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

function isDocumentRequest(request) {
  const accept = request.headers.accept?.toLowerCase() ?? "";
  const destination = request.headers["sec-fetch-dest"];
  return accept.includes("text/html") || destination === "document";
}

function isMissingPathError(error) {
  return error?.code === "ENOENT" || error?.code === "ENOTDIR";
}

function endPlain(response, request, status, message) {
  response.writeHead(status).end(request.method === "HEAD" ? undefined : message);
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
        endPlain(response, request, 404, "Not found");
        return;
      }
      const relative = decodeURIComponent(url.pathname.slice(prefix.length)) || "/";
      const acquired = registry.acquire();
      const root = acquired.root;
      response.once("finish", acquired.release);
      response.once("close", acquired.release);
      let filePath = path.resolve(root, `.${relative}`);
      if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
        endPlain(response, request, 400, "Invalid path");
        return;
      }
      let body;
      let status = 200;
      try {
        if ((await fs.stat(filePath)).isDirectory()) filePath = path.join(filePath, "index.html");
        body = await fs.readFile(filePath);
      } catch (error) {
        if (!isMissingPathError(error) || !isDocumentRequest(request)) throw error;
        try {
          filePath = path.join(root, "404.html");
          body = await fs.readFile(filePath);
          status = 404;
        } catch (fallbackError) {
          if (!isMissingPathError(fallbackError)) throw fallbackError;
          endPlain(response, request, 404, "Not found");
          return;
        }
      }
      const html = path.extname(filePath) === ".html";
      if (liveReload && html && request.method !== "HEAD") {
        const text = body.toString("utf8");
        const script = reloadScript(reloadEndpoint);
        body = Buffer.from(
          text.includes("</body>") ? text.replace("</body>", `${script}</body>`) : `${text}${script}`,
        );
      }
      response.writeHead(status, {
        ...(liveReload && html ? { "Cache-Control": "no-store" } : {}),
        "Content-Type": contentTypes.get(path.extname(filePath)) ?? "application/octet-stream",
      });
      response.end(request.method === "HEAD" ? undefined : body);
    } catch (error) {
      endPlain(response, request, isMissingPathError(error) ? 404 : 500, "Not found");
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
