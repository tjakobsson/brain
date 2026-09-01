import Graph from "graphology";
import { describe, expect, it, vi } from "vitest";
import {
  activeInspectionNode,
  createLongPressController,
  createHoverReducers,
  graphScreenTargets,
  resolveFocusedVisibility,
  hitGraphScreenTarget,
  isInspectionNeighborhoodNode,
  setFocusedInspection,
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
    focused: null,
    neighbors: new Set(),
    theme: { fadedEdge: "#eeeeee", fadedLabel: "#cccccc", fadedNode: "#dddddd" },
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

    expect(nodeReducer("a", attrs)).toEqual({ ...attrs, forceLabel: true });
    expect(nodeReducer("b", attrs)).toEqual({ ...attrs, forceLabel: true });
    expect(nodeReducer("d", attrs)).toEqual({
      ...attrs,
      color: "#dddddd",
      label: "",
      forceLabel: false,
    });
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

  it.each([
    ["light", { fadedEdge: "#e7e4ea", fadedLabel: "#aaa4b0", fadedNode: "#e1dde5" }],
    ["dark", { fadedEdge: "#211f25", fadedLabel: "#625e69", fadedNode: "#29262e" }],
  ])("composes inspection with %s global and local attributes and restores them", (_scheme, theme) => {
    const { graph, state } = fixture();
    state.theme = theme;
    state.hovered = "a";
    state.neighbors = new Set(["b"]);
    const reducers = createHoverReducers(graph, state);
    const globalMatch = { ...graph.getNodeAttributes("a"), label: "Alpha", color: "#abc", forceLabel: false };
    const localForeign = {
      ...graph.getNodeAttributes("b"),
      label: "○ ↗ @other · Beta",
      color: "#8f8b94",
      forceLabel: false,
      foreign: true,
    };
    const searchMiss = { ...graph.getNodeAttributes("d"), label: "Delta", color: "#abc", forceLabel: true };

    expect(reducers.nodeReducer("a", globalMatch)).toEqual({ ...globalMatch, forceLabel: true });
    expect(reducers.nodeReducer("b", localForeign)).toEqual({ ...localForeign, forceLabel: true });
    expect(reducers.nodeReducer("d", searchMiss)).toEqual({
      ...searchMiss,
      color: theme.fadedNode,
      label: "",
      forceLabel: false,
    });

    state.hovered = null;
    state.neighbors.clear();
    const restored = createHoverReducers(graph, state);
    expect(restored.nodeReducer("a", globalMatch)).toBe(globalMatch);
    expect(restored.nodeReducer("b", localForeign)).toBe(localForeign);
    expect(restored.nodeReducer("d", searchMiss)).toBe(searchMiss);
  });

  it("restores pinned inspection after pointer hover and ignores touch hover events", () => {
    const { graph, renderer, emit, state } = fixture();
    setFocusedInspection(graph, state, "a");
    expect(isInspectionNeighborhoodNode(state, "a")).toBe(true);
    expect(isInspectionNeighborhoodNode(state, "b")).toBe(true);
    expect(isInspectionNeighborhoodNode(state, "c")).toBe(false);
    wireGraphHover(renderer as never, graph, state);

    emit("enterNode", { node: "b", event: { original: { type: "touchmove" } } });
    expect(activeInspectionNode(state)).toBe("a");
    expect(state.neighbors).toEqual(new Set(["b"]));

    emit("enterNode", { node: "c", event: { original: { type: "mousemove" } } });
    expect(activeInspectionNode(state)).toBe("c");
    expect(state.neighbors).toEqual(new Set(["b", "d"]));

    emit("leaveNode", { node: "c", event: { original: { type: "mousemove" } } });
    expect(activeInspectionNode(state)).toBe("a");
    expect(state.neighbors).toEqual(new Set(["b"]));

    setFocusedInspection(graph, state, null);
    expect(isInspectionNeighborhoodNode(state, "a")).toBe(false);
    expect(isInspectionNeighborhoodNode(state, "b")).toBe(false);
  });

  it("lets shared focus override stored filters once and clears on explicit exclusion", () => {
    const restoredHidden = new Set(["a", "b", "c"]);
    expect(resolveFocusedVisibility(restoredHidden, "a", ["b"], true)).toBe("a");
    expect(restoredHidden).toEqual(new Set(["c"]));

    const explicitHidden = new Set(["a", "b"]);
    expect(resolveFocusedVisibility(explicitHidden, "a", ["b"], false)).toBeNull();
    expect(explicitHidden).toEqual(new Set(["a", "b"]));
  });

  it("stops an active camera animation at its current state", () => {
    const { camera, renderer } = fixture();
    camera.isAnimated.mockReturnValue(true);

    stopCameraAnimation(renderer as never);

    expect(camera.animate).toHaveBeenCalledWith(camera.getState(), { duration: 1 });
  });
});

describe("graph screen targets", () => {
  it("hits markers and long rendered labels, including foreign mark width", () => {
    const targets = graphScreenTargets([
      { node: "plain", x: 50, y: 50, radius: 6, label: "Long title", labelWidth: 180, labelRendered: true },
      {
        node: "foreign",
        x: 50,
        y: 100,
        radius: 4,
        label: "Foreign",
        labelWidth: 60,
        foreignMarkWidth: 24,
        labelRendered: true,
      },
    ], { width: 300, height: 150 });

    expect(hitGraphScreenTarget(targets, { x: 35, y: 50 })).toBe("plain");
    expect(hitGraphScreenTarget(targets, { x: 220, y: 50 })).toBe("plain");
    expect(hitGraphScreenTarget(targets, { x: 140, y: 100 })).toBe("foreign");
  });

  it("clips targets to the viewport and omits absent or unrendered labels", () => {
    const targets = graphScreenTargets([
      { node: "clipped", x: 4, y: 4, radius: 8, label: "Visible", labelWidth: 70, labelRendered: true },
      { node: "absent", x: 60, y: 60, radius: 5 },
      { node: "selected-out", x: 90, y: 60, radius: 5, label: "Hidden", labelWidth: 70, labelRendered: false },
      { node: "outside", x: 180, y: 180, radius: 5, label: "Outside", labelWidth: 70, labelRendered: true },
    ], { width: 120, height: 100 });

    expect(targets.find((target) => target.node === "clipped" && target.kind === "marker")).toMatchObject({
      left: 0,
      top: 0,
    });
    expect(targets.filter((target) => target.node === "absent")).toHaveLength(1);
    expect(targets.filter((target) => target.node === "selected-out")).toHaveLength(1);
    expect(targets.some((target) => target.node === "outside")).toBe(false);
    expect(hitGraphScreenTarget(targets, { x: -1, y: 4 })).toBeNull();
  });

  it("resolves overlapping targets by distance, marker priority, then node ID", () => {
    const targets = graphScreenTargets([
      { node: "beta", x: 50, y: 50, radius: 5, label: "Beta", labelWidth: 80, labelRendered: true },
      { node: "alpha", x: 50, y: 50, radius: 5, label: "Alpha", labelWidth: 80, labelRendered: true },
      { node: "near", x: 80, y: 50, radius: 5 },
    ], { width: 200, height: 100 });

    expect(hitGraphScreenTarget(targets, { x: 50, y: 50 })).toBe("alpha");
    expect(hitGraphScreenTarget(targets, { x: 75, y: 50 })).toBe("near");
    expect(hitGraphScreenTarget(targets, { x: 120, y: 50 })).toBe("alpha");
  });
});

describe("graph long press", () => {
  it("activates and consumes a held press after release", () => {
    vi.useFakeTimers();
    const activate = vi.fn();
    const press = createLongPressController({ onActivate: activate, duration: 400 });

    press.start("a", { x: 10, y: 10 });
    press.move({ x: 12, y: 12 });
    vi.advanceTimersByTime(400);
    press.release();

    expect(activate).toHaveBeenCalledWith("a");
    expect(press.consumeActivatedPress()).toBe(true);
    expect(press.consumeActivatedPress()).toBe(false);
    vi.useRealTimers();
  });

  it("cancels on early release, drag movement, and teardown", () => {
    vi.useFakeTimers();
    const activate = vi.fn();
    const press = createLongPressController({ onActivate: activate, duration: 400, tolerance: 3 });

    press.start("early", { x: 0, y: 0 });
    press.release();
    vi.advanceTimersByTime(400);

    press.start("dragged", { x: 0, y: 0 });
    press.move({ x: 4, y: 0 });
    vi.advanceTimersByTime(400);

    press.start("destroyed", { x: 0, y: 0 });
    press.destroy();
    vi.advanceTimersByTime(400);

    expect(activate).not.toHaveBeenCalled();
    expect(press.consumeActivatedPress()).toBe(false);
    vi.useRealTimers();
  });
});
