import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveAttachments } from "./attachment-resolution";
import { buildLinkIndex } from "./vault-scan";
import { buildWorkspaceLinkIndex } from "./vault-scan";
import { createVaultManifest } from "./vault-manifest";

let root: string;
let vault: string;

function write(relative: string, content = relative): void {
  const file = path.join(vault, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function resolve(exclusions: string[] = []) {
  const manifest = createVaultManifest({
    vaultDir: vault,
    outputDir: path.join(root, "site"),
    exclusions,
  });
  return resolveAttachments(buildLinkIndex(manifest), manifest);
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "attachment-resolution-"));
  vault = path.join(root, "vault");
  fs.mkdirSync(vault);
});

afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe("resolveAttachments", () => {
  it("prefers exact relative and vault-root paths", () => {
    write("Notes/Source.md", "![local](../Media/image.png) [root](/Other/image.png)");
    write("Media/image.png");
    write("Other/image.png");

    expect(resolve().map((item) => item.entry.path)).toEqual([
      "Media/image.png",
      "Other/image.png",
    ]);
  });

  it("resolves a filename-only Brain embed when unique", () => {
    write("Source.md", "![[über diagram.png|preview]]");
    write("Media/über diagram.png");
    expect(resolve()[0].entry.path).toBe("Media/über diagram.png");
  });

  it("lists every conflicting path for an ambiguous filename", () => {
    write("Source.md", "![[diagram.png]]");
    write("A/diagram.png");
    write("B/diagram.png");
    expect(() => resolve()).toThrow(/Source\.md: !\[\[diagram\.png\]\].*A\/diagram\.png, B\/diagram\.png/);
  });

  it("distinguishes missing, excluded, and outside-vault targets", () => {
    write(
      "Source.md",
      "![missing](missing.pdf)\n![excluded](Private/secret.pdf)\n![outside](../../outside.pdf)",
    );
    write("Private/secret.pdf");
    fs.writeFileSync(path.join(root, "outside.pdf"), "outside");

    expect(() => resolve(["Private/**"])).toThrow(/missing\.pdf\) is missing/);
    expect(() => resolve(["Private/**"])).toThrow(/Private\/secret\.pdf\) is excluded/);
    expect(() => resolve(["Private/**"])).toThrow(/outside\.pdf\) is outside the vault/);
  });

  it("rejects an attachment symlink that escapes the vault", () => {
    write("Source.md", "![secret](secret.pdf)");
    const outside = path.join(root, "secret.pdf");
    fs.writeFileSync(outside, "secret");
    fs.symlinkSync(outside, path.join(vault, "secret.pdf"));
    expect(() => resolve()).toThrow(/secret\.pdf\) is outside the vault/);
  });

  it("isolates equal filenames by owning brain and namespaces workspace output", () => {
    const design = path.join(root, "design");
    fs.renameSync(vault, path.join(root, "engineering"));
    vault = path.join(root, "engineering");
    fs.mkdirSync(design);
    write("Source.md", "![[diagram.png]]");
    write("media/diagram.png", "engineering");
    fs.writeFileSync(path.join(design, "Source.md"), "![[diagram.png]]");
    fs.mkdirSync(path.join(design, "media"));
    fs.writeFileSync(path.join(design, "media", "diagram.png"), "design");

    const engineeringManifest = createVaultManifest({
      vaultDir: vault,
      outputDir: path.join(root, "site"),
    });
    const designManifest = createVaultManifest({
      vaultDir: design,
      outputDir: path.join(root, "site"),
    });
    const index = buildWorkspaceLinkIndex([
      { brainId: "engineering", manifest: engineeringManifest },
      { brainId: "design", manifest: designManifest },
    ]);

    const engineering = resolveAttachments(index, engineeringManifest, {
      mode: "workspace",
      brainId: "engineering",
    });
    const designAttachments = resolveAttachments(index, designManifest, {
      mode: "workspace",
      brainId: "design",
    });
    expect(engineering[0]).toMatchObject({
      brainId: "engineering",
      route: "/brains/engineering/assets/media/diagram.png",
      outputPath: "brains/engineering/assets/media/diagram.png",
    });
    expect(designAttachments[0]).toMatchObject({
      brainId: "design",
      route: "/brains/design/assets/media/diagram.png",
      outputPath: "brains/design/assets/media/diagram.png",
    });
  });
});
