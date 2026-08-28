import type Graph from "graphology";
import type Sigma from "sigma";

export interface GraphHoverState {
  hovered: string | null;
  neighbors: Set<string>;
  theme: {
    fadedEdge: string;
    fadedNode: string;
  };
}

type SigmaSettings = ReturnType<Sigma["getSettings"]>;

export function createHoverReducers(graph: Graph, state: GraphHoverState) {
  const nodeReducer: NonNullable<SigmaSettings["nodeReducer"]> = (node, attrs) => {
    if (state.hovered && node !== state.hovered && !state.neighbors.has(node)) {
      return { ...attrs, color: state.theme.fadedNode };
    }
    return attrs;
  };
  const edgeReducer: NonNullable<SigmaSettings["edgeReducer"]> = (edge, attrs) => {
    if (
      state.hovered &&
      graph.source(edge) !== state.hovered &&
      graph.target(edge) !== state.hovered
    ) {
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
  renderer.on("enterNode", ({ node }) => {
    onNodeEnter?.();
    state.hovered = node;
    state.neighbors = new Set(graph.neighbors(node));
    renderer.getContainer().style.cursor = "pointer";
    renderer.refresh({ skipIndexation: true });
  });
  renderer.on("leaveNode", () => {
    state.hovered = null;
    state.neighbors.clear();
    if (!isDragging()) renderer.getContainer().style.cursor = "";
    renderer.refresh({ skipIndexation: true });
  });
}

export function stopCameraAnimation(renderer: Sigma): void {
  const camera = renderer.getCamera();
  if (camera.isAnimated()) void camera.animate(camera.getState(), { duration: 1 });
}
