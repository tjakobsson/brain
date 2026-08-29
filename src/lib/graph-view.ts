import Graph from "graphology";
import Sigma from "sigma";
import { drawDiscNodeHover, drawDiscNodeLabel } from "sigma/rendering";
import type { MouseCoords, TouchCoords, WheelCoords } from "sigma/types";
import { BRAIN_MARK_PATH } from "./brain-mark";
import {
  createHoverReducers,
  stopCameraAnimation,
  wireGraphHover,
  type GraphHoverState,
} from "./graph-interaction";
import { fitRenderedGraph } from "./graph-fit";
import { GraphMotionController } from "./graph-motion";
import { ResizeSettler } from "./graph-motion-core";
import {
  deriveGraphData,
  deriveNoteNeighborhood,
  normalizeGraphData,
  type GraphContext,
  type GraphData,
} from "./graph-data";
import { graphEdgeAttributes, graphNodeAttributes } from "./graph-style";
import { combinedRoutes, joinBase, routes, routesFor, type LogicalRoute } from "./routes";

/**
 * Browser-side graph rendering shared by the global graph page and the
 * per-note local graph island. One graphology data model, one sigma renderer,
 * one visual language.
 */

interface GraphTheme {
  edge: string;
  fadedEdge: string;
  fadedNode: string;
  label: string;
}

type NodeLabelData = Parameters<typeof drawDiscNodeLabel>[1] & {
  brainAccent?: string;
  foreign?: boolean;
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
    graphData.brainAccent ?? color,
  );
  context.fillStyle = color;
  context.fillText(parts[2], markX + markSize + 3, baseline);
};

const drawGraphNodeHover: typeof drawDiscNodeHover = (context, data, settings) => {
  const graphData = data as NodeLabelData;
  if (!graphData.foreign || typeof data.label !== "string") {
    drawDiscNodeHover(context, data, settings);
    return;
  }

  context.font = `${settings.labelWeight} ${settings.labelSize}px ${settings.labelFont}`;
  context.fillStyle = "#FFF";
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 0;
  context.shadowBlur = 8;
  context.shadowColor = "#000";
  const padding = 2;
  const textWidth = context.measureText(data.label).width + settings.labelSize + 4;
  const boxWidth = Math.round(textWidth + 5);
  const boxHeight = Math.round(settings.labelSize + 2 * padding);
  const radius = Math.max(data.size, settings.labelSize / 2) + padding;
  const angle = Math.asin(Math.min(1, boxHeight / 2 / radius));
  const xOffset = Math.sqrt(Math.abs(radius ** 2 - (boxHeight / 2) ** 2));
  context.beginPath();
  context.moveTo(data.x + xOffset, data.y + boxHeight / 2);
  context.lineTo(data.x + radius + boxWidth, data.y + boxHeight / 2);
  context.lineTo(data.x + radius + boxWidth, data.y - boxHeight / 2);
  context.lineTo(data.x + xOffset, data.y - boxHeight / 2);
  context.arc(data.x, data.y, radius, angle, -angle);
  context.closePath();
  context.fill();
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 0;
  context.shadowBlur = 0;
  drawGraphNodeLabel(context, data, settings);
};

function graphTheme(): GraphTheme {
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? {
        edge: "#716b7c",
        fadedEdge: "#d4d0d8",
        fadedNode: "#d4d0d8",
        label: "#5f5a68",
      }
    : {
        edge: "#575360",
        fadedEdge: "#29272e",
        fadedNode: "#302d36",
        label: "#a5a1ae",
      };
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
    labelColor: { color: theme.label },
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

function touchTargetNode(renderer: Sigma, graph: Graph, point: { x: number; y: number }): string | null {
  const settings = renderer.getSettings();
  const displayedLabels = renderer.getNodeDisplayedLabels();
  const labelContext = renderer.getCanvases().labels?.getContext("2d");
  if (labelContext) {
    labelContext.font = `${settings.labelWeight} ${settings.labelSize}px ${settings.labelFont}`;
  }

  let closestLabel: { node: string; distance: number } | null = null;
  let closestNode: { node: string; distance: number } | null = null;
  graph.forEachNode((node) => {
    const data = renderer.getNodeDisplayData(node);
    if (!data || data.hidden) return;
    const center = renderer.framedGraphToViewport(data);
    const visualRadius = renderer.scaleSize(data.size);
    const distance = Math.hypot(point.x - center.x, point.y - center.y);

    if (distance <= Math.max(visualRadius, 22) && (!closestNode || distance < closestNode.distance)) {
      closestNode = { node, distance };
    }

    if (!labelContext || !data.label || !displayedLabels.has(node)) return;
    const labelLeft = center.x + visualRadius + 3;
    const labelWidth = labelContext.measureText(data.label).width +
      ((data as NodeLabelData).foreign ? settings.labelSize + 4 : 0);
    if (
      point.x >= labelLeft - 8 &&
      point.x <= labelLeft + labelWidth + 8 &&
      point.y >= center.y - 22 &&
      point.y <= center.y + 22 &&
      (!closestLabel || distance < closestLabel.distance)
    ) {
      closestLabel = { node, distance };
    }
  });
  return closestLabel?.node ?? closestNode?.node ?? null;
}

function wireHoverAndClick(
  renderer: Sigma,
  graph: Graph,
  state: InteractionState,
  onNodeEnter?: () => void,
): void {
  const navigateToNode = (node: string) => {
    const route = graph.getNodeAttribute(node, "route") as LogicalRoute | undefined;
    if (route) window.location.assign(joinBase(import.meta.env.BASE_URL, route));
  };
  wireGraphHover(renderer, graph, state, onNodeEnter, () => state.dragged !== null);
  renderer.on("clickNode", ({ node }) => {
    if (state.draggedMoved) {
      state.draggedMoved = false;
      return;
    }
    navigateToNode(node);
  });
  renderer.on("clickStage", ({ event }) => {
    if (!event.original.type.startsWith("touch")) return;
    if (state.draggedMoved) {
      state.draggedMoved = false;
      return;
    }
    const node = touchTargetNode(renderer, graph, event);
    if (node) navigateToNode(node);
  });
}

function wireTheme(renderer: Sigma, state: InteractionState): void {
  const media = window.matchMedia("(prefers-color-scheme: light)");
  const update = () => {
    state.theme = graphTheme();
    renderer.setSettings({
      defaultEdgeColor: state.theme.edge,
      labelColor: { color: state.theme.label },
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
    if (Math.hypot(point.x - startViewport.x, point.y - startViewport.y) > 3) {
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
  brainFilters: NodeListOf<HTMLInputElement>;
  tagFilter: HTMLSelectElement;
  count: HTMLElement;
  fitViewButton: HTMLButtonElement;
  relatedBrainsToggle?: HTMLButtonElement | null;
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
    ui.relatedBrainsToggle?.setAttribute("aria-pressed", String(showRelatedBrains));
    if (ui.relatedBrainsToggle) {
      ui.relatedBrainsToggle.textContent = showRelatedBrains ? "Hide related brains" : "Show related brains";
    }
  }
  let selectedBrainIds = combined
    ? (new URLSearchParams(window.location.search).get("brains") ?? "").split(",").filter(Boolean)
    : [];
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
  const theme = graphTheme();
  const renderer = new Sigma(graph, ui.host, baseSettings(theme, graph.order));
  const motion = new GraphMotionController(renderer, graph, data, () => {
    relatedBrainsSessionInvalid = false;
    if (relatedBrainsStatePending) saveRelatedBrainsState();
  }, motionScope());
  const restored = relatedBrainsStorageKey === null || relatedBrainsStateRecorded
    ? motion.restoreSession()
    : { positions: false, view: false };
  if (relatedBrainsStorageKey && !restored.positions) relatedBrainsStatePending = true;
  if (!restored.view) fitRenderedGraph(renderer, graph.nodes());

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
    neighbors: new Set(),
    dragged: null,
    draggedMoved: false,
    theme,
  };
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

  function recomputeHidden(): void {
    hidden.clear();
    const contextData = deriveGraphData(data, currentContext());
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
    const total = graph.order - hidden.size;
    ui.count.textContent = `${total} of ${contextData.nodes.length} notes`;
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

  function applyReducers(): void {
    renderer.setSetting("nodeReducer", (node, attrs) => {
      const res = { ...attrs } as Record<string, unknown>;
      if (hidden.has(node)) {
        res.hidden = true;
        return res as typeof attrs;
      }
      const label = (attrs.label as string).toLowerCase();
      if (state.hovered) {
        return hoverReducers.nodeReducer(node, attrs);
      } else if (query && !label.includes(query)) {
        res.color = state.theme.fadedNode;
        res.label = "";
      }
      return res as typeof attrs;
    });
    renderer.setSetting("edgeReducer", (edge, attrs) => {
      const res = { ...attrs } as Record<string, unknown>;
      const source = graph.source(edge);
      const target = graph.target(edge);
      if (!contextEdges.has(edgeKey(source, target)) || hidden.has(source) || hidden.has(target)) {
        res.hidden = true;
      }
      else if (state.hovered) return hoverReducers.edgeReducer(edge, attrs);
      return res as typeof attrs;
    });
    renderer.refresh();
  }

  const visibleIds = () => graph.nodes().filter((id) => !hidden.has(id));

  function refresh(settle = true): void {
    recomputeHidden();
    applyReducers();
    if (settle) motion.settle("filter", visibleIds());
  }

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
    ui.relatedBrainsToggle?.setAttribute("aria-pressed", String(showRelatedBrains));
    if (ui.relatedBrainsToggle) {
      ui.relatedBrainsToggle.textContent = showRelatedBrains ? "Hide related brains" : "Show related brains";
    }
    refresh();
    renderSearchResults();
  };
  ui.relatedBrainsToggle?.addEventListener("click", onRelatedBrainsToggle);

  if (combined) {
    for (const control of ui.brainFilters) {
      control.checked = selectedBrainIds.includes(control.value);
      control.addEventListener("change", () => {
        selectedBrainIds = data.brains
          .map((brain) => brain.id)
          .filter((brainId) => [...ui.brainFilters].some((item) =>
            item.value === brainId && item.checked
          ));
        if (selectedBrainIds.length === 0) {
          window.location.assign(joinBase(import.meta.env.BASE_URL, routes.home));
          return;
        }
        if (selectedBrainIds.length === 1) {
          window.location.assign(joinBase(
            import.meta.env.BASE_URL,
            routesFor({ mode: "workspace", brainId: selectedBrainIds[0] }).graph,
          ));
          return;
        }
        const target = combinedRoutes(data.brains, selectedBrainIds);
        if (target.valid) {
          window.history.replaceState(null, "", joinBase(import.meta.env.BASE_URL, target.graph));
          document.dispatchEvent(new CustomEvent("brain-selection-change", {
            detail: { brainIds: selectedBrainIds },
          }));
        }
        motion.setSessionScope(motionScope());
        refresh();
        renderSearchResults();
      });
    }
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
      button.addEventListener("click", () => focusNode(match.id));
      li.appendChild(button);
      ui.searchResults.appendChild(li);
    }
  }

  function focusNode(id: string): void {
    motion.cancel();
    resolveCanceledRelatedBrainsState();
    const displayData = renderer.getNodeDisplayData(id);
    if (displayData) {
      renderer
        .getCamera()
        .animate({ x: displayData.x, y: displayData.y, ratio: 0.25 }, { duration: 500 });
    }
  }

  ui.searchInput.addEventListener("input", () => {
    query = ui.searchInput.value.trim().toLowerCase();
    renderSearchResults();
    applyReducers();
  });

  const onFitView = () => motion.fitView(visibleIds());
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

  const resizeSettler = new ResizeSettler(
    ui.host.clientWidth,
    ui.host.clientHeight,
    () => {
      renderer.resize();
      motion.settle("resize", visibleIds());
    },
  );
  const resizeObserver = new ResizeObserver(() => {
    if (state.dragged) {
      resizeSettler.reset(ui.host.clientWidth, ui.host.clientHeight);
      return;
    }
    resizeSettler.update(ui.host.clientWidth, ui.host.clientHeight);
  });
  resizeObserver.observe(ui.host);
  const interruptAutomaticMotion = () => {
    resizeSettler.reset(ui.host.clientWidth, ui.host.clientHeight);
    motion.cancel();
    stopCamera();
    resolveCanceledRelatedBrainsState();
  };
  wireHoverAndClick(renderer, graph, state, interruptAutomaticMotion);
  const commitDrag = (_node: string, _neighborhood: string[], moved: boolean) => {
    stopCamera();
    motion.cancel();
    resizeSettler.reset(ui.host.clientWidth, ui.host.clientHeight);
    if (moved) {
      relatedBrainsSessionInvalid = false;
      commitSession();
    }
  };
  wireNodeDragging(renderer, graph, state, commitDrag, interruptAutomaticMotion);

  const onVisibilityChange = () => {
    if (document.hidden) {
      motion.cancel();
      resolveCanceledRelatedBrainsState();
    } else if (relatedBrainsStatePending || relatedBrainsSessionInvalid) {
      motion.settle("filter", visibleIds());
    }
  };
  document.addEventListener("visibilitychange", onVisibilityChange);
  renderer.on("kill", () => {
    mouse.off("wheel", onWheel);
    if (sessionTimer !== null) window.clearTimeout(sessionTimer);
    resizeObserver.disconnect();
    resizeSettler.cancel();
    renderer.getCamera().off("updated", saveSession);
    window.removeEventListener("pagehide", flushSession);
    ui.fitViewButton.removeEventListener("click", onFitView);
    ui.relatedBrainsToggle?.removeEventListener("click", onRelatedBrainsToggle);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    motion.destroy();
  });

  refresh(false);
  if (!restored.positions) motion.settle("initial", visibleIds());
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
    const fitButton = host
      .closest<HTMLElement>(".local-graph-panel")
      ?.querySelector<HTMLButtonElement>("[data-fit-local-graph]");
    const fitView = (animate: boolean) => {
      if (animate) stopCameraAnimation(renderer);
      fitRenderedGraph(renderer, graph.nodes(), {
        animate: animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      });
    };
    fitView(false);
    const state: InteractionState = {
      hovered: null,
      neighbors: new Set(),
      dragged: null,
      draggedMoved: false,
      theme,
    };
    renderer.setSettings(createHoverReducers(graph, state));
    wireHoverAndClick(renderer, graph, state);
    wireNodeDragging(renderer, graph, state);
    wireTheme(renderer, state);
    const onFitView = () => fitView(true);
    fitButton?.addEventListener("click", onFitView);
    renderer.on("kill", () => fitButton?.removeEventListener("click", onFitView));
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__localGraphDebug = { renderer, graph };
    }
  }
}
