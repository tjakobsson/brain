import Graph from "graphology";
import { describe, expect, it, vi } from "vitest";
import type { GraphHoverState } from "./graph-interaction";
import {
  createLensReducers,
  createLensStore,
  lensStorageKey,
  normalizeLens,
  type LensStorage,
} from "./graph-lens";

const knownBrains = ["engineering", "design", "research"];

function memoryStorage(): LensStorage & { items: Map<string, string> } {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  };
}

function fixture() {
  const graph = new Graph();
  for (const [id, brainId] of [
    ["a", "engineering"],
    ["b", "research"],
    ["c", "research"],
    ["d", "design"],
  ] as const) {
    graph.addNode(id, {
      x: 0,
      y: 0,
      size: 5,
      label: id.toUpperCase(),
      color: "#123456",
      brainId,
      forceLabel: true,
    });
  }
  graph.addEdgeWithKey("a-b", "a", "b", { color: "#654321" });
  graph.addEdgeWithKey("b-c", "b", "c", { color: "#654321" });
  graph.addEdgeWithKey("a-d", "a", "d", { color: "#654321" });
  const state: GraphHoverState = {
    hovered: null,
    focused: null,
    neighbors: new Set(),
    theme: { fadedEdge: "#eeeeee", fadedLabel: "#cccccc", fadedNode: "#dddddd" },
  };
  return { graph, state };
}

describe("lens store", () => {
  it("keys the lens by site base and round-trips dimmed Brains", () => {
    const storage = memoryStorage();
    const store = createLensStore("/workspace-demo/", () => storage);

    expect(store.key).toBe(lensStorageKey("/workspace-demo/"));
    expect(lensStorageKey("/")).not.toBe(lensStorageKey("/workspace-demo/"));
    expect(store.read()).toEqual([]);
    store.write(["research"]);
    expect(storage.items.get(store.key)).toBe(JSON.stringify(["research"]));
    expect(store.read()).toEqual(["research"]);
    expect(store.backend).toBe("storage");
    store.reset();
    expect(store.read()).toEqual([]);
    expect(storage.items.has(store.key)).toBe(false);
  });

  it("ignores malformed stored values", () => {
    const storage = memoryStorage();
    const store = createLensStore("/", () => storage);
    storage.items.set(store.key, "{not json");
    expect(store.read()).toEqual([]);
    storage.items.set(store.key, JSON.stringify({ research: true }));
    expect(store.read()).toEqual([]);
    storage.items.set(store.key, JSON.stringify(["research", 4, null]));
    expect(store.read()).toEqual(["research"]);
  });

  it("falls back to an in-memory lens when storage throws", () => {
    const throwing = vi.fn(() => {
      throw new DOMException("denied", "SecurityError");
    });
    const store = createLensStore("/", throwing);

    expect(store.read()).toEqual([]);
    expect(store.backend).toBe("memory");
    store.write(["design"]);
    expect(store.read()).toEqual(["design"]);
    store.reset();
    expect(store.read()).toEqual([]);
    expect(throwing).toHaveBeenCalledTimes(1);
  });

  it("keeps the lens in memory when a later write throws", () => {
    const storage = memoryStorage();
    storage.setItem = () => {
      throw new Error("quota");
    };
    const store = createLensStore("/", () => storage);
    store.write(["research"]);
    expect(store.backend).toBe("memory");
    expect(store.read()).toEqual(["research"]);
  });
});

describe("lens normalization", () => {
  it("keeps configured Brains in declared order without duplicates", () => {
    expect(normalizeLens(["research", "unknown", "engineering", "research"], knownBrains))
      .toEqual(["engineering", "research"]);
  });

  it("treats a lens that dims every Brain as no lens", () => {
    expect(normalizeLens(["design", "research", "engineering"], knownBrains)).toEqual([]);
    expect(normalizeLens(["research"], ["research"])).toEqual([]);
    expect(normalizeLens([], knownBrains)).toEqual([]);
  });
});

describe("lens reducers", () => {
  it("dims a Brain's nodes and incident edges without removing them", () => {
    const { graph, state } = fixture();
    const before = graph.nodes();
    const dimmed = new Set(["research"]);
    const { nodeReducer, edgeReducer } = createLensReducers(graph, state, { dimmed: () => dimmed });

    const research = nodeReducer("b", graph.getNodeAttributes("b"));
    expect(research).toMatchObject({
      color: "#dddddd",
      labelColor: "#cccccc",
      label: "B",
      forceLabel: false,
      dimmed: true,
    });
    expect(research.hidden).toBeUndefined();
    expect(nodeReducer("a", graph.getNodeAttributes("a"))).toBe(graph.getNodeAttributes("a"));
    expect(edgeReducer("a-b", graph.getEdgeAttributes("a-b"))).toMatchObject({ color: "#eeeeee", dimmed: true });
    expect(edgeReducer("b-c", graph.getEdgeAttributes("b-c"))).toMatchObject({ color: "#eeeeee", dimmed: true });
    expect(edgeReducer("a-d", graph.getEdgeAttributes("a-d"))).toBe(graph.getEdgeAttributes("a-d"));
    expect(graph.nodes()).toEqual(before);
    expect(graph.getNodeAttributes("b")).toMatchObject({ x: 0, y: 0, color: "#123456" });
  });

  it("renders a focused neighborhood at full emphasis over the lens", () => {
    const { graph, state } = fixture();
    state.focused = "a";
    state.neighbors = new Set(graph.neighbors("a"));
    const { nodeReducer, edgeReducer } = createLensReducers(graph, state, {
      dimmed: () => new Set(["research"]),
    });

    const neighbor = nodeReducer("b", graph.getNodeAttributes("b"));
    expect(neighbor).toMatchObject({ color: "#123456", label: "B", forceLabel: true });
    expect(neighbor).not.toHaveProperty("dimmed");
    expect(nodeReducer("c", graph.getNodeAttributes("c"))).toMatchObject({ color: "#dddddd", label: "" });
    expect(edgeReducer("a-b", graph.getEdgeAttributes("a-b"))).toBe(graph.getEdgeAttributes("a-b"));
    expect(edgeReducer("b-c", graph.getEdgeAttributes("b-c"))).toMatchObject({ color: "#eeeeee" });
  });

  it("applies the same precedence to a transient hover", () => {
    const { graph, state } = fixture();
    state.hovered = "b";
    state.neighbors = new Set(graph.neighbors("b"));
    const { nodeReducer } = createLensReducers(graph, state, { dimmed: () => new Set(["research"]) });
    expect(nodeReducer("b", graph.getNodeAttributes("b"))).toMatchObject({ color: "#123456", forceLabel: true });
    expect(nodeReducer("c", graph.getNodeAttributes("c"))).toMatchObject({ color: "#123456", forceLabel: true });
    expect(nodeReducer("d", graph.getNodeAttributes("d"))).toMatchObject({ color: "#dddddd", label: "" });
  });

  it("removes filtered nodes before the lens applies", () => {
    const { graph, state } = fixture();
    const hidden = new Set(["b"]);
    const { nodeReducer, edgeReducer } = createLensReducers(graph, state, {
      dimmed: () => new Set(["research"]),
      hidden,
    });
    const filtered = nodeReducer("b", graph.getNodeAttributes("b"));
    expect(filtered).toMatchObject({ hidden: true });
    expect(filtered).not.toHaveProperty("dimmed");
    expect(edgeReducer("a-b", graph.getEdgeAttributes("a-b"))).toMatchObject({ hidden: true });
    expect(nodeReducer("c", graph.getNodeAttributes("c"))).toMatchObject({ dimmed: true });
  });

  it("reads the lens live so a reset restores full emphasis", () => {
    const { graph, state } = fixture();
    let dimmed = new Set(["research"]);
    const { nodeReducer } = createLensReducers(graph, state, { dimmed: () => dimmed });
    expect(nodeReducer("b", graph.getNodeAttributes("b"))).toMatchObject({ dimmed: true });
    dimmed = new Set();
    expect(nodeReducer("b", graph.getNodeAttributes("b"))).toBe(graph.getNodeAttributes("b"));
  });
});
