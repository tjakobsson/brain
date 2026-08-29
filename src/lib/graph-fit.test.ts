import Graph from "graphology";
import { describe, expect, it, vi } from "vitest";
import {
  fitCorrection,
  fitRenderedGraph,
  measureRenderedBounds,
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
  });
  graph.addNode("excluded", { x: 100, y: 100, size: 80, label: "Excluded" });
  const dimensions = { width: 320, height: 180 };
  let bbox = { x: [-1.5, 1.5] as [number, number], y: [-0.5, 0.5] as [number, number] };
  let cameraState = { x: 0.5, y: 0.5, angle: 0, ratio: 1 };
  let maximumRatio = initialMaximumRatio;
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
    getDimensions: vi.fn(() => dimensions),
    getCamera: vi.fn(() => camera),
    setCustomBBox: vi.fn((next: typeof bbox) => {
      bbox = next;
    }),
    refresh: vi.fn(),
    getNodeDisplayedLabels: vi.fn(() => new Set(graph.nodes())),
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
  return { graph, renderer, dimensions, camera, getBBox: () => bbox, getMaximumRatio: () => maximumRatio };
}

describe("rendered graph fitting", () => {
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
