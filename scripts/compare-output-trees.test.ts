import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const roots: string[] = [];

function tree(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brain-output-tree-"));
  roots.push(root);
  fs.mkdirSync(path.join(root, "notes", "welcome"), { recursive: true });
  fs.writeFileSync(path.join(root, "index.html"), "same site");
  fs.writeFileSync(path.join(root, "notes", "welcome", "index.html"), "same note");
  fs.writeFileSync(path.join(root, "search-index.json"), "[]");
  return root;
}

function compare(...args: string[]) {
  return spawnSync(process.execPath, ["scripts/compare-output-trees.mjs", ...args], {
    encoding: "utf8",
  });
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("generated output comparison", () => {
  it("compares generated file inventories and contents directly", () => {
    const first = tree();
    const second = tree();

    expect(compare(first, second).status).toBe(0);

    fs.writeFileSync(path.join(second, "index.html"), "different site");
    expect(compare(first, second).status).not.toBe(0);
  });
});
