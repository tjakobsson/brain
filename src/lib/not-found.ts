import {
  joinBase,
  routes,
  routesFor,
  stripBase,
  type BrainRouteRegistryEntry,
  type LogicalRoute,
} from "./routes";

export type NotFoundMode = "vault" | "workspace";

export interface PublicBrain extends BrainRouteRegistryEntry {
  readonly title?: string;
}

export interface NotFoundSearchCandidate {
  readonly title: string;
  readonly route: LogicalRoute;
  readonly kind: string;
  readonly tags: readonly string[];
  readonly brainId: string;
  readonly brainTitle: string;
  readonly brainAccent?: string;
}

export interface NotFoundInput {
  readonly deploymentBase: string;
  readonly pathname: string;
  /** Kept only as part of the deterministic recommendation seed; never treated as scope. */
  readonly search: string;
  readonly brains: readonly PublicBrain[];
  readonly mode: NotFoundMode;
  readonly candidates: readonly NotFoundSearchCandidate[];
}

export type NotFoundContextSource = "brain-path" | "unscoped";

export interface NotFoundContext {
  readonly source: NotFoundContextSource;
  readonly brainIds: readonly string[];
  readonly recoveryRoute: LogicalRoute;
  readonly recoveryHref: string;
}

export interface NotFoundRecommendation {
  readonly candidate: NotFoundSearchCandidate;
  readonly href: string;
  readonly index: number;
  readonly initialIndex: number;
  readonly advance: number;
  readonly hasAnother: boolean;
}

export interface NotFoundResult {
  readonly context: NotFoundContext;
  readonly candidates: readonly NotFoundSearchCandidate[];
  readonly recommendation: NotFoundRecommendation | null;
}

function pathBrainId(pathname: string | null, brains: readonly PublicBrain[]): string | null {
  if (pathname === null) return null;

  const match = /^\/brains\/([^/]+)(?:\/.*)?$/.exec(pathname);
  if (!match) return null;

  let brainId: string;
  try {
    brainId = decodeURIComponent(match[1]);
  } catch {
    return null;
  }

  if (match[1] !== encodeURIComponent(brainId)) return null;
  return brains.some((brain) => brain.id === brainId) ? brainId : null;
}

/**
 * Scope is inferred from the namespaced Brain path alone. Query parameters are
 * never consulted: a proxy may strip them, and they never identify a destination.
 */
export function resolveNotFoundContext(
  input: Pick<NotFoundInput, "deploymentBase" | "pathname" | "brains" | "mode">,
): NotFoundContext {
  if (input.mode === "workspace") {
    const strippedPathname = stripBase(input.deploymentBase, input.pathname);
    const pathnameBrainId = pathBrainId(strippedPathname, input.brains);

    if (pathnameBrainId) {
      const recoveryRoute = routesFor({ mode: "workspace", brainId: pathnameBrainId }).graph;
      return {
        source: "brain-path",
        brainIds: [pathnameBrainId],
        recoveryRoute,
        recoveryHref: joinBase(input.deploymentBase, recoveryRoute),
      };
    }
  }

  return {
    source: "unscoped",
    brainIds: [],
    recoveryRoute: routes.home,
    recoveryHref: joinBase(input.deploymentBase, routes.home),
  };
}

function candidateIdentity(candidate: NotFoundSearchCandidate): string {
  return [
    candidate.brainId,
    candidate.route,
    candidate.title,
    [...candidate.tags].sort().join("\u001f"),
    candidate.brainTitle,
    candidate.brainAccent ?? "",
  ].join("\u001e");
}

export function stableNotFoundHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function createNotFoundResult(input: NotFoundInput, advance = 0): NotFoundResult {
  const context = resolveNotFoundContext(input);
  const knownBrainIds = new Set(input.brains.map((brain) => brain.id));
  const scopedBrainIds = new Set(context.brainIds);
  const candidates = input.candidates
    .filter((candidate) => candidate.kind === "note")
    .filter((candidate) => input.mode === "vault" || knownBrainIds.has(candidate.brainId))
    .filter((candidate) => scopedBrainIds.size === 0 || scopedBrainIds.has(candidate.brainId))
    .map((candidate) => ({ candidate, identity: candidateIdentity(candidate) }))
    .sort((left, right) =>
      left.identity < right.identity ? -1 : left.identity > right.identity ? 1 : 0,
    );

  if (candidates.length === 0) {
    return { context, candidates: [], recommendation: null };
  }

  const seed = [input.pathname, input.search, ...candidates.map(({ identity }) => identity)].join(
    "\u001d",
  );
  const initialIndex = stableNotFoundHash(seed) % candidates.length;
  const normalizedAdvance = ((advance % candidates.length) + candidates.length) % candidates.length;
  const index = (initialIndex + normalizedAdvance) % candidates.length;
  const orderedCandidates = candidates.map(({ candidate }) => candidate);
  const candidate = orderedCandidates[index];

  return {
    context,
    candidates: orderedCandidates,
    recommendation: {
      candidate,
      href: joinBase(input.deploymentBase, candidate.route),
      index,
      initialIndex,
      advance: normalizedAdvance,
      hasAnother: candidates.length > 1,
    },
  };
}
