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
import { graphLabelBox, layoutGraphLabel } from "./graph-style";

/**
 * What `layoutGraphLabel` would produce for a label at a 200 pixel budget in a
 * 6-pixel-per-character font, wrapped onto at most three lines.
 */
function labelMeasurements(label: string) {
  const layout = layoutGraphLabel(label, 200, 13, (value) => [...value].length * 6);
  return { labelWidth: layout.width, labelHeight: layout.height };
}

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
      // The reducer attaches the shared label layout's measurements; fitting
      // reads them rather than measuring text again.
      ...labelMeasurements(graph.getNodeAttribute(id, "label") as string),
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

  it("cannot oscillate between label size and camera", () => {
    // Rendered label size follows the camera, and label-aware fitting reads
    // labels to choose the camera, which is a loop. It is broken on the fit
    // side: the graph fits its markers, so however large the labels measure,
    // the camera it settles on is the same one.
    const { graph, renderer } = fakeRenderer();
    graph.setNodeAttribute("right", "label", "Short");
    const withShortLabels = planRenderedGraphFit(renderer as never, ["left", "right"], 20, false);
    graph.setNodeAttribute(
      "right",
      "label",
      "A deliberately enormous rendered title that dwarfs every marker on the graph",
    );
    const withLongLabels = planRenderedGraphFit(renderer as never, ["left", "right"], 20, false);
    expect(withLongLabels.camera).toEqual(withShortLabels.camera);
  });

  it("settles a fit in one pass", () => {
    const { renderer, dimensions } = fakeRenderer();
    const plan = planRenderedGraphFit(renderer as never, ["left", "right"], 20, false);
    renderer.getCamera().setState(plan.camera);
    // Planning again from the settled camera changes nothing, so a fit does not
    // chase itself across repeated passes.
    const again = planRenderedGraphFit(renderer as never, ["left", "right"], 20, false);
    expect(again.camera).toEqual(plan.camera);
    const bounds = measureRenderedBounds(renderer as never, ["left", "right"], false)!;
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(dimensions.width);
  });

  it("keeps marker-only fitting independent of label extent", () => {
    const { graph, renderer } = fakeRenderer();
    graph.setNodeAttribute("right", "label", "A very long rendered node title ".repeat(6));

    const markerBounds = measureRenderedBounds(renderer as never, ["left", "right"], false)!;
    const labelBounds = measureRenderedBounds(renderer as never, ["left", "right"], true)!;

    // Excluding labels can only ever measure a smaller box.
    expect(labelBounds.bottom).toBeGreaterThan(markerBounds.bottom);
    expect(labelBounds.top).toBe(markerBounds.top);
  });

  it("accounts for a wrapped label's height rather than its length", () => {
    const { graph, renderer, setDisplayedLabels } = fakeRenderer();
    setDisplayedLabels(["right"]);
    // One line, then the same node wrapped onto three.
    graph.setNodeAttribute("right", "label", "Short");
    const oneLine = measureRenderedBounds(renderer as never, ["right"])!;
    const wrappedLabel = "Retrieval practice beats rereading the original source material";
    graph.setNodeAttribute("right", "label", wrappedLabel);
    const wrapped = measureRenderedBounds(renderer as never, ["right"])!;

    const layout = layoutGraphLabel(wrappedLabel, 200, 13, (value) => [...value].length * 6);
    const oneLineLayout = layoutGraphLabel("Short", 200, 13, (value) => [...value].length * 6);
    expect(layout.lines).toHaveLength(3);
    // A wrapped label grows the measured bounds downward. Its width is bounded
    // by centring, so extra text becomes height, not reach to one side.
    expect(wrapped.bottom - oneLine.bottom).toBeCloseTo(layout.height - oneLineLayout.height, 6);
    expect(wrapped.right - wrapped.left).toBeCloseTo(layout.width, 6);
  });

  it("frames a centred label symmetrically about its node", () => {
    const { graph, renderer, setDisplayedLabels } = fakeRenderer();
    setDisplayedLabels(["right"]);
    graph.setNodeAttribute("right", "label", "A centred title");
    const bounds = measureRenderedBounds(renderer as never, ["right"])!;
    const data = renderer.getNodeDisplayData("right");
    const center = renderer.framedGraphToViewport(data);
    const box = graphLabelBox(
      { lines: ["x"], width: data.labelWidth!, height: data.labelHeight!, lineHeight: 0 },
      center,
      renderer.scaleSize(data.size),
    )!;
    expect(bounds.left).toBeCloseTo(box.left, 6);
    expect(bounds.right).toBeCloseTo(box.right, 6);
    expect(center.x - bounds.left).toBeCloseTo(bounds.right - center.x, 6);
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

  it("does not charge a corner control twice, and counts About at the bottom", () => {
    const { renderer } = fakeRenderer();
    // Host is 320x180. The toolbar takes the top band; the navigation button
    // sits inside that band at the right; About sits in the bottom right.
    const rects: Record<string, Partial<DOMRect>> = {
      ".graph-controls": { left: 8, top: 8, right: 150, bottom: 40, width: 142, height: 32 },
      ".site-header": { left: 260, top: 8, right: 308, bottom: 40, width: 48, height: 32 },
      ".graph-about": { left: 220, top: 150, right: 310, bottom: 175, width: 90, height: 25 },
    };
    vi.stubGlobal("document", {
      querySelector: vi.fn((selector: string) =>
        rects[selector] ? { getBoundingClientRect: () => rects[selector] } : null
      ),
    });

    let insets = graphFitInsets(renderer as never, 20);
    expect(insets.top).toBe(52);
    // The button is inside the top band already: no right-hand band for it,
    // which is what kept every phone fit 24 pixels left of centre.
    expect(insets.right).toBe(20);
    expect(insets.bottom).toBe(42);
    expect(insets.left).toBe(20);

    // A header that reaches below the top band does need room on the right.
    rects[".site-header"] = { left: 260, top: 8, right: 308, bottom: 70, width: 48, height: 62 };
    insets = graphFitInsets(renderer as never, 20);
    expect(insets.right).toBe(72);

    // About hidden: no bottom band for it.
    rects[".graph-about"] = { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
    expect(graphFitInsets(renderer as never, 20).bottom).toBe(20);

    vi.unstubAllGlobals();
  });

  it("keeps a required title inside a marker-only fit", () => {
    // The focused note on a phone: labels are left out of the fit so long
    // titles cannot shrink the composition, but the focused note's own title,
    // on its plate, must not be cut at the edge.
    const { renderer, dimensions, setDisplayedLabels } = fakeRenderer();
    setDisplayedLabels(["right"]);
    fitRenderedGraph(renderer as never, ["left", "right"], {
      includeLabels: false,
      padding: 10,
      labelIds: ["right"],
    });
    const withTitle = measureRenderedBounds(renderer as never, ["left", "right"], true)!;
    expect(withTitle.right).toBeLessThanOrEqual(dimensions.width - 9);
    expect(withTitle.bottom).toBeLessThanOrEqual(dimensions.height - 9);

    // Without the requirement the same fit lets that title run past the edge.
    fitRenderedGraph(renderer as never, ["left", "right"], { includeLabels: false, padding: 10 });
    const markersOnly = measureRenderedBounds(renderer as never, ["left", "right"], true)!;
    expect(markersOnly.right).toBeGreaterThan(dimensions.width - 9);
  });

  it("measures only the labels that are actually rendered", () => {
    const { renderer, setDisplayedLabels } = fakeRenderer();
    setDisplayedLabels([]);
    const unlabelled = measureRenderedBounds(renderer as never, ["right"])!;

    setDisplayedLabels(["right"]);
    const labelled = measureRenderedBounds(renderer as never, ["right"])!;

    expect(labelled.bottom).toBeGreaterThan(unlabelled.bottom);
    expect(labelled.right - labelled.left).toBeGreaterThan(unlabelled.right - unlabelled.left);
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

  it("fits inside asymmetric insets, zooming in to fill them, within a restrictive camera limit", () => {
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
    // This graph is smaller than its room at the starting camera, so the fit
    // zooms in to fill the width rather than stopping where it began, and the
    // camera it lands on is inside the limit it was given.
    expect(bounds!.right - bounds!.left).toBeGreaterThan(dimensions.width - 60 - 8);
    expect(renderer.getCamera().getState().ratio).toBeLessThan(1);
    expect(renderer.getCamera().getState().ratio).toBeLessThanOrEqual(getMaximumRatio());
  });

  it("expands a restrictive camera limit only when a fit has to zoom out past it", () => {
    const { renderer, dimensions, getMaximumRatio } = fakeRenderer(1);
    // Insets that leave sixty pixels of width: the labels alone are wider.
    fitRenderedGraph(renderer as never, ["left", "right"], {
      padding: { top: 20, right: 130, bottom: 20, left: 130 },
    });

    const bounds = measureRenderedBounds(renderer as never, ["left", "right"]);
    expect(bounds).not.toBeNull();
    expect(bounds!.top).toBeGreaterThanOrEqual(19);
    expect(bounds!.bottom).toBeLessThanOrEqual(dimensions.height - 19);
    expect(getMaximumRatio()).toBeGreaterThan(1);
    expect(renderer.getCamera().getState().ratio).toBeGreaterThan(1);
    expect(renderer.getCamera().getState().ratio).toBeLessThanOrEqual(getMaximumRatio());
  });
});
