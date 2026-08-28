import { computeLayout } from "./graph-layout";
import type { InputMode } from "./note-identity";
import type { LogicalRoute } from "./routes";
import type { LinkEdge, LinkIndex } from "./vault-scan";
import type { WorkspaceDefinition } from "./workspace.mjs";

export interface GraphBrainDatum {
  id: string;
  title: string;
  accent: string;
}

export interface GraphNodeDatum {
  id: string;
  brainId: string;
  brainTitle: string;
  brainAccent: string;
  title: string;
  route: LogicalRoute;
  type: "fleeting" | "literature" | "permanent";
  status: "draft" | "developing" | "established";
  tags: string[];
  degree: number;
  x: number;
  y: number;
}

export interface GraphEdgeDatum extends LinkEdge {}

export interface GraphData {
  mode: InputMode;
  brains: GraphBrainDatum[];
  nodes: GraphNodeDatum[];
  edges: GraphEdgeDatum[];
}

export type GraphContext =
  | { mode: "all" }
  | { mode: "brain"; brainId: string }
  | { mode: "combined"; brainIds: readonly string[] };

interface LegacyGraphData {
  mode?: InputMode;
  brains?: GraphBrainDatum[];
  nodes: Array<Omit<GraphNodeDatum, "brainId" | "brainTitle" | "brainAccent"> &
    Partial<Pick<GraphNodeDatum, "brainId" | "brainTitle" | "brainAccent">>>;
  edges: Array<Pick<GraphEdgeDatum, "source" | "target"> & Partial<GraphEdgeDatum>>;
}

export function normalizeGraphData(data: LegacyGraphData): GraphData {
  const fallbackBrain = data.brains?.[0] ?? {
    id: "default",
    title: "Brain",
    accent: "#5b4bc4",
  };
  const brains = data.brains?.length ? data.brains : [fallbackBrain];
  const brainById = new Map(brains.map((brain) => [brain.id, brain]));
  const nodes = data.nodes.map((node) => {
    const brainId = node.brainId ?? fallbackBrain.id;
    const brain = brainById.get(brainId) ?? fallbackBrain;
    return {
      ...node,
      brainId,
      brainTitle: node.brainTitle ?? brain.title,
      brainAccent: node.brainAccent ?? brain.accent,
    };
  });
  const nodeBrain = new Map(nodes.map((node) => [node.id, node.brainId]));
  return {
    mode: data.mode ?? "vault",
    brains,
    nodes,
    edges: data.edges.map((edge) => {
      const sourceBrainId = edge.sourceBrainId ?? nodeBrain.get(edge.source) ?? fallbackBrain.id;
      const targetBrainId = edge.targetBrainId ?? nodeBrain.get(edge.target) ?? fallbackBrain.id;
      return {
        source: edge.source,
        target: edge.target,
        sourceBrainId,
        targetBrainId,
        crossBrain: edge.crossBrain ?? sourceBrainId !== targetBrainId,
      };
    }),
  };
}

function orderedEdges(edges: readonly LinkEdge[]): GraphEdgeDatum[] {
  return [...edges].sort((a, b) =>
    `${a.source}\u001f${a.target}`.localeCompare(`${b.source}\u001f${b.target}`)
  );
}

export function buildGraphData(
  index: Pick<LinkIndex, "notes" | "edges">,
  registry: WorkspaceDefinition,
  mode: InputMode,
): GraphData {
  const edges = orderedEdges(index.edges);
  const degree = new Map<string, number>();
  for (const edge of edges) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }

  const notes = [...index.notes].sort((a, b) => a.id.localeCompare(b.id));
  const positions = computeLayout(notes.map((note) => note.id), edges);
  const brains = registry.brains.map(({ id, title, accent }) => ({ id, title, accent }));
  const brainsById = new Map(brains.map((brain) => [brain.id, brain]));

  return {
    mode,
    brains,
    nodes: notes.map((note) => {
      const brain = brainsById.get(note.brainId);
      if (!brain) throw new Error(`Graph note ${JSON.stringify(note.id)} has unknown brain ${JSON.stringify(note.brainId)}.`);
      return {
        id: note.id,
        brainId: note.brainId,
        brainTitle: brain.title,
        brainAccent: brain.accent,
        title: note.title,
        route: note.route,
        type: note.meta.type,
        status: note.meta.status,
        tags: [...note.meta.tags],
        degree: degree.get(note.id) ?? 0,
        x: positions[note.id].x,
        y: positions[note.id].y,
      };
    }),
    edges,
  };
}

export function deriveGraphData(data: GraphData, context: GraphContext): GraphData {
  if (context.mode === "all") return data;

  const included = new Set<string>();
  if (context.mode === "combined") {
    const brainIds = new Set(context.brainIds);
    for (const node of data.nodes) {
      if (brainIds.has(node.brainId)) included.add(node.id);
    }
  } else {
    const local = new Set(
      data.nodes.filter((node) => node.brainId === context.brainId).map((node) => node.id),
    );
    for (const id of local) included.add(id);
    for (const edge of data.edges) {
      if (!edge.crossBrain || (!local.has(edge.source) && !local.has(edge.target))) continue;
      included.add(edge.source);
      included.add(edge.target);
    }
  }

  return {
    ...data,
    nodes: data.nodes.filter((node) => included.has(node.id)),
    edges: data.edges.filter((edge) => {
      if (!included.has(edge.source) || !included.has(edge.target)) return false;
      return context.mode !== "brain" ||
        edge.sourceBrainId === context.brainId ||
        edge.targetBrainId === context.brainId;
    }),
  };
}

export function deriveNoteNeighborhood(data: GraphData, noteId: string, depth = 2): GraphData {
  const root = data.nodes.find((node) => node.id === noteId);
  if (!root) return { ...data, nodes: [], edges: [] };

  const adjacency = new Map<string, Set<string>>();
  for (const edge of data.edges) {
    adjacency.set(edge.source, (adjacency.get(edge.source) ?? new Set()).add(edge.target));
    adjacency.set(edge.target, (adjacency.get(edge.target) ?? new Set()).add(edge.source));
  }
  const nodesById = new Map(data.nodes.map((node) => [node.id, node]));
  const local = new Set([noteId]);
  let frontier = [noteId];
  for (let level = 0; level < depth; level += 1) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const neighbor of adjacency.get(id) ?? []) {
        if (local.has(neighbor) || nodesById.get(neighbor)?.brainId !== root.brainId) continue;
        local.add(neighbor);
        next.push(neighbor);
      }
    }
    frontier = next;
  }

  const included = new Set(local);
  for (const id of local) {
    for (const neighbor of adjacency.get(id) ?? []) {
      if (nodesById.get(neighbor)?.brainId !== root.brainId) included.add(neighbor);
    }
  }

  return {
    ...data,
    nodes: data.nodes.filter((node) => included.has(node.id)),
    edges: data.edges.filter((edge) =>
      included.has(edge.source) &&
      included.has(edge.target) &&
      (local.has(edge.source) || local.has(edge.target))
    ),
  };
}
