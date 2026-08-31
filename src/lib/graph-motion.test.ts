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
  removeItem(key: string): void {
    this.values.delete(key);
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
  let bbox = { x: [-2, 2] as [number, number], y: [-1, 2] as [number, number] };
  let cameraState = { x: 0.5, y: 0.5, angle: 0, ratio: 1 };
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
  const renderer = {
    getDimensions: vi.fn(() => ({ width: 390, height: 844 })),
    getCamera: vi.fn(() => camera),
    setCustomBBox: vi.fn((next: typeof bbox) => {
      bbox = next;
    }),
    getCustomBBox: vi.fn(() => bbox),
    getBBox: vi.fn(() => ({ x: [-1, 1], y: [0, 1] })),
    refresh: vi.fn(),
    scheduleRefresh: vi.fn(),
    getGraph: vi.fn(() => graph),
    getNodeDisplayedLabels: vi.fn(() => new Set<string>()),
    getSettings: vi.fn(() => ({ labelWeight: "500", labelSize: 13, labelFont: "sans-serif" })),
    getSetting: vi.fn(() => 10),
    setSetting: vi.fn(),
    getCanvases: vi.fn(() => ({})),
    getNodeDisplayData: vi.fn((id: string) => {
      const scale = Math.max(bbox.x[1] - bbox.x[0], bbox.y[1] - bbox.y[0]);
      return {
        x: 0.5 + ((graph.getNodeAttribute(id, "x") as number) - (bbox.x[0] + bbox.x[1]) / 2) / scale,
        y: 0.5 + ((graph.getNodeAttribute(id, "y") as number) - (bbox.y[0] + bbox.y[1]) / 2) / scale,
        size: graph.getNodeAttribute(id, "size") as number,
        hidden: false,
      };
    }),
    framedGraphToViewport: vi.fn((point: { x: number; y: number }) => ({
      x: 195 + ((point.x - cameraState.x) * 120) / cameraState.ratio,
      y: 422 + ((point.y - cameraState.y) * 120) / cameraState.ratio,
    })),
    viewportToFramedGraph: vi.fn((point: { x: number; y: number }) => ({
      x: cameraState.x + ((point.x - 195) * cameraState.ratio) / 120,
      y: cameraState.y + ((point.y - 422) * cameraState.ratio) / 120,
    })),
    scaleSize: vi.fn((size: number) => size / Math.sqrt(cameraState.ratio)),
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
    expect(camera.animate).not.toHaveBeenCalled();
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

  it("freezes the current frame on cancellation and accepts a later settle", () => {
    const { camera, renderer, graph, data } = fixture(false);
    const frames = new Map<number, FrameRequestCallback>();
    let nextFrame = 1;
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        const id = nextFrame++;
        frames.set(id, callback);
        return id;
      }),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => frames.delete(id)));
    const controller = new GraphMotionController(renderer as never, graph, data);

    controller.settle("initial", graph.nodes());
    const firstWorker = FakeWorker.instances[0];
    firstWorker.emit("message", {
      generation: (firstWorker.request as { generation: number }).generation,
      positions: { a: { x: -3, y: -2 }, b: { x: 3, y: 2 }, c: { x: 0, y: 3 } },
    });
    const firstFrame = frames.get(1)!;
    firstFrame(performance.now() + 100);
    const frozen = Object.fromEntries(
      graph.nodes().map((node) => [node, { ...graph.getNodeAttributes(node) }]),
    );
    const frozenCamera = camera.getState();

    controller.cancel();
    firstFrame(performance.now() + 500);
    expect(Object.fromEntries(graph.nodes().map((node) => [node, graph.getNodeAttributes(node)])))
      .toEqual(frozen);
    expect(camera.getState()).toEqual(frozenCamera);

    controller.settle("filter", graph.nodes());
    expect(FakeWorker.instances).toHaveLength(2);
    expect(FakeWorker.instances[1].request).toBeDefined();
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
    const positions = Object.fromEntries(
      graph.nodes().map((id) => [id, { x: graph.getNodeAttribute(id, "x"), y: graph.getNodeAttribute(id, "y") }]),
    );

    controller.fitView(["a", "b"]);

    expect(renderer.setCustomBBox).toHaveBeenCalled();
    expect(renderer.getNodeDisplayData).not.toHaveBeenCalledWith("c");
    expect(camera.animate).toHaveBeenCalledWith(
      expect.objectContaining({ angle: 0 }),
      { duration: 320, easing: "quadraticInOut" },
      expect.any(Function),
    );
    expect(
      Object.fromEntries(
        graph.nodes().map((id) => [id, { x: graph.getNodeAttribute(id, "x"), y: graph.getNodeAttribute(id, "y") }]),
      ),
    ).toEqual(positions);
    controller.destroy();
  });

  it("commits a fitted view only after its camera animation completes", () => {
    const { storage, camera, renderer, graph, data } = fixture(false);
    const onSettled = vi.fn();
    let completeAnimation: (() => void) | undefined;
    camera.animate.mockImplementation((state, _options, callback) => {
      camera.setState(state);
      completeAnimation = callback;
    });
    const controller = new GraphMotionController(renderer as never, graph, data, onSettled);

    controller.fitView(graph.nodes());
    expect(storage.values.size).toBe(0);
    expect(onSettled).not.toHaveBeenCalled();

    completeAnimation?.();
    expect(storage.values.size).toBe(2);
    expect(onSettled).toHaveBeenCalledOnce();
    controller.destroy();
  });

  it("completes node and camera motion on one timeline with one session commit", () => {
    const { camera, renderer, graph, data } = fixture(false);
    const frames = new Map<number, FrameRequestCallback>();
    let nextFrame = 1;
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      const id = nextFrame++;
      frames.set(id, callback);
      return id;
    }));
    const onSettled = vi.fn();
    const controller = new GraphMotionController(renderer as never, graph, data, onSettled);
    const commit = vi.spyOn(controller, "commitSession");

    controller.settle("initial", graph.nodes());
    const worker = FakeWorker.instances[0];
    worker.emit("message", {
      generation: (worker.request as { generation: number }).generation,
      positions: { a: { x: -3, y: -2 }, b: { x: 3, y: 2 }, c: { x: 0, y: 3 } },
    });
    const firstCamera = camera.getState();
    frames.get(1)!(performance.now() + 450);
    expect(camera.getState()).not.toEqual(firstCamera);
    frames.get(2)!(performance.now() + 1000);

    expect(graph.getNodeAttributes("a")).toMatchObject({ x: -3, y: -2 });
    expect(camera.animate).not.toHaveBeenCalled();
    expect(commit).toHaveBeenCalledOnce();
    expect(onSettled).toHaveBeenCalledOnce();
    controller.destroy();
  });

  it("commits and reports an empty settlement", () => {
    const { storage, renderer, graph, data } = fixture();
    const onSettled = vi.fn();
    const controller = new GraphMotionController(renderer as never, graph, data, onSettled);

    controller.settle("filter", []);

    expect(storage.values.size).toBe(2);
    expect(onSettled).toHaveBeenCalledOnce();
    controller.destroy();
  });

  it("settles a pinned local graph without persisting its view", () => {
    const { storage, renderer, graph, data } = fixture();
    const onSettled = vi.fn();
    const controller = new GraphMotionController(
      renderer as never,
      graph,
      data,
      onSettled,
      "local:a",
      false,
      true,
    );

    controller.settle("initial", graph.nodes(), "a");
    const worker = FakeWorker.instances[0];
    expect(worker.request).toMatchObject({
      width: 390,
      height: 844,
      pinnedId: "a",
      fitViewportAspect: true,
      nodes: expect.arrayContaining([expect.objectContaining({ id: "a" })]),
    });
    worker.emit("message", {
      generation: (worker.request as { generation: number }).generation,
      positions: { a: { x: -1, y: 0 }, b: { x: 2, y: 1 }, c: { x: 0, y: 2 } },
    });

    expect(onSettled).toHaveBeenCalledOnce();
    expect(storage.values.size).toBe(0);
    controller.destroy();
  });

  it("invalidates an incomplete graph session", () => {
    const { storage, renderer, graph, data } = fixture();
    const controller = new GraphMotionController(renderer as never, graph, data);
    controller.commitSession();
    expect(storage.values.size).toBe(2);

    expect(controller.invalidateSession()).toBe(true);

    expect(storage.values.size).toBe(0);
    controller.destroy();
  });

  it("isolates sessions by graph scope", () => {
    const { storage, renderer, graph, data } = fixture();
    const controller = new GraphMotionController(renderer as never, graph, data, undefined, "brain:a");
    controller.commitSession();

    controller.setSessionScope("brain:b");
    expect(controller.restoreSession()).toEqual({ positions: false, view: false });
    controller.commitSession();
    expect(storage.values.size).toBe(4);

    controller.setSessionScope("brain:a");
    expect(controller.restoreSession()).toEqual({ positions: true, view: true });
    controller.destroy();
  });

  it("does not report settlement when stale cache entries cannot be removed", () => {
    const { storage, renderer, graph, data } = fixture();
    const onSettled = vi.fn();
    storage.values.set("stale", "entry");
    vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    vi.spyOn(storage, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const controller = new GraphMotionController(renderer as never, graph, data, onSettled);

    controller.settle("filter", []);

    expect(onSettled).not.toHaveBeenCalled();
    expect(storage.values.get("stale")).toBe("entry");
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
