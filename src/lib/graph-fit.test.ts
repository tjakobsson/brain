import Graph from "graphology";
import { describe, expect, it, vi } from "vitest";
import {
  applyRenderedGraphFit,
  convertCameraToBoundingBox,
  fitCorrection,
  fitRenderedGraph,
  graphFitInsets,
  measureRenderedBounds,
  planRenderedGraphFit,
  type GraphBoundingBox,
  type GraphCameraState,
  type ViewportBounds,
} from "./graph-fit";

function fakeRenderer(initialMaximumRatio = 10) {
  const graph = new Graph();
  graph.addNode("left", { x: -1, y: 0, size: 24, label: "Left" });
  graph.addNode("right", {
    x: 1,
    y: 0,
    size: 8,
    label: "A deliberately long rendered node title",
    foreign: true,
  });
  graph.addNode("excluded", { x: 100, y: 100, size: 80, label: "Excluded" });
  const dimensions = { width: 320, height: 180 };
  let bbox = { x: [-1.5, 1.5] as [number, number], y: [-0.5, 0.5] as [number, number] };
  let cameraState = { x: 0.5, y: 0.5, angle: 0, ratio: 1 };
  let maximumRatio = initialMaximumRatio;
  let displayedLabels = new Set(graph.nodes());
  let focusBounds: DOMRect | null = null;
  const hostBounds = { left: 0, top: 0, right: 320, bottom: 180 } as DOMRect;
  const focusScope = {
    querySelector: vi.fn(() => focusBounds ? { getBoundingClientRect: () => focusBounds } : null),
  };
  const camera = {
    getState: vi.fn(() => ({ ...cameraState })),
    setState: vi.fn((state: Partial<typeof cameraState>) => {
      cameraState = { ...cameraState, ...state };
    }),
    animate: vi.fn((state: typeof cameraState, _options: unknown, callback?: () => void) => {
      cameraState = { ...state };
      callback?.();
    }),
  };
  const framedPosition = (id: string) => {
    const x = graph.getNodeAttribute(id, "x") as number;
    const y = graph.getNodeAttribute(id, "y") as number;
    return {
      x: (x - bbox.x[0]) / (bbox.x[1] - bbox.x[0]),
      y: (y - bbox.y[0]) / (bbox.y[1] - bbox.y[0]),
    };
  };
  const renderer = {
    getGraph: vi.fn(() => graph),
    getContainer: vi.fn(() => ({
      getBoundingClientRect: () => hostBounds,
      closest: () => focusScope,
    })),
    getDimensions: vi.fn(() => dimensions),
    getCamera: vi.fn(() => camera),
    getCustomBBox: vi.fn(() => bbox),
    getBBox: vi.fn(() => bbox),
    setCustomBBox: vi.fn((next: typeof bbox) => {
      bbox = next;
    }),
    refresh: vi.fn(),
    getNodeDisplayedLabels: vi.fn(() => displayedLabels),
    getSettings: vi.fn(() => ({ labelWeight: "500", labelSize: 13, labelFont: "sans-serif" })),
    getSetting: vi.fn(() => maximumRatio),
    setSetting: vi.fn((_key: string, value: number) => {
      maximumRatio = value;
    }),
    getCanvases: vi.fn(() => ({
      labels: {
        getContext: () => ({
          font: "",
          measureText: (text: string) => ({
            width: text.length * 6,
            actualBoundingBoxAscent: 10,
            actualBoundingBoxDescent: 3,
          }),
        }),
      },
    })),
    getNodeDisplayData: vi.fn((id: string) => ({
      ...framedPosition(id),
      size: graph.getNodeAttribute(id, "size") as number,
      label: graph.getNodeAttribute(id, "label") as string,
      foreign: graph.getNodeAttribute(id, "foreign") as boolean | undefined,
      hidden: false,
    })),
    framedGraphToViewport: vi.fn((point: { x: number; y: number }) => {
      const factor = Math.min(dimensions.width, dimensions.height) / cameraState.ratio;
      return {
        x: dimensions.width / 2 + (point.x - cameraState.x) * factor,
        y: dimensions.height / 2 + (point.y - cameraState.y) * factor,
      };
    }),
    viewportToFramedGraph: vi.fn((point: { x: number; y: number }) => {
      const factor = Math.min(dimensions.width, dimensions.height) / cameraState.ratio;
      return {
        x: cameraState.x + (point.x - dimensions.width / 2) / factor,
        y: cameraState.y + (point.y - dimensions.height / 2) / factor,
      };
    }),
    scaleSize: vi.fn((size: number) => size / Math.sqrt(cameraState.ratio)),
  };
  return {
    graph,
    renderer,
    dimensions,
    camera,
    getBBox: () => bbox,
    getMaximumRatio: () => maximumRatio,
    setDisplayedLabels: (ids: string[]) => {
      displayedLabels = new Set(ids);
    },
    setFocusBounds: (bounds: Partial<DOMRect> | null) => {
      focusBounds = bounds as DOMRect | null;
    },
  };
}

describe("rendered graph fitting", () => {
  it("converts a camera between bounding boxes without moving graph points in the viewport", () => {
    const source: GraphBoundingBox = { x: [-2, 2], y: [-1, 3] };
    const target: GraphBoundingBox = { x: [-10, 10], y: [-4, 8] };
    const camera: GraphCameraState = { x: 0.65, y: 0.4, angle: 0, ratio: 0.8 };
    const converted = convertCameraToBoundingBox(camera, source, target);
    const viewportPosition = (
      point: { x: number; y: number },
      bbox: GraphBoundingBox,
      state: GraphCameraState,
    ) => {
      const scale = Math.max(bbox.x[1] - bbox.x[0], bbox.y[1] - bbox.y[0]);
      const framed = {
        x: 0.5 + (point.x - (bbox.x[0] + bbox.x[1]) / 2) / scale,
        y: 0.5 + (point.y - (bbox.y[0] + bbox.y[1]) / 2) / scale,
      };
      return {
        x: 160 + (framed.x - state.x) * 180 / state.ratio,
        y: 90 + (framed.y - state.y) * 180 / state.ratio,
      };
    };

    for (const point of [{ x: -1, y: 0 }, { x: 1.5, y: 2 }]) {
      const before = viewportPosition(point, source, camera);
      const after = viewportPosition(point, target, converted);
      expect(after.x).toBeCloseTo(before.x);
      expect(after.y).toBeCloseTo(before.y);
    }
  });

  it("calculates the zoom and visual center needed for an inset viewport", () => {
    const bounds: ViewportBounds = { left: -20, top: 10, right: 340, bottom: 170 };
    expect(fitCorrection(bounds, { width: 320, height: 180 }, 20)).toEqual({
      center: { x: 160, y: 90 },
      viewportCenter: { x: 160, y: 90 },
      scale: 360 / 280,
      settled: false,
    });
  });

  it("centers rendered bounds inside asymmetric overlay insets", () => {
    const bounds: ViewportBounds = { left: 20, top: 40, right: 260, bottom: 180 };
    expect(
      fitCorrection(bounds, { width: 320, height: 200 }, { top: 40, right: 60, bottom: 20, left: 20 }),
    ).toEqual({
      center: { x: 140, y: 110 },
      viewportCenter: { x: 140, y: 110 },
      scale: 1,
      settled: true,
    });
  });

  it("fits long labels and large markers while excluding unrequested nodes", () => {
    const { renderer, dimensions, getBBox } = fakeRenderer();
    fitRenderedGraph(renderer as never, ["left", "right"], { padding: 20 });

    const bounds = measureRenderedBounds(renderer as never, ["left", "right"]);
    expect(bounds).not.toBeNull();
    expect(bounds!.left).toBeGreaterThanOrEqual(19);
    expect(bounds!.top).toBeGreaterThanOrEqual(19);
    expect(bounds!.right).toBeLessThanOrEqual(dimensions.width - 19);
    expect(bounds!.bottom).toBeLessThanOrEqual(dimensions.height - 19);
    expect(getBBox().x[1]).toBeLessThan(3);
    expect(renderer.refresh.mock.calls.length).toBeLessThanOrEqual(10);
  });

  it("keeps narrow marker fitting independent of fixed-pixel label width", () => {
    const { graph, renderer } = fakeRenderer();
    graph.setNodeAttribute("right", "label", "A".repeat(200));

    const markerPlan = planRenderedGraphFit(renderer as never, ["left", "right"], 20, false);
    const renderedPlan = planRenderedGraphFit(renderer as never, ["left", "right"], 20, true);

    expect(markerPlan.camera.ratio).toBeLessThan(2);
    expect(renderedPlan.camera.ratio).toBeGreaterThan(markerPlan.camera.ratio * 10);
  });

  it("reserves a constant trailing extent without fitting the full label", () => {
    const { graph, renderer } = fakeRenderer();
    graph.setNodeAttribute("right", "label", "A".repeat(200));

    const markerPlan = planRenderedGraphFit(renderer as never, ["left", "right"], 20, false, 51);
    const renderedPlan = planRenderedGraphFit(renderer as never, ["left", "right"], 20, true);

    expect(markerPlan.camera.ratio).toBeLessThan(renderedPlan.camera.ratio);
    renderer.getCamera().setState(markerPlan.camera);
    const markerBounds = measureRenderedBounds(renderer as never, ["left", "right"], false)!;
    expect(markerBounds.right).toBeLessThanOrEqual(250);
  });

  it("preserves wide rendered-label fitting while narrow marker bounds stay contained", () => {
    const { renderer, dimensions } = fakeRenderer();
    fitRenderedGraph(renderer as never, ["left", "right"], { padding: 20, includeLabels: false });

    const markerBounds = measureRenderedBounds(renderer as never, ["left", "right"], false)!;
    expect(markerBounds.left).toBeGreaterThanOrEqual(19);
    expect(markerBounds.top).toBeGreaterThanOrEqual(19);
    expect(markerBounds.right).toBeLessThanOrEqual(dimensions.width - 19);
    expect(markerBounds.bottom).toBeLessThanOrEqual(dimensions.height - 19);

    fitRenderedGraph(renderer as never, ["left", "right"], { padding: 20 });
    const renderedBounds = measureRenderedBounds(renderer as never, ["left", "right"])!;
    expect(renderedBounds.right).toBeLessThanOrEqual(dimensions.width - 19);
  });

  it("derives collapsed and expanded bottom insets from the visible focus bar", () => {
    const { renderer, setFocusBounds } = fakeRenderer();
    vi.stubGlobal("document", {
      querySelector: vi.fn(() => null),
    });

    setFocusBounds({ left: 16, top: 108, right: 304, bottom: 164 });
    expect(graphFitInsets(renderer as never, 20).bottom).toBe(84);
    setFocusBounds({ left: 16, top: 58, right: 304, bottom: 164 });
    expect(graphFitInsets(renderer as never, 20).bottom).toBe(134);

    vi.unstubAllGlobals();
  });

  it("measures only selected rendered labels and includes the foreign brain mark", () => {
    const { graph, renderer, setDisplayedLabels } = fakeRenderer();
    setDisplayedLabels(["left"]);
    const withoutForeignLabel = measureRenderedBounds(renderer as never, ["left", "right"])!;

    setDisplayedLabels(["left", "right"]);
    const withForeignLabel = measureRenderedBounds(renderer as never, ["left", "right"])!;
    graph.setNodeAttribute("right", "foreign", false);
    const withoutBrainMark = measureRenderedBounds(renderer as never, ["left", "right"])!;

    expect(withForeignLabel.right).toBeGreaterThan(withoutForeignLabel.right);
    expect(withForeignLabel.right - withoutBrainMark.right).toBe(17);
  });

  it("derives a reusable bounding-box and camera plan", () => {
    const { renderer, camera } = fakeRenderer();
    const plan = planRenderedGraphFit(renderer as never, ["left", "right"], 20);
    camera.setState({ x: 0, y: 0, ratio: 0.2 });

    applyRenderedGraphFit(renderer as never, plan);

    expect(renderer.setCustomBBox).toHaveBeenLastCalledWith(plan.bbox);
    expect(camera.getState()).toEqual(plan.camera);
  });

  it("uses a safe default view for an empty included set", () => {
    const { renderer, camera, getBBox } = fakeRenderer();
    const onAnimationComplete = vi.fn();
    fitRenderedGraph(renderer as never, [], { onAnimationComplete });
    expect(getBBox()).toEqual({ x: [0, 1], y: [0, 1] });
    expect(camera.getState()).toEqual({ x: 0.5, y: 0.5, angle: 0, ratio: 1.12 });
    expect(onAnimationComplete).toHaveBeenCalledOnce();
  });

  it("fits inside asymmetric insets and expands a restrictive camera limit", () => {
    const { renderer, dimensions, getMaximumRatio } = fakeRenderer(1);
    fitRenderedGraph(renderer as never, ["left", "right"], {
      padding: { top: 40, right: 40, bottom: 20, left: 20 },
    });

    const bounds = measureRenderedBounds(renderer as never, ["left", "right"]);
    expect(bounds).not.toBeNull();
    expect(bounds!.left).toBeGreaterThanOrEqual(19);
    expect(bounds!.top).toBeGreaterThanOrEqual(39);
    expect(bounds!.right).toBeLessThanOrEqual(dimensions.width - 39);
    expect(bounds!.bottom).toBeLessThanOrEqual(dimensions.height - 19);
    expect(getMaximumRatio()).toBeGreaterThan(1);
  });
});
