import type Graph from "graphology";
import type Sigma from "sigma";

export interface GraphHoverState {
  hovered: string | null;
  pinned: string | null;
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
  return state.hovered ?? state.pinned;
}

function updateInspectionNeighbors(graph: Graph, state: GraphHoverState): void {
  const active = activeInspectionNode(state);
  state.neighbors = new Set(active ? graph.neighbors(active) : []);
}

export function setPinnedInspection(
  graph: Graph,
  state: GraphHoverState,
  node: string | null,
): void {
  state.pinned = node;
  updateInspectionNeighbors(graph, state);
}

export function createHoverReducers(graph: Graph, state: GraphHoverState) {
  const nodeReducer: NonNullable<SigmaSettings["nodeReducer"]> = (node, attrs) => {
    const active = activeInspectionNode(state);
    if (active && node !== active && !state.neighbors.has(node)) {
      return { ...attrs, color: state.theme.fadedNode, labelColor: state.theme.fadedLabel };
    }
    return attrs;
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

export function wireGraphHover(
  renderer: Sigma,
  graph: Graph,
  state: GraphHoverState,
  onNodeEnter?: () => void,
  isDragging: () => boolean = () => false,
): void {
  renderer.on("enterNode", ({ node, event }) => {
    if (event?.original?.type?.startsWith("touch")) return;
    onNodeEnter?.();
    state.hovered = node;
    updateInspectionNeighbors(graph, state);
    renderer.getContainer().style.cursor = "pointer";
    renderer.refresh({ skipIndexation: true });
  });
  renderer.on("leaveNode", ({ event }) => {
    if (event?.original?.type?.startsWith("touch")) return;
    state.hovered = null;
    updateInspectionNeighbors(graph, state);
    if (!isDragging()) renderer.getContainer().style.cursor = "";
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
