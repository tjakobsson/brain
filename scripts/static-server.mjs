import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".wasm", "application/wasm"],
]);

function reloadScript(endpoint) {
  return `<script>(()=>{const events=new EventSource(${JSON.stringify(endpoint)});events.addEventListener("reload",()=>location.reload());})();</script>`;
}

export function createGenerationRegistry(output, onRetire) {
  const generations = new Map();
  let active = output;

  function generation(root) {
    let state = generations.get(root);
    if (!state) {
      state = { references: 0, retired: false };
      generations.set(root, state);
    }
    return state;
  }

  function retire(root) {
    const state = generation(root);
    state.retired = true;
    if (state.references === 0) {
      generations.delete(root);
      return onRetire?.(root);
    }
  }

  generation(active);
  return {
    acquire() {
      const root = active;
      const state = generation(root);
      state.references += 1;
      let released = false;
      return {
        root,
        release() {
          if (released) return;
          released = true;
          state.references -= 1;
          if (state.retired && state.references === 0) {
            generations.delete(root);
            void onRetire?.(root);
          }
        },
      };
    },
    activate(nextOutput) {
      if (nextOutput === active) return;
      const previous = active;
      active = nextOutput;
      generation(active);
      return retire(previous);
    },
  };
}

export function serveStaticSite({ output, base = "", host, port, liveReload = false, onRetire }) {
  const prefix = base || "";
  const reloadEndpoint = `${prefix}/__brain_reload`;
  const clients = new Set();
  const registry = createGenerationRegistry(output, onRetire);
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://${host}:${port}`);
      if (liveReload && url.pathname === reloadEndpoint) {
        response.writeHead(200, {
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "Content-Type": "text/event-stream",
        });
        response.write(": connected\n\n");
        clients.add(response);
        request.once("close", () => clients.delete(response));
        return;
      }
      if (prefix && url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`)) {
        response.writeHead(404).end("Not found");
        return;
      }
      const relative = decodeURIComponent(url.pathname.slice(prefix.length)) || "/";
      const acquired = registry.acquire();
      const root = acquired.root;
      response.once("finish", acquired.release);
      response.once("close", acquired.release);
      let filePath = path.resolve(root, `.${relative}`);
      if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
        response.writeHead(400).end("Invalid path");
        return;
      }
      if ((await fs.stat(filePath)).isDirectory()) filePath = path.join(filePath, "index.html");
      let body = await fs.readFile(filePath);
      const html = path.extname(filePath) === ".html";
      if (liveReload && html && request.method !== "HEAD") {
        const text = body.toString("utf8");
        const script = reloadScript(reloadEndpoint);
        body = Buffer.from(
          text.includes("</body>") ? text.replace("</body>", `${script}</body>`) : `${text}${script}`,
        );
      }
      response.writeHead(200, {
        ...(liveReload && html ? { "Cache-Control": "no-store" } : {}),
        "Content-Type": contentTypes.get(path.extname(filePath)) ?? "application/octet-stream",
      });
      response.end(request.method === "HEAD" ? undefined : body);
    } catch (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500).end("Not found");
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () =>
      resolve({
        server,
        activate: registry.activate,
        reload() {
          for (const client of clients) client.write("event: reload\ndata: ready\n\n");
        },
        close() {
          for (const client of clients) client.end();
          clients.clear();
          return new Promise((closeResolve, closeReject) => {
            server.close((error) => (error ? closeReject(error) : closeResolve()));
          });
        },
      }),
    );
  });
}
