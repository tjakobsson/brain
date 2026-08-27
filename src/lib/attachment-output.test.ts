import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { copyResolvedAttachments } from "./attachment-output";
import { resolveAttachments } from "./attachment-resolution";
import { buildLinkIndex } from "./vault-scan";
import { createVaultManifest } from "./vault-manifest";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => fs.rmSync(root, { recursive: true, force: true })));

describe("copyResolvedAttachments", () => {
  it("resolves the public demo attachments", () => {
    const vault = path.resolve("examples/demo-vault");
    const manifest = createVaultManifest({ vaultDir: vault, outputDir: path.resolve("dist") });
    const attachments = resolveAttachments(buildLinkIndex(manifest), manifest);
    expect([...new Set(attachments.map((attachment) => attachment.entry.path))].sort()).toEqual(
      ["media/diagram.svg", "media/reference.txt"],
    );
  });

  it("copies only referenced files with vault-relative structure", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "attachment-output-"));
    roots.push(root);
    const vault = path.join(root, "vault");
    const output = path.join(root, "site");
    fs.mkdirSync(path.join(vault, "Media"), { recursive: true });
    fs.writeFileSync(path.join(vault, "Note.md"), "![image](<Media/über image.png>)");
    fs.writeFileSync(path.join(vault, "Media", "über image.png"), "image");
    fs.writeFileSync(path.join(vault, "Media", "unreferenced.txt"), "sentinel");

    const manifest = createVaultManifest({ vaultDir: vault, outputDir: output });
    const attachments = resolveAttachments(buildLinkIndex(manifest), manifest);
    copyResolvedAttachments(attachments, output);

    expect(fs.readFileSync(path.join(output, "vault-assets", "Media", "über image.png"), "utf8"))
      .toBe("image");
    expect(fs.existsSync(path.join(output, "vault-assets", "Media", "unreferenced.txt"))).toBe(false);
  });
});
