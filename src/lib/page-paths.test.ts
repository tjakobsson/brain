import path from "node:path";
import { describe, expect, it } from "vitest";
import { createWorkspaceSnapshot } from "./vault-loader";
import {
  vaultNotePagePaths,
  workspaceBrainPagePaths,
  workspaceNotePagePaths,
  workspaceTagPagePaths,
} from "./page-paths";

const outputDir = path.resolve("dist");

describe("static page paths", () => {
  it("keeps single-vault note IDs on the existing catch-all route", () => {
    const snapshot = createWorkspaceSnapshot({
      mode: "vault",
      vaultDir: path.resolve("examples/demo-vault"),
      outputDir,
      exclusions: [],
      strictLinks: false,
    });
    const entries = snapshot.index.notes.map((note) => ({
      id: note.id,
      data: { brainId: note.brainId },
    }));

    expect(vaultNotePagePaths(entries, snapshot).map(({ params }) => params.id)).toContain("welcome");
    expect(workspaceNotePagePaths(entries, snapshot)).toEqual([]);
  });

  it("splits composite workspace entries into distinct namespaced note paths", () => {
    const snapshot = createWorkspaceSnapshot({
      mode: "workspace",
      vaultDir: path.resolve("examples/demo-vault"),
      workspacePath: path.resolve("examples/demo-workspace/workspace.json"),
      outputDir,
      exclusions: [],
      strictLinks: false,
    });
    const entries = snapshot.index.notes.map((note) => ({
      id: note.id,
      data: { brainId: note.brainId, tags: note.meta.tags },
    }));
    const paths = workspaceNotePagePaths(entries, snapshot);

    expect(vaultNotePagePaths(entries, snapshot)).toEqual([]);
    expect(paths.filter(({ params }) => params.slug === "principles").map(({ params }) => params))
      .toEqual([
        { brainId: "engineering", slug: "principles" },
        { brainId: "design", slug: "principles" },
      ]);
    expect(workspaceBrainPagePaths(snapshot).map(({ params }) => params.brainId)).toEqual([
      "engineering",
      "design",
      "research",
    ]);
    expect(workspaceTagPagePaths(snapshot)).toContainEqual(expect.objectContaining({
      params: { brainId: "design", tag: "decisions" },
    }));
  });
});
