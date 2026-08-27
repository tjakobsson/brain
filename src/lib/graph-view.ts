import Graph from "graphology";
import Sigma from "sigma";
import type { MouseCoords, TouchCoords } from "sigma/types";
import { GraphMotionController } from "./graph-motion";
import { ResizeSettler, zoomLayoutScale } from "./graph-motion-core";
import { joinBase, routes, type LogicalRoute } from "./routes";

/**
 * Browser-side graph rendering shared by the global graph page and the
 * per-note local graph island. One graphology data model, one sigma renderer,
 * one visual language.
 */

export interface GraphNodeDatum {
  id: string;
  title: string;
  route: LogicalRoute;
  type: "fleeting" | "literature" | "permanent";
  status: "draft" | "developing" | "established";
  tags: string[];
  degree: number;
  x: number;
  y: number;
}

export interface GraphData {
  nodes: GraphNodeDatum[];
  edges: { source: string; target: string }[];
}

/* Visual encoding: type sets hue, status sets intensity, degree sets size. */
const TYPE_HUE: Record<string, number> = {
  fleeting: 4,
  literature: 212,
  permanent: 268,
};

const STATUS_SL: Record<string, [number, number]> = {
  draft: [48, 50],
  developing: [66, 57],
  established: [82, 64],
};

interface GraphTheme {
  edge: string;
  fadedEdge: string;
  fadedNode: string;
  label: string;
}

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

/** sigma does not parse hsl() strings — emit hex. */
function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100;
  const ln = l / 100;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return ln - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  const to = (v: number) => Math.round(255 * v).toString(16).padStart(2, "0");
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
}

export function nodeColor(type: string, status: string): string {
  const hue = TYPE_HUE[type] ?? 268;
  const [s, l] = STATUS_SL[status] ?? STATUS_SL.draft;
  return hslToHex(hue, s, l);
}

export function nodeSize(degree: number): number {
  return 3.5 + Math.sqrt(degree) * 2.5;
}

let cache: Promise<GraphData> | null = null;

export function fetchGraphData(): Promise<GraphData> {
  if (!cache) {
    cache = fetch(joinBase(import.meta.env.BASE_URL, routes.graphData)).then((r) => {
      if (!r.ok) throw new Error(`graph-data.json: HTTP ${r.status}`);
      return r.json() as Promise<GraphData>;
    });
  }
  return cache;
}

export function buildGraph(data: GraphData): Graph {
  const graph = new Graph();
  for (const node of data.nodes) {
    graph.addNode(node.id, {
      label: node.title,
      x: node.x,
      y: node.y,
      size: nodeSize(node.degree),
      color: nodeColor(node.type, node.status),
      route: node.route,
      noteType: node.type,
      status: node.status,
      tags: node.tags,
    });
  }
  for (const edge of data.edges) {
    if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
      graph.addEdge(edge.source, edge.target);
    }
  }
  return graph;
}

/** Sigma's initial fit touches the frame edges exactly; zoom out slightly for margin. */
function fitWithMargin(renderer: Sigma): void {
  const camera = renderer.getCamera();
  camera.setState({ ratio: camera.getState().ratio * 1.2 });
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
    defaultEdgeColor: theme.edge,
    minCameraRatio: 0.05,
    maxCameraRatio: 10,
    zIndex: true,
  };
}

interface InteractionState {
  hovered: string | null;
  neighbors: Set<string>;
  dragged: string | null;
  draggedMoved: boolean;
  theme: GraphTheme;
}

function wireHoverAndClick(renderer: Sigma, graph: Graph, state: InteractionState): void {
  renderer.on("enterNode", ({ node }) => {
    state.hovered = node;
    state.neighbors = new Set(graph.neighbors(node));
    renderer.getContainer().style.cursor = "pointer";
    renderer.refresh();
  });
  renderer.on("leaveNode", () => {
    state.hovered = null;
    state.neighbors.clear();
    if (!state.dragged) renderer.getContainer().style.cursor = "";
    renderer.refresh();
  });
  renderer.on("clickNode", ({ node }) => {
    if (state.draggedMoved) {
      state.draggedMoved = false;
      return;
    }
    const route = graph.getNodeAttribute(node, "route") as LogicalRoute | undefined;
    if (route) window.location.assign(joinBase(import.meta.env.BASE_URL, route));
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
  onDragComplete?: (node: string, neighborhood: string[]) => void,
): void {
  let startPointer: { x: number; y: number } | null = null;
  let startViewport: { x: number; y: number } | null = null;
  let starts = new Map<string, { x: number; y: number; weight: number }>();

  renderer.on("downNode", ({ node, event, preventSigmaDefault }) => {
    state.dragged = node;
    state.draggedMoved = false;
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
    if (moved) onDragComplete?.(dragged, neighborhood);
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
  touch.on("touchmovebody", moveTouch);
  touch.on("touchup", finish);

  renderer.on("kill", () => {
    mouse.off("mousemovebody", moveMouse);
    mouse.off("mouseup", finish);
    touch.off("touchmovebody", moveTouch);
    touch.off("touchup", finish);
  });
}

function hoverReducers(renderer: Sigma, graph: Graph, state: InteractionState): void {
  renderer.setSetting("nodeReducer", (node, attrs) => {
    const res = { ...attrs } as Record<string, unknown>;
    if (state.hovered && node !== state.hovered && !state.neighbors.has(node)) {
      res.color = state.theme.fadedNode;
    }
    return res as typeof attrs;
  });
  renderer.setSetting("edgeReducer", (edge, attrs) => {
    const res = { ...attrs } as Record<string, unknown>;
    if (
      state.hovered &&
      graph.source(edge) !== state.hovered &&
      graph.target(edge) !== state.hovered
    ) {
      res.color = state.theme.fadedEdge;
      res.label = "";
    }
    return res as typeof attrs;
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
}

export async function mountGlobalGraph(ui: GlobalGraphUI): Promise<void> {
  const data = await fetchGraphData();
  const graph = buildGraph(data);
  const theme = graphTheme();
  const renderer = new Sigma(graph, ui.host, baseSettings(theme, graph.order));
  const motion = new GraphMotionController(renderer, graph, data);
  motion.restoreSession();
  fitWithMargin(renderer);

  const hidden = new Set<string>();
  const state: InteractionState = {
    hovered: null,
    neighbors: new Set(),
    dragged: null,
    draggedMoved: false,
    theme,
  };
  let query = "";

  const activeTypes = () =>
    new Set([...ui.typeFilters].filter((c) => c.checked).map((c) => c.value));
  const activeStatuses = () =>
    new Set(
      [...ui.statusFilters].filter((control) => control.checked).map((control) => control.value),
    );

  function recomputeHidden(): void {
    hidden.clear();
    const types = activeTypes();
    const statuses = activeStatuses();
    const tag = ui.tagFilter.value;
    graph.forEachNode((id, attrs) => {
      if (!types.has(attrs.noteType as string)) hidden.add(id);
      else if (!statuses.has(attrs.status as string)) hidden.add(id);
      else if (tag && !(attrs.tags as string[]).includes(tag)) hidden.add(id);
    });
    const total = graph.order - hidden.size;
    ui.count.textContent = `${total} of ${graph.order} notes`;
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
        if (node !== state.hovered && !state.neighbors.has(node)) {
          res.color = state.theme.fadedNode;
        }
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
      if (hidden.has(source) || hidden.has(target)) res.hidden = true;
      else if (state.hovered && source !== state.hovered && target !== state.hovered) {
        res.color = state.theme.fadedEdge;
      }
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
      button.textContent = match.title;
      button.addEventListener("click", () => focusNode(match.id));
      li.appendChild(button);
      ui.searchResults.appendChild(li);
    }
  }

  function focusNode(id: string): void {
    motion.cancel();
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

  wireHoverAndClick(renderer, graph, state);
  wireNodeDragging(renderer, graph, state, (node, neighborhood) => {
    motion.settle(
      "drag",
      neighborhood.filter((id) => !hidden.has(id)),
      node,
      visibleIds(),
      false,
    );
  });

  let zoomSettleTimer: number | null = null;
  let pinching = false;
  let previousZoomRatio = renderer.getCamera().getState().ratio;
  const scheduleZoomSettle = (delay: number) => {
    if (zoomSettleTimer !== null) window.clearTimeout(zoomSettleTimer);
    zoomSettleTimer = window.setTimeout(() => {
      zoomSettleTimer = null;
      const currentRatio = renderer.getCamera().getState().ratio;
      const scale = zoomLayoutScale(previousZoomRatio, currentRatio);
      previousZoomRatio = currentRatio;
      motion.settle("zoom", visibleIds(), undefined, undefined, false, scale);
    }, delay);
  };
  const mouse = renderer.getMouseCaptor();
  const touch = renderer.getTouchCaptor();
  const onWheel = () => scheduleZoomSettle(260);
  const onTouchMove = (event: TouchCoords) => {
    if (event.touches.length > 1) pinching = true;
  };
  const onTouchUp = (event: TouchCoords) => {
    if (!pinching || event.touches.length > 1) return;
    pinching = false;
    scheduleZoomSettle(0);
  };
  mouse.on("wheel", onWheel);
  touch.on("touchmove", onTouchMove);
  touch.on("touchup", onTouchUp);
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
    resizeSettler.update(ui.host.clientWidth, ui.host.clientHeight);
  });
  resizeObserver.observe(ui.host);

  const onVisibilityChange = () => {
    if (document.hidden) motion.cancel();
  };
  document.addEventListener("visibilitychange", onVisibilityChange);
  renderer.on("kill", () => {
    mouse.off("wheel", onWheel);
    touch.off("touchmove", onTouchMove);
    touch.off("touchup", onTouchUp);
    if (zoomSettleTimer !== null) window.clearTimeout(zoomSettleTimer);
    resizeObserver.disconnect();
    resizeSettler.cancel();
    ui.fitViewButton.removeEventListener("click", onFitView);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    motion.destroy();
  });

  refresh(false);
  motion.settle("initial", visibleIds());
}

/* ------------------------------------------------------------------------ */
/* Local graph                                                               */
/* ------------------------------------------------------------------------ */

function neighborhood(data: GraphData, slug: string, depth: number): GraphData {
  const adjacency = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    const set = adjacency.get(a) ?? new Set<string>();
    set.add(b);
    adjacency.set(a, set);
  };
  for (const { source, target } of data.edges) {
    link(source, target);
    link(target, source);
  }

  const included = new Set([slug]);
  let frontier = [slug];
  for (let d = 0; d < depth; d++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const neighbor of adjacency.get(id) ?? []) {
        if (!included.has(neighbor)) {
          included.add(neighbor);
          next.push(neighbor);
        }
      }
    }
    frontier = next;
  }

  return {
    nodes: data.nodes.filter((n) => included.has(n.id)),
    edges: data.edges.filter((e) => included.has(e.source) && included.has(e.target)),
  };
}

export async function mountLocalGraphs(): Promise<void> {
  const hosts = document.querySelectorAll<HTMLElement>(".local-graph[data-slug]");
  if (hosts.length === 0) return;
  const data = await fetchGraphData();

  for (const host of hosts) {
    const slug = host.dataset.slug!;
    const local = neighborhood(data, slug, 2);
    if (local.nodes.length <= 1) {
      host.style.display = "none"; // isolated note: nothing to show
      continue;
    }
    const graph = buildGraph(local);
    const theme = graphTheme();
    const renderer = new Sigma(graph, host, {
      ...baseSettings(theme, graph.order),
      labelRenderedSizeThreshold: 3,
    });
    fitWithMargin(renderer);
    const state: InteractionState = {
      hovered: null,
      neighbors: new Set(),
      dragged: null,
      draggedMoved: false,
      theme,
    };
    hoverReducers(renderer, graph, state);
    wireHoverAndClick(renderer, graph, state);
    wireNodeDragging(renderer, graph, state);
    wireTheme(renderer, state);
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__localGraphDebug = { renderer, graph };
    }
  }
}
