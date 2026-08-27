import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let root: string;
let vault: string;
let output: string;
const generator = path.resolve("scripts/generator.mjs");

function run(extraEnv: NodeJS.ProcessEnv = {}) {
  return spawnSync(
    process.execPath,
    [generator, "build", "--vault", vault, "--output", output, "--site", "https://example.com"],
    {
      cwd: root,
      env: { ...process.env, ...extraEnv },
      encoding: "utf8",
    },
  );
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "generator-command-"));
  vault = path.resolve("examples/demo-vault");
  output = path.join(root, "site");
});

afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe("generator build command", () => {
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

  it("runs generation and Pagefind before promoting output", () => {
    const vaultBefore = hashes(vault);
    const result = run();
    expect(result.status, result.stderr).toBe(0);
    expect(fs.existsSync(path.join(output, "notes", "welcome", "index.html"))).toBe(true);
    expect(fs.existsSync(path.join(output, "pagefind", "pagefind.js"))).toBe(true);
    expect(fs.existsSync(path.join(output, "vault-assets", "media", "diagram.svg"))).toBe(true);
    expect(fs.existsSync(path.join(output, "vault-assets", "media", "reference.txt"))).toBe(true);
    expect(fs.existsSync(path.join(output, "vault-assets", "media", "unreferenced.txt"))).toBe(
      false,
    );

    const generatedText = fs
      .readdirSync(output, { recursive: true, encoding: "utf8" })
      .filter((entry) => /\.(?:html|js|json|css)$/u.test(entry))
      .map((entry) => fs.readFileSync(path.join(output, entry), "utf8"))
      .join("\n");
    expect(generatedText).not.toContain(".staging-");
    expect(hashes(vault)).toEqual(vaultBefore);
  }, 30_000);

  it("keeps prior output intact after a forced late failure", () => {
    fs.mkdirSync(output);
    fs.writeFileSync(path.join(output, "sentinel.txt"), "previous output");

    const result = run({ BRAIN_MANUAL_TEST_FAIL_AFTER_PAGEFIND: "true" });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Forced late-stage failure");
    expect(fs.readdirSync(output)).toEqual(["sentinel.txt"]);
    expect(fs.readFileSync(path.join(output, "sentinel.txt"), "utf8")).toBe("previous output");
    expect(fs.readdirSync(root).some((entry) => entry.includes(".staging-"))).toBe(false);
  }, 30_000);

  it("produces identical inventories and hashes across clean builds", () => {
    const first = output;
    expect(run().status).toBe(0);
    output = path.join(root, "site-again");
    expect(run().status).toBe(0);
    expect(hashes(output)).toEqual(hashes(first));
  }, 30_000);
});
