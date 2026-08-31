export interface GraphPosition {
  x: number;
  y: number;
}

export type GraphPositions = Record<string, GraphPosition>;
export type MotionTrigger = "initial" | "resize" | "filter" | "drag";
export type ViewportClass = "portrait" | "square" | "landscape";

export interface MotionPlan {
  iterations: number;
  duration: number;
  workerTimeout: number;
}

export interface MotionNode {
  id: string;
  x: number;
  y: number;
  size: number;
}

export interface MotionEdge {
  source: string;
  target: string;
}

export interface LayoutRequest {
  generation: number;
  nodes: MotionNode[];
  edges: MotionEdge[];
  width: number;
  height: number;
  iterations: number;
  pinnedId?: string;
  fitViewportAspect?: boolean;
}

export interface LayoutResponse {
  generation: number;
  positions?: GraphPositions;
  error?: string;
}

export interface PositionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export interface GraphViewState {
  camera: { x: number; y: number; angle: number; ratio: number };
  bbox: { x: [number, number]; y: [number, number] };
}

const CACHE_VERSION = 2;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Number(value.toFixed(5));
}

export function viewportClass(width: number, height: number): ViewportClass {
  const ratio = width / Math.max(height, 1);
  if (ratio < 0.85) return "portrait";
  if (ratio > 1.18) return "landscape";
  return "square";
}

export function motionPlan(trigger: MotionTrigger, nodeCount: number): MotionPlan {
  if (nodeCount <= 2) return { iterations: 0, duration: 350, workerTimeout: 400 };

  const large = nodeCount > 500;
  const medium = nodeCount > 100;
  if (trigger === "drag") {
    return {
      iterations: large ? 4 : medium ? 10 : 28,
      duration: 420,
      workerTimeout: 700,
    };
  }
  if (trigger === "filter") {
    return {
      iterations: large ? 8 : medium ? 20 : 56,
      duration: 650,
      workerTimeout: 900,
    };
  }
  return {
    iterations: large ? 12 : medium ? 32 : 80,
    duration: 900,
    workerTimeout: 1200,
  };
}

export function animationDuration(plan: MotionPlan, reducedMotion: boolean): number {
  return reducedMotion ? 0 : Math.min(plan.duration, 2500);
}

export function adaptPositionsToViewport(
  positions: GraphPositions,
  width: number,
  height: number,
  pinnedId?: string,
  scaleLimit = 1.45,
): GraphPositions {
  const entries = Object.entries(positions).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return {};

  const xs = entries.map(([, point]) => point.x);
  const ys = entries.map(([, point]) => point.y);
  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
  const rangeX = Math.max(Math.max(...xs) - Math.min(...xs), 0.0001);
  const rangeY = Math.max(Math.max(...ys) - Math.min(...ys), 0.0001);
  const currentAspect = rangeX / rangeY;
  const targetAspect = clamp(width / Math.max(height, 1), 0.45, 2.2);
  const adjustment = Math.sqrt(targetAspect / currentAspect);
  const minimumScale = 1 / scaleLimit;
  const scaleX = clamp(adjustment, minimumScale, scaleLimit);
  const scaleY = clamp(1 / adjustment, minimumScale, scaleLimit);

  const adapted = Object.fromEntries(
    entries.map(([id, point]) => [
      id,
      {
        x: round(centerX + (point.x - centerX) * scaleX),
        y: round(centerY + (point.y - centerY) * scaleY),
      },
    ]),
  );

  const pinnedBefore = pinnedId ? positions[pinnedId] : undefined;
  const pinnedAfter = pinnedId ? adapted[pinnedId] : undefined;
  if (pinnedBefore && pinnedAfter) {
    const dx = pinnedBefore.x - pinnedAfter.x;
    const dy = pinnedBefore.y - pinnedAfter.y;
    for (const point of Object.values(adapted)) {
      point.x = round(point.x + dx);
      point.y = round(point.y + dy);
    }
  }

  return adapted;
}

export function positionBounds(
  positions: GraphPositions,
  ids: Iterable<string>,
  padding = 0.12,
): { x: [number, number]; y: [number, number] } {
  const points = [...ids].map((id) => positions[id]).filter((point) => point !== undefined);
  if (points.length === 0) return { x: [0, 1], y: [0, 1] };

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const padX = Math.max((maxX - minX) * padding, 0.5);
  const padY = Math.max((maxY - minY) * padding, 0.5);
  return { x: [minX - padX, maxX + padX], y: [minY - padY, maxY + padY] };
}

export function graphSignature(
  nodes: Iterable<{ id: string }>,
  edges: Iterable<{ source: string; target: string }>,
): string {
  const nodePart = [...nodes].map(({ id }) => id).sort().join("\u001f");
  const edgePart = [...edges]
    .map(({ source, target }) => (source < target ? `${source}\u001e${target}` : `${target}\u001e${source}`))
    .sort()
    .join("\u001f");
  const input = `${nodePart}\u001d${edgePart}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function positionCacheKey(signature: string, view: ViewportClass): string {
  return `graph-motion:${CACHE_VERSION}:${signature}:${view}`;
}

export function graphViewCacheKey(signature: string, view: ViewportClass): string {
  return `graph-view:${CACHE_VERSION}:${signature}:${view}`;
}

export function loadPositions(
  storage: PositionStorage,
  key: string,
  expectedIds: Iterable<string>,
): GraphPositions | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { version?: unknown; positions?: unknown };
    if (parsed.version !== CACHE_VERSION || typeof parsed.positions !== "object" || !parsed.positions) {
      return null;
    }
    const positions = parsed.positions as GraphPositions;
    const ids = [...expectedIds];
    if (Object.keys(positions).length !== ids.length) return null;
    for (const id of ids) {
      const point = positions[id];
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    }
    return Object.fromEntries(ids.map((id) => [id, { x: positions[id].x, y: positions[id].y }]));
  } catch {
    return null;
  }
}

export function savePositions(storage: PositionStorage, key: string, positions: GraphPositions): boolean {
  try {
    storage.setItem(key, JSON.stringify({ version: CACHE_VERSION, positions }));
    return true;
  } catch {
    // Storage can be unavailable in private browsing or restricted embeds.
    return false;
  }
}

export function loadGraphView(storage: PositionStorage, key: string): GraphViewState | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { version?: unknown; view?: Partial<GraphViewState> };
    const camera = parsed.view?.camera;
    const bbox = parsed.view?.bbox;
    const cameraValues = camera ? [camera.x, camera.y, camera.angle, camera.ratio] : [];
    const bboxValues = bbox ? [...bbox.x, ...bbox.y] : [];
    if (
      parsed.version !== CACHE_VERSION ||
      !camera ||
      !bbox ||
      !Array.isArray(bbox.x) ||
      bbox.x.length !== 2 ||
      !Array.isArray(bbox.y) ||
      bbox.y.length !== 2 ||
      cameraValues.some((value) => !Number.isFinite(value)) ||
      camera.ratio <= 0 ||
      bboxValues.some((value) => !Number.isFinite(value)) ||
      bbox.x[0] > bbox.x[1] ||
      bbox.y[0] > bbox.y[1]
    ) {
      return null;
    }
    return {
      camera: { x: camera.x, y: camera.y, angle: camera.angle, ratio: camera.ratio },
      bbox: { x: [bbox.x[0], bbox.x[1]], y: [bbox.y[0], bbox.y[1]] },
    };
  } catch {
    return null;
  }
}

export function saveGraphView(storage: PositionStorage, key: string, view: GraphViewState): boolean {
  try {
    storage.setItem(key, JSON.stringify({ version: CACHE_VERSION, view }));
    return true;
  } catch {
    // Storage can be unavailable in private browsing or restricted embeds.
    return false;
  }
}

export class MotionGeneration {
  private value = 0;

  next(): number {
    this.value += 1;
    return this.value;
  }

  cancel(): void {
    this.value += 1;
  }

  isCurrent(generation: number): boolean {
    return generation === this.value;
  }
}

export class ResizeSettler {
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private width: number,
    private height: number,
    private readonly callback: (width: number, height: number) => void,
    private readonly delay = 180,
    private readonly threshold = 24,
  ) {}

  update(width: number, height: number): boolean {
    if (Math.abs(width - this.width) < this.threshold && Math.abs(height - this.height) < this.threshold) {
      return false;
    }
    this.width = width;
    this.height = height;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.callback(this.width, this.height);
    }, this.delay);
    return true;
  }

  cancel(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  reset(width: number, height: number): void {
    this.cancel();
    this.width = width;
    this.height = height;
  }
}
