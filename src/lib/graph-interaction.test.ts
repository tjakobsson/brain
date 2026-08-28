import Graph from "graphology";
import { describe, expect, it, vi } from "vitest";
import {
  createHoverReducers,
  stopCameraAnimation,
  wireGraphHover,
  type GraphHoverState,
} from "./graph-interaction";

function fixture() {
  const graph = new Graph();
  for (const [id, x, y] of [
    ["a", 0, 0],
    ["b", 1, 0],
    ["c", 2, 0],
    ["d", 3, 0],
  ] as const) {
    graph.addNode(id, { x, y, size: 5, hidden: false, label: id.toUpperCase(), color: "#123456" });
  }
  graph.addEdgeWithKey("a-b", "a", "b", { color: "#654321", hidden: false });
  graph.addEdgeWithKey("b-c", "b", "c", { color: "#654321", hidden: false });
  graph.addEdgeWithKey("c-d", "c", "d", { color: "#654321", hidden: false });

  const cameraState = { x: 0.5, y: 0.5, angle: 0, ratio: 1 };
  const camera = {
    getState: vi.fn(() => cameraState),
    isAnimated: vi.fn(() => false),
    animate: vi.fn(),
    setState: vi.fn(),
  };
  const handlers = new Map<string, ((payload: unknown) => void)[]>();
  const renderer = {
    on: vi.fn((event: string, listener: (payload: unknown) => void) => {
      handlers.set(event, [...(handlers.get(event) ?? []), listener]);
    }),
    getContainer: vi.fn(() => ({ style: { cursor: "" } })),
    getCamera: vi.fn(() => camera),
    refresh: vi.fn(),
  };
  const container = renderer.getContainer();
  renderer.getContainer.mockReturnValue(container);
  const emit = (event: string, payload: unknown = {}) => {
    for (const listener of handlers.get(event) ?? []) listener(payload);
  };
  const state: GraphHoverState = {
    hovered: null,
    neighbors: new Set(),
    theme: { fadedEdge: "#eeeeee", fadedNode: "#dddddd" },
  };
  const frame = () => ({
    nodes: Object.fromEntries(
      graph.nodes().map((node) => {
        const attrs = graph.getNodeAttributes(node);
        return [
          node,
          { x: attrs.x, y: attrs.y, size: attrs.size, hidden: attrs.hidden },
        ];
      }),
    ),
    camera: { ...camera.getState() },
  });
  return { graph, camera, renderer, container, emit, state, frame };
}

describe("graph hover interaction", () => {
  it("preserves graph and camera geometry across hover transitions", () => {
    const { graph, camera, renderer, container, emit, state, frame } = fixture();
    const interrupt = vi.fn();
    const baseline = frame();
    wireGraphHover(renderer as never, graph, state, interrupt);

    emit("enterNode", { node: "a" });
    expect(state.hovered).toBe("a");
    expect(state.neighbors).toEqual(new Set(["b"]));
    expect(container.style.cursor).toBe("pointer");
    expect(frame()).toEqual(baseline);

    createHoverReducers(graph, state).nodeReducer("d", graph.getNodeAttributes("d"));
    expect(frame()).toEqual(baseline);

    emit("leaveNode", { node: "a" });
    emit("enterNode", { node: "b" });
    expect(state.hovered).toBe("b");
    expect(state.neighbors).toEqual(new Set(["a", "c"]));
    expect(container.style.cursor).toBe("pointer");
    expect(frame()).toEqual(baseline);

    emit("leaveNode", { node: "b" });
    expect(state.hovered).toBeNull();
    expect(container.style.cursor).toBe("");
    expect(frame()).toEqual(baseline);

    expect(interrupt).toHaveBeenCalledTimes(2);
    expect(renderer.refresh).toHaveBeenCalledTimes(4);
    expect(renderer.refresh).toHaveBeenCalledWith({ skipIndexation: true });
    expect(camera.animate).not.toHaveBeenCalled();
    expect(camera.setState).not.toHaveBeenCalled();
  });

  it("changes only visual attributes in shared hover reducers", () => {
    const { graph, state } = fixture();
    state.hovered = "a";
    state.neighbors = new Set(["b"]);
    const { nodeReducer, edgeReducer } = createHoverReducers(graph, state);
    const attrs = {
      x: 12,
      y: -4,
      size: 9,
      hidden: true,
      label: "Alpha",
      color: "#123456",
    };

    expect(nodeReducer("a", attrs)).toEqual(attrs);
    expect(nodeReducer("b", attrs)).toEqual(attrs);
    expect(nodeReducer("d", attrs)).toEqual({ ...attrs, color: "#dddddd" });
    expect(attrs).toEqual({
      x: 12,
      y: -4,
      size: 9,
      hidden: true,
      label: "Alpha",
      color: "#123456",
    });

    const edgeAttrs = { color: "#654321", hidden: true, label: "relation" };
    expect(edgeReducer("a-b", edgeAttrs)).toEqual(edgeAttrs);
    expect(edgeReducer("c-d", edgeAttrs)).toEqual({ ...edgeAttrs, color: "#eeeeee" });
  });

  it("stops an active camera animation at its current state", () => {
    const { camera, renderer } = fixture();
    camera.isAnimated.mockReturnValue(true);

    stopCameraAnimation(renderer as never);

    expect(camera.animate).toHaveBeenCalledWith(camera.getState(), { duration: 1 });
  });
});
