import Graph from "graphology";
import Sigma from "sigma";
import { drawDiscNodeLabel } from "sigma/rendering";
import type { MouseCoords, TouchCoords, WheelCoords } from "sigma/types";
import { BRAIN_MARK_PATH } from "./brain-mark";
import {
  activeInspectionNode,
  advanceTouchSequence,
  createLongPressController,
  createHoverReducers,
  graphScreenTargets,
  GRAPH_DRAG_TOLERANCE,
  hitGraphScreenTarget,
  isInspectionNeighborhoodNode,
  isTouchPress,
  permitsNodeDrag,
  pinchCameraState,
  clampNeighborhoodDepth,
  setInspectionDepth,
  resolveFocusedVisibility,
  setFocusedInspection,
  setTransientInspection,
  stopCameraAnimation,
  type GraphHoverState,
} from "./graph-interaction";
import { fitRenderedGraph, graphFitInsets, setGraphFitLabelRefresh } from "./graph-fit";
import { createLensReducers, createLensStore, normalizeLens } from "./graph-lens";
import { wireLocalGraphLabelReveal } from "./graph-local-labels";
import { GraphMotionController } from "./graph-motion";
import { syncGraphPageScope } from "./graph-page-scope";
import { ResponsiveGraphScheduler } from "./graph-motion-core";
import {
  deriveGraphData,
  deriveFocusedGraphData,
  deriveNoteNeighborhood,
  normalizeGraphData,
  type GraphContext,
  type GraphData,
} from "./graph-data";
import {
  beginLabelFades,
  easedEdgeSize,
  finishedLabelFadeOuts,
  flooredNodeSize,
  labelFadeAlpha,
  labelFadesRunning,
  forceForeignLabel,
  GRAPH_LABEL_GAP,
  graphLabelAvailableWidth,
  graphLabelBox,
  graphMarkerBox,
  layoutGraphLabel,
  maximumGraphLabelWidth,
  renderedLabelSize,
  selectGraphLabels,
  type GraphLabelBox,
  type GraphLabelLayout,
  forceLabelsOnNarrowZoom,
  foreignLabelMarkWidth,
  graphEdgeAttributes,
  graphHoverPlate,
  graphHoverSurface,
  graphNodeAttributes,
  composeGraphLabel,
  defaultHoverPreviewPreference,
  defaultNeighborhoodDepth,
  defaultOwnerLabelPreference,
  hoverPreviewStorageKey,
  neighborhoodDepthStorageKey,
  ownerLabelStorageKey,
  responsiveLabelSettings,
  shortenGraphLabel,
} from "./graph-style";
import {
  connectedDomains,
  createFocusUrlSync,
  graphSessionScope,
  initialGraphFocus,
  neighborRows,
  neighborhoodHref,
  neighborhoodRoute,
} from "./graph-neighborhood";
import {
  joinBase,
  routes,
  routesFor,
  singularQueryValue,
  withGraphFocus,
  type LogicalRoute,
} from "./routes";

/**
 * Browser-side graph rendering shared by the global graph page and the
 * per-note local graph island. One graphology data model, one sigma renderer,
 * one visual language.
 */

interface GraphTheme {
  edge: string;
  fadedEdge: string;
  fadedLabel: string;
  fadedNode: string;
  label: string;
}

type NodeLabelData = Parameters<typeof drawDiscNodeLabel>[1] & {
  brainAccent?: string;
  foreign?: boolean;
  labelColor?: string;
  focused?: boolean;
  suppressHover?: boolean;
  /** Wrapped lines from `layoutGraphLabel`, shared by drawing and hit testing. */
  labelLines?: string[];
  labelWidth?: number;
  labelHeight?: number;
  labelLineHeight?: number;
};

let brainMarkPath: Path2D | undefined;

function nodeLabelColor(
  data: NodeLabelData,
  settings: Parameters<typeof drawDiscNodeLabel>[2],
): string {
  if (!settings.labelColor.attribute) return settings.labelColor.color;
  const value = (data as NodeLabelData & Record<string, unknown>)[settings.labelColor.attribute];
  return typeof value === "string" ? value : settings.labelColor.color ?? "#000";
}

function drawBrainMark(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
): void {
  brainMarkPath ??= new Path2D(BRAIN_MARK_PATH);
  context.save();
  context.translate(x, y);
  context.scale(size / 24, size / 24);
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.stroke(brainMarkPath);
  context.restore();
}

/**
 * The lines a node's label renders as, laid out by `layoutGraphLabel` in the
 * reducer. Falling back to the raw label keeps a node readable if it is drawn
 * before a reducer has run.
 */
function nodeLabelLines(data: NodeLabelData): string[] {
  const lines = data.labelLines;
  if (Array.isArray(lines)) return lines.filter((line) => typeof line === "string" && line.length > 0);
  return typeof data.label === "string" && data.label ? [data.label] : [];
}

/**
 * Draws a canvas label centred horizontally on its node and below its marker,
 * one `fillText` per wrapped line.
 *
 * Centred rather than to the right because a right-hand label needs its whole
 * length in clear space on one side of the node, which a real note title on a
 * phone never has.
 */
const drawGraphNodeLabel: typeof drawDiscNodeLabel = (context, data, settings) => {
  const graphData = data as NodeLabelData;
  const lines = nodeLabelLines(graphData);
  if (lines.length === 0) return;

  const size = settings.labelSize;
  const lineHeight = graphData.labelLineHeight ?? size * 1.15;
  const color = nodeLabelColor(graphData, settings);
  const alpha = labelFadeAlpha(context, String((graphData as { key?: string }).key ?? ""));
  const previousAlpha = context.globalAlpha;
  context.globalAlpha = previousAlpha * alpha;
  context.font = `${settings.labelWeight} ${size}px ${settings.labelFont}`;
  context.fillStyle = color;
  const top = data.y + data.size + GRAPH_LABEL_GAP;
  const baselineOf = (index: number) => top + index * lineHeight + size * 0.82;

  // A foreign node carries its Brain's mark inline on the first line, so that
  // line is laid out by hand around the mark instead of being centred as text.
  const parts = graphData.foreign ? /^([○◇◆][\s\u00a0]+)(.*)$/u.exec(lines[0]!) : null;
  const previousAlign = context.textAlign;
  if (parts) {
    const markSize = size + 1;
    const prefixWidth = context.measureText(parts[1]!).width;
    const restWidth = context.measureText(parts[2]!).width;
    const total = prefixWidth + markSize + 3 + restWidth;
    const start = data.x - total / 2;
    const baseline = baselineOf(0);
    context.textAlign = "left";
    context.fillText(parts[1]!, start, baseline);
    drawBrainMark(
      context,
      start + prefixWidth,
      baseline - markSize,
      markSize,
      graphData.labelColor ?? graphData.brainAccent ?? color,
    );
    context.fillStyle = color;
    context.fillText(parts[2]!, start + prefixWidth + markSize + 3, baseline);
  }

  context.textAlign = "center";
  for (let index = parts ? 1 : 0; index < lines.length; index += 1) {
    context.fillText(lines[index]!, data.x, baselineOf(index));
  }
  context.textAlign = previousAlign;
  context.globalAlpha = previousAlpha;
};

const drawGraphNodeHover: typeof drawDiscNodeLabel = (context, data, settings) => {
  const graphData = data as NodeLabelData;
  if (graphData.suppressHover) return;
  context.font = `${settings.labelWeight} ${settings.labelSize}px ${settings.labelFont}`;
  context.fillStyle = graphHoverSurface(window.matchMedia("(prefers-color-scheme: light)").matches);
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 0;
  context.shadowBlur = 8;
  context.shadowColor = "#000";
  const lines = nodeLabelLines(graphData);
  context.beginPath();
  if (lines.length > 0) {
    const plate = graphHoverPlate(data, data.size, {
      lines,
      width: graphData.labelWidth ?? 0,
      height: graphData.labelHeight ?? 0,
      lineHeight: graphData.labelLineHeight ?? 0,
    });
    context.roundRect(
      plate.left,
      plate.top,
      plate.right - plate.left,
      plate.bottom - plate.top,
      plate.radius,
    );
  } else {
    context.arc(data.x, data.y, data.size + 2, 0, Math.PI * 2);
  }
  context.closePath();
  context.fill();
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 0;
  context.shadowBlur = 0;
  if (graphData.focused) {
    context.beginPath();
    context.arc(data.x, data.y, data.size + 5, 0, Math.PI * 2);
    context.strokeStyle = nodeLabelColor(graphData, settings);
    context.lineWidth = 2;
    context.setLineDash([3, 2]);
    context.stroke();
    context.setLineDash([]);
    context.beginPath();
    context.moveTo(data.x, data.y - data.size - 9);
    context.lineTo(data.x + 4, data.y - data.size - 5);
    context.lineTo(data.x, data.y - data.size - 1);
    context.lineTo(data.x - 4, data.y - data.size - 5);
    context.closePath();
    context.fillStyle = nodeLabelColor(graphData, settings);
    context.fill();
  }
  drawGraphNodeLabel(context, data, settings);
};

function graphTheme(): GraphTheme {
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? {
        edge: "#c0bbc7",
        fadedEdge: "#eceaef",
        fadedLabel: "#aaa4b0",
        fadedNode: "#e1dde5",
        label: "#5f5a68",
      }
    : {
        edge: "#3f3b47",
        fadedEdge: "#1e1c22",
        fadedLabel: "#625e69",
        fadedNode: "#29262e",
        label: "#a5a1ae",
      };
}

function updateGeometryStats(host: HTMLElement, renderer: Sigma, graph: Graph): void {
  let sumX = 0;
  let sumY = 0;
  let sumSquares = 0;
  graph.forEachNode((_node, attrs) => {
    const x = attrs.x as number;
    const y = attrs.y as number;
    sumX += x;
    sumY += y;
    sumSquares += x * x + y * y;
  });
  host.dataset.graphGeometry = [graph.order, sumX, sumY, sumSquares].join(":");
  const camera = renderer.getCamera().getState();
  // The framing the camera is expressed in follows the state, because a
  // camera ratio means nothing without the bounding box it is relative to.
  const bbox = renderer.getCustomBBox() ?? renderer.getBBox();
  host.dataset.cameraGeometry = [
    camera.x, camera.y, camera.angle, camera.ratio,
    bbox.x[0], bbox.x[1], bbox.y[0], bbox.y[1],
  ].join(":");
}

function updateInspectionTargetStats(
  host: HTMLElement,
  renderer: Sigma,
  graph: Graph,
  node: string,
): void {
  const data = renderer.getNodeDisplayData(node);
  if (!data || data.hidden) return;
  const settings = renderer.getSettings();
  const label = data.label;
  const labelContext = renderer.getCanvases().labels?.getContext("2d");
  if (labelContext) {
    labelContext.font = `${settings.labelWeight} ${settings.labelSize}px ${settings.labelFont}`;
  }
  const center = renderer.framedGraphToViewport(data);
  const targets = graphScreenTargets([{
    node,
    x: center.x,
    y: center.y,
    radius: renderer.scaleSize(data.size),
    label,
    labelRendered: renderer.getNodeDisplayedLabels().has(node),
    labelWidth: (data as NodeLabelData).labelWidth,
    labelHeight: (data as NodeLabelData).labelHeight,
  }], renderer.getDimensions());
  const roundTarget = (target: (typeof targets)[number]) => ({
    kind: target.kind,
    left: Number(target.left.toFixed(3)),
    top: Number(target.top.toFixed(3)),
    right: Number(target.right.toFixed(3)),
    bottom: Number(target.bottom.toFixed(3)),
  });
  host.dataset.inspectionTargetGeometry = JSON.stringify(targets.map(roundTarget));
}

/**
 * Every visible marker's center and rendered radius in CSS pixels, so a browser
 * assertion can measure marker diameter against the distance between markers
 * without reimplementing sigma's size scaling.
 */
function renderedMarkerGeometry(
  renderer: Sigma,
  graph: Graph,
): { x: number; y: number; r: number }[] {
  const markers: { x: number; y: number; r: number }[] = [];
  graph.forEachNode((node) => {
    const data = renderer.getNodeDisplayData(node);
    if (!data || data.hidden) return;
    const center = renderer.framedGraphToViewport(data);
    markers.push({
      x: Number(center.x.toFixed(2)),
      y: Number(center.y.toFixed(2)),
      r: Number(renderer.scaleSize(data.size).toFixed(3)),
    });
  });
  return markers;
}

/**
 * Lays canvas labels out for one renderer, memoized by text, width budget and
 * rendered size.
 *
 * Wrapping a label costs several `measureText` calls, and a reducer runs for
 * every node on every refresh, so the same title at the same size and budget is
 * measured once. Budgets are rounded into buckets so panning does not miss the
 * cache on every frame.
 */
function createGraphLabelLayouts(renderer: Sigma) {
  const cache = new Map<string, GraphLabelLayout>();
  const measureContext = document.createElement("canvas").getContext("2d")!;
  let appliedFont = "";

  return {
    clear(): void {
      cache.clear();
    },
    /** Rounded width budget for a node centred at `centerX`. */
    budget(centerX: number, viewportWidth: number): number {
      const available = graphLabelAvailableWidth(
        centerX,
        viewportWidth,
        maximumGraphLabelWidth(viewportWidth),
      );
      return Math.round(available / 4) * 4;
    },
    layout(label: string, budget: number, size: number, foreign: boolean): GraphLabelLayout {
      const key = `${size}\u001f${budget}\u001f${foreign ? 1 : 0}\u001f${label}`;
      const cached = cache.get(key);
      if (cached) return cached;
      const settings = renderer.getSettings();
      const font = `${settings.labelWeight} ${size}px ${settings.labelFont}`;
      if (font !== appliedFont) {
        measureContext.font = font;
        appliedFont = font;
      }
      // A foreign node draws its Brain's mark inline on the first line, so the
      // line carrying the status marker has to budget for it.
      const measure = (value: string) =>
        measureContext.measureText(value).width +
        (foreign && /^[○◇◆]\s/u.test(value) ? foreignLabelMarkWidth(size) : 0);
      const layout = layoutGraphLabel(label, budget, size, measure);
      cache.set(key, layout);
      return layout;
    },
  };
}

/**
 * The labels a frame actually painted.
 *
 * Sigma adds a node to `getNodeDisplayedLabels()` before it checks whether the
 * label has any text, so a node whose label this graph suppressed still counts
 * as displayed. Collision selection suppresses by emptying the label, which
 * made the reported count several times the number of titles on screen.
 */
function paintedLabels(renderer: Sigma): Set<string> {
  const painted = new Set<string>();
  for (const node of renderer.getNodeDisplayedLabels()) {
    if (renderer.getNodeDisplayData(node)?.label) painted.add(node);
  }
  return painted;
}

function incrementGraphCounter(host: HTMLElement, name: string): void {
  host.dataset[name] = String(Number(host.dataset[name] ?? 0) + 1);
}

export { nodeColor, nodeSize } from "./graph-style";

let cache: Promise<GraphData> | null = null;

export function fetchGraphData(): Promise<GraphData> {
  if (!cache) {
    cache = fetch(joinBase(import.meta.env.BASE_URL, routes.graphData)).then((r) => {
      if (!r.ok) throw new Error(`graph-data.json: HTTP ${r.status}`);
      return r.json() as Promise<Parameters<typeof normalizeGraphData>[0]>;
    }).then(normalizeGraphData);
  }
  return cache;
}

export function buildGraph(data: GraphData, context: GraphContext = { mode: "all" }): Graph {
  const graph = new Graph();
  for (const node of data.nodes) {
    graph.addNode(node.id, graphNodeAttributes(node, context));
  }
  data.edges.forEach((edge, index) => {
    if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
      graph.addDirectedEdgeWithKey(
        `edge-${index}`,
        edge.source,
        edge.target,
        graphEdgeAttributes(edge, context),
      );
    }
  });
  return graph;
}

function baseSettings(theme: GraphTheme, nodeCount: number) {
  const largeGraph = nodeCount > 500;
  return {
    labelSize: 11,
    labelWeight: "500",
    labelFont: "ui-sans-serif, system-ui, sans-serif",
    labelColor: { color: theme.label, attribute: "labelColor" },
    labelRenderedSizeThreshold: largeGraph ? 14 : 4,
    labelDensity: largeGraph ? 0.08 : 1,
    labelGridCellSize: largeGraph ? 180 : 100,
    // Marker size is a graph-space quantity, so the fit compresses markers
    // along with the positions they sit in and the ratio of marker diameter to
    // node spacing stays roughly constant however large the vault grows.
    itemSizesReference: "positions" as const,
    // Edges are structure, not content. Sigma floors edge thickness at a pixel
    // by default, which at overview density turns the graph into a mesh that
    // canvas labels cannot be read against.
    minEdgeThickness: 0.5,
    defaultDrawNodeLabel: drawGraphNodeLabel,
    defaultDrawNodeHover: drawGraphNodeHover,
    defaultEdgeColor: theme.edge,
    minCameraRatio: 0.05,
    maxCameraRatio: 10,
    // A graph of titles has an up direction. Sigma reads the few degrees of
    // twist in any real pinch as a camera rotation, which tilts the whole
    // graph under labels that stay level; `wirePinchZoom` drives the zoom
    // instead, and nothing else here asks the camera to turn.
    enableCameraRotation: false,
    zIndex: true,
  };
}

interface InteractionState extends GraphHoverState {
  dragged: string | null;
  draggedMoved: boolean;
  theme: GraphTheme;
}

function graphTargetNode(renderer: Sigma, graph: Graph, state: GraphHoverState, point: { x: number; y: number }): string | null {
  const settings = renderer.getSettings();
  const displayedLabels = renderer.getNodeDisplayedLabels();
  const labelContext = renderer.getCanvases().labels?.getContext("2d");
  if (labelContext) {
    labelContext.font = `${settings.labelWeight} ${settings.labelSize}px ${settings.labelFont}`;
  }

  const nodes: Parameters<typeof graphScreenTargets>[0][number][] = [];
  graph.forEachNode((node) => {
    const data = renderer.getNodeDisplayData(node);
    if (!data || data.hidden) return;
    const center = renderer.framedGraphToViewport(data);
    const visualRadius = renderer.scaleSize(data.size);
    const label = data.label;
    nodes.push({
      node,
      x: center.x,
      y: center.y,
      radius: visualRadius,
      label,
      labelRendered: displayedLabels.has(node),
      labelWidth: (data as NodeLabelData).labelWidth,
      labelHeight: (data as NodeLabelData).labelHeight,
    });
  });
  return hitGraphScreenTarget(graphScreenTargets(nodes, renderer.getDimensions()), point);
}

/**
 * Two-contact zoom, in place of sigma's own.
 *
 * Sigma reads the angle between the two contacts as a camera rotation, so a
 * pinch tilts the graph by however many degrees the hand turned through, under
 * labels that stay level, and holds the tilt until some later fit snaps it
 * upright. Dropping the rotation means the gesture can no longer honor both
 * contacts at once, so it honors the point between them.
 */
function wirePinchZoom(renderer: Sigma, state: InteractionState): void {
  const touch = renderer.getTouchCaptor();
  const camera = renderer.getCamera();
  let gesture: Parameters<typeof pinchCameraState>[0] | null = null;

  const midpointOf = (contacts: readonly { x: number; y: number }[]) => ({
    x: (contacts[0]!.x + contacts[1]!.x) / 2,
    y: (contacts[0]!.y + contacts[1]!.y) / 2,
  });
  const begin = (contacts: readonly { x: number; y: number }[]) => {
    gesture = {
      anchor: renderer.viewportToFramedGraph(midpointOf(contacts)),
      ratio: camera.getState().ratio,
      distance: Math.hypot(
        contacts[1]!.x - contacts[0]!.x,
        contacts[1]!.y - contacts[0]!.y,
      ),
    };
  };
  const frame = () => {
    const { width, height } = renderer.getDimensions();
    // Measured rather than derived, so the stage padding and normalization
    // sigma applies are whatever sigma says they are.
    const origin = renderer.viewportToFramedGraph({ x: 0, y: 0 });
    const step = renderer.viewportToFramedGraph({ x: 1, y: 0 });
    return {
      width,
      height,
      graphUnitsPerPixel: (step.x - origin.x) / camera.getState().ratio,
      boundRatio: (ratio: number) => camera.getBoundedRatio(ratio),
    };
  };

  const start = (event: TouchCoords) => {
    if (event.touches.length !== 2) {
      gesture = null;
      return;
    }
    begin(event.touches);
  };
  const zoom = (event: TouchCoords) => {
    // A node being dragged owns the gesture; the camera stays out of it.
    if (state.dragged) return;
    if (event.touches.length !== 2) {
      gesture = null;
      return;
    }
    if (!gesture) begin(event.touches);
    const next = gesture && pinchCameraState(gesture, event.touches, frame());
    if (!next) return;
    // Sigma's captor has already called `preventDefault` on the touch event;
    // this only tells it to skip its own camera update.
    event.preventSigmaDefault();
    camera.setState(next);
  };
  const end = () => {
    gesture = null;
  };

  touch.on("touchdown", start);
  touch.on("touchmove", zoom);
  touch.on("touchup", end);
  renderer.on("kill", () => {
    touch.off("touchdown", start);
    touch.off("touchmove", zoom);
    touch.off("touchup", end);
  });
}

function wireHoverAndClick(
  renderer: Sigma,
  graph: Graph,
  state: InteractionState,
  onInteraction?: () => void,
  options: {
    onFocus?: (node: string | null, fit?: boolean) => void;
    onContextMenu?: (node: string | null, event: MouseEvent) => void;
    onNavigate?: (node: string, route: LogicalRoute) => void;
    /**
     * The node under the pointer, whether or not it changed inspection state.
     * A pinned neighborhood deliberately freezes inspection, so this is the
     * only way to know what the reader is pointing at while one is active.
     */
    onPointerNode?: (node: string | null) => void;
    /**
     * While true, the pointer stops changing which node is inspected. A
     * context menu belongs to the node it was opened on, and reaching for the
     * menu means leaving that node.
     */
    holdInspection?: () => boolean;
    /**
     * Whether a hover previews the node's whole neighborhood. Off, a hover
     * still shows the pointer and the node's own title; it just does not dim
     * the rest of the graph or reveal the neighbors' titles.
     */
    hoverPreview?: () => boolean;
  } = {},
): { reapplyPointer(): void; nodeUnderPointer(): string | null } {
  wirePinchZoom(renderer, state);
  const canNavigateToNode = (node: string) =>
    state.focused === null || isInspectionNeighborhoodNode(state, node);
  const navigateToNode = (node: string) => {
    if (!canNavigateToNode(node)) return;
    onInteraction?.();
    const route = graph.getNodeAttribute(node, "route") as LogicalRoute | undefined;
    if (!route) return;
    if (options.onNavigate) options.onNavigate(node, route);
    else window.location.assign(joinBase(import.meta.env.BASE_URL, route));
  };
  const focus = (node: string | null, fit = false) => {
    if (options.onFocus) options.onFocus(node, fit);
    else {
      setFocusedInspection(graph, state, node);
      renderer.getContainer().toggleAttribute("data-focused-inspection", node !== null);
      renderer.refresh({ skipIndexation: true });
    }
  };
  const longPress = createLongPressController({
    onActivate: (node) => {
      onInteraction?.();
      focus(node, true);
    },
  });
  let emptyStageTouch: { x: number; y: number } | null = null;
  // A camera gesture is not a tap. Once a sequence has had two contact points
  // it cannot clear focus again until every point has lifted, whatever order
  // they lift in.
  let multiTouchSequence = false;
  const observeTouchSequence = (event: TouchEvent) => {
    multiTouchSequence = advanceTouchSequence(multiTouchSequence, {
      type: event.type,
      touches: event.touches.length,
    });
    if (event.touches.length <= 1) return;
    longPress.release();
    emptyStageTouch = null;
  };
  const container = renderer.getContainer();
  let pointerNode: string | null = null;
  let pointerPosition: { x: number; y: number } | null = null;
  const nodeUnderPointer = () => {
    if (!pointerPosition) return null;
    const bounds = container.getBoundingClientRect();
    return graphTargetNode(renderer, graph, state, {
      x: pointerPosition.x - bounds.left,
      y: pointerPosition.y - bounds.top,
    });
  };
  const setPointerTarget = (node: string | null) => {
    if (options.holdInspection?.()) return;
    container.style.cursor = node ? "pointer" : "";
    if (node !== pointerNode) {
      pointerNode = node;
      if (node) container.dataset.pointerNode = node;
      else delete container.dataset.pointerNode;
      options.onPointerNode?.(node);
    }
    // The pointer always knows what it is over; whether that becomes an
    // inspection of the neighborhood is the reader's preference.
    const inspected = node && (options.hoverPreview?.() ?? true) ? node : null;
    const startingInspection = inspected !== null && activeInspectionNode(state) === null;
    if (!setTransientInspection(graph, state, inspected)) return;
    if (inspected) {
      if (startingInspection) onInteraction?.();
      container.dataset.transientInspection = inspected;
      if (startingInspection) {
        updateGeometryStats(container, renderer, graph);
        container.dataset.inspectionStartGraphGeometry = container.dataset.graphGeometry;
        container.dataset.inspectionStartCameraGeometry = container.dataset.cameraGeometry;
        container.dataset.geometryCheckPending = "";
      }
    } else {
      delete container.dataset.transientInspection;
    }
    renderer.refresh({ skipIndexation: true });
  };
  const reapplyPointer = () => {
    const node = nodeUnderPointer();
    setPointerTarget(node && canNavigateToNode(node) ? node : null);
  };
  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    // Keep the physical pointer current even while a menu holds inspection.
    pointerPosition = { x: event.clientX, y: event.clientY };
    if (state.dragged === null) reapplyPointer();
  };
  const onPointerLeave = (event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    pointerPosition = null;
    setPointerTarget(null);
  };
  container.addEventListener("pointermove", onPointerMove);
  container.addEventListener("pointerleave", onPointerLeave);
  const onContextMenu = (event: MouseEvent) => {
    if (!options.onContextMenu) return;
    pointerPosition = { x: event.clientX, y: event.clientY };
    const node = nodeUnderPointer();
    event.preventDefault();
    // Emphasize the node the menu is about before the menu opens, so it stays
    // emphasized for as long as the menu names it.
    setPointerTarget(node);
    options.onContextMenu(node, event);
  };
  container.addEventListener("contextmenu", onContextMenu);
  container.addEventListener("touchstart", observeTouchSequence, { passive: true });
  container.addEventListener("touchmove", observeTouchSequence, { passive: true });
  container.addEventListener("touchcancel", observeTouchSequence, { passive: true });
  // Sigma's touch captor listens for `touchend` on the document, so the
  // sequence must be disarmed there too, and after the captor: registering
  // later means the captor's `touchup` still sees the armed flag on the final
  // lift, which is the event that would otherwise clear the pin.
  document.addEventListener("touchend", observeTouchSequence, { passive: true });
  renderer.on("downNode", ({ node, event }) => {
    emptyStageTouch = null;
    if (isTouchPress(event)) longPress.start(node, event);
  });
  renderer.on("downStage", ({ event }) => {
    if (!isTouchPress(event)) return;
    const node = graphTargetNode(renderer, graph, state, event);
    if (node) longPress.start(node, event);
    else {
      longPress.consumeActivatedPress();
      emptyStageTouch = { x: event.x, y: event.y };
    }
  });
  renderer.on("clickNode", ({ node, event }) => {
    if (longPress.consumeActivatedPress()) return;
    if (multiTouchSequence && event.original.type.startsWith("touch")) return;
    if (state.draggedMoved) {
      state.draggedMoved = false;
      return;
    }
    navigateToNode(node);
  });
  renderer.on("clickStage", ({ event }) => {
    const touchEvent = event.original.type.startsWith("touch");
    if (longPress.consumeActivatedPress()) return;
    if (multiTouchSequence && touchEvent) return;
    if (state.draggedMoved) {
      state.draggedMoved = false;
      return;
    }
    const node = graphTargetNode(renderer, graph, state, event);
    if (node) {
      navigateToNode(node);
    } else if (touchEvent && state.focused) {
      focus(null);
    }
  });
  const touch = renderer.getTouchCaptor();
  const moveLongPress = (event: TouchCoords) => {
    if (event.touches.length !== 1) {
      longPress.release();
      emptyStageTouch = null;
      return;
    }
    const point = event.touches[0];
    if (point) longPress.move(point);
    if (
      !point ||
      (emptyStageTouch && Math.hypot(point.x - emptyStageTouch.x, point.y - emptyStageTouch.y) > 8)
    ) {
      emptyStageTouch = null;
    }
  };
  const releaseLongPress = () => {
    longPress.release();
    if (emptyStageTouch && state.focused && !multiTouchSequence) {
      focus(null);
    }
    emptyStageTouch = null;
  };
  touch.on("touchmove", moveLongPress);
  touch.on("touchup", releaseLongPress);
  renderer.on("kill", () => {
    touch.off("touchmove", moveLongPress);
    touch.off("touchup", releaseLongPress);
    container.removeEventListener("touchstart", observeTouchSequence);
    container.removeEventListener("touchmove", observeTouchSequence);
    container.removeEventListener("touchcancel", observeTouchSequence);
    document.removeEventListener("touchend", observeTouchSequence);
    container.removeEventListener("pointermove", onPointerMove);
    container.removeEventListener("pointerleave", onPointerLeave);
    container.removeEventListener("contextmenu", onContextMenu);
    setTransientInspection(graph, state, null);
    longPress.destroy();
  });
  return {
    reapplyPointer,
    nodeUnderPointer,
  };
}

/**
 * The hover-preview preference, shared by the global graph and a note page's
 * connection map so one choice covers both.
 */
function createHoverPreviewPreference() {
  const key = hoverPreviewStorageKey(import.meta.env.BASE_URL);
  let value: boolean | null = null;
  const read = (): boolean => {
    if (value !== null) return value;
    try {
      const stored = window.localStorage.getItem(key);
      if (stored === "true" || stored === "false") return (value = stored === "true");
    } catch {
      // Local storage can be unavailable in restricted browsing contexts.
    }
    return (value = defaultHoverPreviewPreference());
  };
  const write = (next: boolean) => {
    value = next;
    try {
      window.localStorage.setItem(key, String(next));
    } catch {
      // The choice still applies for this page.
    }
  };
  return { read, write };
}

/** Keys that act on the graph, never while the reader is typing somewhere. */
function isGraphKey(event: KeyboardEvent, key: string): boolean {
  if (event.key.toLowerCase() !== key || event.repeat) return false;
  if (event.metaKey || event.ctrlKey || event.altKey) return false;
  const target = event.target as HTMLElement | null;
  if (!target) return true;
  if (target.isContentEditable) return false;
  return !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function wireTheme(renderer: Sigma, state: InteractionState): void {
  const media = window.matchMedia("(prefers-color-scheme: light)");
  const update = () => {
    state.theme = graphTheme();
    renderer.setSettings({
      defaultEdgeColor: state.theme.edge,
      labelColor: { color: state.theme.label, attribute: "labelColor" },
    });
    renderer.refresh();
  };
  media.addEventListener("change", update);
  renderer.on("kill", () => media.removeEventListener("change", update));
}

function wireNodeDragging(
  renderer: Sigma,
  graph: Graph,
  state: InteractionState,
  onDragComplete?: (node: string, neighborhood: string[], moved: boolean) => void,
  onDragStart?: () => void,
): void {
  let startPointer: { x: number; y: number } | null = null;
  let startViewport: { x: number; y: number } | null = null;
  let starts = new Map<string, { x: number; y: number; weight: number }>();

  renderer.on("downNode", ({ node, event, preventSigmaDefault }) => {
    if (!permitsNodeDrag(event.original as MouseEvent)) return;
    state.dragged = node;
    state.draggedMoved = false;
    onDragStart?.();
    startPointer = renderer.viewportToGraph(event);
    startViewport = { x: event.x, y: event.y };
    starts = new Map([
      [
        node,
        {
          x: graph.getNodeAttribute(node, "x") as number,
          y: graph.getNodeAttribute(node, "y") as number,
          weight: 1,
        },
      ],
      ...graph.neighbors(node).map(
        (neighbor) =>
          [
            neighbor,
            {
              x: graph.getNodeAttribute(neighbor, "x") as number,
              y: graph.getNodeAttribute(neighbor, "y") as number,
              weight: 0.22,
            },
          ] as const,
      ),
    ]);
    graph.setNodeAttribute(node, "highlighted", true);
    if (!renderer.getCustomBBox()) renderer.setCustomBBox(renderer.getBBox());
    renderer.getContainer().style.cursor = "grabbing";
    preventSigmaDefault();
  });

  const move = (
    point: { x: number; y: number },
    event: {
      preventSigmaDefault(): void;
      original: MouseEvent | TouchEvent;
    },
  ) => {
    if (!state.dragged || !startPointer || !startViewport) return;
    const current = renderer.viewportToGraph(point);
    const dx = current.x - startPointer.x;
    const dy = current.y - startPointer.y;
    if (Math.hypot(point.x - startViewport.x, point.y - startViewport.y) > GRAPH_DRAG_TOLERANCE) {
      state.draggedMoved = true;
    }
    for (const [node, start] of starts) {
      graph.mergeNodeAttributes(node, {
        x: start.x + dx * start.weight,
        y: start.y + dy * start.weight,
      });
    }
    event.preventSigmaDefault();
    event.original.preventDefault();
    event.original.stopPropagation();
  };

  const finish = () => {
    if (!state.dragged) return;
    const dragged = state.dragged;
    const moved = state.draggedMoved;
    const neighborhood = [dragged, ...graph.neighbors(dragged)];
    graph.removeNodeAttribute(dragged, "highlighted");
    state.dragged = null;
    startPointer = null;
    startViewport = null;
    starts.clear();
    renderer.getContainer().style.cursor = state.hovered ? "pointer" : "";
    if (state.draggedMoved) window.setTimeout(() => (state.draggedMoved = false), 0);
    onDragComplete?.(dragged, neighborhood, moved);
  };

  const mouse = renderer.getMouseCaptor();
  const moveMouse = (event: MouseCoords) => move(event, event);
  mouse.on("mousemovebody", moveMouse);
  mouse.on("mouseup", finish);

  const touch = renderer.getTouchCaptor();
  const moveTouch = (event: TouchCoords) => {
    const point = event.touches[0];
    if (point) move(point, event);
  };
  touch.on("touchmove", moveTouch);
  touch.on("touchup", finish);

  renderer.on("kill", () => {
    mouse.off("mousemovebody", moveMouse);
    mouse.off("mouseup", finish);
    touch.off("touchmove", moveTouch);
    touch.off("touchup", finish);
  });
}

/* ------------------------------------------------------------------------ */
/* Global graph                                                              */
/* ------------------------------------------------------------------------ */

export interface GlobalGraphUI {
  host: HTMLElement;
  searchInput: HTMLInputElement;
  searchResults: HTMLElement;
  typeFilters: NodeListOf<HTMLInputElement>;
  statusFilters: NodeListOf<HTMLInputElement>;
  tagFilter: HTMLSelectElement;
  count: HTMLElement;
  fitViewButton: HTMLButtonElement;
  relatedBrainsToggle?: HTMLButtonElement | null;
  /** Fine-pointer only: whether hovering previews a neighborhood. */
  hoverPreviewToggle?: HTMLButtonElement | null;
  focusStatus: HTMLElement;
  focusTitle: HTMLElement;
  focusTitleFull: HTMLElement;
  focusDisclosure: HTMLButtonElement;
  focusDetails: HTMLElement;
  focusCopy: HTMLButtonElement;
  focusOpen: HTMLAnchorElement;
  focusClear: HTMLButtonElement;
  /** The focused note's connected neighbors, as readable rows. */
  neighbors: { list: HTMLElement; items: HTMLElement };
  contextMenu: HTMLElement;
  contextFocus: HTMLButtonElement;
  contextCopy: HTMLButtonElement;
  contextOpen: HTMLButtonElement;
  contextClear: HTMLButtonElement;
  contextFit: HTMLButtonElement;
  contextDivider: HTMLElement;
  /** The Brain lens control; absent in vault mode. */
  lens?: GraphLensUI | null;
  /** Connected-domain chips; present on any workspace-mode graph. */
  domains?: GraphDomainsUI | null;
}

export interface GraphLensUI {
  control: HTMLElement;
  summary: HTMLElement;
  checkboxes: readonly HTMLInputElement[];
  reset: HTMLButtonElement;
  /** Whether workspace canvas labels carry their owning Brain. */
  ownerLabels?: HTMLInputElement | null;
}

export interface GraphDomainChipUI {
  brainId: string;
  title: string;
  item: HTMLElement;
  toggle: HTMLButtonElement;
  count: HTMLElement;
  state: HTMLElement;
  /** Marks the Brain the focused note itself belongs to. */
  owner: HTMLElement;
}

export interface GraphDomainsUI {
  list: HTMLElement;
  /** One chip per configured Brain, already in declared hierarchy order. */
  chips: readonly GraphDomainChipUI[];
}

export async function mountGlobalGraph(ui: GlobalGraphUI): Promise<void> {
  const data = await fetchGraphData();
  const activeBrainId = ui.host.dataset.activeBrainId;
  /** The unfocused graph this page's focus belongs to. */
  const graphRoute = activeBrainId
    ? routesFor({ mode: "workspace", brainId: activeBrainId }).graph
    : routes.home;
  // Keyed to the graph this page shows, not to the address bar. Pinning focus
  // rewrites the address to the focused note's neighborhood path, and a
  // preference about which Brains the graph shows must not be orphaned by
  // which note happens to be focused.
  const relatedBrainsStorageKey = activeBrainId && ui.relatedBrainsToggle
    ? `graph-related-brains:${joinBase(import.meta.env.BASE_URL, graphRoute)}`
    : null;
  let showRelatedBrains = false;
  let relatedBrainsStateRecorded = false;
  let relatedBrainsStatePending = Boolean(relatedBrainsStorageKey);
  let relatedBrainsSessionInvalid = false;
  if (relatedBrainsStorageKey) {
    try {
      const stored = window.sessionStorage.getItem(relatedBrainsStorageKey);
      if (stored === "true" || stored === "false") {
        showRelatedBrains = stored === "true";
        relatedBrainsStateRecorded = true;
        relatedBrainsStatePending = false;
      }
    } catch {
      // Session storage can be unavailable in restricted browsing contexts.
    }
    if (ui.relatedBrainsToggle) {
      const label = showRelatedBrains
        ? "Hide related brains"
        : "Show related brains";
      ui.relatedBrainsToggle.setAttribute("aria-pressed", String(showRelatedBrains));
      ui.relatedBrainsToggle.setAttribute("aria-label", label);
      ui.relatedBrainsToggle.title = label;
      ui.relatedBrainsToggle.querySelector<HTMLElement>("[data-control-label]")!.textContent = label;
    }
  }
  // A page generated at a note's path keeps its layout and camera under a
  // scope of its own, so its close-up never comes back as the graph page's
  // restored view.
  let neighborhoodFocus = ui.host.dataset.initialFocus ?? null;
  const motionScope = () =>
    graphSessionScope({ activeBrainId, showRelatedBrains, neighborhoodFocus });
  const visualContext: GraphContext = activeBrainId
    ? { mode: "brain", brainId: activeBrainId }
    : { mode: "all", encodeBrains: data.mode === "workspace" };
  const graph = buildGraph(data, visualContext);
  const nodeByCompositeId = new Map(data.nodes.map((node) => [node.compositeId, node.id]));
  const compositeIds = [...nodeByCompositeId.keys()];
  const theme = graphTheme();
  const renderer = new Sigma(graph, ui.host, baseSettings(theme, graph.order));
  const narrowGraphQuery = window.matchMedia("(max-width: 700px)");
  const compactFocusQuery = window.matchMedia("(max-width: 700px), (pointer: coarse)");
  let focusDetailsExpanded = false;
  const syncFocusDetails = () => {
    const compact = compactFocusQuery.matches;
    ui.focusDisclosure.hidden = !compact;
    ui.focusDisclosure.setAttribute("aria-expanded", String(compact && focusDetailsExpanded));
    ui.focusDisclosure.setAttribute(
      "aria-label",
      focusDetailsExpanded ? "Hide focus details" : "Show focus details",
    );
    ui.focusDetails.hidden = compact && !focusDetailsExpanded;
    ui.focusStatus.dataset.focusDetails = compact && focusDetailsExpanded ? "expanded" : "collapsed";
  };
  const desktopLabelThreshold = graph.order > 500 ? 14 : 4;
  const desktopLabelGridCellSize = graph.order > 500 ? 180 : 100;
  const applyResponsiveLabelThreshold = (narrow = narrowGraphQuery.matches) => {
    renderer.setSettings(
      responsiveLabelSettings(narrow, desktopLabelThreshold, desktopLabelGridCellSize),
    );
  };
  applyResponsiveLabelThreshold();
  let focusAfterMotion: (() => void) | null = null;
  const motion = new GraphMotionController(renderer, graph, data, () => {
    incrementGraphCounter(ui.host, "motionCompletions");
    relatedBrainsSessionInvalid = false;
    if (relatedBrainsStatePending) saveRelatedBrainsState();
    if (narrowGraphQuery.matches && state.focused) applyReducers();
    const afterMotion = focusAfterMotion;
    focusAfterMotion = null;
    afterMotion?.();
  }, motionScope(), true, false, () => ({
    includeLabels: !narrowGraphQuery.matches,
    // Narrow fits still keep the focused note's title and plate inside.
    labelIds: state.focused ? [state.focused] : [],
  }));
  const requestSettle = (...args: Parameters<GraphMotionController["settle"]>) => {
    incrementGraphCounter(ui.host, "settleRequests");
    motion.settle(...args);
  };
  const restored = relatedBrainsStorageKey === null || relatedBrainsStateRecorded
    ? motion.restoreSession()
    : { positions: false, view: false };
  if (relatedBrainsStorageKey && !restored.positions) relatedBrainsStatePending = true;
  function saveRelatedBrainsState(): void {
    if (!relatedBrainsStorageKey) return;
    try {
      window.sessionStorage.setItem(relatedBrainsStorageKey, String(showRelatedBrains));
      relatedBrainsStatePending = false;
    } catch {
      // Session storage can be unavailable in restricted browsing contexts.
    }
  }
  const commitSession = () => {
    if (relatedBrainsStatePending || relatedBrainsSessionInvalid) return;
    if (motion.commitSession()) saveRelatedBrainsState();
  };
  const resolveCanceledRelatedBrainsState = () => {
    if (!relatedBrainsStatePending) return;
    if (!motion.invalidateSession()) return;
    relatedBrainsSessionInvalid = true;
    saveRelatedBrainsState();
  };
  let sessionTimer: number | null = null;
  const saveSession = () => {
    if (sessionTimer !== null) window.clearTimeout(sessionTimer);
    sessionTimer = window.setTimeout(() => {
      sessionTimer = null;
      commitSession();
    }, 120);
  };
  const flushSession = () => {
    if (sessionTimer !== null) window.clearTimeout(sessionTimer);
    sessionTimer = null;
    if (relatedBrainsStatePending) {
      motion.cancel();
      resolveCanceledRelatedBrainsState();
      return;
    }
    commitSession();
  };
  renderer.getCamera().on("updated", saveSession);
  window.addEventListener("pagehide", flushSession);

  const hidden = new Set<string>();
  let contextEdges = new Set<string>();
  const depthKey = neighborhoodDepthStorageKey(import.meta.env.BASE_URL);
  const readNeighborhoodDepth = (): number => {
    try {
      const stored = Number(window.localStorage.getItem(depthKey));
      if (stored >= 1) return clampNeighborhoodDepth(stored);
    } catch {
      // Local storage can be unavailable in restricted browsing contexts.
    }
    return defaultNeighborhoodDepth();
  };
  const state: InteractionState = {
    hovered: null,
    focused: null,
    neighbors: new Set(),
    depth: readNeighborhoodDepth(),
    hops: new Map(),
    dragged: null,
    draggedMoved: false,
    theme,
  };
  ui.host.dataset.neighborhoodDepth = String(state.depth);
  const requestedFocus = initialGraphFocus(ui.host.dataset.initialFocus, window.location.search);
  setFocusedInspection(
    graph,
    state,
    requestedFocus ? nodeByCompositeId.get(requestedFocus) ?? null : null,
  );
  let initialFocusOverride = state.focused !== null;
  // The personal Brain lens: dimmed Brain IDs remembered per site base in the
  // reader's own browser. It lowers emphasis in place and never reaches a URL.
  const knownBrainIds = data.brains.map(({ id }) => id);
  const lensStore = createLensStore(import.meta.env.BASE_URL);
  // A reader-owned display setting, remembered in the reader's own browser per
  // site base like the Brain lens, and never in a URL.
  const ownerLabelKey = ownerLabelStorageKey(import.meta.env.BASE_URL);
  const readOwnerLabelPreference = (): boolean => {
    try {
      const stored = window.localStorage.getItem(ownerLabelKey);
      if (stored === "true" || stored === "false") return stored === "true";
    } catch {
      // Local storage can be unavailable in restricted browsing contexts.
    }
    return defaultOwnerLabelPreference(narrowGraphQuery.matches);
  };
  let showOwnerLabels = readOwnerLabelPreference();
  const writeOwnerLabelPreference = (value: boolean) => {
    try {
      window.localStorage.setItem(ownerLabelKey, String(value));
    } catch {
      // Local storage can be unavailable in restricted browsing contexts; the
      // choice still applies for this page.
    }
  };
  let dimmedBrains: ReadonlySet<string> = new Set(normalizeLens(lensStore.read(), knownBrainIds));
  const lensReducers = createLensReducers(graph, state, { dimmed: () => dimmedBrains, hidden });
  let query = "";

  const activeTypes = () =>
    new Set([...ui.typeFilters].filter((c) => c.checked).map((c) => c.value));
  const activeStatuses = () =>
    new Set(
      [...ui.statusFilters].filter((control) => control.checked).map((control) => control.value),
    );

  function currentContext(): GraphContext {
    if (activeBrainId) {
      return { mode: "brain", brainId: activeBrainId, includeForeign: showRelatedBrains };
    }
    return { mode: "all" };
  }

  // Nodes the lens currently renders dimmed: a hovered or focused neighborhood
  // is excluded because it outranks the lens.
  function updateLensStats(): void {
    ui.host.dataset.lens = [...dimmedBrains].join(",");
    ui.host.dataset.dimmedNodes = String(graph.nodes().filter((id) =>
      !hidden.has(id) &&
      dimmedBrains.has(graph.getNodeAttribute(id, "brainId") as string) &&
      !isInspectionNeighborhoodNode(state, id)
    ).length);
  }

  /**
   * Connected domains of the focused neighborhood on a workspace neighborhood
   * page: one chip per Brain owning the focused note or a visible neighbor.
   * The chip order is the declared hierarchy, fixed in the markup; the
   * grouping is client-side so it always matches the graph the reader sees.
   */
  function updateDomains(): void {
    const domains = ui.domains;
    if (!domains) return;
    const focused = state.focused;
    if (!focused) {
      domains.list.hidden = true;
      return;
    }
    const focusedBrainId = graph.getNodeAttribute(focused, "brainId") as string;
    const member = (id: string) => ({ id, brainId: graph.getNodeAttribute(id, "brainId") as string });
    const present = new Map(
      connectedDomains(
        member(focused),
        [...state.neighbors].filter((id) => !hidden.has(id)).map(member),
        domains.chips.map((chip) => chip.brainId),
      ).map((domain) => [domain.brainId, domain.count]),
    );
    for (const chip of domains.chips) {
      const count = present.get(chip.brainId);
      chip.item.hidden = count === undefined;
      if (count === undefined) continue;
      const dimmed = dimmedBrains.has(chip.brainId);
      // Which Brain the focused note itself lives in. With the owner prefix
      // off, the bar is the only place left that can say so, and it is
      // required to keep saying it.
      const owns = chip.brainId === focusedBrainId;
      chip.count.textContent = String(count);
      chip.count.setAttribute("aria-label", `${count} ${count === 1 ? "note" : "notes"}`);
      chip.owner.hidden = !owns;
      chip.item.toggleAttribute("data-domain-owner-chip", owns);
      chip.state.hidden = !dimmed;
      chip.toggle.setAttribute("aria-pressed", String(dimmed));
      chip.toggle.title = dimmed
        ? `Show ${chip.title} at full emphasis everywhere`
        : `Dim ${chip.title} outside this neighborhood`;
    }
    domains.list.hidden = false;
  }

  /**
   * The focused note's connected neighbors as text rows, so a reader can read
   * them without zooming or panning the canvas. On a graph dense enough that
   * collision selection places almost no labels, this is where the
   * neighborhood becomes legible at all.
   */
  function updateNeighborList(): void {
    const focused = state.focused;
    if (!focused) {
      ui.neighbors.list.hidden = true;
      ui.neighbors.items.replaceChildren();
      delete ui.host.dataset.neighborRows;
      return;
    }
    const rows = neighborRows(
      graph.getNodeAttribute(focused, "brainId") as string,
      [...state.neighbors].filter((id) => !hidden.has(id)).map((id) => ({
        node: id,
        title: data.nodes.find(({ id: nodeId }) => nodeId === id)?.title ?? id,
        brainId: graph.getNodeAttribute(id, "brainId") as string,
        brainTitle: graph.getNodeAttribute(id, "brainTitle") as string,
        distance: state.hops?.get(id) ?? 1,
      })),
    );
    ui.host.dataset.neighborRows = String(rows.length);
    if (rows.length === 0) {
      ui.neighbors.list.hidden = true;
      ui.neighbors.items.replaceChildren();
      return;
    }
    ui.neighbors.items.replaceChildren(...rows.map((row) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "graph-neighbor";
      button.dataset.neighborNode = row.node;
      const title = document.createElement("span");
      title.className = "graph-neighbor__title";
      title.textContent = row.title;
      button.append(title);
      if (row.foreignBrainTitle) {
        // A foreign neighbor says so here whatever the canvas is doing about
        // owner prefixes, because the row is the only text a reader gets.
        const owner = document.createElement("span");
        owner.className = "graph-neighbor__owner";
        owner.textContent = row.foreignBrainTitle;
        button.append(owner);
      }
      if (row.distance > 1) {
        const distance = document.createElement("span");
        distance.className = "graph-neighbor__owner";
        distance.textContent = `${row.distance} links away`;
        button.append(distance);
      }
      const away = row.distance > 1 ? `, ${row.distance} links away` : "";
      button.setAttribute(
        "aria-label",
        row.foreignBrainTitle
          ? `Focus ${row.title}, in ${row.foreignBrainTitle}${away}`
          : `Focus ${row.title}${away}`,
      );
      button.addEventListener("click", () => setFocus(row.node, true, true));
      item.append(button);
      return item;
    }));
    ui.neighbors.list.hidden = false;
  }

  function edgeKey(source: string, target: string): string {
    return `${source}\u001f${target}`;
  }

  const focusAllowed = (node: string): boolean => {
    if (!graph.hasNode(node)) return false;
    const context = activeBrainId
      ? { mode: "brain" as const, brainId: activeBrainId, includeForeign: true }
      : currentContext();
    return deriveGraphData(data, context).nodes.some(({ id }) => id === node);
  };

  const focusedCompositeId = (): string | null => state.focused
    ? graph.getNodeAttribute(state.focused, "compositeId") as string
    : null;

  const syncFocusUrlState = createFocusUrlSync({
    base: import.meta.env.BASE_URL,
    graphRoute,
    knownCompositeIds: compositeIds,
    neighborhoodRouteFor: (compositeId) => {
      const node = data.nodes.find((entry) => entry.compositeId === compositeId);
      return node ? neighborhoodRoute(node, data.mode) : null;
    },
    location: window.location,
    history: window.history,
  });
  const syncFocusUrl = () => {
    const focus = focusedCompositeId();
    syncFocusUrlState(focus);
    neighborhoodFocus = focus;
    motion.setSessionScope(motionScope());
    if (data.mode === "workspace") {
      const owner = state.focused
        ? graph.getNodeAttribute(state.focused, "brainId") as string
        : activeBrainId;
      syncGraphPageScope(import.meta.env.BASE_URL, owner);
    }
  };

  /** Pathname-only link to a node's own neighborhood page. */
  const nodeNeighborhoodHref = (node: string): string => {
    const datum = data.nodes.find(({ id }) => id === node);
    if (!datum) throw new Error(`graph: unknown node ${node}`);
    return neighborhoodHref(import.meta.env.BASE_URL, window.location.origin, datum, data.mode);
  };

  const noteHref = (route: LogicalRoute): string =>
    joinBase(import.meta.env.BASE_URL, withGraphFocus(route, compositeIds, focusedCompositeId()));

  const focusIds = () => state.focused
    ? [state.focused, ...[...state.neighbors].filter((id) => !hidden.has(id))]
    : [];

  const updateFocusUI = () => {
    const node = state.focused;
    ui.host.toggleAttribute("data-focused-inspection", node !== null);
    if (!node) {
      focusDetailsExpanded = false;
      syncFocusDetails();
      ui.focusStatus.hidden = true;
      delete ui.host.dataset.focusedNode;
      if (ui.host.dataset.graphTitle) document.title = ui.host.dataset.graphTitle;
      delete document.documentElement.dataset.originatingGraphFocus;
      return;
    }
    const title = data.nodes.find(({ id }) => id === node)?.title ?? node;
    const route = graph.getNodeAttribute(node, "route") as LogicalRoute;
    ui.host.dataset.focusedNode = node;
    document.documentElement.dataset.originatingGraphFocus = graph.getNodeAttribute(node, "compositeId") as string;
    ui.focusStatus.hidden = false;
    ui.focusTitle.textContent = title;
    ui.focusTitleFull.textContent = title;
    // The tab says what the address says: a focused note's neighborhood, or
    // the graph itself. Same rule whichever path the page was opened at.
    document.title = `${title} neighborhood`;
    ui.focusOpen.href = noteHref(route);
    syncFocusDetails();
    updateDomains();
    updateNeighborList();
  };

  /**
   * Frames the focused note and its visible neighbors.
   *
   * `animate` is false when a page opens already focused. There is no earlier
   * view for the reader to be carried from, so animating means watching the
   * whole graph appear and then be zoomed away from, every time a neighborhood
   * link is followed.
   */
  const fitFocus = (animate = true) => {
    const ids = focusIds();
    if (ids.length === 0) return;
    cancelFilterSettle();
    motion.cancel();
    responsiveScheduler.defer(responsiveState());
    responsiveScheduler.flush(applyResponsiveState);
    incrementGraphCounter(ui.host, "fitRequests");
    motion.fitView(ids, animate);
  };

  const setFocus = (node: string | null, fit = false, fromFocusBar = false) => {
    const next = node && focusAllowed(node) ? node : null;
    // A move made from inside the bar leaves it open: the reader is reading
    // the list and expects the list to refill, not to close under them.
    if (next !== state.focused && !fromFocusBar) focusDetailsExpanded = false;
    if (!next) initialFocusOverride = false;
    setFocusedInspection(graph, state, next);
    delete ui.host.dataset.transientInspection;
    updateFocusUI();
    syncFocusUrl();
    recomputeHidden();
    applyReducers();
    if (fit && next) fitFocus();
  };

  function recomputeHidden(): void {
    hidden.clear();
    const contextData = deriveFocusedGraphData(data, currentContext(), state.focused);
    const contextNodes = new Set(contextData.nodes.map((node) => node.id));
    contextEdges = new Set(contextData.edges.map((edge) => edgeKey(edge.source, edge.target)));
    const types = activeTypes();
    const statuses = activeStatuses();
    const tag = ui.tagFilter.value;
    graph.forEachNode((id, attrs) => {
      if (!contextNodes.has(id)) hidden.add(id);
      else if (!types.has(attrs.noteType as string)) hidden.add(id);
      else if (!statuses.has(attrs.status as string)) hidden.add(id);
      else if (tag && !(attrs.tags as string[]).includes(tag)) hidden.add(id);
    });
    const resolvedFocus = resolveFocusedVisibility(
      hidden,
      state.focused,
      state.focused ? [...state.neighbors].filter((id) => contextNodes.has(id)) : [],
      initialFocusOverride,
    );
    if (state.focused && !resolvedFocus) {
      setFocusedInspection(graph, state, null);
      updateFocusUI();
      syncFocusUrl();
    }
    const total = graph.order - hidden.size;
    ui.count.textContent = `${total} of ${contextNodes.size} notes`;
    const visibleNodes = data.nodes.filter((node) => !hidden.has(node.id));
    const visibleBrainIds = data.brains
      .map((brain) => brain.id)
      .filter((brainId) => visibleNodes.some((node) => node.brainId === brainId));
    const visibleCrossEdges = data.edges.filter((edge) =>
      edge.crossBrain &&
      contextEdges.has(edgeKey(edge.source, edge.target)) &&
      !hidden.has(edge.source) &&
      !hidden.has(edge.target)
    );
    ui.host.dataset.visibleNodes = String(total);
    ui.host.dataset.visibleBrainIds = visibleBrainIds.join(",");
    ui.host.dataset.foreignNodes = String(
      activeBrainId ? visibleNodes.filter((node) => node.brainId !== activeBrainId).length : 0,
    );
    ui.host.dataset.crossEdges = String(visibleCrossEdges.length);
    ui.host.dataset.relatedBrainsVisible = String(Boolean(activeBrainId && showRelatedBrains));
    updateLensStats();
    updateDomains();
    updateNeighborList();
  }

  /**
   * Redraws while any label is fading in. `skipIndexation` keeps this cheap:
   * nothing about the graph changed, only how opaque some text is.
   */
  let fadeFrame: number | null = null;
  const runLabelFades = (context: CanvasRenderingContext2D | null | undefined) => {
    if (!context || fadeFrame !== null || !labelFadesRunning(context)) return;
    const step = () => {
      fadeFrame = null;
      const retired = finishedLabelFadeOuts(context);
      if (retired.length > 0) {
        // A label that has finished leaving stops being drawn at all, which
        // needs the reducer to run again, unlike the fade itself.
        for (const node of retired) retiringLabels.delete(node);
        renderer.refresh();
      } else {
        renderer.refresh({ skipIndexation: true });
      }
      if (labelFadesRunning(context)) fadeFrame = window.requestAnimationFrame(step);
    };
    fadeFrame = window.requestAnimationFrame(step);
  };
  const scaleMarkerSize = (size: number) => renderer.scaleSize(size);
  const labelLayouts = createGraphLabelLayouts(renderer);
  const baseLabelSize = renderer.getSetting("labelSize");
  /** Labels collision selection has kept; `null` during the layout pass. */
  let selectedLabels: Set<string> | null = null;
  /** Labels already on screen, so only genuinely new ones fade in. */
  let drawnLabels = new Set<string>();
  /** Labels still drawn while they fade out, before they stop being drawn. */
  let retiringLabels = new Set<string>();
  /** The node under the pointer, which always gets to show its title. */
  let pointerLabelNode: string | null = null;
  /**
   * Repaints just the nodes whose pointer state changed. A hover must show its
   * title at once, and a full re-index per pointer move is what made pinch
   * zoom stutter; sigma's partial refresh re-applies the reducer to the named
   * nodes only. Hidden nodes have no program slot to repaint into.
   */
  const repaintPointerNodes = (...nodes: (string | null)[]) => {
    const visible = nodes.filter((node): node is string =>
      node !== null && graph.hasNode(node) && !renderer.getNodeDisplayData(node)?.hidden
    );
    if (visible.length) renderer.refresh({ partialGraph: { nodes: visible }, skipIndexation: true });
  };
  function applyReducers(fitting = false): void {
    const dimensions = renderer.getDimensions();
    const labelSize = renderedLabelSize(baseLabelSize, renderer.getCamera().getState().ratio);
    // Screen geometry is independent of what the reducer decides to show, so
    // it can be gathered once and read from inside the reducer.
    const centers = new Map<string, { x: number; y: number; radius: number }>();
    graph.forEachNode((node, attrs) => {
      if (hidden.has(node)) return;
      const data = renderer.getNodeDisplayData(node);
      if (!data || data.hidden) return;
      // From graph coordinates rather than the cached display data: a focus fit
      // installs a custom bounding box, and normalized display coordinates go
      // stale against it until the next indexation. Reading a stale position
      // put nodes thousands of pixels off screen, which collapsed their label
      // width budget to zero and silently suppressed every label on the graph.
      const center = renderer.graphToViewport({ x: attrs.x as number, y: attrs.y as number });
      // Cached display sizes were reduced for the previous camera state.
      const radius = scaleMarkerSize(flooredNodeSize(attrs.size as number, scaleMarkerSize));
      centers.set(node, { ...center, radius });
    });
    const laidOut = new Map<string, { layout: GraphLabelLayout; box: GraphLabelBox }>();
    const labelFor = (node: string, label: string, foreign: boolean) => {
      const center = centers.get(node);
      if (!center || !label) return null;
      const layout = labelLayouts.layout(
        label,
        labelLayouts.budget(center.x, dimensions.width),
        labelSize,
        foreign,
      );
      const box = graphLabelBox(layout, center, center.radius);
      if (!box) return null;
      const placed = { layout, box };
      laidOut.set(node, placed);
      return placed;
    };
    const nodeReducer: NonNullable<ReturnType<Sigma["getSettings"]>["nodeReducer"]> = (node, attrs) => {
      const activeNode = activeInspectionNode(state);
      const res = { ...attrs } as Record<string, unknown>;
      if (hidden.has(node)) {
        res.hidden = true;
        return res as typeof attrs;
      }
      res.size = flooredNodeSize(attrs.size as number, scaleMarkerSize);
      // The reader's owner preference decides the text; everything downstream
      // (search matching, layout, hit testing) works from what it chooses.
      if (!showOwnerLabels && !attrs.ownerRequired && attrs.titleLabel) {
        res.label = attrs.titleLabel;
      }
      if (attrs.foreign) {
        res.forceLabel = forceForeignLabel(true, narrowGraphQuery.matches);
      }
      const label = (res.label as string).toLowerCase();
      const inspectedNeighborhood = isInspectionNeighborhoodNode(state, node);
      if (inspectedNeighborhood && res.label) res.forceLabel = true;
      if (node === state.focused && state.hovered === null) {
        res.focused = true;
        res.highlighted = true;
      }
      if (state.focused && node !== state.focused && node !== pointerLabelNode) {
        res.suppressHover = true;
      }
      // Precedence: inspected neighborhood at full emphasis, then the lens,
      // then search fading and normal styling. `res` is already a copy.
      const styled = lensReducers.nodeReducer(node, res as typeof attrs) as Record<string, unknown>;
      if (!activeNode && query && !label.includes(query)) {
        styled.color = state.theme.fadedNode;
        styled.label = "";
      }
      // Whatever the pointer is over shows its title on the hover plate, unless
      // it is grayed out by the lens or by a pin it does not belong to.
      const underPointer = node === pointerLabelNode
        && !styled.dimmed && !styled.suppressHover && Boolean(styled.label);
      if (underPointer) styled.highlighted = true;
      const displayLabel = typeof styled.label === "string" ? styled.label : "";
      // One layout, shared: the renderer draws these lines, `graphScreenTargets`
      // hit-tests the box they occupy, and label-aware fitting measures the
      // same box. Nothing downstream recomputes where a label sits.
      const placed = labelFor(node, displayLabel, Boolean(styled.foreign));
      if (!placed && displayLabel) {
        // No legible line fits: omit rather than draw a label cut off.
        styled.label = "";
        styled.forceLabel = false;
        return styled as typeof attrs;
      }
      if (placed) {
        // Keep measurement separate from visibility: a required title must fit
        // even when panning or collision selection removed it from the canvas.
        styled.fitLabelLayout = placed.layout;
        // Whatever the reader is pointing at always shows its title, even when
        // collision selection had no room to place it.
        if (
          selectedLabels &&
          !selectedLabels.has(node) &&
          (fitting || !retiringLabels.has(node)) &&
          !underPointer
        ) {
          styled.label = "";
          styled.forceLabel = false;
          return styled as typeof attrs;
        }
        // Forced, because collision selection has already decided this label
        // fits. Sigma's density grid must not get a second, contradictory vote.
        styled.forceLabel = true;
        styled.labelLines = placed.layout.lines;
        styled.labelWidth = placed.layout.width;
        styled.labelHeight = placed.layout.height;
        styled.labelLineHeight = placed.layout.lineHeight;
      }
      return styled as typeof attrs;
    };
    const edgeReducer: NonNullable<ReturnType<Sigma["getSettings"]>["edgeReducer"]> = (edge, attrs) => {
      const source = graph.source(edge);
      const target = graph.target(edge);
      if (!contextEdges.has(edgeKey(source, target)) || hidden.has(source) || hidden.has(target)) {
        return { ...attrs, hidden: true };
      }
      return lensReducers.edgeReducer(edge, {
        ...attrs,
        size: easedEdgeSize(attrs.size, scaleMarkerSize),
      });
    };
    // Two passes, because collision selection needs to know the box every
    // candidate label would occupy before it can tell which of them collide.
    // The first pass lays them all out; the second draws the survivors.
    selectedLabels = null;
    // Sigma indexes immediately when settings change. Batch the changes, then
    // render that index rather than building it again for the layout pass.
    renderer.setSettings({ labelSize, nodeReducer, edgeReducer });
    if (!fitting) renderer.refresh({ partialGraph: {}, skipIndexation: true });
    const focusPriority = (node: string) =>
      node === activeInspectionNode(state) ? 0 : state.neighbors.has(node) ? 1 : 2;
    // A fit already frames its included nodes. Its layout pass needs boxes,
    // not a provisional WebGL frame containing every candidate label.
    const labelCandidates = [...(fitting ? laidOut.keys() : paintedLabels(renderer))].flatMap((node) => {
      const placed = laidOut.get(node);
      return placed
        ? [{
          node,
          box: placed.box,
          priority: focusPriority(node),
          degree: graph.degree(node),
          required: node === state.focused || node === pointerLabelNode,
          // A foreign note's label names the Brain it belongs to.
          exempt: graph.getNodeAttribute(node, "foreign") === true,
        }]
        : [];
    });
    selectedLabels = selectGraphLabels(
      labelCandidates,
      labelSize,
      [...centers].map(([node, center]) => ({ node, box: graphMarkerBox(center, center.radius) })),
    );
    if (ui.host.hasAttribute("data-measure-markers")) {
      // The stages behind a rendered-label count, for assertions about why a
      // label is or is not there: how many could carry one, how many were
      // chosen, and how many are still fading out from the last selection.
      ui.host.dataset.labelCandidates = String(labelCandidates.length);
      ui.host.dataset.labelSelected = String(selectedLabels.size);
      ui.host.dataset.labelRetiring = String(retiringLabels.size);
    }
    const labelContext = fitting ? null : renderer.getCanvases().labels?.getContext("2d");
    if (labelContext) {
      // A selection change that swaps several titles at once reads as a
      // flicker. Arriving labels fade in and leaving ones fade out, so the
      // same change reads as the graph resolving instead.
      const appearing = [...selectedLabels].filter((node) => !drawnLabels.has(node));
      const leaving = [...drawnLabels].filter((node) => !selectedLabels!.has(node));
      retiringLabels = new Set(leaving);
      drawnLabels = new Set(selectedLabels);
      if (beginLabelFades(labelContext, appearing, leaving)) {
        renderer.refresh();
        runLabelFades(labelContext);
        return;
      }
    }
    renderer.refresh();
  }

  setGraphFitLabelRefresh(renderer, () => applyReducers(true));

  const updateRenderedLabelStats = () => {
    const displayed = paintedLabels(renderer);
    const rendered = activeInspectionNode(state)
      ? new Set([...displayed].filter((id) => isInspectionNeighborhoodNode(state, id)))
      : displayed;
    ui.host.dataset.renderedLabels = String(rendered.size);
    ui.host.dataset.renderedLabelIds = [...rendered].sort().join(",");
    ui.host.dataset.renderedForeignLabels = String(
      [...displayed].filter((id) => graph.getNodeAttribute(id, "foreign") === true && !hidden.has(id)).length,
    );
    ui.host.dataset.renderedMarkers = String(graph.order - hidden.size);
    if (dimmedBrains.size > 0) updateLensStats();
    const inspected = activeInspectionNode(state);
    if (inspected) {
      updateInspectionTargetStats(ui.host, renderer, graph, inspected);
      // What the canvas actually draws, which is the wrapped lines with the
      // last one shortened if it had to be, not the untouched label text.
      const inspectedData = renderer.getNodeDisplayData(inspected) as NodeLabelData | undefined;
      ui.host.dataset.inspectionCanvasLabel = inspectedData?.labelLines?.length
        ? inspectedData.labelLines.join(" ")
        : inspectedData?.label ?? "";
    } else {
      delete ui.host.dataset.inspectionTargetGeometry;
      delete ui.host.dataset.inspectionCanvasLabel;
    }
    if (state.focused) {
      ui.host.dataset.focusedMarkerGeometry = JSON.stringify(focusIds().flatMap((id) => {
        const data = renderer.getNodeDisplayData(id);
        if (!data || data.hidden) return [];
        const center = renderer.framedGraphToViewport(data);
        const labelled = data as NodeLabelData;
        return [{
          id,
          x: center.x,
          y: center.y,
          radius: renderer.scaleSize(data.size),
          // The drawn text, so a shortened or omitted label reports as one.
          label: labelled.labelLines?.length
            ? labelled.labelLines.join(" ")
            : data.label ?? "",
        }];
      }));
    } else {
      delete ui.host.dataset.focusedMarkerGeometry;
    }
    if (ui.host.hasAttribute("data-geometry-check-pending")) {
      updateGeometryStats(ui.host, renderer, graph);
      delete ui.host.dataset.geometryCheckPending;
    }
    // Opt-in because reporting every visible marker costs a pass over the
    // whole graph. Density assertions ask for it; readers never pay for it.
    if (ui.host.hasAttribute("data-measure-markers")) {
      ui.host.dataset.markerGeometry = JSON.stringify(renderedMarkerGeometry(renderer, graph));
      ui.host.dataset.cameraRatio = String(renderer.getCamera().getState().ratio);
      ui.host.dataset.renderedLabelSize = String(renderer.getSetting("labelSize"));
    } else {
      delete ui.host.dataset.markerGeometry;
      delete ui.host.dataset.cameraRatio;
      delete ui.host.dataset.renderedLabelSize;
    }
  };
  renderer.on("afterRender", updateRenderedLabelStats);
  // Turning marker measurement on has to produce a frame: an idle graph is not
  // rendering, so the attribute alone would never be answered.
  const markerMeasurementObserver = new MutationObserver(() => renderer.refresh());
  markerMeasurementObserver.observe(ui.host, {
    attributeFilter: ["data-measure-markers"],
  });
  renderer.on("kill", () => markerMeasurementObserver.disconnect());
  let labelBudgetFrame: number | null = null;
  /**
   * Recomputes label layout and selection once the camera stops moving.
   *
   * Both passes of `applyReducers` need a full re-index, because sigma only
   * runs a node reducer while indexing, and laying a label out measures text.
   * Doing that on every frame of a pinch cost about two thirds of the frame
   * budget: median frame gap measured 36ms while zooming against 10ms at rest.
   * Labels follow their nodes during the gesture regardless, since they are
   * drawn from node positions; only their wrapping and selection wait, which
   * is the part a reader cannot read mid-gesture anyway.
   */
  const scheduleLabelRefresh = () => {
    if (labelBudgetFrame !== null) window.clearTimeout(labelBudgetFrame);
    labelBudgetFrame = window.setTimeout(() => {
      labelBudgetFrame = null;
      applyReducers();
    }, 120);
  };
  // Label size, wrap width and collision selection are all functions of the
  // camera, so every camera change has to recompute them. That is what makes
  // zooming in reveal titles that were suppressed, and zooming back out
  // suppress them again. Coalesced to one animation frame so a pinch or a
  // wheel spin does not re-wrap every label per event.
  renderer.getCamera().on("updated", scheduleLabelRefresh);

  const visibleIds = () => graph.nodes().filter((id) => !hidden.has(id));
  let filterSettleTimer: number | null = null;
  const cancelFilterSettle = () => {
    if (filterSettleTimer !== null) window.clearTimeout(filterSettleTimer);
    filterSettleTimer = null;
    ui.host.removeAttribute("data-filter-settle-pending");
  };

  const settleFilter = () => {
    cancelFilterSettle();
    ui.host.setAttribute("data-filter-settle-pending", "");
    filterSettleTimer = window.setTimeout(() => {
      filterSettleTimer = null;
      ui.host.removeAttribute("data-filter-settle-pending");
      if (state.focused) focusAfterMotion = fitFocus;
      requestSettle("filter", visibleIds());
    }, 180);
  };

  function refresh(settle = true): void {
    recomputeHidden();
    applyReducers();
    if (settle) settleFilter();
  }

  const responsiveState = () => ({
    width: ui.host.clientWidth,
    height: ui.host.clientHeight,
    policy: narrowGraphQuery.matches,
  });
  const applyResponsiveState = ({ width, height, policy }: ReturnType<typeof responsiveState>) => {
    incrementGraphCounter(ui.host, "responsiveUpdates");
    ui.host.dataset.responsiveDimensions = `${width}:${height}`;
    ui.host.dataset.responsivePolicy = policy ? "narrow" : "wide";
    renderer.resize();
    applyResponsiveLabelThreshold(policy);
    applyReducers();
  };
  const responsiveScheduler = new ResponsiveGraphScheduler(
    responsiveState(),
    (responsive) => {
      applyResponsiveState(responsive);
      if (state.focused) focusAfterMotion = fitFocus;
      requestSettle("resize", visibleIds());
    },
  );

  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__graphDebug = { renderer, graph, hidden };
  }

  const onFilterChange = () => {
    initialFocusOverride = false;
    refresh();
  };
  for (const box of [...ui.typeFilters, ...ui.statusFilters]) {
    box.addEventListener("change", onFilterChange);
  }
  ui.tagFilter.addEventListener("change", onFilterChange);

  const onRelatedBrainsToggle = () => {
    showRelatedBrains = !showRelatedBrains;
    relatedBrainsStatePending = Boolean(relatedBrainsStorageKey);
    motion.setSessionScope(motionScope());
    if (ui.relatedBrainsToggle) {
      const label = showRelatedBrains
        ? "Hide related brains"
        : "Show related brains";
      ui.relatedBrainsToggle.setAttribute("aria-pressed", String(showRelatedBrains));
      ui.relatedBrainsToggle.setAttribute("aria-label", label);
      ui.relatedBrainsToggle.title = label;
      ui.relatedBrainsToggle.querySelector<HTMLElement>("[data-control-label]")!.textContent = label;
    }
    refresh();
    renderSearchResults();
  };
  ui.relatedBrainsToggle?.addEventListener("click", onRelatedBrainsToggle);

  const syncLensControl = () => {
    const lens = ui.lens;
    if (!lens) return;
    for (const control of lens.checkboxes) control.checked = !dimmedBrains.has(control.value);
    const label = dimmedBrains.size === 0 ? "Brains" : `Brains: ${dimmedBrains.size} dimmed`;
    lens.summary.setAttribute("aria-label", label);
    lens.summary.title = label;
    lens.control.toggleAttribute("data-dimmed", dimmedBrains.size > 0);
  };
  const setLens = (dimmed: Iterable<string>) => {
    dimmedBrains = new Set(normalizeLens(dimmed, knownBrainIds));
    if (dimmedBrains.size === 0) lensStore.reset();
    else lensStore.write([...dimmedBrains]);
    syncLensControl();
    updateLensStats();
    updateDomains();
    applyReducers();
  };
  const onLensChange = () => {
    setLens((ui.lens?.checkboxes ?? []).filter((box) => !box.checked).map((box) => box.value));
  };
  const onLensReset = () => setLens([]);
  for (const control of ui.lens?.checkboxes ?? []) control.addEventListener("change", onLensChange);
  ui.lens?.reset.addEventListener("click", onLensReset);

  // A reader-owned display setting, like the Brain lens: remembered in the
  // reader's own browser per site base, and never in a URL.
  const ownerLabelsControl = ui.lens?.ownerLabels ?? null;
  const syncOwnerLabelsControl = () => {
    if (!ownerLabelsControl) return;
    ownerLabelsControl.checked = showOwnerLabels;
    ui.host.dataset.ownerLabels = String(showOwnerLabels);
  };
  const onOwnerLabelsChange = () => {
    showOwnerLabels = ownerLabelsControl!.checked;
    writeOwnerLabelPreference(showOwnerLabels);
    syncOwnerLabelsControl();
    applyReducers();
  };
  ownerLabelsControl?.addEventListener("change", onOwnerLabelsChange);
  syncOwnerLabelsControl();
  // A domain chip toggles its Brain in the same lens. The neighborhood keeps
  // every node because focus outranks the lens, and the URL never changes.
  const toggleDomain = (brainId: string) => {
    const next = new Set(dimmedBrains);
    if (next.has(brainId)) next.delete(brainId);
    else next.add(brainId);
    setLens(next);
  };
  const domainListeners = (ui.domains?.chips ?? []).map((chip) => {
    const listener = () => toggleDomain(chip.brainId);
    chip.toggle.addEventListener("click", listener);
    return () => chip.toggle.removeEventListener("click", listener);
  });
  syncLensControl();

  const onNarrowGraphChange = () => {
    const next = responsiveState();
    if (state.dragged) responsiveScheduler.defer(next);
    else responsiveScheduler.update(next);
  };
  narrowGraphQuery.addEventListener("change", onNarrowGraphChange);
  const onCompactFocusChange = () => {
    const restoreDisclosureFocus = compactFocusQuery.matches && ui.focusDetails.contains(document.activeElement);
    const restoreOpenFocus = !compactFocusQuery.matches && document.activeElement === ui.focusDisclosure;
    focusDetailsExpanded = false;
    syncFocusDetails();
    if (restoreDisclosureFocus) ui.focusDisclosure.focus({ preventScroll: true });
    else if (restoreOpenFocus) ui.focusOpen.focus({ preventScroll: true });
    if (state.focused) window.requestAnimationFrame(fitFocus);
  };
  compactFocusQuery.addEventListener("change", onCompactFocusChange);

  /* Search: dim non-matches, list matches, camera-focus on selection. */
  function renderSearchResults(): void {
    ui.searchResults.innerHTML = "";
    if (!query) return;
    const matches = data.nodes
      .filter((n) => !hidden.has(n.id) && n.title.toLowerCase().includes(query))
      .sort((a, b) => b.degree - a.degree)
      .slice(0, 8);
    for (const match of matches) {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      const title = document.createElement("span");
      title.textContent = match.title;
      button.append(title);
      if (data.mode === "workspace") {
        const owner = document.createElement("span");
        owner.className = "graph-search-owner";
        owner.textContent = `@${match.brainId}`;
        button.append(owner);
        button.setAttribute("aria-label", `${match.title}, ${match.brainTitle} brain @${match.brainId}`);
      }
      button.addEventListener("click", () => setFocus(match.id, true));
      li.appendChild(button);
      ui.searchResults.appendChild(li);
    }
  }

  ui.searchInput.addEventListener("input", () => {
    query = ui.searchInput.value.trim().toLowerCase();
    renderSearchResults();
    applyReducers();
  });

  const onFitView = () => {
    if (state.focused) {
      fitFocus();
      return;
    }
    cancelFilterSettle();
    motion.cancel();
    responsiveScheduler.defer(responsiveState());
    responsiveScheduler.flush(applyResponsiveState);
    incrementGraphCounter(ui.host, "fitRequests");
    motion.fitView(visibleIds());
  };
  ui.fitViewButton.addEventListener("click", onFitView);

  const stopCamera = () => stopCameraAnimation(renderer);
  const mouse = renderer.getMouseCaptor();
  const onWheel = (event: WheelCoords) => {
    if (!state.dragged) return;
    event.preventSigmaDefault();
    stopCamera();
  };
  mouse.on("wheel", onWheel);
  wireTheme(renderer, state);

  let menuNode: string | null = null;
  let copyResetTimer: number | null = null;
  const closeContextMenu = (restoreFocus = false) => {
    if (ui.contextMenu.hidden) return;
    ui.contextMenu.hidden = true;
    if (restoreFocus) ui.fitViewButton.focus({ preventScroll: true });
    menuNode = null;
    pointer.reapplyPointer();
  };
  const openContextMenu = (node: string | null, event: MouseEvent) => {
    document.dispatchEvent(new CustomEvent("graph-context-menu-open"));
    menuNode = node;
    // Opened on empty canvas there is no note to act on, so only the actions
    // that are about the graph itself remain.
    for (const item of [ui.contextFocus, ui.contextCopy, ui.contextOpen]) {
      item.hidden = node === null;
    }
    // The bar and the menu offer the same action under the same name. On a
    // neighborhood page it leads to the whole graph rather than clearing in
    // place, but it is still the one way out of a focused view.
    const clearable = Boolean(state.focused);
    ui.contextClear.hidden = !clearable;
    ui.contextDivider.hidden = node === null;
    const focusLabel = ui.contextFocus.querySelector("[data-graph-menu-label]") ?? ui.contextFocus;
    focusLabel.textContent = state.focused ? "Move focus here" : "Pin neighborhood";
    ui.contextMenu.hidden = false;
    ui.contextMenu.style.left = `${event.clientX}px`;
    ui.contextMenu.style.top = `${event.clientY}px`;
    const bounds = ui.contextMenu.getBoundingClientRect();
    const left = Math.max(8, Math.min(event.clientX, window.innerWidth - bounds.width - 8));
    const top = Math.max(8, Math.min(event.clientY, window.innerHeight - bounds.height - 8));
    ui.contextMenu.style.left = `${left}px`;
    ui.contextMenu.style.top = `${top}px`;
    (node === null ? (clearable ? ui.contextClear : ui.contextFit) : ui.contextFocus).focus();
  };
  const openNode = (node: string) => {
    const route = graph.getNodeAttribute(node, "route") as LogicalRoute;
    window.location.assign(noteHref(route));
  };
  const copyNeighborhoodLink = async (node: string, button: HTMLButtonElement) => {
    const previous = button.textContent ?? "Copy link";
    window.clearTimeout(copyResetTimer ?? undefined);
    try {
      await navigator.clipboard.writeText(nodeNeighborhoodHref(node));
      button.textContent = "Copied";
      button.setAttribute("aria-label", "Copied neighborhood link");
    } catch {
      button.textContent = "Copy failed";
      button.setAttribute("aria-label", "Copy neighborhood link failed");
    }
    copyResetTimer = window.setTimeout(() => {
      button.textContent = previous;
      button.removeAttribute("aria-label");
      copyResetTimer = null;
    }, 2000);
  };
  ui.contextFocus.addEventListener("click", () => {
    if (menuNode) setFocus(menuNode, true);
    closeContextMenu();
  });
  ui.contextCopy.addEventListener("click", () => {
    if (menuNode) {
      setFocus(menuNode);
      void copyNeighborhoodLink(menuNode, ui.focusCopy);
    }
    closeContextMenu();
  });
  ui.contextOpen.addEventListener("click", () => {
    if (menuNode) openNode(menuNode);
  });
  ui.contextClear.addEventListener("click", () => {
    setFocus(null);
    closeContextMenu();
  });
  ui.contextFit.addEventListener("click", () => {
    onFitView();
    closeContextMenu();
  });
  ui.focusCopy.addEventListener("click", () => {
    if (state.focused) void copyNeighborhoodLink(state.focused, ui.focusCopy);
  });
  // On a note-owned neighborhood page the pathname is the focus, so there is
  // nothing to clear in place: leaving focus means going to the whole graph.
  ui.focusClear.addEventListener("click", () => setFocus(null));
  const onFocusDisclosure = () => {
    focusDetailsExpanded = !focusDetailsExpanded;
    syncFocusDetails();
    window.requestAnimationFrame(fitFocus);
  };
  const setNeighborhoodDepth = (depth: number) => {
    if (!setInspectionDepth(graph, state, depth)) return;
    ui.host.dataset.neighborhoodDepth = String(state.depth);
    try {
      window.localStorage.setItem(depthKey, String(state.depth));
    } catch {
      // The choice still applies for this page.
    }
    recomputeHidden();
    updateFocusUI();
    applyReducers();
    if (state.focused) fitFocus();
  };
  const toggleHoverPreview = () => {
    hoverPreview.write(!hoverPreview.read());
    syncHoverPreviewToggle();
    // Whatever the pointer is over right now follows the new setting at once.
    pointer.reapplyPointer();
  };
  ui.hoverPreviewToggle?.addEventListener("click", toggleHoverPreview);
  const onGraphEscape = (event: KeyboardEvent) => {
    // D: hover preview on or off. F: pin the node under the pointer, move the
    // pin to it, or lift the pin when it is already the pinned note.
    if (isGraphKey(event, "d")) {
      event.preventDefault();
      toggleHoverPreview();
      return;
    }
    if (isGraphKey(event, "f")) {
      const node = ui.contextMenu.hidden ? pointer.nodeUnderPointer() : menuNode;
      if (!node) return;
      event.preventDefault();
      if (node === state.focused) setFocus(null);
      else setFocus(node, true);
      return;
    }
    // C clears the pin; Z fits the view, the focused neighborhood when there
    // is one and every visible note otherwise.
    if (isGraphKey(event, "c")) {
      if (!state.focused) return;
      event.preventDefault();
      setFocus(null);
      return;
    }
    if (isGraphKey(event, "z")) {
      event.preventDefault();
      onFitView();
      return;
    }
    // 1 to 5: how many links away the lit neighborhood reaches, for a hover
    // preview and for a pin alike. Pressed while pinned, the pin re-lights to
    // the new reach and the view refits to it.
    const digit = ["1", "2", "3", "4", "5"].find((key) => isGraphKey(event, key));
    if (digit) {
      event.preventDefault();
      setNeighborhoodDepth(Number(digit));
      return;
    }
    if (event.key !== "Escape") return;
    if (!ui.contextMenu.hidden) {
      event.stopImmediatePropagation();
      closeContextMenu(true);
      return;
    }
    if (!compactFocusQuery.matches || !focusDetailsExpanded) return;
    event.stopImmediatePropagation();
    focusDetailsExpanded = false;
    syncFocusDetails();
    ui.focusDisclosure.focus({ preventScroll: true });
    window.requestAnimationFrame(fitFocus);
  };
  ui.focusDisclosure.addEventListener("click", onFocusDisclosure);
  document.addEventListener("keydown", onGraphEscape);
  document.addEventListener("pointerdown", (event) => {
    if (!ui.contextMenu.hidden && event.target instanceof Node && !ui.contextMenu.contains(event.target)) {
      closeContextMenu();
    }
  });

  const resizeObserver = new ResizeObserver(() => {
    if (state.dragged) {
      responsiveScheduler.defer(responsiveState());
      return;
    }
    responsiveScheduler.update(responsiveState());
  });
  resizeObserver.observe(ui.host);
  const interruptAutomaticMotion = () => {
    cancelFilterSettle();
    motion.cancel();
    stopCamera();
    resolveCanceledRelatedBrainsState();
    responsiveScheduler.defer(responsiveState());
    if (!state.dragged) responsiveScheduler.flush();
  };
  const hoverPreview = createHoverPreviewPreference();
  const syncHoverPreviewToggle = () => {
    if (!ui.hoverPreviewToggle) return;
    const on = hoverPreview.read();
    ui.hoverPreviewToggle.setAttribute("aria-pressed", String(on));
    ui.host.dataset.hoverPreview = String(on);
  };
  syncHoverPreviewToggle();
  const pointer = wireHoverAndClick(renderer, graph, state, interruptAutomaticMotion, {
    holdInspection: () => !ui.contextMenu.hidden,
    hoverPreview: hoverPreview.read,
    onPointerNode: (node) => {
      // While a neighborhood is pinned, inspection is frozen on purpose so a
      // drifting pointer cannot disturb it. That was decided when every
      // neighbor carried a label; now that collision selection can omit some,
      // freezing inspection would also leave a reader unable to identify what
      // they are pointing at. The pointer reveals a title without touching the
      // pin's emphasis.
      if (pointerLabelNode === node) return;
      const previous = pointerLabelNode;
      pointerLabelNode = node;
      repaintPointerNodes(previous, node);
      if (state.focused) applyReducers();
      // Unpinned, a hover reveals its neighborhood's labels and blanks the
      // rest, and selection has to follow the hover both in and out. Without
      // this, leaving a node left its neighborhood's labels standing and every
      // other label hidden until the next camera move re-ran selection.
      else scheduleLabelRefresh();
    },
    onFocus: setFocus,
    onContextMenu: openContextMenu,
    onNavigate: (_node, route) => window.location.assign(noteHref(route)),
  });
  const commitDrag = (_node: string, _neighborhood: string[], moved: boolean) => {
    cancelFilterSettle();
    stopCamera();
    motion.cancel();
    const responsiveFlushed = responsiveScheduler.flush();
    if (moved && !responsiveFlushed) {
      relatedBrainsSessionInvalid = false;
      commitSession();
    }
  };
  wireNodeDragging(renderer, graph, state, commitDrag, interruptAutomaticMotion);

  const onVisibilityChange = () => {
    if (document.hidden) {
      cancelFilterSettle();
      motion.cancel();
      resolveCanceledRelatedBrainsState();
    } else if (relatedBrainsStatePending || relatedBrainsSessionInvalid) {
      if (state.focused) focusAfterMotion = fitFocus;
      requestSettle("filter", visibleIds());
    }
  };
  document.addEventListener("visibilitychange", onVisibilityChange);
  renderer.on("kill", () => {
    mouse.off("wheel", onWheel);
    if (sessionTimer !== null) window.clearTimeout(sessionTimer);
    cancelFilterSettle();
    resizeObserver.disconnect();
    responsiveScheduler.cancel();
    if (labelBudgetFrame !== null) window.clearTimeout(labelBudgetFrame);
    if (fadeFrame !== null) window.cancelAnimationFrame(fadeFrame);
    renderer.getCamera().off("updated", saveSession);
    renderer.getCamera().off("updated", scheduleLabelRefresh);
    window.removeEventListener("pagehide", flushSession);
    ui.fitViewButton.removeEventListener("click", onFitView);
    ui.focusDisclosure.removeEventListener("click", onFocusDisclosure);
    document.removeEventListener("keydown", onGraphEscape);
    ui.relatedBrainsToggle?.removeEventListener("click", onRelatedBrainsToggle);
    for (const control of ui.lens?.checkboxes ?? []) control.removeEventListener("change", onLensChange);
    ui.lens?.reset.removeEventListener("click", onLensReset);
    for (const remove of domainListeners) remove();
    narrowGraphQuery.removeEventListener("change", onNarrowGraphChange);
    compactFocusQuery.removeEventListener("change", onCompactFocusChange);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    motion.destroy();
  });

  if (state.focused && !focusAllowed(state.focused)) {
    setFocusedInspection(graph, state, null);
  }
  updateFocusUI();
  syncFocusUrl();
  refresh(false);
  if (state.focused) {
    // Arriving already focused: land on the neighborhood rather than flying to
    // it from a view the reader never asked for. The camera is fitted before
    // the first frame is painted, so the whole graph is never shown; the
    // layout then settles under a camera that is already where it will end.
    fitFocus(false);
    if (!restored.positions) {
      focusAfterMotion = () => fitFocus(false);
      requestSettle("initial", visibleIds(), undefined, focusIds());
    }
  } else if (!restored.positions) requestSettle("initial", visibleIds());
  else if (!restored.view) {
    fitRenderedGraph(renderer, visibleIds(), { includeLabels: !narrowGraphQuery.matches });
  }
}

/* ------------------------------------------------------------------------ */
/* Local graph                                                               */
/* ------------------------------------------------------------------------ */

export async function mountLocalGraphs(): Promise<void> {
  const hosts = document.querySelectorAll<HTMLElement>(".local-graph[data-slug]");
  if (hosts.length === 0) return;
  const data = await fetchGraphData();

  for (const host of hosts) {
    const slug = host.dataset.slug!;
    const local = deriveNoteNeighborhood(data, slug, 2);
    if (local.nodes.length <= 1) {
      host.style.display = "none"; // isolated note: nothing to show
      continue;
    }
    const root = local.nodes.find((node) => node.id === slug);
    const graph = buildGraph(
      local,
      root ? { mode: "brain", brainId: root.brainId } : { mode: "all" },
    );
    const theme = graphTheme();
    const renderer = new Sigma(graph, host, {
      ...baseSettings(theme, graph.order),
      labelRenderedSizeThreshold: 3,
    });
    const narrowGraphQuery = window.matchMedia("(max-width: 700px)");
    const localLabelLayouts = createGraphLabelLayouts(renderer);
    const localBaseLabelSize = renderer.getSetting("labelSize");
    let localSelectedLabels: Set<string> | null = null;
    /** The node under the pointer on the connection map; it wears the plate. */
    let localPointerNode: string | null = null;
    const applyResponsiveLabelThreshold = (narrow = narrowGraphQuery.matches) => {
      renderer.setSettings(responsiveLabelSettings(narrow, 3, 100));
    };
    applyResponsiveLabelThreshold();
    const fitButton = host
      .closest<HTMLElement>(".local-graph-panel")
      ?.querySelector<HTMLButtonElement>("[data-fit-local-graph]");
    const state: InteractionState = {
      hovered: null,
      focused: null,
      neighbors: new Set(),
      dragged: null,
      draggedMoved: false,
      theme,
    };
    const hoverReducers = createHoverReducers(graph, state);
    const scaleMarkerSize = (size: number) => renderer.scaleSize(size);
    let revealNarrowLabels = false;
    const applyLocalReducers = () => {
      const dimensions = renderer.getDimensions();
      const labelSize = renderedLabelSize(localBaseLabelSize, renderer.getCamera().getState().ratio);
      const centers = new Map<string, { x: number; y: number; radius: number }>();
      graph.forEachNode((node, attrs) => {
        const data = renderer.getNodeDisplayData(node);
        if (!data || data.hidden) return;
        const center = renderer.graphToViewport({ x: attrs.x as number, y: attrs.y as number });
        const radius = scaleMarkerSize(flooredNodeSize(attrs.size as number, scaleMarkerSize));
        centers.set(node, { ...center, radius });
      });
      const laidOut = new Map<string, { layout: GraphLabelLayout; box: GraphLabelBox }>();
      localSelectedLabels = null;
      renderer.setSettings({
        labelSize,
        nodeReducer: (node, attrs) => {
          const sized = { ...attrs, size: flooredNodeSize(attrs.size, scaleMarkerSize) };
          const brainAware = sized.foreign
            ? { ...sized, forceLabel: forceForeignLabel(true, narrowGraphQuery.matches) }
            : sized;
          const inspectedNeighborhood = isInspectionNeighborhoodNode(state, node);
          const labelAware = inspectedNeighborhood && brainAware.label
            ? { ...brainAware, forceLabel: true }
            : brainAware;
          const focused = node === state.focused && state.hovered === null
            ? { ...labelAware, focused: true, highlighted: true }
            : labelAware;
          const styled = hoverReducers.nodeReducer(
            node,
            state.focused && node !== state.focused
              ? { ...focused, suppressHover: true }
              : focused,
          ) as Record<string, unknown>;
          const underPointer = node === localPointerNode
            && !styled.dimmed && !styled.suppressHover && Boolean(styled.label);
          if (underPointer) styled.highlighted = true;

          const label = typeof styled.label === "string" ? styled.label : "";
          const center = centers.get(node);
          if (!label || !center) return styled as typeof attrs;
          const layout = localLabelLayouts.layout(
            label,
            localLabelLayouts.budget(center.x, dimensions.width),
            labelSize,
            Boolean(styled.foreign),
          );
          const box = graphLabelBox(layout, center, center.radius);
          if (!box) {
            return { ...styled, label: "", forceLabel: false } as typeof attrs;
          }
          laidOut.set(node, { layout, box });
          styled.fitLabelLayout = layout;
          if (localSelectedLabels && !localSelectedLabels.has(node) && !underPointer) {
            return { ...styled, label: "", forceLabel: false } as typeof attrs;
          }
          return {
            ...styled,
            forceLabel: true,
            labelLines: layout.lines,
            labelWidth: layout.width,
            labelHeight: layout.height,
            labelLineHeight: layout.lineHeight,
          } as typeof attrs;
        },
        edgeReducer: (edge, attrs) =>
          hoverReducers.edgeReducer(edge, {
            ...attrs,
            size: easedEdgeSize(attrs.size, (size) => renderer.scaleSize(size)),
          }),
      });

      // Same two passes as the global graph: lay every candidate out, then draw
      // the ones that survive collision selection.
      renderer.refresh({ partialGraph: {}, skipIndexation: true });
      const priority = (node: string) =>
        node === slug ? 0 : isInspectionNeighborhoodNode(state, node) ? 1 : 2;
      localSelectedLabels = selectGraphLabels(
        [...paintedLabels(renderer)].flatMap((node) => {
          const placed = laidOut.get(node);
          return placed
            ? [{
              node,
              box: placed.box,
              priority: priority(node),
              degree: graph.degree(node),
              required: node === state.focused || node === localPointerNode,
              exempt: graph.getNodeAttribute(node, "foreign") === true,
            }]
            : [];
        }),
        labelSize,
        [...centers].map(([node, center]) => ({ node, box: graphMarkerBox(center, center.radius) })),
      );
      renderer.refresh();
    };
    setGraphFitLabelRefresh(renderer, applyLocalReducers);
    applyLocalReducers();
    let labelInspection = activeInspectionNode(state);
    const updateRenderedLabelStats = () => {
      const displayed = paintedLabels(renderer);
      const rendered = activeInspectionNode(state)
        ? new Set([...displayed].filter((id) => isInspectionNeighborhoodNode(state, id)))
        : displayed;
      host.dataset.renderedLabels = String(rendered.size);
      host.dataset.renderedLabelIds = [...rendered].sort().join(",");
      host.dataset.renderedMarkers = String(graph.order);
      const inspected = activeInspectionNode(state);
      // Pointer leave and preview toggles change inspection without moving the
      // camera. Observe the updated state, not the earlier pointer callback.
      if (inspected !== labelInspection) {
        labelInspection = inspected;
        scheduleLocalLabelRefresh();
      }
      if (inspected) updateInspectionTargetStats(host, renderer, graph, inspected);
      else delete host.dataset.inspectionTargetGeometry;
      if (host.hasAttribute("data-geometry-check-pending")) {
        updateGeometryStats(host, renderer, graph);
        delete host.dataset.geometryCheckPending;
      }
    };
    renderer.on("afterRender", updateRenderedLabelStats);
    const camera = renderer.getCamera();
    let localLabelBudgetFrame: number | null = null;
    const scheduleLocalLabelRefresh = () => {
      if (localLabelBudgetFrame !== null) window.clearTimeout(localLabelBudgetFrame);
      localLabelBudgetFrame = window.setTimeout(() => {
        localLabelBudgetFrame = null;
        applyLocalReducers();
      }, 120);
    };
    camera.on("updated", scheduleLocalLabelRefresh);
    const labelReveal = wireLocalGraphLabelReveal(
      () => camera.getState().ratio,
      () => narrowGraphQuery.matches,
      (reveal) => {
        revealNarrowLabels = reveal;
        applyLocalReducers();
      },
      (listener) => {
        camera.on("updated", listener);
        return () => camera.off("updated", listener);
      },
    );
    let pendingMotion: "initial" | "resize" | "drag-resize" | "fit" | null = null;
    let pendingPinnedId = slug;
    let resizeDeferredDuringDrag = false;
    const motion = new GraphMotionController(
      renderer,
      graph,
      local,
      () => {
        pendingMotion = null;
        host.dataset.fittedRatio = String(labelReveal.recordFit());
        if (narrowGraphQuery.matches) applyLocalReducers();
        host.dataset.fitCompletions = String(Number(host.dataset.fitCompletions ?? 0) + 1);
      },
      `local:${slug}`,
      false,
      true,
      // Narrow fits reserve label space only for the focused note. Desktop
      // fits include every label selected at the fitted camera state.
      () => ({ includeLabels: !narrowGraphQuery.matches, labelIds: state.focused ? [state.focused] : [] }),
    );
    const fitView = () => {
      pendingMotion = "fit";
      incrementGraphCounter(host, "fitRequests");
      stopCameraAnimation(renderer);
      labelReveal.beginFit();
      motion.fitView(graph.nodes());
    };
    const settle = (trigger: "initial" | "resize") => {
      pendingMotion = trigger;
      incrementGraphCounter(host, "settleRequests");
      pendingPinnedId = slug;
      host.dataset.lastSettlePinnedId = slug;
      labelReveal.beginFit();
      motion.settle(trigger, graph.nodes(), slug);
    };
    const settleDraggedResize = (pinnedId: string) => {
      pendingMotion = "drag-resize";
      incrementGraphCounter(host, "settleRequests");
      pendingPinnedId = pinnedId;
      host.dataset.lastSettlePinnedId = pinnedId;
      labelReveal.beginFit();
      motion.settle("drag", graph.nodes(), pinnedId, undefined, true);
    };
    const responsiveState = () => ({
      width: host.clientWidth,
      height: host.clientHeight,
      policy: narrowGraphQuery.matches,
    });
    let deferredResizePinnedId: string | null = null;
    const applyResponsiveState = ({ width, height, policy }: ReturnType<typeof responsiveState>) => {
      incrementGraphCounter(host, "responsiveUpdates");
      host.dataset.responsiveDimensions = `${width}:${height}`;
      host.dataset.responsivePolicy = policy ? "narrow" : "wide";
      renderer.resize();
      applyResponsiveLabelThreshold(policy);
      applyLocalReducers();
      labelReveal.refresh();
    };
    const responsiveScheduler = new ResponsiveGraphScheduler(
      responsiveState(),
      (responsive) => {
        applyResponsiveState(responsive);
        if (deferredResizePinnedId) {
          const pinnedId = deferredResizePinnedId;
          deferredResizePinnedId = null;
          settleDraggedResize(pinnedId);
        } else {
          settle("resize");
        }
      },
    );
    const interruptAutomaticMotion = () => {
      pendingMotion = null;
      motion.cancel();
      labelReveal.finishFitPlanning();
      stopCameraAnimation(renderer);
      const responsiveDeferred = responsiveScheduler.defer(responsiveState());
      if (state.dragged) resizeDeferredDuringDrag ||= responsiveDeferred;
      else responsiveScheduler.flush();
    };
    const hoverPreview = createHoverPreviewPreference();
    host.dataset.hoverPreview = String(hoverPreview.read());
    const pointer = wireHoverAndClick(renderer, graph, state, interruptAutomaticMotion, {
      hoverPreview: hoverPreview.read,
      onPointerNode: (node) => {
        if (localPointerNode === node) return;
        const previous = localPointerNode;
        localPointerNode = node;
        const visible = [previous, node].filter((id): id is string =>
          id !== null && graph.hasNode(id) && !renderer.getNodeDisplayData(id)?.hidden
        );
        if (visible.length) renderer.refresh({ partialGraph: { nodes: visible }, skipIndexation: true });
      },
      onNavigate: (_node, route) => {
        const requestedFocus = singularQueryValue(new URLSearchParams(window.location.search), "focus");
        const focus = requestedFocus.valid && requestedFocus.present ? requestedFocus.value : null;
        const fallbackBrainId = host.dataset.activeBrainId;
        const graphContext: GraphContext = fallbackBrainId && data.mode === "workspace"
          ? { mode: "brain", brainId: fallbackBrainId, includeForeign: true }
          : { mode: "all" };
        const knownCompositeIds = deriveGraphData(data, graphContext).nodes.map(({ compositeId }) => compositeId);
        window.location.assign(
          joinBase(import.meta.env.BASE_URL, withGraphFocus(route, knownCompositeIds, focus)),
        );
      },
    });
    const onLocalKey = (event: KeyboardEvent) => {
      if (isGraphKey(event, "z")) {
        event.preventDefault();
        onFitView();
        return;
      }
      if (!isGraphKey(event, "d")) return;
      event.preventDefault();
      hoverPreview.write(!hoverPreview.read());
      host.dataset.hoverPreview = String(hoverPreview.read());
      pointer.reapplyPointer();
    };
    document.addEventListener("keydown", onLocalKey);
    renderer.on("kill", () => document.removeEventListener("keydown", onLocalKey));
    wireNodeDragging(renderer, graph, state, (node) => {
      if (!resizeDeferredDuringDrag) return;
      resizeDeferredDuringDrag = false;
      deferredResizePinnedId = node;
      if (!responsiveScheduler.flush()) deferredResizePinnedId = null;
    }, interruptAutomaticMotion);
    wireTheme(renderer, state);
    const onFitView = () => {
      if (
        responsiveScheduler.hasPending()
        || pendingMotion === "initial"
        || pendingMotion === "resize"
        || pendingMotion === "drag-resize"
      ) return;
      responsiveScheduler.reset(responsiveState());
      fitView();
    };
    const onNarrowGraphChange = () => {
      if (state.dragged) {
        resizeDeferredDuringDrag = true;
        responsiveScheduler.defer(responsiveState());
        return;
      }
      responsiveScheduler.update(responsiveState());
    };
    const resizeObserver = new ResizeObserver(() => {
      if (state.dragged) {
        resizeDeferredDuringDrag = true;
        responsiveScheduler.defer(responsiveState());
        return;
      }
      responsiveScheduler.update(responsiveState());
    });
    resizeObserver.observe(host);
    const interruptViewportMotion = () => {
      if (pendingMotion) {
        pendingMotion = null;
        motion.cancel();
        labelReveal.finishFitPlanning();
        stopCameraAnimation(renderer);
      }
      const responsiveDeferred = responsiveScheduler.defer(responsiveState());
      if (state.dragged) resizeDeferredDuringDrag ||= responsiveDeferred;
      else responsiveScheduler.flush(applyResponsiveState);
    };
    const mouse = renderer.getMouseCaptor();
    const touch = renderer.getTouchCaptor();
    mouse.on("mousedown", interruptViewportMotion);
    mouse.on("wheel", interruptViewportMotion);
    touch.on("touchdown", interruptViewportMotion);
    const onVisibilityChange = () => {
      if (document.hidden) {
        motion.cancel();
        labelReveal.finishFitPlanning();
      } else if (pendingMotion === "fit") {
        fitView();
      } else if (pendingMotion === "drag-resize") {
        settleDraggedResize(pendingPinnedId);
      } else if (pendingMotion) {
        settle(pendingMotion);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    fitButton?.addEventListener("click", onFitView);
    narrowGraphQuery.addEventListener("change", onNarrowGraphChange);
    renderer.on("kill", () => {
      fitButton?.removeEventListener("click", onFitView);
      narrowGraphQuery.removeEventListener("change", onNarrowGraphChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      mouse.off("mousedown", interruptViewportMotion);
      mouse.off("wheel", interruptViewportMotion);
      touch.off("touchdown", interruptViewportMotion);
      resizeObserver.disconnect();
      responsiveScheduler.cancel();
      if (localLabelBudgetFrame !== null) window.clearTimeout(localLabelBudgetFrame);
      camera.off("updated", scheduleLocalLabelRefresh);
      motion.destroy();
      labelReveal.destroy();
      renderer.off("afterRender", updateRenderedLabelStats);
    });
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__localGraphDebug = { renderer, graph };
    }
    settle("initial");
  }
}
