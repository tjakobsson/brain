import type { InputMode } from "./note-identity";
import {
  joinBase,
  routes,
  routesFor,
  singularQueryValue,
  withGraphFocus,
  type LogicalRoute,
} from "./routes";

/**
 * Note-owned focused neighborhoods. A neighborhood is identified by the note's
 * canonical path followed by `graph/`; that pathname is the only shareable
 * form. Graph pages that are not note-owned keep `?focus=` as in-session state,
 * and note pages may carry `?focus=` as return context.
 */

export interface NeighborhoodNode {
  readonly brainId: string;
  readonly compositeId: string;
}

/** The slug half of `<brainId>/<slug>`. */
export function noteSlug(node: NeighborhoodNode): string {
  const prefix = `${node.brainId}/`;
  return node.compositeId.startsWith(prefix)
    ? node.compositeId.slice(prefix.length)
    : node.compositeId;
}

export function neighborhoodRoute(node: NeighborhoodNode, mode: InputMode): LogicalRoute {
  const slug = noteSlug(node);
  return mode === "workspace"
    ? routesFor({ mode: "workspace", brainId: node.brainId }).neighborhood(slug)
    : routes.neighborhood(slug);
}

/** Absolute, pathname-only neighborhood link under the site origin and base. */
export function neighborhoodHref(
  base: string,
  origin: string,
  node: NeighborhoodNode,
  mode: InputMode,
): string {
  return new URL(joinBase(base, neighborhoodRoute(node, mode)), origin).href;
}

/**
 * The composite ID a graph page mounts with. A neighborhood page names its
 * note in a host attribute, which outranks any `focus` query.
 */
export function initialGraphFocus(hostFocus: string | undefined, search: string): string | null {
  if (hostFocus) return hostFocus;
  const requested = singularQueryValue(new URLSearchParams(search), "focus");
  return requested.present && requested.valid ? requested.value : null;
}

export interface FocusUrlSyncOptions {
  readonly neighborhoodPage: boolean;
  readonly base: string;
  readonly graphRoute: LogicalRoute;
  readonly knownCompositeIds: readonly string[];
  readonly location: { readonly pathname: string; readonly search: string };
  readonly history: {
    replaceState(data: unknown, unused: string, url?: string | URL | null): void;
  };
}

/**
 * Mirrors the pinned focus into a graph page's URL as in-session state. On a
 * neighborhood page the URL is the destination itself and is never rewritten.
 */
export function createFocusUrlSync(options: FocusUrlSyncOptions): (focus: string | null) => void {
  return (focus) => {
    if (options.neighborhoodPage) return;
    const href = joinBase(
      options.base,
      withGraphFocus(options.graphRoute, options.knownCompositeIds, focus),
    );
    if (`${options.location.pathname}${options.location.search}` !== href) {
      options.history.replaceState(null, "", href);
    }
  };
}

/**
 * A note page's Graph action: the originating note's neighborhood page when the
 * return context names a known note, otherwise the note's own neighborhood.
 */
export function noteGraphActionRoute(
  ownNeighborhood: LogicalRoute,
  requestedFocus: string | null | undefined,
  nodes: readonly NeighborhoodNode[],
  mode: InputMode,
): LogicalRoute {
  const origin = requestedFocus
    ? nodes.find((node) => node.compositeId === requestedFocus)
    : undefined;
  return origin ? neighborhoodRoute(origin, mode) : ownNeighborhood;
}
