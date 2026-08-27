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

export function serveStaticSite({ output, base = "", host, port }) {
  const prefix = base || "";
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://${host}:${port}`);
      if (prefix && url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`)) {
        response.writeHead(404).end("Not found");
        return;
      }
      const relative = decodeURIComponent(url.pathname.slice(prefix.length)) || "/";
      let filePath = path.resolve(output, `.${relative}`);
      if (filePath !== output && !filePath.startsWith(`${output}${path.sep}`)) {
        response.writeHead(400).end("Invalid path");
        return;
      }
      if ((await fs.stat(filePath)).isDirectory()) filePath = path.join(filePath, "index.html");
      const body = await fs.readFile(filePath);
      response.writeHead(200, {
        "Content-Type": contentTypes.get(path.extname(filePath)) ?? "application/octet-stream",
      });
      response.end(request.method === "HEAD" ? undefined : body);
    } catch (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500).end("Not found");
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve(server));
  });
}
