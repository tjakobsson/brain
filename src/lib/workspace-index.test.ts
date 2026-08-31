import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createVaultManifest } from "./vault-manifest";
import { buildWorkspaceLinkIndex } from "./vault-scan";

let root: string;

function write(brainId: string, name: string, body: string): void {
  const file = path.join(root, brainId, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
}

function build() {
  const brainIds = ["engineering", "design", "research"];
  return buildWorkspaceLinkIndex(
    brainIds.map((brainId) => ({
      brainId,
      manifest: createVaultManifest({
        vaultDir: path.join(root, brainId),
        outputDir: path.join(root, "site"),
      }),
    })),
  );
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "workspace-index-"));
  for (const brainId of ["engineering", "design", "research"]) {
    fs.mkdirSync(path.join(root, brainId));
  }
});

afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe("buildWorkspaceLinkIndex", () => {
  it("keeps equal titles and slugs distinct and resolves local and foreign links", () => {
    write(
      "engineering",
      "Principles.md",
      "Local [[Delivery loops]]. Foreign [[@design/Principles]] twice [[@design/Principles]]. Self [[Principles]].",
    );
    write("engineering", "Delivery loops.md", "Delivery loops are useful.");
    write("design", "Principles.md", "Design principles.");
    write("research", "Evidence.md", "Research evidence.");

    const index = build();
    const principles = index.notes.filter((note) => note.title === "Principles");
    expect(principles.map((note) => note.id)).toEqual([
      "engineering/principles",
      "design/principles",
    ]);
    expect(principles.map((note) => note.route)).toEqual([
      "/brains/engineering/notes/principles",
      "/brains/design/notes/principles",
    ]);
    expect(index.edges).toMatchObject([
      {
        source: "engineering/principles",
        target: "engineering/delivery-loops",
        crossBrain: false,
      },
      {
        source: "engineering/principles",
        target: "design/principles",
        sourceBrainId: "engineering",
        targetBrainId: "design",
        crossBrain: true,
      },
    ]);
    expect(index.edges).toHaveLength(2);
    expect(index.backlinks.get("design/principles")?.[0]).toMatchObject({
      sourceBrainId: "engineering",
      targetBrainId: "design",
      context: expect.stringContaining("Foreign Principles twice Principles"),
    });
  });

  it("separates unknown brains from missing foreign notes", () => {
    write(
      "engineering",
      "Source.md",
      "[[@design/Future interaction]] and [[@missing-brain/Unknown principle]] and [[Local future]].",
    );
    write("design", "Principles.md", "Design.");
    write("research", "Evidence.md", "Evidence.");

    expect(build().unresolved).toMatchObject([
      {
        kind: "missing-note",
        sourceBrainId: "engineering",
        targetBrainId: "design",
        target: "Future interaction",
      },
      {
        kind: "unknown-brain",
        sourceBrainId: "engineering",
        targetBrainId: "missing-brain",
        target: "Unknown principle",
      },
      {
        kind: "missing-note",
        sourceBrainId: "engineering",
        targetBrainId: "engineering",
        target: "Local future",
      },
    ]);
  });

  it("counts foreign inbound links globally and limits unlinked mentions to one brain", () => {
    write("engineering", "Source.md", "Links [[@design/Target]]. Mentions Local target.");
    write("engineering", "Local target.md", "Local.");
    write("design", "Target.md", "Target.");
    write("design", "Foreign prose.md", "Local target is an equal foreign phrase.");
    write("research", "Evidence.md", "Target appears here without a link.");

    const index = build();
    expect(index.orphans.map((note) => note.id)).not.toContain("design/target");
    expect(index.unlinkedMentions.get("engineering/local-target")?.map((note) => note.id)).toEqual([
      "engineering/source",
    ]);
    expect(index.unlinkedMentions.get("design/target")?.map((note) => note.id)).toEqual([
      "design/foreign-prose",
    ]);
  });

  it("indexes only soft-wrapped wiki-links using normalized semantics", () => {
    write(
      "engineering",
      "Source.md",
      [
        "Local [[Delivery\n loops|delivery\n loops]].",
        "Foreign [[@design/Interaction\n model#Decision\n rationale|design\n model]].",
        "Missing [[Future\n runbook]]. Attachment ![[diagram\n.svg]].",
        "",
        "Rejected [[Delivery\n\nloops]].",
      ].join("\n"),
    );
    write("engineering", "Delivery loops.md", "Delivery loops are useful.");
    write("design", "Interaction model.md", "Interaction model details.");
    write("research", "Evidence.md", "Evidence.");

    const index = build();
    const source = index.byId.get("engineering/source");
    expect(source?.links).toMatchObject([
      {
        raw: "[[Delivery\n loops|delivery\n loops]]",
        target: "Delivery loops",
        alias: "delivery loops",
      },
      {
        targetBrainId: "design",
        target: "Interaction model",
        anchor: "Decision rationale",
        alias: "design model",
      },
      { target: "Future runbook" },
    ]);
    expect(source?.links).toHaveLength(3);
    expect(index.edges).toMatchObject([
      { source: "engineering/source", target: "engineering/delivery-loops" },
      { source: "engineering/source", target: "design/interaction-model", crossBrain: true },
    ]);
    expect(index.backlinks.get("engineering/delivery-loops")?.[0].context).toBe(
      "Local delivery loops.",
    );
    expect(index.unlinkedMentions.get("engineering/delivery-loops")).toBeUndefined();
    expect(index.unresolved).toMatchObject([
      { targetBrainId: "engineering", target: "Future runbook" },
    ]);
  });

  it("enforces title uniqueness within each brain only", () => {
    write("engineering", "A/Same.md", "One.");
    write("engineering", "B/Same.md", "Two.");
    write("design", "Same.md", "Allowed across brains.");
    write("research", "Evidence.md", "Evidence.");
    expect(() => build()).toThrow(/brain "engineering"[\s\S]*A\/Same\.md[\s\S]*B\/Same\.md/);
  });
});
