import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => fs.rmSync(root, { recursive: true, force: true })));

describe("stress vault build", () => {
  it("builds and indexes 2,000 public generated notes", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "stress-build-"));
    roots.push(root);
    const output = path.join(root, "site");
    const generated = spawnSync(process.execPath, [path.resolve("scripts/generate-stress-vault.mjs")], {
      encoding: "utf8",
    });
    expect(generated.status, generated.stderr).toBe(0);

    const build = spawnSync(
      process.execPath,
      [
        path.resolve("scripts/generator.mjs"),
        "build",
        "--vault",
        path.resolve(".generated/stress-vault"),
        "--output",
        output,
        "--site",
        "https://example.com",
        "--base",
        "/stress",
        "--strict-links",
      ],
      { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
    );
    expect(build.status, build.stderr).toBe(0);

    const graph = JSON.parse(fs.readFileSync(path.join(output, "graph-data.json"), "utf8"));
    const search = JSON.parse(fs.readFileSync(path.join(output, "search-index.json"), "utf8"));
    expect(graph.nodes).toHaveLength(2_000);
    expect(search.filter((entry: { kind: string }) => entry.kind === "note")).toHaveLength(2_000);
    expect(fs.existsSync(path.join(output, "notes", "generated-note-0001", "index.html"))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(output, "pagefind", "pagefind.js"))).toBe(true);
  }, 120_000);
});
