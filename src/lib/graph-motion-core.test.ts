import { describe, expect, it, vi } from "vitest";
import {
  MotionGeneration,
  ResponsiveGraphScheduler,
  adaptPositionsToViewport,
  animationDuration,
  graphSignature,
  graphViewCacheKey,
  loadGraphView,
  loadPositions,
  motionPlan,
  positionBounds,
  positionCacheKey,
  saveGraphView,
  savePositions,
  viewportClass,
  type GraphPositions,
  type PositionStorage,
} from "./graph-motion-core";

const POSITIONS: GraphPositions = {
  a: { x: -1, y: -1 },
  b: { x: 1, y: 1 },
};

function extent(positions: GraphPositions, axis: "x" | "y"): number {
  const values = Object.values(positions).map((point) => point[axis]);
  return Math.max(...values) - Math.min(...values);
}

describe("responsive graph motion helpers", () => {
  it("classifies portrait, square, and landscape viewports", () => {
    expect(viewportClass(390, 844)).toBe("portrait");
    expect(viewportClass(800, 800)).toBe("square");
    expect(viewportClass(1440, 900)).toBe("landscape");
  });

  it("adapts graph spread to the viewport without changing a pinned point", () => {
    const portrait = adaptPositionsToViewport(POSITIONS, 390, 844);
    const landscape = adaptPositionsToViewport(POSITIONS, 1440, 900);
    expect(extent(portrait, "x") / extent(portrait, "y")).toBeLessThan(1);
    expect(extent(landscape, "x") / extent(landscape, "y")).toBeGreaterThan(1);

    const pinned = adaptPositionsToViewport(POSITIONS, 390, 844, "a");
    expect(pinned.a).toEqual(POSITIONS.a);
  });

  it("returns bounded work plans for small and 2,000-node graphs", () => {
    expect(motionPlan("initial", 2).iterations).toBe(0);
    const large = motionPlan("initial", 2000);
    expect(large.iterations).toBeLessThanOrEqual(12);
    expect(large.workerTimeout + large.duration).toBeLessThan(2500);
    expect(motionPlan("drag", 2000).duration).toBeLessThan(large.duration);
    expect(animationDuration(large, true)).toBe(0);
    expect(animationDuration(large, false)).toBe(large.duration);
  });

  it("builds deterministic signatures independent of input order", () => {
    const first = graphSignature([{ id: "b" }, { id: "a" }], [{ source: "b", target: "a" }]);
    const second = graphSignature([{ id: "a" }, { id: "b" }], [{ source: "a", target: "b" }]);
    expect(first).toBe(second);
  });

  it("pads visible bounds, including a single node", () => {
    expect(positionBounds(POSITIONS, ["a"])).toEqual({ x: [-1.5, -0.5], y: [-1.5, -0.5] });
    const bounds = positionBounds(POSITIONS, ["a", "b"]);
    expect(bounds.x[0]).toBeLessThan(POSITIONS.a.x);
    expect(bounds.x[1]).toBeGreaterThan(POSITIONS.b.x);
  });
});

describe("motion generation", () => {
  it("invalidates stale work when a newer generation starts or cancels", () => {
    const generations = new MotionGeneration();
    const first = generations.next();
    const second = generations.next();
    expect(generations.isCurrent(first)).toBe(false);
    expect(generations.isCurrent(second)).toBe(true);
    generations.cancel();
    expect(generations.isCurrent(second)).toBe(false);
  });
});

describe("responsive graph scheduling", () => {
  it("ignores minor changes and debounces repeated meaningful resizes", () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const resize = new ResponsiveGraphScheduler({ width: 390, height: 844, policy: "narrow" }, callback);
    expect(resize.hasPending()).toBe(false);
    expect(resize.update({ width: 400, height: 850, policy: "narrow" })).toBe(false);
    expect(resize.update({ width: 844, height: 390, policy: "wide" })).toBe(true);
    expect(resize.hasPending()).toBe(true);
    expect(resize.update({ width: 900, height: 390, policy: "wide" })).toBe(true);
    vi.advanceTimersByTime(179);
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledOnce();
    expect(resize.hasPending()).toBe(false);
    resize.cancel();
    vi.useRealTimers();
  });

  it("settles rapid measured changes once at the final dimensions and ignores unchanged overlays", () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const resize = new ResponsiveGraphScheduler({ width: 1200, height: 800, policy: false }, callback);

    expect(resize.update({ width: 1200, height: 800, policy: false })).toBe(false);
    expect(resize.update({ width: 900, height: 800, policy: false })).toBe(true);
    expect(resize.update({ width: 1040, height: 800, policy: false })).toBe(true);
    expect(resize.update({ width: 1040, height: 800, policy: false })).toBe(true);
    vi.runAllTimers();

    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith({ width: 1040, height: 800, policy: false });
    vi.useRealTimers();
  });

  it("applies final dimensions and breakpoint settings once for one burst", () => {
    vi.useFakeTimers();
    const resizeRenderer = vi.fn();
    const applySettings = vi.fn();
    const requestSettle = vi.fn();
    const resize = new ResponsiveGraphScheduler(
      { width: 720, height: 600, policy: "desktop" },
      ({ width, height, policy }) => {
        resizeRenderer(width, height);
        applySettings(policy);
        requestSettle();
      },
    );

    expect(resize.update({ width: 708.5, height: 601, policy: "desktop" })).toBe(false);
    expect(resize.update({ width: 699.75, height: 602, policy: "narrow" })).toBe(true);
    expect(resize.update({ width: 688.25, height: 604, policy: "narrow" })).toBe(true);
    vi.runAllTimers();

    expect(resizeRenderer).toHaveBeenCalledOnce();
    expect(resizeRenderer).toHaveBeenCalledWith(688.25, 604);
    expect(applySettings).toHaveBeenCalledOnce();
    expect(applySettings).toHaveBeenCalledWith("narrow");
    expect(requestSettle).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("defers and flushes final responsive work during an interaction", () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const resize = new ResponsiveGraphScheduler({ width: 390, height: 844, policy: true }, callback);
    expect(resize.update({ width: 844, height: 390, policy: false })).toBe(true);
    expect(resize.defer({ width: 900, height: 390, policy: false })).toBe(true);
    vi.runAllTimers();
    expect(callback).not.toHaveBeenCalled();
    expect(resize.flush()).toBe(true);
    expect(callback).toHaveBeenCalledWith({ width: 900, height: 390, policy: false });
    vi.useRealTimers();
  });

  it("reports when deferred interaction work has nothing to flush", () => {
    const callback = vi.fn();
    const resize = new ResponsiveGraphScheduler({ width: 390, height: 844, policy: true }, callback);

    expect(resize.defer({ width: 391, height: 844, policy: true })).toBe(false);
    expect(resize.hasPending()).toBe(false);
    expect(resize.flush()).toBe(false);
    expect(callback).not.toHaveBeenCalled();
  });

  it("can consume responsive work with an interaction-specific callback", () => {
    const callback = vi.fn();
    const interactionCallback = vi.fn();
    const resize = new ResponsiveGraphScheduler({ width: 390, height: 844, policy: true }, callback);

    expect(resize.defer({ width: 844, height: 390, policy: false })).toBe(true);
    expect(resize.flush(interactionCallback)).toBe(true);
    expect(interactionCallback).toHaveBeenCalledWith({ width: 844, height: 390, policy: false });
    expect(callback).not.toHaveBeenCalled();
  });
});

describe("session position cache", () => {
  class MemoryStorage implements PositionStorage {
    values = new Map<string, string>();
    getItem(key: string): string | null {
      return this.values.get(key) ?? null;
    }
    setItem(key: string, value: string): void {
      this.values.set(key, value);
    }
  }

  it("round-trips compatible positions", () => {
    const storage = new MemoryStorage();
    const key = positionCacheKey("signature", "portrait");
    savePositions(storage, key, POSITIONS);
    expect(loadPositions(storage, key, ["a", "b"])).toEqual(POSITIONS);
  });

  it("rejects malformed and stale entries and tolerates unavailable storage", () => {
    const storage = new MemoryStorage();
    storage.values.set("key", "not json");
    expect(loadPositions(storage, "key", ["a", "b"])).toBeNull();
    storage.values.set("key", JSON.stringify({ version: 1, positions: { a: POSITIONS.a } }));
    expect(loadPositions(storage, "key", ["a", "b"])).toBeNull();

    const unavailable: PositionStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadPositions(unavailable, "key", ["a"])).toBeNull();
    expect(savePositions(unavailable, "key", POSITIONS)).toBe(false);
  });

  it("round-trips a finite camera and matching graph bounds", () => {
    const storage = new MemoryStorage();
    const key = graphViewCacheKey("signature", "landscape");
    const view = {
      camera: { x: 0.3, y: 0.7, angle: 0, ratio: 0.45 },
      bbox: { x: [-4, 8] as [number, number], y: [-2, 5] as [number, number] },
    };
    saveGraphView(storage, key, view);
    expect(loadGraphView(storage, key)).toEqual(view);
  });

  it("rejects invalid graph view state", () => {
    const storage = new MemoryStorage();
    storage.values.set(
      "key",
      JSON.stringify({
        version: 1,
        view: {
          camera: { x: 0.5, y: 0.5, angle: 0, ratio: 0 },
          bbox: { x: [2, 1], y: [0, 1] },
        },
      }),
    );
    expect(loadGraphView(storage, "key")).toBeNull();
    storage.values.set(
      "key",
      JSON.stringify({
        version: 1,
        view: {
          camera: { x: 0.5, y: 0.5, angle: 0, ratio: 1 },
          bbox: { x: [], y: [0, 1] },
        },
      }),
    );
    expect(loadGraphView(storage, "key")).toBeNull();
  });
});
