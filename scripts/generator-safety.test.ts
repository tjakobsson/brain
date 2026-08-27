import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  GeneratorValidationError,
  validateGeneratorInputs,
} from "./generator-safety.mjs";

let root: string;
let vault: string;
let output: string;

function inputs(overrides: Record<string, unknown> = {}) {
  return {
    command: "build",
    vault,
    output,
    site: undefined,
    base: "",
    exclusions: [],
    strictLinks: false,
    ...overrides,
  };
}

async function snapshot(directory: string) {
  const result: Array<[string, string]> = [];

  async function visit(current: string, relative = "") {
    const entries = await fs.readdir(current, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const entryRelative = path.join(relative, entry.name);
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        result.push([`${entryRelative}/`, "directory"]);
        await visit(entryPath, entryRelative);
      } else if (entry.isFile()) {
        result.push([entryRelative, await fs.readFile(entryPath, "utf8")]);
      } else {
        result.push([entryRelative, "other"]);
      }
    }
  }

  await visit(directory);
  return result;
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "brain-safety-"));
  vault = path.join(root, "vault");
  output = path.join(root, "site");
  await fs.mkdir(vault);
  await fs.writeFile(path.join(vault, "Note.md"), "A note\n");
});

afterEach(async () => {
  await fs.chmod(root, 0o700).catch(() => {});
  await fs.chmod(vault, 0o700).catch(() => {});
  await fs.chmod(output, 0o700).catch(() => {});
  await fs.rm(root, { recursive: true, force: true });
});

describe("validateGeneratorInputs", () => {
  it("canonicalizes vault and prospective output paths through symlinked ancestors", async () => {
    const realParent = path.join(root, "real-parent");
    const linkedParent = path.join(root, "linked-parent");
    const linkedVault = path.join(root, "linked-vault");
    await fs.mkdir(realParent);
    await fs.symlink(realParent, linkedParent);
    await fs.symlink(vault, linkedVault);

    const result = await validateGeneratorInputs(
      inputs({ vault: linkedVault, output: path.join(linkedParent, "nested", "site") }),
    );

    expect(result.vault).toBe(await fs.realpath(vault));
    expect(result.output).toBe(path.join(await fs.realpath(realParent), "nested", "site"));
    await expect(fs.stat(result.output)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("accepts a readable, read-only vault without changing it", async () => {
    const before = await snapshot(vault);
    await fs.chmod(vault, 0o555);

    await expect(validateGeneratorInputs(inputs())).resolves.toMatchObject({
      vault: await fs.realpath(vault),
      output: path.join(await fs.realpath(root), "site"),
    });
    expect(await snapshot(vault)).toEqual(before);
  });

  it("rejects missing, non-directory, and empty vaults", async () => {
    const empty = path.join(root, "empty");
    const file = path.join(root, "vault.txt");
    await fs.mkdir(empty);
    await fs.writeFile(file, "not a directory");

    await expect(validateGeneratorInputs(inputs({ vault: path.join(root, "missing") }))).rejects.toThrow(
      "Vault is not a readable directory",
    );
    await expect(validateGeneratorInputs(inputs({ vault: file }))).rejects.toThrow("Vault is not a directory");
    await expect(validateGeneratorInputs(inputs({ vault: empty }))).rejects.toThrow(
      "contains no publishable Markdown notes",
    );
  });

  it("does not count notes in default-excluded directories", async () => {
    const empty = path.join(root, "excluded-only");
    await fs.mkdir(path.join(empty, ".obsidian"), { recursive: true });
    await fs.mkdir(path.join(empty, "Templates"));
    await fs.writeFile(path.join(empty, ".obsidian", "Private.md"), "private");
    await fs.writeFile(path.join(empty, "Templates", "Template.md"), "template");

    await expect(validateGeneratorInputs(inputs({ vault: empty }))).rejects.toThrow(
      "contains no publishable Markdown notes",
    );
  });

  it.each([
    ["the vault itself", () => vault],
    ["an ancestor of the vault", () => root],
    ["inside the vault", () => path.join(vault, "generated")],
  ])("rejects output at %s", async (_label, getOutput) => {
    const before = await snapshot(root);

    await expect(validateGeneratorInputs(inputs({ output: getOutput() }))).rejects.toThrow(
      GeneratorValidationError,
    );
    expect(await snapshot(root)).toEqual(before);
  });

  it("rejects an existing output file without modifying vault or output", async () => {
    await fs.writeFile(output, "existing output");
    const before = await snapshot(root);

    await expect(validateGeneratorInputs(inputs())).rejects.toThrow("Output path is not a directory");
    expect(await snapshot(root)).toEqual(before);
  });

  it("rejects an unwritable existing output without modifying prior content", async () => {
    await fs.mkdir(output);
    await fs.writeFile(path.join(output, "sentinel.txt"), "keep me");
    const before = await snapshot(root);
    await fs.chmod(output, 0o555);

    await expect(validateGeneratorInputs(inputs())).rejects.toThrow("Output directory is not writable");
    expect(await snapshot(root)).toEqual(before);
  });

  it("rejects an unwritable output parent without creating output", async () => {
    const parent = path.join(root, "read-only-parent");
    output = path.join(parent, "site");
    await fs.mkdir(parent);
    await fs.chmod(parent, 0o555);

    await expect(validateGeneratorInputs(inputs())).rejects.toThrow("Output parent is not writable");
    await expect(fs.stat(output)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
