import Graph from "graphology";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  graphSignature,
  graphViewCacheKey,
  positionCacheKey,
  saveGraphView,
  savePositions,
  viewportClass,
} from "./graph-motion-core";
import { GraphMotionController } from "./graph-motion";

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

class FakeWorker {
  static instances: FakeWorker[] = [];
  request: unknown;
  terminated = false;
  private listeners = new Map<string, ((event: MessageEvent) => void)[]>();

  constructor() {
    FakeWorker.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  postMessage(request: unknown): void {
    this.request = request;
  }

  terminate(): void {
    this.terminated = true;
  }

  emit(type: "message" | "error", data: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ data } as MessageEvent);
    }
  }
}

function fixture(reducedMotion = true) {
  const storage = new MemoryStorage();
  const camera = {
    getState: vi.fn(() => ({ x: 0.5, y: 0.5, angle: 0, ratio: 1 })),
    setState: vi.fn(),
    animate: vi.fn((_state, _options, callback?: () => void) => callback?.()),
  };
  const renderer = {
    getDimensions: vi.fn(() => ({ width: 390, height: 844 })),
    getCamera: vi.fn(() => camera),
    setCustomBBox: vi.fn(),
    getCustomBBox: vi.fn(() => ({ x: [-2, 2], y: [-1, 2] })),
    getBBox: vi.fn(() => ({ x: [-1, 1], y: [0, 1] })),
    refresh: vi.fn(),
    scheduleRefresh: vi.fn(),
  };
  const graph = new Graph();
  graph.addNode("a", { x: -1, y: 0, size: 5 });
  graph.addNode("b", { x: 1, y: 0, size: 5 });
  graph.addNode("c", { x: 0, y: 1, size: 5 });
  const data = {
    nodes: [{ id: "a" }, { id: "b" }, { id: "c" }],
    edges: [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
    ],
  };
  vi.stubGlobal("window", {
    sessionStorage: storage,
    setTimeout,
    clearTimeout,
    matchMedia: () => ({ matches: reducedMotion }),
  });
  vi.stubGlobal("document", { hidden: false });
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  return { storage, camera, renderer, graph, data };
}

describe("GraphMotionController", () => {
  beforeEach(() => {
    FakeWorker.instances = [];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ignores stale worker results and applies only the latest generation", () => {
    const { camera, renderer, graph, data } = fixture();
    const controller = new GraphMotionController(renderer as never, graph, data);

    controller.settle("initial", graph.nodes());
    const first = FakeWorker.instances[0];
    controller.settle("resize", graph.nodes());
    const second = FakeWorker.instances[1];
    expect(first.terminated).toBe(true);

    first.emit("message", {
      generation: (first.request as { generation: number }).generation,
      positions: { a: { x: 100, y: 100 }, b: { x: 100, y: 100 }, c: { x: 100, y: 100 } },
    });
    expect(graph.getNodeAttribute("a", "x")).toBe(-1);

    second.emit("message", {
      generation: (second.request as { generation: number }).generation,
      positions: { a: { x: -2, y: -2 }, b: { x: 2, y: 2 }, c: { x: 0, y: 2 } },
    });
    expect(graph.getNodeAttributes("a")).toMatchObject({ x: -2, y: -2 });
    expect(graph.getNodeAttributes("b")).toMatchObject({ x: 2, y: 2 });
    expect(graph.getNodeAttributes("c")).toMatchObject({ x: 0, y: 2 });
    expect(camera.setState).toHaveBeenCalled();
    controller.destroy();
  });

  it("uses requestAnimationFrame when motion is enabled and cancels it", () => {
    const { renderer, graph, data } = fixture(false);
    const controller = new GraphMotionController(renderer as never, graph, data);
    controller.settle("initial", graph.nodes());
    const worker = FakeWorker.instances[0];
    worker.emit("message", {
      generation: (worker.request as { generation: number }).generation,
      positions: { a: { x: -2, y: -2 }, b: { x: 2, y: 2 }, c: { x: 0, y: 2 } },
    });
    expect(requestAnimationFrame).toHaveBeenCalledOnce();
    controller.cancel();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
  });

  it("settles zoom from current positions without resetting the camera", () => {
    const { camera, renderer, graph, data } = fixture();
    const controller = new GraphMotionController(renderer as never, graph, data);
    graph.setNodeAttribute("a", "x", 4);

    controller.settle("zoom", graph.nodes(), undefined, undefined, false, 0.5);
    const worker = FakeWorker.instances[0];
    const request = worker.request as {
      generation: number;
      nodes: { id: string; x: number }[];
    };
    expect(request.nodes.find(({ id }) => id === "a")?.x).toBe(3);
    worker.emit("message", {
      generation: request.generation,
      positions: { a: { x: 5, y: 0 }, b: { x: 2, y: 0 }, c: { x: 0, y: 2 } },
    });

    expect(graph.getNodeAttribute("a", "x")).toBe(5);
    expect(camera.setState).not.toHaveBeenCalled();
    expect(camera.animate).not.toHaveBeenCalled();
    controller.destroy();
  });

  it("settles a dragged neighborhood without fitting the camera", () => {
    const { camera, renderer, graph, data } = fixture();
    const controller = new GraphMotionController(renderer as never, graph, data);

    controller.settle("drag", graph.nodes(), "a", graph.nodes());
    const worker = FakeWorker.instances[0];
    const request = worker.request as { generation: number };
    worker.emit("message", {
      generation: request.generation,
      positions: { a: { x: -1, y: 0 }, b: { x: 2, y: 1 }, c: { x: 0, y: 2 } },
    });

    expect(graph.getNodeAttributes("b")).toMatchObject({ x: 2, y: 1 });
    expect(camera.setState).not.toHaveBeenCalled();
    expect(camera.animate).not.toHaveBeenCalled();
    controller.destroy();
  });

  it("fits the visible graph only when requested", () => {
    const { camera, renderer, graph, data } = fixture(false);
    const controller = new GraphMotionController(renderer as never, graph, data);

    controller.fitView(["a", "b"]);

    expect(renderer.setCustomBBox).toHaveBeenCalledOnce();
    expect(camera.animate).toHaveBeenCalledWith(
      { x: 0.5, y: 0.5, angle: 0, ratio: 1.12 },
      { duration: 320, easing: "quadraticInOut" },
      expect.any(Function),
    );
    controller.destroy();
  });

  it("restores only a compatible graph and viewport cache entry", () => {
    const { storage, renderer, graph, data } = fixture();
    const signature = graphSignature(data.nodes, data.edges);
    const key = positionCacheKey(signature, viewportClass(390, 844));
    savePositions(storage, key, {
      a: { x: 10, y: 11 },
      b: { x: 12, y: 13 },
      c: { x: 14, y: 15 },
    });
    const controller = new GraphMotionController(renderer as never, graph, data);
    expect(controller.restoreSession()).toEqual({ positions: true, view: false });
    expect(graph.getNodeAttributes("c")).toMatchObject({ x: 14, y: 15 });
    controller.destroy();
  });

  it("restores positions, bounds, and camera without animation", () => {
    const { storage, camera, renderer, graph, data } = fixture();
    const signature = graphSignature(data.nodes, data.edges);
    const view = viewportClass(390, 844);
    savePositions(storage, positionCacheKey(signature, view), {
      a: { x: 10, y: 11 },
      b: { x: 12, y: 13 },
      c: { x: 14, y: 15 },
    });
    saveGraphView(storage, graphViewCacheKey(signature, view), {
      camera: { x: 0.2, y: 0.8, angle: 0, ratio: 0.4 },
      bbox: { x: [8, 16], y: [9, 17] },
    });

    const controller = new GraphMotionController(renderer as never, graph, data);
    expect(controller.restoreSession()).toEqual({ positions: true, view: true });
    expect(renderer.setCustomBBox).toHaveBeenCalledWith({ x: [8, 16], y: [9, 17] });
    expect(renderer.refresh).toHaveBeenCalled();
    expect(camera.setState).toHaveBeenCalledWith({ x: 0.2, y: 0.8, angle: 0, ratio: 0.4 });
    expect(camera.animate).not.toHaveBeenCalled();
    controller.destroy();
  });
});
