import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildLiveGeneration, buildSite, runNode } from "./generator.mjs";

let temporary: string;

function hashes(directory: string): Array<[string, string]> {
  return fs
    .readdirSync(directory, { recursive: true, encoding: "utf8" })
    .filter((entry) => fs.statSync(path.join(directory, entry)).isFile())
    .sort()
    .map((entry) => [
      entry,
      crypto.createHash("sha256").update(fs.readFileSync(path.join(directory, entry))).digest("hex"),
    ]);
}

async function waitForFile(file: string) {
  const deadline = Date.now() + 5_000;
  while (!fs.existsSync(file)) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${file}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

beforeEach(() => {
  temporary = fs.mkdtempSync(path.join(os.tmpdir(), "brain-process-"));
});

afterEach(() => fs.rmSync(temporary, { recursive: true, force: true }));

describe("generator child processes", () => {
  it("reports non-zero exits", async () => {
    const script = path.join(temporary, "fail.mjs");
    fs.writeFileSync(script, "process.exit(7);\n");
    await expect(runNode(script, [], process.env, { stdio: "ignore" })).rejects.toThrow(
      "exit code 7",
    );
  });

  it("terminates an active stage when aborted", async () => {
    const marker = path.join(temporary, "started");
    const script = path.join(temporary, "wait.mjs");
    fs.writeFileSync(
      script,
      `import fs from "node:fs"; fs.writeFileSync(${JSON.stringify(marker)}, "ready"); setInterval(() => {}, 1000);\n`,
    );
    const controller = new AbortController();
    const running = runNode(script, [], process.env, {
      signal: controller.signal,
      stdio: "ignore",
    });
    await waitForFile(marker);
    controller.abort();
    await expect(running).rejects.toThrow("aborted");
  });
});

describe("live generation", () => {
  it("matches normal production output without promoting the live root", async () => {
    const vault = path.resolve("examples/demo-vault");
    const output = path.join(temporary, "build");
    const inputs = {
      command: "build",
      vault,
      output,
      site: "https://example.com",
      base: "",
      exclusions: [],
      strictLinks: false,
    };
    await buildSite(inputs);
    const live = await buildLiveGeneration({
      ...inputs,
      command: "serve",
      output: path.join(temporary, "live"),
      host: "localhost",
      port: 4321,
    });

    expect(hashes(live.output)).toEqual(hashes(output));
    expect(fs.existsSync(path.join(temporary, "live"))).toBe(false);
    fs.rmSync(live.output, { recursive: true, force: true });
  }, 30_000);
});
