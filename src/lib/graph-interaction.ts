import type Graph from "graphology";
import type Sigma from "sigma";

export interface GraphHoverState {
  hovered: string | null;
  focused: string | null;
  neighbors: Set<string>;
  theme: {
    fadedEdge: string;
    fadedLabel: string;
    fadedNode: string;
  };
}

type SigmaSettings = ReturnType<Sigma["getSettings"]>;

export const GRAPH_DRAG_TOLERANCE = 3;
export const GRAPH_LONG_PRESS_DURATION = 500;

export function activeInspectionNode(state: GraphHoverState): string | null {
  return state.focused ?? state.hovered;
}

export function isInspectionNeighborhoodNode(state: GraphHoverState, node: string): boolean {
  const active = activeInspectionNode(state);
  return active !== null && (active === node || state.neighbors.has(node));
}

function updateInspectionNeighbors(graph: Graph, state: GraphHoverState): void {
  const active = activeInspectionNode(state);
  state.neighbors = new Set(active ? graph.neighbors(active) : []);
}

export function setFocusedInspection(
  graph: Graph,
  state: GraphHoverState,
  node: string | null,
): void {
  state.focused = node;
  state.hovered = null;
  updateInspectionNeighbors(graph, state);
}

export function setTransientInspection(
  graph: Graph,
  state: GraphHoverState,
  node: string | null,
): boolean {
  if (state.focused !== null) return false;
  if (state.hovered === node) return false;
  state.hovered = node;
  updateInspectionNeighbors(graph, state);
  return true;
}

export function permitsNodeDrag(event: Pick<MouseEvent, "button" | "ctrlKey" | "type">): boolean {
  return event.type.startsWith("touch") || (event.button === 0 && !event.ctrlKey);
}

export function resolveFocusedVisibility(
  hidden: Set<string>,
  focused: string | null,
  neighbors: Iterable<string>,
  restoreSharedFocus: boolean,
): string | null {
  if (!focused) return null;
  if (!restoreSharedFocus) return hidden.has(focused) ? null : focused;
  hidden.delete(focused);
  for (const neighbor of neighbors) hidden.delete(neighbor);
  return focused;
}

export function createHoverReducers(graph: Graph, state: GraphHoverState) {
  const nodeReducer: NonNullable<SigmaSettings["nodeReducer"]> = (node, attrs) => {
    const active = activeInspectionNode(state);
    if (!active) return attrs;
    if (node === active || state.neighbors.has(node)) {
      return attrs.label ? { ...attrs, forceLabel: true } : attrs;
    }
    return {
      ...attrs,
      color: state.theme.fadedNode,
      label: "",
      forceLabel: false,
    };
  };
  const edgeReducer: NonNullable<SigmaSettings["edgeReducer"]> = (edge, attrs) => {
    const active = activeInspectionNode(state);
    if (active && graph.source(edge) !== active && graph.target(edge) !== active) {
      return { ...attrs, color: state.theme.fadedEdge };
    }
    return attrs;
  };
  return { nodeReducer, edgeReducer };
}

export interface GraphScreenNode {
  node: string;
  x: number;
  y: number;
  radius: number;
  label?: string | null;
  labelWidth?: number;
  foreignMarkWidth?: number;
  labelRendered?: boolean;
}

export interface GraphScreenTarget {
  node: string;
  kind: "marker" | "label";
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
  radius?: number;
}

interface ViewportSize {
  width: number;
  height: number;
}

function clippedTarget(
  target: GraphScreenTarget,
  viewport: ViewportSize,
): GraphScreenTarget | null {
  const left = Math.max(0, target.left);
  const right = Math.min(viewport.width, target.right);
  const top = Math.max(0, target.top);
  const bottom = Math.min(viewport.height, target.bottom);
  return left <= right && top <= bottom ? { ...target, left, right, top, bottom } : null;
}

export function graphScreenTargets(
  nodes: readonly GraphScreenNode[],
  viewport: ViewportSize,
): GraphScreenTarget[] {
  const targets: GraphScreenTarget[] = [];
  for (const node of nodes) {
    const markerRadius = Math.max(node.radius, 22);
    const marker = clippedTarget({
      node: node.node,
      kind: "marker",
      left: node.x - markerRadius,
      right: node.x + markerRadius,
      top: node.y - markerRadius,
      bottom: node.y + markerRadius,
      centerX: node.x,
      centerY: node.y,
      radius: markerRadius,
    }, viewport);
    if (marker) targets.push(marker);

    if (!node.labelRendered || !node.label || !node.labelWidth || node.labelWidth <= 0) continue;
    const label = clippedTarget({
      node: node.node,
      kind: "label",
      left: node.x + node.radius + 3 - 8,
      right: node.x + node.radius + 3 + node.labelWidth + (node.foreignMarkWidth ?? 0) + 8,
      top: node.y - 22,
      bottom: node.y + 22,
      centerX: node.x,
      centerY: node.y,
    }, viewport);
    if (label) targets.push(label);
  }
  return targets;
}

export function hitGraphScreenTarget(
  targets: readonly GraphScreenTarget[],
  point: { x: number; y: number },
): string | null {
  const matches = targets.filter((target) =>
    point.x >= target.left && point.x <= target.right &&
    point.y >= target.top && point.y <= target.bottom &&
    (target.kind === "label" ||
      (point.x - target.centerX) ** 2 + (point.y - target.centerY) ** 2 <=
        target.radius! ** 2)
  );
  matches.sort((a, b) => {
    const aDistance = (point.x - a.centerX) ** 2 + (point.y - a.centerY) ** 2;
    const bDistance = (point.x - b.centerX) ** 2 + (point.y - b.centerY) ** 2;
    return aDistance - bDistance ||
      Number(a.kind === "label") - Number(b.kind === "label") ||
      a.node.localeCompare(b.node);
  });
  return matches[0]?.node ?? null;
}

export function wireGraphHover(
  renderer: Sigma,
  graph: Graph,
  state: GraphHoverState,
  onNodeEnter?: () => void,
  isDragging: () => boolean = () => false,
): void {
  renderer.on("enterNode", ({ node, event }) => {
    if (event?.original?.type?.startsWith("touch")) return;
    renderer.getContainer().style.cursor = "pointer";
    if (!setTransientInspection(graph, state, node)) return;
    onNodeEnter?.();
    renderer.refresh({ skipIndexation: true });
  });
  renderer.on("leaveNode", ({ event }) => {
    if (event?.original?.type?.startsWith("touch")) return;
    if (!isDragging()) renderer.getContainer().style.cursor = "";
    if (!setTransientInspection(graph, state, null)) return;
    renderer.refresh({ skipIndexation: true });
  });
}

interface LongPressOptions {
  onActivate(node: string): void;
  duration?: number;
  tolerance?: number;
}

export function createLongPressController({
  onActivate,
  duration = GRAPH_LONG_PRESS_DURATION,
  tolerance = GRAPH_DRAG_TOLERANCE,
}: LongPressOptions) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let startPoint: { x: number; y: number } | null = null;
  let pendingNode: string | null = null;
  let consumed = false;

  const cancelTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    pendingNode = null;
  };

  return {
    start(node: string, point: { x: number; y: number }) {
      cancelTimer();
      consumed = false;
      pendingNode = node;
      startPoint = { ...point };
      timer = setTimeout(() => {
        timer = null;
        const activeNode = pendingNode;
        pendingNode = null;
        if (!activeNode) return;
        consumed = true;
        onActivate(activeNode);
      }, duration);
    },
    move(point: { x: number; y: number }) {
      if (!startPoint || Math.hypot(point.x - startPoint.x, point.y - startPoint.y) <= tolerance) return;
      cancelTimer();
    },
    release() {
      cancelTimer();
      startPoint = null;
    },
    consumeActivatedPress() {
      const result = consumed;
      consumed = false;
      return result;
    },
    destroy() {
      cancelTimer();
      startPoint = null;
      consumed = false;
    },
  };
}

export function stopCameraAnimation(renderer: Sigma): void {
  const camera = renderer.getCamera();
  if (camera.isAnimated()) void camera.animate(camera.getState(), { duration: 1 });
}
