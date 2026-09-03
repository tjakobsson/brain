import { describe, expect, it } from "vitest";
import type { WorkspaceDefinition } from "./workspace.mjs";
import { buildGraphData, deriveFocusedGraphData, deriveGraphData, deriveNoteNeighborhood, normalizeGraphData } from "./graph-data";
import type { LinkIndex, VaultNote } from "./vault-scan";

const registry = {
  version: 1,
  title: "Workspace",
  exclusions: [],
  groups: [],
  brains: [
    { id: "engineering", title: "Engineering", accent: "#3366cc" },
    { id: "design", title: "Design", accent: "#b56cff" },
    { id: "research", title: "Research", accent: "#228866" },
  ],
} as WorkspaceDefinition;

function note(id: string, brainId: string, title: string): VaultNote {
  return {
    id,
    compositeId: `${brainId}/${title.toLowerCase()}`,
    brainId,
    title,
    slug: title.toLowerCase(),
    route: `/brains/${brainId}/notes/${title.toLowerCase()}`,
    filePath: `${brainId}/${title}.md`,
    vaultPath: `${title}.md`,
    source: "",
    body: "",
    links: [],
    attachments: [],
    frontmatter: {},
    meta: { type: "permanent", status: "established", tags: ["shared"] },
  };
}

const notes = [
  note("engineering:principles", "engineering", "Principles"),
  note("engineering:delivery", "engineering", "Delivery"),
  note("design:principles", "design", "Principles"),
  note("design:interaction", "design", "Interaction"),
  note("research:evidence", "research", "Evidence"),
];
const edges = [
  { source: notes[0].id, target: notes[1].id, sourceBrainId: "engineering", targetBrainId: "engineering", crossBrain: false },
  { source: notes[0].id, target: notes[2].id, sourceBrainId: "engineering", targetBrainId: "design", crossBrain: true },
  { source: notes[2].id, target: notes[3].id, sourceBrainId: "design", targetBrainId: "design", crossBrain: false },
  { source: notes[3].id, target: notes[4].id, sourceBrainId: "design", targetBrainId: "research", crossBrain: true },
];
const index = { notes, edges } as LinkIndex;

describe("workspace graph data", () => {
  it("keeps duplicate titles distinct and emits ownership, routes, and cross-brain edges", () => {
    const data = buildGraphData(index, registry, "workspace");
    const principles = data.nodes.filter((node) => node.title === "Principles");

    expect(principles.map(({ id }) => id)).toEqual(["design:principles", "engineering:principles"]);
    expect(principles.map(({ route }) => route)).toEqual([
      "/brains/design/notes/principles",
      "/brains/engineering/notes/principles",
    ]);
    expect(principles.map(({ compositeId }) => compositeId)).toEqual([
      "design/principles",
      "engineering/principles",
    ]);
    expect(principles[0]).toMatchObject({ brainId: "design", brainTitle: "Design", brainAccent: "#b56cff" });
    expect(data.edges.filter((edge) => edge.crossBrain)).toHaveLength(2);
    expect(data.nodes.some((node) => node.id === "missing")).toBe(false);
  });

  it("produces repeatable workspace positions regardless of input order", () => {
    const first = buildGraphData(index, registry, "workspace");
    const second = buildGraphData(
      { notes: [...notes].reverse(), edges: [...edges].reverse() } as LinkIndex,
      registry,
      "workspace",
    );
    expect(second).toEqual(first);
  });

  it("keeps direct foreign boundaries in a brain graph without foreign-to-foreign expansion", () => {
    const view = deriveGraphData(buildGraphData(index, registry, "workspace"), {
      mode: "brain",
      brainId: "engineering",
    });
    expect(view.nodes.map(({ id }) => id)).toEqual([
      "design:principles",
      "engineering:delivery",
      "engineering:principles",
    ]);
    expect(view.edges).toHaveLength(2);
  });

  it("can keep a brain graph local until related brains are enabled", () => {
    const view = deriveGraphData(buildGraphData(index, registry, "workspace"), {
      mode: "brain",
      brainId: "engineering",
      includeForeign: false,
    });
    expect(view.nodes.map(({ id }) => id)).toEqual([
      "engineering:delivery",
      "engineering:principles",
    ]);
    expect(view.edges).toHaveLength(1);
    expect(view.edges[0].crossBrain).toBe(false);
  });

  it("reveals only a focused subject's direct foreign boundary", () => {
    const data = buildGraphData(index, registry, "workspace");
    const view = deriveFocusedGraphData(data, {
      mode: "brain",
      brainId: "engineering",
      includeForeign: false,
    }, "engineering:principles");
    expect(view.nodes.map(({ id }) => id)).toEqual([
      "design:principles",
      "engineering:delivery",
      "engineering:principles",
    ]);
    expect(view.edges.map(({ source, target }) => `${source}->${target}`)).toEqual([
      "engineering:principles->design:principles",
      "engineering:principles->engineering:delivery",
    ]);
    expect(view.nodes.some(({ id }) => id === "research:evidence")).toBe(false);
    expect(view.edges.every(({ source, target }) =>
      view.nodes.some(({ id }) => id === source) && view.nodes.some(({ id }) => id === target)
    )).toBe(true);
  });

  it("ignores focus outside a brain graph's reach", () => {
    const data = buildGraphData(index, registry, "workspace");
    const view = deriveFocusedGraphData(data, {
      mode: "brain",
      brainId: "engineering",
      includeForeign: false,
    }, "research:evidence");
    expect(new Set(view.nodes.map(({ brainId }) => brainId))).toEqual(new Set(["engineering"]));
  });

  it("keeps every Brain and every edge on the full workspace graph, focused or not", () => {
    const data = buildGraphData(index, registry, "workspace");
    expect(deriveGraphData(data, { mode: "all" })).toBe(data);
    const focused = deriveFocusedGraphData(data, { mode: "all", encodeBrains: true }, "engineering:principles");
    expect(focused.nodes).toEqual(data.nodes);
    expect(focused.edges).toEqual(data.edges);
  });

  it("keeps local depth and direct foreign relationships in a note neighborhood", () => {
    const local = deriveNoteNeighborhood(buildGraphData(index, registry, "workspace"), notes[0].id);
    expect(local.nodes.map(({ id }) => id)).toEqual([
      "design:principles",
      "engineering:delivery",
      "engineering:principles",
    ]);
    expect(local.edges).toHaveLength(2);
  });

  it("preserves single-vault IDs and routes", () => {
    const vaultRegistry = {
      ...registry,
      brains: [{ id: "default", title: "Brain", accent: "#5b4bc4" }],
    } as WorkspaceDefinition;
    const vaultNote = note("principles", "default", "Principles");
    vaultNote.route = "/notes/principles";
    const data = buildGraphData({ notes: [vaultNote], edges: [] } as LinkIndex, vaultRegistry, "vault");
    expect(data.nodes[0]).toMatchObject({
      id: "principles",
      compositeId: "default/principles",
      route: "/notes/principles",
    });
  });

  it("normalizes the original single-vault payload contract", () => {
    const data = normalizeGraphData({
      nodes: [{
        id: "principles",
        title: "Principles",
        route: "/notes/principles",
        type: "permanent",
        status: "draft",
        tags: [],
        degree: 0,
        x: 0,
        y: 0,
      }],
      edges: [],
    });
    expect(data).toMatchObject({
      mode: "vault",
      brains: [{ id: "default", title: "Brain" }],
      nodes: [{ id: "principles", compositeId: "default/principles", brainId: "default", route: "/notes/principles" }],
    });
  });
});
