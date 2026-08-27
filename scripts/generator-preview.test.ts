import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let root: string;
let vault: string;
let output: string;
const children: ReturnType<typeof spawn>[] = [];
const generator = path.resolve("scripts/generator.mjs");

async function availablePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "generator-preview-"));
  vault = path.join(root, "vault");
  output = path.join(root, "site");
  fs.mkdirSync(vault);
  fs.writeFileSync(path.join(vault, "Note.md"), "Preview note.\n");
});

afterEach(() => {
  children.splice(0).forEach((child) => child.kill("SIGTERM"));
  fs.rmSync(root, { recursive: true, force: true });
});

describe("generator preview command", () => {
  it("builds and serves the site and graph at the configured address", async () => {
    const port = await availablePort();
    const child = spawn(
      process.execPath,
      [
        generator,
        "preview",
        "--vault",
        vault,
        "--output",
        output,
        "--base",
        "/vault-repo",
        "--host",
        "127.0.0.1",
        "--port",
        String(port),
      ],
      { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
    );
    children.push(child);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("preview did not start")), 30_000);
      child.stdout.on("data", (chunk) => {
        if (String(chunk).includes("Preview server:")) {
          clearTimeout(timer);
          resolve();
        }
      });
      child.once("exit", (code) => reject(new Error(`preview exited ${code}`)));
    });

    const page = await fetch(`http://127.0.0.1:${port}/vault-repo/`);
    const graph = await fetch(`http://127.0.0.1:${port}/vault-repo/graph-data.json`);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("<title>Graph</title>");
    expect(graph.status).toBe(200);
    expect(await graph.json()).toMatchObject({ nodes: [{ title: "Note" }] });
  }, 40_000);

  it("does not serve stale output when vault validation fails", async () => {
    const port = await availablePort();
    const child = spawn(
      process.execPath,
      [generator, "preview", "--vault", path.join(root, "missing"), "--output", output, "--port", String(port)],
      { cwd: root, stdio: "ignore" },
    );
    children.push(child);
    const code = await new Promise<number | null>((resolve) => child.once("exit", resolve));
    expect(code).not.toBe(0);
    await expect(fetch(`http://127.0.0.1:${port}/`)).rejects.toThrow();
  });
});
