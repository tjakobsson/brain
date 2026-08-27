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
    await controller.activate(second);
    expect(await (await fetch(`http://127.0.0.1:${port}/`)).text()).toContain("second");
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
