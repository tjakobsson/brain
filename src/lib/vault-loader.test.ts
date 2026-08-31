import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  createWorkspaceSnapshot,
  formatUnresolvedLinkDiagnostic,
  workspaceLoader,
} from "./vault-loader";
import { getWorkspaceSnapshot, publishWorkspaceSnapshot } from "./vault-state";

describe("workspace snapshot", () => {
  const workspaceOptions = {
    mode: "workspace" as const,
    vaultDir: path.resolve("examples/demo-vault"),
    workspacePath: path.resolve("examples/demo-workspace/workspace.json"),
    outputDir: path.resolve("dist"),
    exclusions: [],
    strictLinks: false,
  };

  it("normalizes the public workspace into owned manifests, notes, and attachments", () => {
    const snapshot = createWorkspaceSnapshot(workspaceOptions);

    expect(snapshot.mode).toBe("workspace");
    expect(snapshot.registry.brains.map((brain) => brain.id)).toEqual([
      "engineering",
      "design",
      "research",
      "research-archive-and-synthesis-source-trails",
    ]);
    expect([...snapshot.manifests.keys()]).toEqual([
      "engineering",
      "design",
      "research",
      "research-archive-and-synthesis-source-trails",
    ]);
    expect(snapshot.index.notes.filter((note) => note.title === "Principles").map((note) => note.id))
      .toEqual(["engineering/principles", "design/principles"]);
    expect(snapshot.index.notes.map((note) => note.vaultPath)).not.toContain("drafts/Private rollout.md");
    expect(snapshot.attachments.map((attachment) => attachment.outputPath).sort()).toEqual([
      "brains/design/assets/media/diagram.svg",
      "brains/engineering/assets/media/diagram.svg",
    ]);

    publishWorkspaceSnapshot(snapshot);
    expect(getWorkspaceSnapshot()).toBe(snapshot);
  });

  it("preserves single-vault IDs, routes, manifest access, and asset output", () => {
    const snapshot = createWorkspaceSnapshot({
      mode: "vault",
      vaultDir: path.resolve("examples/demo-vault"),
      outputDir: path.resolve("dist"),
      exclusions: [],
      strictLinks: false,
    });

    expect(snapshot.mode).toBe("vault");
    expect(snapshot.manifest).toBe(snapshot.manifests.get("default"));
    expect(snapshot.index.notes.every((note) => note.id === note.slug)).toBe(true);
    expect(snapshot.index.notes.every((note) => note.route.startsWith("/notes/"))).toBe(true);
    expect(snapshot.attachments.every((attachment) =>
      attachment.outputPath.startsWith("vault-assets/") &&
      attachment.route.startsWith("/vault-assets/")
    )).toBe(true);
  });

  it("formats missing-note and unknown-brain diagnostics with both owners", () => {
    const base = {
      sourceBrainId: "engineering",
      source: "/workspace/engineering/Source.md",
      raw: "[[@design/Future idea]]",
      target: "Future idea",
    } as const;
    expect(formatUnresolvedLinkDiagnostic({
      ...base,
      kind: "missing-note",
      targetBrainId: "design",
    })).toContain('missing note "Future idea" in brain "design"');
    expect(formatUnresolvedLinkDiagnostic({
      ...base,
      kind: "unknown-brain",
      targetBrainId: "missing-brain",
    })).toContain('unknown brain "missing-brain"');
    expect(formatUnresolvedLinkDiagnostic({
      ...base,
      kind: "missing-note",
      targetBrainId: "design",
    })).toContain('brain "engineering" file /workspace/engineering/Source.md');
  });

  it("adds brain ownership to content entries and reports non-strict diagnostics", async () => {
    const entries: Array<{ id: string; data: Record<string, unknown> }> = [];
    const warn = vi.fn();
    const loader = workspaceLoader(workspaceOptions);
    await loader.load!({
      logger: { warn, error: vi.fn() },
      parseData: async ({ data }: { data: Record<string, unknown> }) => data,
      renderMarkdown: async () => ({ html: "", metadata: {} }),
      store: { clear: vi.fn(), set: (entry: typeof entries[number]) => entries.push(entry) },
      config: { root: new URL("file:///generator/") },
      generateDigest: (source: string) => source,
    } as never);

    expect(entries.map(({ id }) => id)).toContain("engineering/principles");
    expect(entries.find(({ id }) => id === "engineering/principles")?.data.brainId).toBe(
      "engineering",
    );
    expect(warn).toHaveBeenCalledTimes(3);
    expect(warn.mock.calls.flat().join("\n")).toContain('unknown brain "missing-brain"');
  });

  it("fails strict loading after logging every owned diagnostic", async () => {
    const error = vi.fn();
    const loader = workspaceLoader({ ...workspaceOptions, strictLinks: true });
    await expect(loader.load!({ logger: { error, warn: vi.fn() } } as never)).rejects.toThrow(
      "Strict link validation failed with 3 unresolved link(s)",
    );
    expect(error).toHaveBeenCalledTimes(3);
    expect(error.mock.calls.flat().join("\n")).toContain('brain "engineering"');
    expect(error.mock.calls.flat().join("\n")).toContain('brain "design"');
  });
});
