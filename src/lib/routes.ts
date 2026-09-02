export type LogicalRoute = `/${string}`;

export type RouteScope =
  | { readonly mode: "vault" }
  | { readonly mode: "workspace"; readonly brainId: string };

export interface ContextualRoutes {
  readonly graph: LogicalRoute;
  readonly tags: LogicalRoute;
  readonly tag: (tag: string) => LogicalRoute;
  readonly recent: LogicalRoute;
  readonly orphans: LogicalRoute;
  readonly note: (slug: string) => LogicalRoute;
  /** The note-owned focused-neighborhood page: `<note path>/graph`. */
  readonly neighborhood: (slug: string) => LogicalRoute;
  readonly asset: (path: string) => LogicalRoute;
}

export interface BrainRouteRegistryEntry {
  readonly id: string;
}

export type SingularQueryValue =
  | { readonly present: false; readonly valid: true }
  | { readonly present: true; readonly valid: true; readonly value: string }
  | { readonly present: true; readonly valid: false };

function segment(value: string): string {
  return encodeURIComponent(value);
}

function queryKey(entry: string): string {
  const key = entry.split("=", 1)[0];
  try {
    return decodeURIComponent(key.replaceAll("+", " "));
  } catch {
    return key;
  }
}

function withQueryValue(route: LogicalRoute, key: "focus", value?: string): LogicalRoute {
  const fragmentIndex = route.indexOf("#");
  const fragment = fragmentIndex < 0 ? "" : route.slice(fragmentIndex);
  const beforeFragment = fragmentIndex < 0 ? route : route.slice(0, fragmentIndex);
  const queryIndex = beforeFragment.indexOf("?");
  const pathname = queryIndex < 0 ? beforeFragment : beforeFragment.slice(0, queryIndex);
  const entries = queryIndex < 0 ? [] : beforeFragment.slice(queryIndex + 1).split("&");
  const retained = entries.filter((entry) => entry && queryKey(entry) !== key);

  if (value !== undefined) retained.push(`${key}=${value}`);

  return `${pathname}${retained.length > 0 ? `?${retained.join("&")}` : ""}${fragment}` as LogicalRoute;
}

export const routes = {
  home: "/",
  graphAlias: "/graph",
  graphData: "/graph-data.json",
  searchIndex: "/search-index.json",
  tags: "/tags",
  tag: (tag: string): LogicalRoute => `/tags/${segment(tag)}`,
  recent: "/recent",
  orphans: "/orphans",
  note: (slug: string): LogicalRoute => `/notes/${segment(slug)}`,
  neighborhood: (slug: string): LogicalRoute => `/notes/${segment(slug)}/graph`,
  vaultAsset: (vaultPath: string): LogicalRoute =>
    `/vault-assets/${vaultPath.split("/").map(segment).join("/")}`,
  faviconSvg: "/favicon.svg",
  faviconIco: "/favicon.ico",
} as const satisfies Record<string, LogicalRoute | ((value: string) => LogicalRoute)>;

export function routesFor(scope: RouteScope): ContextualRoutes {
  if (scope.mode === "vault") {
    return {
      graph: routes.home,
      tags: routes.tags,
      tag: routes.tag,
      recent: routes.recent,
      orphans: routes.orphans,
      note: routes.note,
      neighborhood: routes.neighborhood,
      asset: routes.vaultAsset,
    };
  }

  const brain = `/brains/${segment(scope.brainId)}` as LogicalRoute;
  return {
    graph: brain,
    tags: `${brain}/tags`,
    tag: (tag: string): LogicalRoute => `${brain}/tags/${segment(tag)}`,
    recent: `${brain}/recent`,
    orphans: `${brain}/orphans`,
    note: (slug: string): LogicalRoute => `${brain}/notes/${segment(slug)}`,
    neighborhood: (slug: string): LogicalRoute => `${brain}/notes/${segment(slug)}/graph`,
    asset: (path: string): LogicalRoute =>
      `${brain}/assets/${path.split("/").map(segment).join("/")}`,
  };
}

export function singularQueryValue(
  parameters: URLSearchParams,
  key: string,
): SingularQueryValue {
  const values = parameters.getAll(key);
  if (values.length === 0) return { present: false, valid: true };
  if (values.length !== 1) return { present: true, valid: false };
  return { present: true, valid: true, value: values[0] };
}

/**
 * In-session graph focus. This is the only query state Brain writes, and only on
 * graph pages (where losing it degrades to the same page unfocused) or as return
 * context on note pages. Shareable destinations are identified by pathname alone.
 */
export function withGraphFocus(
  route: LogicalRoute,
  knownCompositeIds: readonly string[],
  focus?: string | null,
): LogicalRoute {
  const validFocus = focus && new Set(knownCompositeIds).has(focus) ? segment(focus) : undefined;
  return withQueryValue(route, "focus", validFocus);
}

export function withoutGraphFocus(route: LogicalRoute): LogicalRoute {
  return withQueryValue(route, "focus");
}

export function withFragment(route: LogicalRoute, fragment: string): LogicalRoute {
  return fragment ? `${route}#${segment(fragment)}` : route;
}

export function joinBase(base: string, route: LogicalRoute): string {
  if (!route.startsWith("/") || route.startsWith("//")) {
    throw new Error(`Invalid logical route: ${route}`);
  }

  const prefix = base === "/" ? "" : base.endsWith("/") ? base.slice(0, -1) : base;
  if (prefix && (!prefix.startsWith("/") || prefix.startsWith("//"))) {
    throw new Error(`Invalid deployment base: ${base}`);
  }
  if (!prefix) return route;
  return route === "/" ? `${prefix}/` : `${prefix}${route}`;
}

export function stripBase(base: string, pathname: string): LogicalRoute | null {
  const prefix = base === "/" ? "" : base.endsWith("/") ? base.slice(0, -1) : base;
  if (prefix && (!prefix.startsWith("/") || prefix.startsWith("//"))) {
    throw new Error(`Invalid deployment base: ${base}`);
  }
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return null;
  if (!prefix) return pathname as LogicalRoute;
  if (pathname === `${prefix}/`) return "/";
  if (!pathname.startsWith(`${prefix}/`)) return null;
  return pathname.slice(prefix.length) as LogicalRoute;
}
