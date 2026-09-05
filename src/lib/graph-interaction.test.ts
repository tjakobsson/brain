import Graph from "graphology";
import { graphLabelBox, layoutGraphLabel } from "./graph-style";
import { describe, expect, it, vi } from "vitest";
import {
  activeInspectionNode,
  advanceTouchSequence,
  createLongPressController,
  createHoverReducers,
  graphScreenTargets,
  resolveFocusedVisibility,
  hitGraphScreenTarget,
  isInspectionNeighborhoodNode,
  pinchCameraState,
  neighborhoodWithin,
  setInspectionDepth,
  clampNeighborhoodDepth,
  isTouchPress,
  permitsNodeDrag,
  GRAPH_LABEL_TOUCH_PADDING,
  setFocusedInspection,
  setTransientInspection,
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

  it("locks pinned inspection against pointer hover and ignores touch hover events", () => {
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
    expect(activeInspectionNode(state)).toBe("a");
    expect(state.hovered).toBeNull();
    expect(state.neighbors).toEqual(new Set(["b"]));

    emit("leaveNode", { node: "c", event: { original: { type: "mousemove" } } });
    expect(activeInspectionNode(state)).toBe("a");
    expect(state.neighbors).toEqual(new Set(["b"]));

    setFocusedInspection(graph, state, null);
    expect(isInspectionNeighborhoodNode(state, "a")).toBe(false);
    expect(isInspectionNeighborhoodNode(state, "b")).toBe(false);
    expect(setTransientInspection(graph, state, "c")).toBe(true);
    expect(activeInspectionNode(state)).toBe("c");
  });

  it("permits only touch and unmodified primary-button node drags", () => {
    expect(permitsNodeDrag({ type: "mousedown", button: 0, ctrlKey: false })).toBe(true);
    expect(permitsNodeDrag({ type: "touchstart", button: 0, ctrlKey: false })).toBe(true);
    expect(permitsNodeDrag({ type: "mousedown", button: 2, ctrlKey: false })).toBe(false);
    expect(permitsNodeDrag({ type: "mousedown", button: 0, ctrlKey: true })).toBe(false);
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
  it("hits a label below and centred on its node", () => {
    const targets = graphScreenTargets([
      {
        node: "plain",
        x: 150,
        y: 50,
        radius: 6,
        label: "Long title",
        labelWidth: 180,
        labelHeight: 30,
        labelRendered: true,
      },
    ], { width: 300, height: 150 });

    // Centred: reachable the same distance either side of the node.
    expect(hitGraphScreenTarget(targets, { x: 70, y: 75 })).toBe("plain");
    expect(hitGraphScreenTarget(targets, { x: 230, y: 75 })).toBe("plain");
    // Below the marker, not beside it.
    expect(hitGraphScreenTarget(targets, { x: 150, y: 85 })).toBe("plain");
    expect(hitGraphScreenTarget(targets, { x: 290, y: 50 })).toBeNull();
  });

  it("covers every line of a wrapped label with the box the layout returned", () => {
    const layout = layoutGraphLabel(
      "An observability budget costs more than a confident guess",
      120,
      13,
      (value) => [...value].length * 6,
    );
    expect(layout.lines).toHaveLength(3);
    const center = { x: 150, y: 40 };
    const radius = 5;
    const box = graphLabelBox(layout, center, radius)!;
    const [, label] = graphScreenTargets([{
      node: "wrapped",
      ...center,
      radius,
      label: layout.lines[0]!,
      labelWidth: layout.width,
      labelHeight: layout.height,
      labelRendered: true,
    }], { width: 300, height: 300 });

    expect(label!.kind).toBe("label");
    // The hit box is the layout's box plus a fixed touch slack, not a
    // reconstruction that could drift from it.
    expect(label!.left).toBeCloseTo(box.left - GRAPH_LABEL_TOUCH_PADDING, 6);
    expect(label!.right).toBeCloseTo(box.right + GRAPH_LABEL_TOUCH_PADDING, 6);
    expect(label!.top).toBeCloseTo(box.top - GRAPH_LABEL_TOUCH_PADDING, 6);
    expect(label!.bottom).toBeCloseTo(box.bottom + GRAPH_LABEL_TOUCH_PADDING, 6);
    // Every line's own baseline row falls inside it.
    for (let line = 0; line < layout.lines.length; line += 1) {
      const y = box.top + (line + 0.5) * layout.lineHeight;
      expect(hitGraphScreenTarget([label!], { x: center.x, y })).toBe("wrapped");
    }
  });

  it("clips targets to the viewport and omits absent or unrendered labels", () => {
    const targets = graphScreenTargets([
      { node: "clipped", x: 4, y: 4, radius: 8, label: "Visible", labelWidth: 70, labelHeight: 15, labelRendered: true },
      { node: "absent", x: 60, y: 60, radius: 5 },
      { node: "selected-out", x: 90, y: 60, radius: 5, label: "Hidden", labelWidth: 70, labelHeight: 15, labelRendered: false },
      { node: "outside", x: 180, y: 180, radius: 5, label: "Outside", labelWidth: 70, labelHeight: 15, labelRendered: true },
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
      { node: "beta", x: 50, y: 50, radius: 5, label: "Beta", labelWidth: 80, labelHeight: 15, labelRendered: true },
      { node: "alpha", x: 50, y: 50, radius: 5, label: "Alpha", labelWidth: 80, labelHeight: 15, labelRendered: true },
      { node: "near", x: 80, y: 50, radius: 5 },
    ], { width: 200, height: 100 });

    expect(hitGraphScreenTarget(targets, { x: 50, y: 50 })).toBe("alpha");
    expect(hitGraphScreenTarget(targets, { x: 75, y: 50 })).toBe("near");
    // Below both nodes, where only the two centred label boxes reach.
    expect(hitGraphScreenTarget(targets, { x: 50, y: 70 })).toBe("alpha");
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

describe("touch sequence disqualification", () => {
  /** Replays a gesture as `[type, touches]` pairs and reports the final flag. */
  const replay = (events: readonly (readonly [string, number])[]) =>
    events.reduce(
      (armed, [type, touches]) => advanceTouchSequence(armed, { type, touches }),
      false,
    );

  /** The flag after every step, so a gesture can be checked mid-flight. */
  const trace = (events: readonly (readonly [string, number])[]) => {
    let armed = false;
    return events.map(([type, touches]) => (armed = advanceTouchSequence(armed, { type, touches })));
  };

  it("leaves a single stationary contact able to clear focus", () => {
    expect(replay([["touchstart", 1], ["touchend", 0]])).toBe(false);
  });

  it("leaves a single contact that moves able to clear focus", () => {
    expect(replay([
      ["touchstart", 1],
      ["touchmove", 1],
      ["touchmove", 1],
      ["touchend", 0],
    ])).toBe(false);
  });

  it("disqualifies a pinch whichever contact lifts first", () => {
    // Lift order is invisible here on purpose: the flag counts contact points
    // rather than tracking which one went away, so both orders reduce to the
    // same sequence and neither can clear focus. Before, the first-lifts-first
    // order only survived because the remaining finger happened to rest on a
    // node and took the long-press branch.
    expect(trace([
      ["touchstart", 1],
      ["touchstart", 2],
      ["touchmove", 2],
      ["touchend", 1],
      ["touchend", 0],
    ])).toEqual([false, true, true, true, false]);
  });

  it("disqualifies two contacts that land simultaneously", () => {
    expect(trace([
      ["touchstart", 2],
      ["touchmove", 2],
      ["touchend", 1],
      ["touchend", 0],
    ])).toEqual([true, true, true, false]);
  });

  it("stays disqualified for the whole gesture, not just the stray event", () => {
    const states = trace([
      ["touchstart", 1],
      ["touchstart", 2],
      ["touchend", 1],
      ["touchmove", 1],
      ["touchmove", 1],
      ["touchend", 0],
    ]);
    // Every event between the second landing and the final lift is covered,
    // including the one-finger drag a pinch usually ends with.
    expect(states.slice(1, -1).every(Boolean)).toBe(true);
    expect(states.at(-1)).toBe(false);
  });

  it("releases the sequence on a cancel mid-gesture", () => {
    expect(trace([
      ["touchstart", 1],
      ["touchstart", 2],
      ["touchcancel", 1],
    ])).toEqual([false, true, false]);
  });

  it("re-arms a fresh gesture after a cancelled one", () => {
    expect(replay([
      ["touchstart", 2],
      ["touchcancel", 0],
      ["touchstart", 1],
      ["touchend", 0],
    ])).toBe(false);
  });

  it("does not let a lone touchend disqualify a sequence", () => {
    // Sigma re-emits a stage press from a `touchend`; the flag must not treat
    // that as evidence of a second contact point.
    expect(advanceTouchSequence(false, { type: "touchend", touches: 1 })).toBe(false);
  });
});

describe("touch press classification", () => {
  it("accepts a real touch press", () => {
    expect(isTouchPress({ original: { type: "touchstart" } })).toBe(true);
  });

  it("ignores a stage press sigma re-emitted from a lift", () => {
    // The event behind the dropped pin: a pinch releasing to one contact point
    // makes sigma emit `downStage` carrying a `touchend`.
    expect(isTouchPress({ original: { type: "touchend" } })).toBe(false);
  });

  it("ignores every other touch phase and the mouse", () => {
    for (const type of ["touchmove", "touchcancel", "mousedown", "pointerdown"]) {
      expect(isTouchPress({ original: { type } })).toBe(false);
    }
  });
});

describe("pinchCameraState", () => {
  // A 390x844 phone viewport with sigma's default stage padding.
  const frame = { width: 390, height: 844, graphUnitsPerPixel: 1 / (390 - 60) };
  // Where a framed-graph point lands on screen under a given camera. The
  // inverse of what the pinch computes, so the assertions can be written in
  // the pixels a reader actually sees.
  const project = (
    point: { x: number; y: number },
    camera: { x: number; y: number; ratio: number },
  ) => ({
    x: frame.width / 2 + (point.x - camera.x) / (frame.graphUnitsPerPixel * camera.ratio),
    y: frame.height / 2 - (point.y - camera.y) / (frame.graphUnitsPerPixel * camera.ratio),
  });
  const midpoint = { x: frame.width / 2, y: frame.height / 2 };
  const gesture = {
    anchor: { x: 0.5, y: 0.5 },
    ratio: 1,
    distance: 100,
  };

  it("zooms in when the contacts spread apart", () => {
    const state = pinchCameraState(gesture, [{ x: 145, y: 422 }, { x: 245, y: 422 }], frame);
    expect(state?.ratio).toBe(1);
    const zoomed = pinchCameraState(gesture, [{ x: 120, y: 422 }, { x: 270, y: 422 }], frame);
    // Sigma zooms in by shrinking the ratio: 100px of contact separation
    // became 150px, so the camera covers two thirds of the graph it did.
    expect(zoomed?.ratio).toBeCloseTo(2 / 3, 10);
  });

  it("holds the point under the contacts' midpoint still", () => {
    for (const contacts of [
      [{ x: 120, y: 422 }, { x: 270, y: 422 }],
      [{ x: 175, y: 422 }, { x: 215, y: 422 }],
      [{ x: 100, y: 300 }, { x: 300, y: 600 }],
    ]) {
      const state = pinchCameraState(gesture, contacts, frame)!;
      const centre = {
        x: (contacts[0]!.x + contacts[1]!.x) / 2,
        y: (contacts[0]!.y + contacts[1]!.y) / 2,
      };
      const landed = project(gesture.anchor, state);
      expect(landed.x).toBeCloseTo(centre.x, 6);
      expect(landed.y).toBeCloseTo(centre.y, 6);
    }
  });

  it("never rotates, however far the contacts twist", () => {
    // The gesture a reader makes without meaning to: the same separation,
    // turned. Sigma's own pinch reads this as a camera rotation and tilts the
    // graph under labels that stay level.
    const twisted = pinchCameraState(
      gesture,
      [{ x: 160, y: 372 }, { x: 230, y: 472 }],
      frame,
    )!;
    expect(twisted).not.toHaveProperty("angle");
    expect(twisted.ratio).toBeCloseTo(gesture.ratio * 100 / Math.hypot(70, 100), 10);
    // And the twist alone did not slide the graph: the midpoint is unmoved, so
    // what was under it stays under it.
    const landed = project(gesture.anchor, twisted);
    expect(landed.x).toBeCloseTo(midpoint.x, 6);
    expect(landed.y).toBeCloseTo(midpoint.y, 6);
  });

  it("keeps the midpoint anchored at the camera's zoom limit", () => {
    const limited = pinchCameraState(gesture, [{ x: 15, y: 422 }, { x: 375, y: 422 }], {
      ...frame,
      boundRatio: (ratio) => Math.max(ratio, 0.5),
    })!;
    expect(limited.ratio).toBe(0.5);
    const landed = project(gesture.anchor, limited);
    expect(landed.x).toBeCloseTo(midpoint.x, 6);
    expect(landed.y).toBeCloseTo(midpoint.y, 6);
  });

  it("leaves the camera alone when the gesture is not two contacts", () => {
    expect(pinchCameraState(gesture, [{ x: 100, y: 100 }], frame)).toBeNull();
    expect(pinchCameraState(gesture, [], frame)).toBeNull();
    expect(
      pinchCameraState(gesture, [{ x: 100, y: 100 }, { x: 100, y: 100 }], frame),
    ).toBeNull();
    expect(
      pinchCameraState({ ...gesture, distance: 0 }, [{ x: 1, y: 1 }, { x: 2, y: 2 }], frame),
    ).toBeNull();
  });

  it("pans when both contacts travel together", () => {
    // Two fingers moving as one is a drag, and the graph should follow them.
    const state = pinchCameraState(gesture, [{ x: 95, y: 462 }, { x: 195, y: 462 }], frame)!;
    expect(state.ratio).toBe(1);
    const landed = project(gesture.anchor, state);
    expect(landed.x).toBeCloseTo(145, 6);
    expect(landed.y).toBeCloseTo(462, 6);
  });
});

describe("neighborhood depth", () => {
  // A chain with a shortcut: a-b-c-d, plus a-c, so c is two links from a by
  // one route and one link by another.
  const chain = () => {
    const graph = new Graph();
    for (const id of ["a", "b", "c", "d", "e"]) graph.addNode(id, {});
    graph.addEdge("a", "b");
    graph.addEdge("b", "c");
    graph.addEdge("c", "d");
    graph.addEdge("d", "e");
    return graph;
  };
  const theme = { fadedEdge: "#eee", fadedLabel: "#eee", fadedNode: "#eee" };

  it("walks outward by the shortest route, as far as asked", () => {
    const graph = chain();
    expect([...neighborhoodWithin(graph, "a", 1)]).toEqual([["b", 1]]);
    expect([...neighborhoodWithin(graph, "a", 3)]).toEqual([["b", 1], ["c", 2], ["d", 3]]);
    graph.addEdge("a", "c");
    expect(neighborhoodWithin(graph, "a", 3).get("c")).toBe(1);
    expect(neighborhoodWithin(graph, "a", 3).get("d")).toBe(2);
  });

  it("clamps the reach to one through five", () => {
    expect(clampNeighborhoodDepth(0)).toBe(1);
    expect(clampNeighborhoodDepth(9)).toBe(5);
    expect(clampNeighborhoodDepth(Number.NaN)).toBe(1);
    expect(clampNeighborhoodDepth(2.6)).toBe(3);
  });

  it("re-lights the pinned neighborhood when the reach changes", () => {
    const graph = chain();
    const state = { hovered: null, focused: null, neighbors: new Set<string>(), theme };
    setFocusedInspection(graph, state, "a");
    expect([...state.neighbors]).toEqual(["b"]);
    expect(setInspectionDepth(graph, state, 3)).toBe(true);
    expect([...state.neighbors]).toEqual(["b", "c", "d"]);
    expect(setInspectionDepth(graph, state, 3)).toBe(false);
    expect(setInspectionDepth(graph, state, 1)).toBe(true);
    expect([...state.neighbors]).toEqual(["b"]);
  });

  it("lights the edges between successive rings and no others", () => {
    const graph = chain();
    graph.addEdge("b", "d");
    const state = { hovered: null, focused: null, neighbors: new Set<string>(), depth: 2, theme };
    setFocusedInspection(graph, state, "a");
    const { edgeReducer } = createHoverReducers(graph, state);
    const lit = (source: string, target: string) =>
      edgeReducer(graph.edge(source, target)!, { color: "#000" }).color === "#000";
    expect(lit("a", "b")).toBe(true);
    expect(lit("b", "c")).toBe(true);
    // b and d are both lit (rings 1 and 2), so their edge is lit.
    expect(lit("b", "d")).toBe(true);
    // c and d are both in ring 2: lateral, so it recedes.
    expect(lit("c", "d")).toBe(false);
    // Beyond the reach.
    expect(lit("d", "e")).toBe(false);
  });
});
