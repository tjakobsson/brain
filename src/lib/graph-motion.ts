import type Graph from "graphology";
import type Sigma from "sigma";
import { fitRenderedGraph } from "./graph-fit";
import {
  MotionGeneration,
  adaptPositionsToViewport,
  animationDuration,
  graphSignature,
  graphViewCacheKey,
  loadGraphView,
  loadPositions,
  motionPlan,
  positionCacheKey,
  savePositions,
  saveGraphView,
  viewportClass,
  type GraphPositions,
  type LayoutRequest,
  type LayoutResponse,
  type MotionEdge,
  type MotionTrigger,
  type PositionStorage,
} from "./graph-motion-core";

interface GraphMotionData {
  nodes: { id: string }[];
  edges: MotionEdge[];
}

export class GraphMotionController {
  private readonly baseline: GraphPositions;
  private readonly signature: string;
  private readonly generations = new MotionGeneration();
  private readonly storage: PositionStorage | null;
  private worker: Worker | null = null;
  private workerTimer: number | null = null;
  private animationFrame: number | null = null;
  private cameraAnimating = false;

  constructor(
    private readonly renderer: Sigma,
    private readonly graph: Graph,
    private readonly data: GraphMotionData,
    private readonly onSettled: () => void = () => {},
    private sessionScope = "",
  ) {
    this.baseline = this.capturePositions();
    this.signature = graphSignature(data.nodes, data.edges);
    try {
      this.storage = window.sessionStorage;
    } catch {
      this.storage = null;
    }
  }

  restoreSession(): { positions: boolean; view: boolean } {
    if (!this.storage) return { positions: false, view: false };
    const { width, height } = this.renderer.getDimensions();
    const viewClass = viewportClass(width, height);
    const positions = loadPositions(
      this.storage,
      positionCacheKey(this.cacheSignature(), viewClass),
      this.graph.nodes(),
    );
    if (!positions) return { positions: false, view: false };
    this.applyPositions(positions);
    const view = loadGraphView(this.storage, graphViewCacheKey(this.cacheSignature(), viewClass));
    if (!view) return { positions: true, view: false };
    this.renderer.setCustomBBox(view.bbox);
    this.renderer.refresh();
    this.renderer.getCamera().setState(view.camera);
    return { positions: true, view: true };
  }

  commitSession(): boolean {
    if (!this.storage) return true;
    const { width, height } = this.renderer.getDimensions();
    const viewClass = viewportClass(width, height);
    const signature = this.cacheSignature();
    const positionsSaved = savePositions(
      this.storage,
      positionCacheKey(signature, viewClass),
      this.capturePositions(),
    );
    const viewSaved = positionsSaved && saveGraphView(
      this.storage,
      graphViewCacheKey(signature, viewClass),
      {
        camera: this.renderer.getCamera().getState(),
        bbox: this.renderer.getCustomBBox() ?? this.renderer.getBBox(),
      },
    );
    return positionsSaved && viewSaved ? true : this.invalidateSession();
  }

  invalidateSession(): boolean {
    if (!this.storage) return true;
    if (!this.storage.removeItem) return false;
    const { width, height } = this.renderer.getDimensions();
    const viewClass = viewportClass(width, height);
    const signature = this.cacheSignature();
    try {
      this.storage.removeItem(positionCacheKey(signature, viewClass));
      this.storage.removeItem(graphViewCacheKey(signature, viewClass));
      return true;
    } catch {
      // Session storage can be unavailable in restricted browsing contexts.
      return false;
    }
  }

  setSessionScope(scope: string): void {
    this.sessionScope = scope;
  }

  fitView(ids: Iterable<string>): void {
    this.cancel();
    const visibleIds = [...new Set(ids)].filter((id) => this.graph.hasNode(id)).sort();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const generation = this.generations.next();
    this.fitVisible(visibleIds, !reducedMotion, generation, () => this.finish(generation));
  }

  settle(
    trigger: MotionTrigger,
    activeIds: Iterable<string>,
    pinnedId?: string,
    cameraIds?: Iterable<string>,
    fitCamera = trigger !== "drag",
  ): void {
    this.cancel();
    if (document.hidden) return;

    const ids = [...new Set(activeIds)].filter((id) => this.graph.hasNode(id)).sort();
    const fittedIds = cameraIds
      ? [...new Set(cameraIds)].filter((id) => this.graph.hasNode(id)).sort()
      : ids;
    if (ids.length === 0) {
      const generation = this.generations.next();
      this.fitVisible([], false, generation, () => this.finish(generation));
      return;
    }

    const generation = this.generations.next();
    const dimensions = this.renderer.getDimensions();
    const plan = motionPlan(trigger, ids.length);
    const source = trigger === "drag" ? this.capturePositions(ids) : this.baseline;
    const idSet = new Set(ids);
    const request: LayoutRequest = {
      generation,
      nodes: ids.map((id) => ({
        id,
        x: source[id].x,
        y: source[id].y,
        size: this.graph.getNodeAttribute(id, "size") as number,
      })),
      edges: this.data.edges.filter(({ source, target }) => idSet.has(source) && idSet.has(target)),
      width: dimensions.width,
      height: dimensions.height,
      iterations: plan.iterations,
      pinnedId,
    };

    const fallback = () => {
      const positions = Object.fromEntries(request.nodes.map(({ id, x, y }) => [id, { x, y }]));
      this.animateTo(
        generation,
        adaptPositionsToViewport(positions, request.width, request.height, pinnedId),
        fittedIds,
        plan.duration,
        fitCamera,
      );
    };

    if (plan.iterations === 0) {
      fallback();
      return;
    }

    const worker = new Worker(new URL("./graph-layout.worker.ts", import.meta.url), {
      type: "module",
    });
    this.worker = worker;
    this.workerTimer = window.setTimeout(() => {
      if (!this.generations.isCurrent(generation)) return;
      worker.terminate();
      this.worker = null;
      this.workerTimer = null;
      fallback();
    }, plan.workerTimeout);

    worker.addEventListener("message", (event: MessageEvent<LayoutResponse>) => {
      if (!this.generations.isCurrent(generation) || event.data.generation !== generation) return;
      this.clearWorker();
      if (event.data.positions && !event.data.error) {
        this.animateTo(generation, event.data.positions, fittedIds, plan.duration, fitCamera);
      } else {
        fallback();
      }
    });
    worker.addEventListener("error", () => {
      if (!this.generations.isCurrent(generation)) return;
      this.clearWorker();
      fallback();
    });
    worker.postMessage(request);
  }

  cancel(): void {
    this.generations.cancel();
    this.clearWorker();
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    if (this.cameraAnimating) {
      this.cameraAnimating = false;
      this.renderer.getCamera().animate(this.renderer.getCamera().getState(), { duration: 1 });
    }
  }

  destroy(): void {
    this.cancel();
  }

  private animateTo(
    generation: number,
    targets: GraphPositions,
    visibleIds: string[],
    plannedDuration: number,
    fitCamera: boolean,
  ): void {
    if (!this.generations.isCurrent(generation)) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = animationDuration(
      { iterations: 0, duration: plannedDuration, workerTimeout: 0 },
      reducedMotion,
    );
    const starts = this.capturePositions(Object.keys(targets));
    const maxMovement = Object.entries(targets).reduce((maximum, [id, target]) => {
      const start = starts[id];
      return start ? Math.max(maximum, Math.hypot(target.x - start.x, target.y - start.y)) : maximum;
    }, 0);

    if (duration === 0 || maxMovement < 0.0001) {
      this.applyPositions(targets);
      this.complete(generation, visibleIds, false, fitCamera);
      return;
    }

    const started = performance.now();
    const tick = (now: number) => {
      if (!this.generations.isCurrent(generation)) return;
      const progress = Math.min((now - started) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const positions: GraphPositions = {};
      for (const [id, target] of Object.entries(targets)) {
        const start = starts[id];
        if (!start) continue;
        positions[id] = {
          x: start.x + (target.x - start.x) * eased,
          y: start.y + (target.y - start.y) * eased,
        };
      }
      this.applyPositions(positions);
      if (progress < 1) this.animationFrame = requestAnimationFrame(tick);
      else {
        this.animationFrame = null;
        this.complete(generation, visibleIds, true, fitCamera);
      }
    };
    this.animationFrame = requestAnimationFrame(tick);
  }

  private complete(
    generation: number,
    visibleIds: string[],
    animateCamera: boolean,
    fitCamera: boolean,
  ): void {
    if (!this.generations.isCurrent(generation)) return;
    if (fitCamera) {
      this.fitVisible(visibleIds, animateCamera, generation, () => this.finish(generation));
    } else {
      this.finish(generation);
    }
  }

  private fitVisible(
    ids: string[],
    animate: boolean,
    generation: number,
    onComplete: () => void = () => {},
  ): void {
    if (!this.generations.isCurrent(generation)) return;
    fitRenderedGraph(this.renderer, ids, {
      animate,
      onAnimationStart: () => {
        this.cameraAnimating = true;
      },
      onAnimationComplete: () => {
        if (!this.generations.isCurrent(generation)) return;
        this.cameraAnimating = false;
        onComplete();
      },
    });
  }

  private finish(generation: number): void {
    if (!this.generations.isCurrent(generation)) return;
    if (this.commitSession()) this.onSettled();
  }

  private cacheSignature(): string {
    return this.sessionScope ? `${this.signature}:${this.sessionScope}` : this.signature;
  }

  private capturePositions(ids: Iterable<string> = this.graph.nodes()): GraphPositions {
    return Object.fromEntries(
      [...ids].filter((id) => this.graph.hasNode(id)).map((id) => [
        id,
        {
          x: this.graph.getNodeAttribute(id, "x") as number,
          y: this.graph.getNodeAttribute(id, "y") as number,
        },
      ]),
    );
  }

  private applyPositions(positions: GraphPositions): void {
    this.graph.updateEachNodeAttributes(
      (id, attributes) => {
        const point = positions[id];
        return point ? { ...attributes, x: point.x, y: point.y } : attributes;
      },
      { attributes: ["x", "y"] },
    );
    this.renderer.scheduleRefresh();
  }

  private clearWorker(): void {
    if (this.workerTimer !== null) {
      window.clearTimeout(this.workerTimer);
      this.workerTimer = null;
    }
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
