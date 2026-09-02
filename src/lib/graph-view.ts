import Graph from "graphology";
import Sigma from "sigma";
import { drawDiscNodeLabel } from "sigma/rendering";
import type { MouseCoords, TouchCoords, WheelCoords } from "sigma/types";
import { BRAIN_MARK_PATH } from "./brain-mark";
import {
  activeInspectionNode,
  createLongPressController,
  createHoverReducers,
  graphScreenTargets,
  GRAPH_DRAG_TOLERANCE,
  hitGraphScreenTarget,
  isInspectionNeighborhoodNode,
  permitsNodeDrag,
  resolveFocusedVisibility,
  setFocusedInspection,
  setTransientInspection,
  stopCameraAnimation,
  type GraphHoverState,
} from "./graph-interaction";
import { fitRenderedGraph } from "./graph-fit";
import { wireLocalGraphLabelReveal } from "./graph-local-labels";
import { GraphMotionController } from "./graph-motion";
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
  forceForeignLabel,
  forceLabelsOnNarrowZoom,
  foreignLabelMarkWidth,
  graphEdgeAttributes,
  graphHoverSurface,
  graphNodeAttributes,
  responsiveLabelSettings,
} from "./graph-style";
import {
  brainSelectionContext,
  joinBase,
  routes,
  singularQueryValue,
  withGraphContext,
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

const drawGraphNodeLabel: typeof drawDiscNodeLabel = (context, data, settings) => {
  const graphData = data as NodeLabelData;
  if (!graphData.foreign || !data.label) {
    drawDiscNodeLabel(context, data, settings);
    return;
  }

  const parts = /^([○◇◆]\s+)(.*)$/u.exec(data.label);
  if (!parts) {
    drawDiscNodeLabel(context, data, settings);
    return;
  }

  const color = nodeLabelColor(graphData, settings);
  const labelX = data.x + data.size + 3;
  const baseline = data.y + settings.labelSize / 3;
  context.fillStyle = color;
  context.font = `${settings.labelWeight} ${settings.labelSize}px ${settings.labelFont}`;
  context.fillText(parts[1], labelX, baseline);

  const prefixWidth = context.measureText(parts[1]).width;
  const markSize = settings.labelSize + 1;
  const markX = labelX + prefixWidth;
  drawBrainMark(
    context,
    markX,
    data.y - markSize / 2,
    markSize,
    graphData.labelColor ?? graphData.brainAccent ?? color,
  );
  context.fillStyle = color;
  context.fillText(parts[2], markX + markSize + 3, baseline);
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
  const padding = 2;
  const textWidth = typeof data.label === "string"
    ? context.measureText(data.label).width + (graphData.foreign ? settings.labelSize + 4 : 0)
    : 0;
  const boxWidth = Math.round(textWidth + 5);
  const boxHeight = Math.round(settings.labelSize + 2 * padding);
  const radius = Math.max(data.size, settings.labelSize / 2) + padding;
  context.beginPath();
  if (typeof data.label === "string") {
    const angle = Math.asin(Math.min(1, boxHeight / 2 / radius));
    const xOffset = Math.sqrt(Math.abs(radius ** 2 - (boxHeight / 2) ** 2));
    context.moveTo(data.x + xOffset, data.y + boxHeight / 2);
    context.lineTo(data.x + radius + boxWidth, data.y + boxHeight / 2);
    context.lineTo(data.x + radius + boxWidth, data.y - boxHeight / 2);
    context.lineTo(data.x + xOffset, data.y - boxHeight / 2);
    context.arc(data.x, data.y, radius, angle, -angle);
  } else {
    context.arc(data.x, data.y, data.size + padding, 0, Math.PI * 2);
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
        edge: "#716b7c",
        fadedEdge: "#e7e4ea",
        fadedLabel: "#aaa4b0",
        fadedNode: "#e1dde5",
        label: "#5f5a68",
      }
    : {
        edge: "#575360",
        fadedEdge: "#211f25",
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
  host.dataset.cameraGeometry = [camera.x, camera.y, camera.angle, camera.ratio].join(":");
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
  const label = graph.getNodeAttribute(node, "label") as string | undefined;
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
    labelRendered: true,
    labelWidth: labelContext && label ? labelContext.measureText(label).width : undefined,
    foreignMarkWidth: (data as NodeLabelData).foreign
      ? foreignLabelMarkWidth(settings.labelSize)
      : undefined,
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
    labelSize: 13,
    labelWeight: "500",
    labelFont: "ui-sans-serif, system-ui, sans-serif",
    labelColor: { color: theme.label, attribute: "labelColor" },
    labelRenderedSizeThreshold: largeGraph ? 14 : 4,
    labelDensity: largeGraph ? 0.08 : 1,
    labelGridCellSize: largeGraph ? 180 : 100,
    defaultDrawNodeLabel: drawGraphNodeLabel,
    defaultDrawNodeHover: drawGraphNodeHover,
    defaultEdgeColor: theme.edge,
    minCameraRatio: 0.05,
    maxCameraRatio: 10,
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
  const activeNode = activeInspectionNode(state);
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
    const inspectedLabel = isInspectionNeighborhoodNode(state, node);
    const label = graph.getNodeAttribute(node, "label") as string | undefined;
    nodes.push({
      node,
      x: center.x,
      y: center.y,
      radius: visualRadius,
      label,
      labelRendered: inspectedLabel || (!activeNode && displayedLabels.has(node)),
      labelWidth: labelContext && label
        ? labelContext.measureText(label).width
        : undefined,
      foreignMarkWidth: (data as NodeLabelData).foreign
        ? foreignLabelMarkWidth(settings.labelSize)
        : undefined,
    });
  });
  return hitGraphScreenTarget(graphScreenTargets(nodes, renderer.getDimensions()), point);
}

function wireHoverAndClick(
  renderer: Sigma,
  graph: Graph,
  state: InteractionState,
  onInteraction?: () => void,
  options: {
    onFocus?: (node: string | null, fit?: boolean) => void;
    onContextMenu?: (node: string, event: MouseEvent) => void;
    onNavigate?: (node: string, route: LogicalRoute) => void;
  } = {},
): void {
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
  const cancelMultiTouch = (event: TouchEvent) => {
    if (event.touches.length <= 1) return;
    longPress.release();
    emptyStageTouch = null;
  };
  const container = renderer.getContainer();
  const setPointerTarget = (node: string | null) => {
    const startingInspection = node !== null && activeInspectionNode(state) === null;
    container.style.cursor = node ? "pointer" : "";
    if (!setTransientInspection(graph, state, node)) return;
    if (node) {
      if (startingInspection) onInteraction?.();
      container.dataset.transientInspection = node;
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
  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType === "touch" || state.dragged !== null) return;
    const bounds = container.getBoundingClientRect();
    const node = graphTargetNode(renderer, graph, state, {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    });
    setPointerTarget(node && canNavigateToNode(node) ? node : null);
  };
  const onPointerLeave = (event: PointerEvent) => {
    if (event.pointerType !== "touch") setPointerTarget(null);
  };
  container.addEventListener("pointermove", onPointerMove);
  container.addEventListener("pointerleave", onPointerLeave);
  const onContextMenu = (event: MouseEvent) => {
    if (!options.onContextMenu) return;
    const bounds = container.getBoundingClientRect();
    const node = graphTargetNode(renderer, graph, state, {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    });
    if (!node) return;
    event.preventDefault();
    options.onContextMenu(node, event);
  };
  container.addEventListener("contextmenu", onContextMenu);
  container.addEventListener("touchstart", cancelMultiTouch, { passive: true });
  container.addEventListener("touchmove", cancelMultiTouch, { passive: true });
  renderer.on("downNode", ({ node, event }) => {
    emptyStageTouch = null;
    if (event.original.type.startsWith("touch")) longPress.start(node, event);
  });
  renderer.on("downStage", ({ event }) => {
    if (!event.original.type.startsWith("touch")) return;
    const node = graphTargetNode(renderer, graph, state, event);
    if (node) longPress.start(node, event);
    else {
      longPress.consumeActivatedPress();
      emptyStageTouch = { x: event.x, y: event.y };
    }
  });
  renderer.on("clickNode", ({ node }) => {
    if (longPress.consumeActivatedPress()) return;
    if (state.draggedMoved) {
      state.draggedMoved = false;
      return;
    }
    navigateToNode(node);
  });
  renderer.on("clickStage", ({ event }) => {
    const touchEvent = event.original.type.startsWith("touch");
    if (longPress.consumeActivatedPress()) return;
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
    if (emptyStageTouch && state.focused) {
      focus(null);
    }
    emptyStageTouch = null;
  };
  touch.on("touchmove", moveLongPress);
  touch.on("touchup", releaseLongPress);
  renderer.on("kill", () => {
    touch.off("touchmove", moveLongPress);
    touch.off("touchup", releaseLongPress);
    container.removeEventListener("touchstart", cancelMultiTouch);
    container.removeEventListener("touchmove", cancelMultiTouch);
    container.removeEventListener("pointermove", onPointerMove);
    container.removeEventListener("pointerleave", onPointerLeave);
    container.removeEventListener("contextmenu", onContextMenu);
    setTransientInspection(graph, state, null);
    longPress.destroy();
  });
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
  focusStatus: HTMLElement;
  focusTitle: HTMLElement;
  focusCopy: HTMLButtonElement;
  focusOpen: HTMLAnchorElement;
  focusClear: HTMLButtonElement;
  contextMenu: HTMLElement;
  contextFocus: HTMLButtonElement;
  contextCopy: HTMLButtonElement;
  contextOpen: HTMLButtonElement;
}

export async function mountGlobalGraph(ui: GlobalGraphUI): Promise<void> {
  const data = await fetchGraphData();
  const activeBrainId = ui.host.dataset.activeBrainId;
  const combined = ui.host.dataset.graphMode === "combined";
  const relatedBrainsStorageKey = activeBrainId && ui.relatedBrainsToggle
    ? `graph-related-brains:${window.location.pathname}`
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
  const initialQuery = singularQueryValue(new URLSearchParams(window.location.search), "brains");
  const initialSelection = brainSelectionContext(
    data.brains,
    initialQuery.valid && initialQuery.present ? initialQuery.value : "",
  );
  let selectedBrainIds = combined && initialSelection.valid ? [...initialSelection.brainIds] : [];
  const motionScope = () => {
    if (activeBrainId) return `brain:${activeBrainId}:${showRelatedBrains}`;
    if (combined) return `combined:${[...selectedBrainIds].sort().join(",")}`;
    return "all";
  };
  const visualContext: GraphContext = activeBrainId
    ? { mode: "brain", brainId: activeBrainId }
    : combined
      ? { mode: "combined", brainIds: selectedBrainIds }
      : { mode: "all" };
  const graph = buildGraph(data, visualContext);
  const nodeByCompositeId = new Map(data.nodes.map((node) => [node.compositeId, node.id]));
  const compositeIds = [...nodeByCompositeId.keys()];
  const theme = graphTheme();
  const renderer = new Sigma(graph, ui.host, baseSettings(theme, graph.order));
  const narrowGraphQuery = window.matchMedia("(max-width: 700px)");
  const desktopLabelThreshold = graph.order > 500 ? 14 : 4;
  const desktopLabelGridCellSize = graph.order > 500 ? 180 : 100;
  const labelContext = document.createElement("canvas").getContext("2d")!;
  labelContext.font = "500 13px ui-sans-serif, system-ui, sans-serif";
  const labelWidths = new Map<string, number>();
  const labelFitsNarrowViewport = (attrs: Record<string, unknown>) => {
    const label = typeof attrs.label === "string" ? attrs.label : "";
    let width = labelWidths.get(label);
    if (width === undefined) {
      width = labelContext.measureText(label).width;
      labelWidths.set(label, width);
    }
    if (attrs.foreign) width += foreignLabelMarkWidth(13);
    const viewportWidth = renderer.getDimensions().width;
    const maximumWidth = attrs.foreign
      ? Math.max(160, viewportWidth - 96)
      : Math.max(160, Math.min(220, viewportWidth - 160));
    return width <= maximumWidth;
  };
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
    focusAfterMotion?.();
    focusAfterMotion = null;
  }, motionScope());
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
  const state: InteractionState = {
    hovered: null,
    focused: null,
    neighbors: new Set(),
    dragged: null,
    draggedMoved: false,
    theme,
  };
  const requestedFocus = new URLSearchParams(window.location.search).get("focus");
  setFocusedInspection(
    graph,
    state,
    requestedFocus ? nodeByCompositeId.get(requestedFocus) ?? null : null,
  );
  let initialFocusOverride = state.focused !== null;
  const hoverReducers = createHoverReducers(graph, state);
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
    if (combined) return { mode: "combined", brainIds: selectedBrainIds };
    return { mode: "all" };
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

  const focusedRoute = (): LogicalRoute => {
    const graphContext = brainSelectionContext(
      data.brains,
      combined ? selectedBrainIds : activeBrainId ? [activeBrainId] : [],
    );
    const current = graphContext.valid ? graphContext.graph : routes.home;
    const compositeId = state.focused
      ? graph.getNodeAttribute(state.focused, "compositeId") as string
      : null;
    return withGraphFocus(current, compositeIds, compositeId);
  };

  const syncFocusUrl = () => {
    const href = joinBase(import.meta.env.BASE_URL, focusedRoute());
    if (`${window.location.pathname}${window.location.search}` !== href) {
      window.history.replaceState(null, "", href);
    }
  };

  const selectedScope = (): readonly string[] => {
    if (combined) return selectedBrainIds;
    if (activeBrainId) return [activeBrainId];
    return [];
  };

  const noteHref = (route: LogicalRoute): string => {
    const scope = selectedScope();
    const focus = state.focused
      ? graph.getNodeAttribute(state.focused, "compositeId") as string
      : null;
    const scoped = scope.length > 0 || focus
      ? withGraphContext(data.brains, compositeIds, route, scope, focus)
      : null;
    return joinBase(import.meta.env.BASE_URL, scoped?.valid ? scoped.route : route);
  };

  const focusIds = () => state.focused
    ? [state.focused, ...graph.neighbors(state.focused).filter((id) => !hidden.has(id))]
    : [];

  const updateFocusUI = () => {
    const node = state.focused;
    ui.host.toggleAttribute("data-focused-inspection", node !== null);
    if (!node) {
      ui.focusStatus.hidden = true;
      delete ui.host.dataset.focusedNode;
      return;
    }
    const title = data.nodes.find(({ id }) => id === node)?.title ?? node;
    const route = graph.getNodeAttribute(node, "route") as LogicalRoute;
    ui.host.dataset.focusedNode = node;
    ui.focusStatus.hidden = false;
    ui.focusTitle.textContent = title;
    ui.focusOpen.href = noteHref(route);
  };

  const fitFocus = () => {
    const ids = focusIds();
    if (ids.length === 0) return;
    cancelFilterSettle();
    motion.cancel();
    responsiveScheduler.defer(responsiveState());
    responsiveScheduler.flush(applyResponsiveState);
    incrementGraphCounter(ui.host, "fitRequests");
    motion.fitView(ids);
  };

  const setFocus = (node: string | null, fit = false) => {
    const next = node && focusAllowed(node) ? node : null;
    initialFocusOverride = false;
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
      state.focused ? graph.neighbors(state.focused).filter((id) => contextNodes.has(id)) : [],
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
  }

  let revealNarrowLabels = forceLabelsOnNarrowZoom(
    narrowGraphQuery.matches,
    renderer.getCamera().getState().ratio,
  );
  function applyReducers(): void {
    renderer.setSetting("nodeReducer", (node, attrs) => {
      const activeNode = activeInspectionNode(state);
      const res = { ...attrs } as Record<string, unknown>;
      if (hidden.has(node)) {
        res.hidden = true;
        return res as typeof attrs;
      }
      if (attrs.foreign) {
        res.forceLabel = forceForeignLabel(true, narrowGraphQuery.matches);
      }
      const label = (attrs.label as string).toLowerCase();
      if (
        narrowGraphQuery.matches &&
        !revealNarrowLabels &&
        node !== activeNode &&
        !state.neighbors.has(node) &&
        !labelFitsNarrowViewport(attrs as Record<string, unknown>)
      ) {
        res.label = "";
        res.forceLabel = false;
      }
      const inspectedNeighborhood = isInspectionNeighborhoodNode(state, node);
      if ((revealNarrowLabels || inspectedNeighborhood) && res.label) res.forceLabel = true;
      if (node === state.focused && state.hovered === null) {
        res.focused = true;
        res.highlighted = true;
      }
      if (state.focused && node !== state.focused) res.suppressHover = true;
      if (activeNode) {
        return hoverReducers.nodeReducer(node, res as typeof attrs);
      } else if (query && !label.includes(query)) {
        res.color = state.theme.fadedNode;
        res.label = "";
      }
      return res as typeof attrs;
    });
    renderer.setSetting("edgeReducer", (edge, attrs) => {
      const activeNode = activeInspectionNode(state);
      const res = { ...attrs } as Record<string, unknown>;
      const source = graph.source(edge);
      const target = graph.target(edge);
      if (!contextEdges.has(edgeKey(source, target)) || hidden.has(source) || hidden.has(target)) {
        res.hidden = true;
      }
      else if (activeNode) return hoverReducers.edgeReducer(edge, attrs);
      return res as typeof attrs;
    });
    renderer.refresh();
  }

  const updateRenderedLabelStats = () => {
    const displayed = renderer.getNodeDisplayedLabels();
    const rendered = activeInspectionNode(state)
      ? new Set([...displayed].filter((id) => isInspectionNeighborhoodNode(state, id)))
      : displayed;
    ui.host.dataset.renderedLabels = String(rendered.size);
    ui.host.dataset.renderedLabelIds = [...rendered].sort().join(",");
    ui.host.dataset.renderedForeignLabels = String(
      [...displayed].filter((id) => graph.getNodeAttribute(id, "foreign") === true && !hidden.has(id)).length,
    );
    ui.host.dataset.renderedMarkers = String(graph.order - hidden.size);
    const inspected = activeInspectionNode(state);
    if (inspected) updateInspectionTargetStats(ui.host, renderer, graph, inspected);
    else delete ui.host.dataset.inspectionTargetGeometry;
    if (ui.host.hasAttribute("data-geometry-check-pending")) {
      updateGeometryStats(ui.host, renderer, graph);
      delete ui.host.dataset.geometryCheckPending;
    }
  };
  renderer.on("afterRender", updateRenderedLabelStats);
  const onCameraLabelReveal = () => {
    const reveal = forceLabelsOnNarrowZoom(
      narrowGraphQuery.matches,
      renderer.getCamera().getState().ratio,
    );
    if (reveal === revealNarrowLabels) return;
    revealNarrowLabels = reveal;
    applyReducers();
  };
  renderer.getCamera().on("updated", onCameraLabelReveal);

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
    revealNarrowLabels = forceLabelsOnNarrowZoom(
      policy,
      renderer.getCamera().getState().ratio,
    );
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

  for (const box of [...ui.typeFilters, ...ui.statusFilters]) {
    box.addEventListener("change", () => refresh());
  }
  ui.tagFilter.addEventListener("change", () => refresh());

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
  const onNarrowGraphChange = () => {
    const next = responsiveState();
    if (state.dragged) responsiveScheduler.defer(next);
    else responsiveScheduler.update(next);
  };
  narrowGraphQuery.addEventListener("change", onNarrowGraphChange);

  if (combined) {
    document.addEventListener("brain-selection-change", (event) => {
      const selection = (event as CustomEvent<{ brainIds: readonly string[] }>).detail;
      selectedBrainIds = [...selection.brainIds];
      motion.setSessionScope(motionScope());
      refresh();
      updateFocusUI();
      syncFocusUrl();
      renderSearchResults();
    });
  }

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
  };
  const openContextMenu = (node: string, event: MouseEvent) => {
    menuNode = node;
    ui.contextFocus.textContent = state.focused ? "Move focus here" : "Pin neighborhood";
    ui.contextMenu.hidden = false;
    ui.contextMenu.style.left = `${event.clientX}px`;
    ui.contextMenu.style.top = `${event.clientY}px`;
    const bounds = ui.contextMenu.getBoundingClientRect();
    const left = Math.max(8, Math.min(event.clientX, window.innerWidth - bounds.width - 8));
    const top = Math.max(8, Math.min(event.clientY, window.innerHeight - bounds.height - 8));
    ui.contextMenu.style.left = `${left}px`;
    ui.contextMenu.style.top = `${top}px`;
    ui.contextFocus.focus();
  };
  const openNode = (node: string) => {
    const route = graph.getNodeAttribute(node, "route") as LogicalRoute;
    window.location.assign(noteHref(route));
  };
  const copyFocusedLink = async (button: HTMLButtonElement) => {
    if (!state.focused) return;
    const previous = button.textContent ?? "Copy link";
    window.clearTimeout(copyResetTimer ?? undefined);
    try {
      await navigator.clipboard.writeText(new URL(joinBase(import.meta.env.BASE_URL, focusedRoute()), window.location.origin).href);
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
    if (menuNode) setFocus(menuNode);
    void copyFocusedLink(ui.focusCopy);
    closeContextMenu();
  });
  ui.contextOpen.addEventListener("click", () => {
    if (menuNode) openNode(menuNode);
  });
  ui.focusCopy.addEventListener("click", () => void copyFocusedLink(ui.focusCopy));
  ui.focusClear.addEventListener("click", () => setFocus(null));
  document.addEventListener("pointerdown", (event) => {
    if (!ui.contextMenu.hidden && event.target instanceof Node && !ui.contextMenu.contains(event.target)) {
      closeContextMenu();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !ui.contextMenu.hidden) {
      event.stopImmediatePropagation();
      closeContextMenu(true);
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
  wireHoverAndClick(renderer, graph, state, interruptAutomaticMotion, {
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
    renderer.getCamera().off("updated", saveSession);
    renderer.getCamera().off("updated", onCameraLabelReveal);
    window.removeEventListener("pagehide", flushSession);
    ui.fitViewButton.removeEventListener("click", onFitView);
    ui.relatedBrainsToggle?.removeEventListener("click", onRelatedBrainsToggle);
    narrowGraphQuery.removeEventListener("change", onNarrowGraphChange);
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
    if (!restored.positions) {
      focusAfterMotion = fitFocus;
      requestSettle("initial", visibleIds());
    } else {
      window.requestAnimationFrame(fitFocus);
    }
  } else if (!restored.positions) requestSettle("initial", visibleIds());
  else if (!restored.view) fitRenderedGraph(renderer, visibleIds());
  initialFocusOverride = false;
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
    let revealNarrowLabels = false;
    const applyLocalReducers = () => {
      renderer.setSettings({
        nodeReducer: (node, attrs) => {
          const brainAware = attrs.foreign
            ? { ...attrs, forceLabel: forceForeignLabel(true, narrowGraphQuery.matches) }
            : attrs;
          const inspectedNeighborhood = isInspectionNeighborhoodNode(state, node);
          const labelAware = (revealNarrowLabels || inspectedNeighborhood) && brainAware.label
            ? { ...brainAware, forceLabel: true }
            : brainAware;
          const focused = node === state.focused && state.hovered === null
            ? { ...labelAware, focused: true, highlighted: true }
            : labelAware;
          return hoverReducers.nodeReducer(
            node,
            state.focused && node !== state.focused
              ? { ...focused, suppressHover: true }
              : focused,
          );
        },
        edgeReducer: hoverReducers.edgeReducer,
      });
    };
    applyLocalReducers();
    const updateRenderedLabelStats = () => {
      const displayed = renderer.getNodeDisplayedLabels();
      const rendered = activeInspectionNode(state)
        ? new Set([...displayed].filter((id) => isInspectionNeighborhoodNode(state, id)))
        : displayed;
      host.dataset.renderedLabels = String(rendered.size);
      host.dataset.renderedLabelIds = [...rendered].sort().join(",");
      host.dataset.renderedMarkers = String(graph.order);
      const inspected = activeInspectionNode(state);
      if (inspected) updateInspectionTargetStats(host, renderer, graph, inspected);
      else delete host.dataset.inspectionTargetGeometry;
      if (host.hasAttribute("data-geometry-check-pending")) {
        updateGeometryStats(host, renderer, graph);
        delete host.dataset.geometryCheckPending;
      }
    };
    renderer.on("afterRender", updateRenderedLabelStats);
    const camera = renderer.getCamera();
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
        host.dataset.fitCompletions = String(Number(host.dataset.fitCompletions ?? 0) + 1);
      },
      `local:${slug}`,
      false,
      true,
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
    wireHoverAndClick(renderer, graph, state, interruptAutomaticMotion, {
      onNavigate: (_node, route) => {
        const parameters = new URLSearchParams(window.location.search);
        const requested = singularQueryValue(parameters, "brains");
        const requestedFocus = singularQueryValue(parameters, "focus");
        const retained = requested.valid && requested.present
          ? brainSelectionContext(data.brains, requested.value)
          : null;
        const fallbackBrainId = host.dataset.activeBrainId;
        const scope = retained?.valid && retained.brainIds.length > 0
          ? retained.brainIds
          : fallbackBrainId && data.mode === "workspace" ? [fallbackBrainId] : [];
        const focus = requestedFocus.valid && requestedFocus.present ? requestedFocus.value : null;
        const scoped = scope.length > 0 || focus
          ? withGraphContext(data.brains, data.nodes.map(({ compositeId }) => compositeId), route, scope, focus)
          : null;
        window.location.assign(joinBase(import.meta.env.BASE_URL, scoped?.valid ? scoped.route : route));
      },
    });
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
