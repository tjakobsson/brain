import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

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

async function waitFor(check: () => Promise<boolean> | boolean, message: string, timeout = 120_000) {
  const deadline = Date.now() + timeout;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error(message);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

afterEach(async () => {
  await Promise.all(
    children.splice(0).map(
      (child) =>
        new Promise<void>((resolve) => {
          if (child.exitCode !== null || child.signalCode !== null) return resolve();
          child.once("exit", () => resolve());
          child.kill("SIGTERM");
        }),
    ),
  );
});

describe("stress vault live serving", () => {
  it("serves throughout one serialized 2,000-note rebuild without idle rebuilds", async () => {
    const generated = spawnSync(process.execPath, [path.resolve("scripts/generate-stress-vault.mjs")], {
      encoding: "utf8",
    });
    expect(generated.status, generated.stderr).toBe(0);
    const vault = path.resolve(".generated/stress-vault");
    const note = path.join(vault, "cluster-01", "Generated note 0001.md");
    const original = fs.readFileSync(note, "utf8");
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "brain-stress-live-"));
    const port = await availablePort();
    const child = spawn(
      process.execPath,
      [
        generator,
        "serve",
        "--vault",
        vault,
        "--output",
        path.join(root, "site"),
        "--host",
        "127.0.0.1",
        "--port",
        String(port),
        "--strict-links",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    children.push(child);
    let logs = "";
    child.stdout.on("data", (chunk) => (logs += String(chunk)));
    child.stderr.on("data", (chunk) => (logs += String(chunk)));

    try {
      await waitFor(() => logs.includes("Live server:"), `stress server did not start:\n${logs}`);
      const url = `http://127.0.0.1:${port}/notes/generated-note-0001/`;
      expect((await fetch(url)).status).toBe(200);
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      expect(logs).not.toContain("Live site updated.");

      const started = Date.now();
      fs.appendFileSync(note, "\nUnique live stress phrase.\n");
      let successfulRequests = 0;
      await waitFor(async () => {
        const response = await fetch(url);
        expect(response.status).toBe(200);
        successfulRequests += 1;
        return (await response.text()).includes("Unique live stress phrase.");
      }, `stress rebuild did not complete:\n${logs}`);
      expect(successfulRequests).toBeGreaterThan(1);
      expect(Date.now() - started).toBeLessThan(120_000);
      expect(logs.split("Live site updated.").length - 1).toBe(1);

      fs.writeFileSync(note, original);
      await waitFor(async () => !(await (await fetch(url)).text()).includes("Unique live stress phrase."), "stress vault did not restore");
      child.kill("SIGTERM");
      await new Promise<void>((resolve) => child.once("exit", () => resolve()));
      expect(fs.readdirSync(root).some((entry) => entry.includes(".generation-"))).toBe(false);
    } finally {
      fs.writeFileSync(note, original);
      fs.rmSync(root, { recursive: true, force: true });
    }
  }, 180_000);
});
