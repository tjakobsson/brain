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
const compareOutputTrees = path.resolve("scripts/compare-output-trees.mjs");
const packageMetadata = JSON.parse(fs.readFileSync(path.resolve("package.json"), "utf8"));

function expectGeneratorMetadata(directory: string): void {
  const htmlFiles = fs
    .readdirSync(directory, { recursive: true, encoding: "utf8" })
    .filter((entry) => entry.endsWith(".html"));
  expect(htmlFiles.length).toBeGreaterThan(0);
  for (const entry of htmlFiles) {
    const html = fs.readFileSync(path.join(directory, entry), "utf8");
    expect(html.match(/<meta name="generator"/gu), entry).toHaveLength(1);
    expect(html, entry).toContain(`content="Brain v${packageMetadata.version}"`);
  }
}

describe("generator command metadata", () => {
  it("prints the package version", () => {
    const result = spawnSync(process.execPath, [generator, "--version"], { encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe(packageMetadata.version);
  });
});

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

function runWorkspace(destination: string) {
  return spawnSync(
    process.execPath,
    [
      generator,
      "build",
      "--workspace",
      path.resolve("examples/demo-workspace/workspace.json"),
      "--output",
      destination,
      "--site",
      "https://example.com",
    ],
    { cwd: root, env: process.env, encoding: "utf8" },
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

  it("generates the Astro site before promoting output", () => {
    const vaultBefore = hashes(vault);
    const result = run();
    expect(result.status, result.stderr).toBe(0);
    expect(fs.existsSync(path.join(output, "notes", "welcome", "index.html"))).toBe(true);
    expect(fs.existsSync(path.join(output, "search-index.json"))).toBe(true);
    expect(fs.existsSync(path.join(output, "404.html"))).toBe(true);
    expect(fs.existsSync(path.join(output, "search", "index.html"))).toBe(false);
    expect(fs.existsSync(path.join(output, "pagefind"))).toBe(false);
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
    expectGeneratorMetadata(output);
    expect(hashes(vault)).toEqual(vaultBefore);
  }, 30_000);

  it("keeps prior output intact after a forced late failure", () => {
    fs.mkdirSync(output);
    fs.writeFileSync(path.join(output, "sentinel.txt"), "previous output");

    const result = run({ BRAIN_TEST_FAIL_AFTER_BUILD: "true" });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Forced late-stage failure");
    expect(fs.readdirSync(output)).toEqual(["sentinel.txt"]);
    expect(fs.readFileSync(path.join(output, "sentinel.txt"), "utf8")).toBe("previous output");
    expect(fs.readdirSync(root).some((entry) => entry.includes(".staging-"))).toBe(false);
  }, 30_000);

  it("rejects a work directory inside the vault before writing", () => {
    const vaultBefore = hashes(vault);
    const result = run({ BRAIN_WORK: path.join(vault, "generated-work") });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("work must be outside the read-only vault");
    expect(hashes(vault)).toEqual(vaultBefore);
    expect(fs.existsSync(path.join(vault, "generated-work"))).toBe(false);
  });

  it("produces identical inventories and hashes across clean builds", () => {
    const first = output;
    expect(run().status).toBe(0);
    output = path.join(root, "site-again");
    expect(run().status).toBe(0);
    expect(hashes(output)).toEqual(hashes(first));
  }, 30_000);

  it("produces deterministic workspace content without leaking source paths", () => {
    const first = path.join(root, "workspace-site");
    const second = path.join(root, "workspace-site-again");
    const firstBuild = runWorkspace(first);
    const secondBuild = runWorkspace(second);

    expect(firstBuild.status, firstBuild.stderr).toBe(0);
    expect(secondBuild.status, secondBuild.stderr).toBe(0);
    expect(fs.existsSync(path.join(first, "brains", "engineering", "notes", "principles", "index.html"))).toBe(true);
    expect(fs.existsSync(path.join(first, "brains", "design", "notes", "principles", "index.html"))).toBe(true);
    expect(fs.existsSync(path.join(first, "brains", "engineering", "search", "index.html"))).toBe(false);
    expect(fs.existsSync(path.join(first, "search", "index.html"))).toBe(false);
    expect(fs.existsSync(path.join(first, "404.html"))).toBe(true);
    expect(fs.existsSync(path.join(first, "pagefind"))).toBe(false);

    const comparison = spawnSync(
      process.execPath,
      [compareOutputTrees, first, second],
      { encoding: "utf8" },
    );
    expect(comparison.status, comparison.stderr).toBe(0);

    const generatedText = fs
      .readdirSync(first, { recursive: true, encoding: "utf8" })
      .filter((entry) => /\.(?:html|js|json|css)$/u.test(entry))
      .map((entry) => fs.readFileSync(path.join(first, entry), "utf8"))
      .join("\n");
    expect(generatedText).not.toContain(path.resolve("examples/demo-workspace"));
    expect(generatedText).not.toContain(root);
    expect(generatedText).not.toContain(".staging-");
    expectGeneratorMetadata(first);
  }, 60_000);
});
