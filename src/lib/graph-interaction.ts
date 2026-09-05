import type Graph from "graphology";
import type Sigma from "sigma";
import { graphLabelBox } from "./graph-style";

export interface GraphHoverState {
  hovered: string | null;
  focused: string | null;
  /** Every lit note other than the inspected one, however many links away. */
  neighbors: Set<string>;
  /**
   * How many links away the lit neighborhood reaches, 1 to 5. One is the
   * direct neighbors; absent means one.
   */
  depth?: number;
  /** Distance in links from the inspected note, for every lit note. */
  hops?: Map<string, number>;
  theme: {
    fadedEdge: string;
    fadedLabel: string;
    fadedNode: string;
  };
}

type SigmaSettings = ReturnType<Sigma["getSettings"]>;

export const GRAPH_DRAG_TOLERANCE = 3;
export const GRAPH_LONG_PRESS_DURATION = 500;

/** Slack around a label's box so a near miss still hits it. */
export const GRAPH_LABEL_TOUCH_PADDING = 8;

export function activeInspectionNode(state: GraphHoverState): string | null {
  return state.focused ?? state.hovered;
}

export function isInspectionNeighborhoodNode(state: GraphHoverState, node: string): boolean {
  const active = activeInspectionNode(state);
  return active !== null && (active === node || state.neighbors.has(node));
}

export const MINIMUM_NEIGHBORHOOD_DEPTH = 1;
export const MAXIMUM_NEIGHBORHOOD_DEPTH = 5;

export function clampNeighborhoodDepth(depth: number): number {
  if (!Number.isFinite(depth)) return MINIMUM_NEIGHBORHOOD_DEPTH;
  return Math.min(MAXIMUM_NEIGHBORHOOD_DEPTH, Math.max(MINIMUM_NEIGHBORHOOD_DEPTH, Math.round(depth)));
}

/**
 * The notes within `depth` links of `origin`, each with its distance. A
 * breadth-first walk, so a note reachable two ways keeps its shorter distance.
 */
export function neighborhoodWithin(graph: Graph, origin: string, depth: number): Map<string, number> {
  const hops = new Map<string, number>();
  if (!graph.hasNode(origin)) return hops;
  let ring = [origin];
  const seen = new Set([origin]);
  for (let distance = 1; distance <= clampNeighborhoodDepth(depth) && ring.length > 0; distance += 1) {
    const next: string[] = [];
    for (const node of ring) {
      for (const neighbor of graph.neighbors(node)) {
        if (seen.has(neighbor)) continue;
        seen.add(neighbor);
        hops.set(neighbor, distance);
        next.push(neighbor);
      }
    }
    ring = next;
  }
  return hops;
}

function updateInspectionNeighbors(graph: Graph, state: GraphHoverState): void {
  const active = activeInspectionNode(state);
  state.hops = active ? neighborhoodWithin(graph, active, state.depth ?? MINIMUM_NEIGHBORHOOD_DEPTH) : new Map();
  state.neighbors = new Set(state.hops.keys());
}

/**
 * Changes how far the lit neighborhood reaches and re-lights whatever is
 * inspected right now. Returns whether the depth actually changed.
 */
export function setInspectionDepth(graph: Graph, state: GraphHoverState, depth: number): boolean {
  const next = clampNeighborhoodDepth(depth);
  if ((state.depth ?? MINIMUM_NEIGHBORHOOD_DEPTH) === next) return false;
  state.depth = next;
  updateInspectionNeighbors(graph, state);
  return true;
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

export function permitsNodeDrag(event: {
  type: string;
  button?: number;
  ctrlKey?: boolean;
  touches?: { length: number };
}): boolean {
  if (event.type.startsWith("touch")) {
    return event.type === "touchstart" && event.touches?.length === 1;
  }
  return event.button === 0 && !event.ctrlKey;
}

/**
 * Whether a sigma down event is a genuine touch press.
 *
 * Sigma re-emits `downStage` when a pinch drops from two contact points to
 * one, and that re-emission carries `original.type === "touchend"`. A lift is
 * not a press: it must neither record a press on empty canvas nor start a
 * long-press timer that would pin whatever node the remaining finger rests on.
 */
export function isTouchPress(event: { original: { type: string } }): boolean {
  return event.original.type === "touchstart";
}

export interface TouchSequenceEvent {
  type: string;
  /** `TouchEvent.touches.length`: contact points still down after the event. */
  touches: number;
}

/**
 * Whether the current touch sequence is disqualified from clearing focus.
 *
 * A camera gesture is not a tap. The moment a sequence has more than one
 * contact point it stops being able to clear a pinned neighborhood, and it
 * stays that way until every contact point has lifted, whatever order they
 * lift in. Disqualifying the whole sequence rather than the one stray event
 * is what makes a pinch structurally incapable of clearing focus, instead of
 * merely patching the sequence we happened to observe.
 */
export function advanceTouchSequence(armed: boolean, event: TouchSequenceEvent): boolean {
  switch (event.type) {
    case "touchstart":
      return armed || event.touches > 1;
    case "touchend":
      // `touches` excludes the point that just lifted, so the sequence is over
      // only at zero. A pinch releasing to one finger is still a pinch.
      return event.touches > 0 && armed;
    case "touchcancel":
      return false;
    default:
      return armed;
  }
}

interface PinchContact {
  x: number;
  y: number;
}

export interface PinchGesture {
  /**
   * The framed-graph point under the midpoint of the two contacts when the
   * gesture began. It is what the pinch holds still.
   */
  anchor: PinchContact;
  /** Camera ratio when the gesture began. */
  ratio: number;
  /** Distance between the two contacts when the gesture began, in pixels. */
  distance: number;
}

export interface PinchFrame {
  width: number;
  height: number;
  /** Framed-graph units spanned by one viewport pixel at a camera ratio of 1. */
  graphUnitsPerPixel: number;
  /** The camera's own ratio limits, so the anchor holds at either extreme. */
  boundRatio?: (ratio: number) => number;
}

/**
 * The camera a two-contact pinch asks for.
 *
 * It does not rotate. A hand pinches by turning two fingers around a knuckle,
 * so a few degrees of twist come free with every pinch, and sigma's own reads
 * that twist as a camera rotation: the graph tilts under labels that stay
 * level, and stays tilted until some later fit snaps it upright.
 *
 * A transform that cannot rotate cannot keep both contacts over the graph
 * positions they started on, so this keeps the point between them there
 * instead, which is the choice that favors neither finger.
 *
 * Returns `null` when the gesture is not a pinch, leaving the camera alone.
 */
export function pinchCameraState(
  gesture: PinchGesture,
  contacts: readonly PinchContact[],
  frame: PinchFrame,
): { x: number; y: number; ratio: number } | null {
  if (contacts.length !== 2) return null;
  const [first, second] = contacts as [PinchContact, PinchContact];
  const distance = Math.hypot(second.x - first.x, second.y - first.y);
  if (!(distance > 0) || !(gesture.distance > 0)) return null;
  const bound = frame.boundRatio ?? ((ratio: number) => ratio);
  // Contacts spreading apart shrink the ratio, which is sigma's way of zooming in.
  const ratio = bound((gesture.ratio * gesture.distance) / distance);
  const perPixel = frame.graphUnitsPerPixel * ratio;
  const midpoint = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
  return {
    x: gesture.anchor.x - (midpoint.x - frame.width / 2) * perPixel,
    // Framed-graph y runs up the screen where viewport y runs down it.
    y: gesture.anchor.y + (midpoint.y - frame.height / 2) * perPixel,
    ratio,
  };
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
  // An edge stays lit when it joins successive rings of the lit neighborhood:
  // the inspected note to its neighbors, those to the next ring, and so on.
  // Lateral edges inside a ring recede, so what stays lit reads as the paths
  // outward rather than a tangle. At depth one this is exactly the edges
  // incident to the inspected note.
  const litEdge = (active: string, edge: string): boolean => {
    const source = graph.source(edge);
    const target = graph.target(edge);
    const hop = (node: string) => (node === active ? 0 : state.hops?.get(node) ?? (state.neighbors.has(node) ? 1 : null));
    const from = hop(source);
    const to = hop(target);
    return from !== null && to !== null && Math.abs(from - to) === 1;
  };
  const edgeReducer: NonNullable<SigmaSettings["edgeReducer"]> = (edge, attrs) => {
    const active = activeInspectionNode(state);
    if (active && !litEdge(active, edge)) {
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
  /** Widest rendered line, from the shared label layout. */
  labelWidth?: number;
  /** Height of the whole wrapped block, from the shared label layout. */
  labelHeight?: number;
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
    // The box the label layout produced, not a reconstruction of it: the label
    // is centred on the node and below its marker, and a wrapped label's box
    // covers every one of its lines.
    const box = graphLabelBox(
      { lines: [node.label], width: node.labelWidth, height: node.labelHeight ?? 0, lineHeight: 0 },
      node,
      node.radius,
    )!;
    const label = clippedTarget({
      node: node.node,
      kind: "label",
      left: box.left - GRAPH_LABEL_TOUCH_PADDING,
      right: box.right + GRAPH_LABEL_TOUCH_PADDING,
      top: box.top - GRAPH_LABEL_TOUCH_PADDING,
      bottom: box.bottom + GRAPH_LABEL_TOUCH_PADDING,
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
