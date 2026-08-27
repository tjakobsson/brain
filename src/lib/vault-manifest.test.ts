import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createVaultManifest } from "./vault-manifest";

let root: string;
let vault: string;

function write(relative: string, content = relative): void {
  const file = path.join(vault, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function inventory(directory: string): string[] {
  const entries: string[] = [];
  function walk(current: string, relative = ""): void {
    for (const name of fs.readdirSync(current).sort()) {
      const file = path.join(current, name);
      const child = path.join(relative, name);
      const stat = fs.lstatSync(file);
      entries.push(`${child}:${stat.mode}:${stat.isSymbolicLink() ? fs.readlinkSync(file) : ""}`);
      if (stat.isDirectory()) walk(file, child);
    }
  }
  walk(directory);
  return entries;
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "vault-manifest-"));
  vault = path.join(root, "vault");
  fs.mkdirSync(vault);
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("createVaultManifest", () => {
  it("sorts visible files after applying every exclusion and symlink boundary", () => {
    write("Z note.md");
    write("A note.md");
    write("assets/café.png");
    write("Templates are useful.md");
    write(".hidden/Hidden.md");
    write("nested/.hidden/Hidden.md");
    write(".hidden-file.md");
    write(".obsidian/Plugin note.md");
    write(".github/Workflow note.md");
    write("Templates/Template.md");
    write("nested/Templates/Nested.md");
    write("generated-site/Old output.md");
    write("generated-site-copy/Keep.md");
    write("Private/Excluded.md");
    write("Cycle/Inside.md");

    const outside = path.join(root, "outside");
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, "Secret.md"), "secret");
    fs.symlinkSync(path.join(outside, "Secret.md"), path.join(vault, "Escaping file.md"));
    fs.symlinkSync(outside, path.join(vault, "Escaping directory"));
    fs.symlinkSync(path.join(vault, ".hidden", "Hidden.md"), path.join(vault, "Hidden alias.md"));
    fs.symlinkSync(path.join(vault, "A note.md"), path.join(vault, "Allowed alias.md"));
    fs.symlinkSync(path.join(vault, "Cycle"), path.join(vault, "Cycle", "loop"));

    const before = inventory(vault);
    const manifest = createVaultManifest({
      vaultDir: vault,
      outputDir: path.join(vault, "generated-site"),
      exclusions: ["Private/**"],
    });
    const paths = manifest.entries.map((entry) => entry.path);

    expect(paths).toEqual([
      "A note.md",
      "Allowed alias.md",
      "Cycle/Inside.md",
      "Templates are useful.md",
      "Z note.md",
      "assets/café.png",
      "generated-site-copy/Keep.md",
    ]);
    expect(paths).toEqual([...paths].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
    expect(manifest.entries.map((entry) => entry.kind)).toEqual([
      "markdown",
      "markdown",
      "markdown",
      "markdown",
      "markdown",
      "file",
      "markdown",
    ]);
    expect(paths.every((entry) => !path.isAbsolute(entry) && !entry.includes("\\"))).toBe(true);
    expect(inventory(vault)).toEqual(before);
  });

  it("uses manifest order and excludes duplicate titles before link indexing", async () => {
    write("B/Visible.md", "Links [[Hidden]].");
    write("A/First.md");
    write("Private/Visible.md", "duplicate excluded");
    write("Private/Hidden.md");

    const { buildLinkIndex } = await import("./vault-scan");
    const manifest = createVaultManifest({
      vaultDir: vault,
      outputDir: path.join(root, "site"),
      exclusions: ["Private/**"],
    });
    const index = buildLinkIndex(manifest);

    expect(index.notes.map((note) => note.vaultPath)).toEqual(["A/First.md", "B/Visible.md"]);
    expect(index.unresolved).toMatchObject([{ target: "Hidden" }]);
    expect(index.edges).toEqual([]);
  });
});
