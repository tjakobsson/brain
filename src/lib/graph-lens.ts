import type Graph from "graphology";
import type Sigma from "sigma";
import {
  activeInspectionNode,
  createHoverReducers,
  type GraphHoverState,
} from "./graph-interaction";

/**
 * The personal Brain lens: a set of dimmed Brain IDs remembered in the
 * reader's own browser. Dimming lowers emphasis in place; it never removes
 * nodes, never moves them, and never reaches a URL.
 */

type SigmaSettings = ReturnType<Sigma["getSettings"]>;

export type LensStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface LensStore {
  readonly key: string;
  /** Where the lens currently lives; `memory` once storage has failed. */
  readonly backend: "storage" | "memory";
  read(): string[];
  write(dimmed: readonly string[]): void;
  reset(): void;
}

export function lensStorageKey(base: string): string {
  return `brain-lens:${base}`;
}

function parseLens(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Creates the store for one site base. Every storage access is guarded: the
 * first failure switches the store to an in-memory lens for this page only.
 */
export function createLensStore(
  base: string,
  storage: () => LensStorage = () => window.localStorage,
): LensStore {
  const key = lensStorageKey(base);
  let memory: string[] = [];
  let backend: "storage" | "memory" = "storage";
  const withStorage = <T>(operation: (target: LensStorage) => T, fallback: () => T): T => {
    if (backend === "memory") return fallback();
    try {
      return operation(storage());
    } catch {
      backend = "memory";
      return fallback();
    }
  };
  return {
    key,
    get backend() {
      return backend;
    },
    read: () => withStorage((target) => parseLens(target.getItem(key)), () => [...memory]),
    write: (dimmed) => {
      memory = [...dimmed];
      withStorage((target) => target.setItem(key, JSON.stringify(memory)), () => undefined);
    },
    reset: () => {
      memory = [];
      withStorage((target) => target.removeItem(key), () => undefined);
    },
  };
}

/**
 * Keeps only configured Brains in declared order, drops duplicates, and treats
 * a lens that would dim every Brain as no lens at all.
 */
export function normalizeLens(
  dimmed: Iterable<string>,
  knownBrainIds: readonly string[],
): string[] {
  const requested = new Set(dimmed);
  const normalized = knownBrainIds.filter((id) => requested.has(id));
  return normalized.length > 0 && normalized.length === knownBrainIds.length ? [] : normalized;
}

export interface LensReducerOptions {
  /** Brain IDs currently dimmed by the lens. */
  dimmed: () => ReadonlySet<string>;
  /** Nodes removed by type, status, or tag filters; they are hidden, not dimmed. */
  hidden?: ReadonlySet<string>;
}

/**
 * Node and edge reducers with fixed precedence: a focused or hovered
 * neighborhood renders at full emphasis, then the lens dims its Brains, then
 * normal styling applies. Filters remove before any of that.
 */
export function createLensReducers(
  graph: Graph,
  state: GraphHoverState,
  options: LensReducerOptions,
) {
  const hover = createHoverReducers(graph, state);
  const dimsNode = (node: string) => {
    const brainId = graph.getNodeAttribute(node, "brainId") as string | undefined;
    return brainId !== undefined && options.dimmed().has(brainId);
  };
  const nodeReducer: NonNullable<SigmaSettings["nodeReducer"]> = (node, attrs) => {
    if (options.hidden?.has(node)) return { ...attrs, hidden: true };
    if (activeInspectionNode(state)) return hover.nodeReducer(node, attrs);
    if (!dimsNode(node)) return attrs;
    return {
      ...attrs,
      color: state.theme.fadedNode,
      labelColor: state.theme.fadedLabel,
      forceLabel: false,
      zIndex: 0,
      dimmed: true,
    };
  };
  const edgeReducer: NonNullable<SigmaSettings["edgeReducer"]> = (edge, attrs) => {
    const source = graph.source(edge);
    const target = graph.target(edge);
    if (options.hidden?.has(source) || options.hidden?.has(target)) return { ...attrs, hidden: true };
    if (activeInspectionNode(state)) return hover.edgeReducer(edge, attrs);
    if (!dimsNode(source) && !dimsNode(target)) return attrs;
    return { ...attrs, color: state.theme.fadedEdge, dimmed: true };
  };
  return { nodeReducer, edgeReducer };
}
