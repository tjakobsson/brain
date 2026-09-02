import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createGenerationRegistry, serveStaticSite } from "./static-server.mjs";

let root: string;
const controllers: Array<Awaited<ReturnType<typeof serveStaticSite>>> = [];

async function availablePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

function generation(name: string, body: string) {
  const directory = path.join(root, name);
  fs.mkdirSync(directory);
  fs.writeFileSync(path.join(directory, "index.html"), `<html><body>${body}</body></html>`);
  return directory;
}

function writeFallback(directory: string, body: string) {
  fs.writeFileSync(path.join(directory, "404.html"), `<html><body>${body}</body></html>`);
}

async function startServer(output: string, options: { base?: string; liveReload?: boolean } = {}) {
  const port = await availablePort();
  const controller = await serveStaticSite({
    output,
    host: "127.0.0.1",
    port,
    ...options,
  });
  controllers.push(controller);
  return { controller, origin: `http://127.0.0.1:${port}` };
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "brain-static-"));
});

afterEach(async () => {
  await Promise.all(controllers.splice(0).map((controller) => controller.close()));
  fs.rmSync(root, { recursive: true, force: true });
});

describe("static server generations", () => {
  it("retains an acquired root until its request releases it", () => {
    const retired: string[] = [];
    const registry = createGenerationRegistry("first", (output: string) => retired.push(output));
    const request = registry.acquire();
    registry.activate("second");
    expect(request.root).toBe("first");
    expect(retired).toEqual([]);
    request.release();
    expect(retired).toEqual(["first"]);
  });

  it("switches complete roots and retires the prior root", async () => {
    const first = generation("first", "first");
    const second = generation("second", "second");
    writeFallback(first, "first missing");
    writeFallback(second, "second missing");
    const retired: string[] = [];
    const port = await availablePort();
    const controller = await serveStaticSite({
      output: first,
      host: "127.0.0.1",
      port,
      onRetire: (output: string) => retired.push(output),
    });
    controllers.push(controller);

    expect(await (await fetch(`http://127.0.0.1:${port}/`)).text()).toContain("first");
    expect(
      await (
        await fetch(`http://127.0.0.1:${port}/missing`, {
          headers: { Accept: "text/html" },
        })
      ).text(),
    ).toContain("first missing");
    await controller.activate(second);
    expect(await (await fetch(`http://127.0.0.1:${port}/`)).text()).toContain("second");
    expect(
      await (
        await fetch(`http://127.0.0.1:${port}/missing`, {
          headers: { Accept: "text/html" },
        })
      ).text(),
    ).toContain("second missing");
    expect(retired).toEqual([first]);
  });

  it("injects base-aware reload only into live responses", async () => {
    const output = generation("live", "live");
    const original = fs.readFileSync(path.join(output, "index.html"), "utf8");
    const port = await availablePort();
    const controller = await serveStaticSite({
      output,
      base: "/notes",
      host: "127.0.0.1",
      port,
      liveReload: true,
    });
    controllers.push(controller);

    const page = await fetch(`http://127.0.0.1:${port}/notes/`);
    expect(page.headers.get("cache-control")).toBe("no-store");
    expect(await page.text()).toContain('/notes/__brain_reload');
    expect(fs.readFileSync(path.join(output, "index.html"), "utf8")).toBe(original);

    const events = await fetch(`http://127.0.0.1:${port}/notes/__brain_reload`);
    const reader = events.body!.getReader();
    await reader.read();
    controller.reload();
    const event = await reader.read();
    expect(new TextDecoder().decode(event.value)).toContain("event: reload");
    await reader.cancel();
  });

  it("keeps one-shot preview responses free of reload code", async () => {
    const output = generation("preview", "preview");
    const port = await availablePort();
    const controller = await serveStaticSite({ output, host: "127.0.0.1", port });
    controllers.push(controller);
    expect(await (await fetch(`http://127.0.0.1:${port}/`)).text()).not.toContain(
      "__brain_reload",
    );
  });
});

describe("static server 404 fallback", () => {
  it.each([
    { base: undefined, requestPath: "/missing", headers: { Accept: "text/html" } },
    {
      base: "/notes",
      requestPath: "/notes/missing",
      headers: { "Sec-Fetch-Dest": "document" },
    },
  ])("serves the generated page for an in-base document at $requestPath", async (testCase) => {
    const output = generation(testCase.base ? "subpath" : "root", "home");
    writeFallback(output, "custom missing");
    const { origin } = await startServer(output, { base: testCase.base });
    const requestedUrl = `${origin}${testCase.requestPath}`;

    const response = await fetch(requestedUrl, {
      headers: testCase.headers,
      redirect: "manual",
    });

    expect(response.status).toBe(404);
    expect(response.url).toBe(requestedUrl);
    expect(response.redirected).toBe(false);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("cache-control")).toBeNull();
    const body = await response.text();
    expect(body).toContain("custom missing");
    expect(body).not.toContain("__brain_reload");
  });

  it("leaves existing pages and resources unchanged", async () => {
    const output = generation("existing", "home");
    writeFallback(output, "custom missing");
    fs.mkdirSync(path.join(output, "known"));
    fs.writeFileSync(path.join(output, "known", "index.html"), "<html><body>known</body></html>");
    fs.writeFileSync(path.join(output, "styles.css"), "body { color: black; }");
    const { origin } = await startServer(output);

    const page = await fetch(`${origin}/known/`, { headers: { Accept: "text/html" } });
    const resource = await fetch(`${origin}/styles.css`, {
      headers: { "Sec-Fetch-Dest": "document" },
    });

    expect(page.status).toBe(200);
    expect(await page.text()).toContain("known");
    expect(resource.status).toBe(200);
    expect(resource.headers.get("content-type")).toBe("text/css; charset=utf-8");
    expect(await resource.text()).toBe("body { color: black; }");
  });

  it("does not rewrite an outside-base document request", async () => {
    const output = generation("outside", "home");
    writeFallback(output, "custom missing");
    const { origin } = await startServer(output, { base: "/notes" });

    const response = await fetch(`${origin}/missing`, { headers: { Accept: "text/html" } });

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBeNull();
    expect(await response.text()).toBe("Not found");
  });

  it("does not rewrite a missing resource request", async () => {
    const output = generation("resource", "home");
    writeFallback(output, "custom missing");
    const { origin } = await startServer(output, { base: "/notes" });

    const response = await fetch(`${origin}/notes/missing.css`, {
      headers: { Accept: "text/css,*/*;q=0.1", "Sec-Fetch-Dest": "style" },
    });

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBeNull();
    expect(await response.text()).toBe("Not found");
  });

  it("serves the fallback for a document path nested beneath an existing file", async () => {
    const output = generation("not-a-directory", "home");
    writeFallback(output, "custom missing");
    fs.writeFileSync(path.join(output, "styles.css"), "body {}");
    const { origin } = await startServer(output);

    const response = await fetch(`${origin}/styles.css/missing`, {
      headers: { Accept: "text/html" },
    });

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(await response.text()).toContain("custom missing");
  });

  it("keeps the plain response when the generated fallback is absent", async () => {
    const output = generation("no-fallback", "home");
    const { origin } = await startServer(output);

    const response = await fetch(`${origin}/missing`, { headers: { Accept: "text/html" } });

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBeNull();
    expect(await response.text()).toBe("Not found");
  });

  it("returns fallback headers without a body for HEAD", async () => {
    const output = generation("head", "home");
    writeFallback(output, "custom missing");
    const { origin } = await startServer(output);

    const response = await fetch(`${origin}/missing`, {
      method: "HEAD",
      headers: { Accept: "text/html" },
    });

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(await response.text()).toBe("");
  });

  it("injects reload code and disables caching for a live fallback", async () => {
    const output = generation("live-fallback", "home");
    writeFallback(output, "custom missing");
    const original = fs.readFileSync(path.join(output, "404.html"), "utf8");
    const { origin } = await startServer(output, { base: "/notes", liveReload: true });

    const response = await fetch(`${origin}/notes/missing`, {
      headers: { Accept: "text/html" },
    });

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toContain('/notes/__brain_reload');
    expect(fs.readFileSync(path.join(output, "404.html"), "utf8")).toBe(original);
  });
});
