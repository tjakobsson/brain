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
  readonly search: LogicalRoute;
  readonly note: (slug: string) => LogicalRoute;
  readonly asset: (path: string) => LogicalRoute;
}

export interface BrainRouteRegistryEntry {
  readonly id: string;
}

export type BrainSelectionInput = string | readonly string[];

export type CanonicalBrainSelection =
  | {
      readonly valid: true;
      readonly brainIds: readonly string[];
      readonly value: string;
    }
  | {
      readonly valid: false;
      readonly unknownBrainIds: readonly string[];
    };

export type CombinedRoutes =
  | {
      readonly valid: true;
      readonly brainIds: readonly string[];
      readonly graph: LogicalRoute;
      readonly search: LogicalRoute;
    }
  | {
      readonly valid: false;
      readonly unknownBrainIds: readonly string[];
    };

function segment(value: string): string {
  return encodeURIComponent(value);
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
  search: "/search",
  note: (slug: string): LogicalRoute => `/notes/${segment(slug)}`,
  vaultAsset: (vaultPath: string): LogicalRoute =>
    `/vault-assets/${vaultPath.split("/").map(segment).join("/")}`,
  faviconSvg: "/favicon.svg",
  faviconIco: "/favicon.ico",
  pagefind: "/pagefind/",
  pagefindUiCss: "/pagefind/pagefind-ui.css",
  pagefindUiJs: "/pagefind/pagefind-ui.js",
} as const satisfies Record<string, LogicalRoute | ((value: string) => LogicalRoute)>;

export function routesFor(scope: RouteScope): ContextualRoutes {
  if (scope.mode === "vault") {
    return {
      graph: routes.home,
      tags: routes.tags,
      tag: routes.tag,
      recent: routes.recent,
      orphans: routes.orphans,
      search: routes.search,
      note: routes.note,
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
    search: `${brain}/search`,
    note: (slug: string): LogicalRoute => `${brain}/notes/${segment(slug)}`,
    asset: (path: string): LogicalRoute =>
      `${brain}/assets/${path.split("/").map(segment).join("/")}`,
  };
}

export function canonicalBrainSelection(
  registry: readonly BrainRouteRegistryEntry[],
  selection: BrainSelectionInput,
): CanonicalBrainSelection {
  const requestedIds = typeof selection === "string" ? selection.split(",") : selection;
  const registryIds = new Set(registry.map(({ id }) => id));
  const unknownBrainIds = [...new Set(requestedIds.filter((id) => !registryIds.has(id)))];

  if (unknownBrainIds.length > 0) {
    return { valid: false, unknownBrainIds };
  }

  const requested = new Set(requestedIds);
  const emitted = new Set<string>();
  const brainIds: string[] = [];
  for (const { id } of registry) {
    if (!requested.has(id) || emitted.has(id)) continue;
    emitted.add(id);
    brainIds.push(id);
  }

  return {
    valid: true,
    brainIds,
    value: brainIds.map(segment).join(","),
  };
}

export function combinedRoutes(
  registry: readonly BrainRouteRegistryEntry[],
  selection: BrainSelectionInput,
): CombinedRoutes {
  const canonical = canonicalBrainSelection(registry, selection);
  if (!canonical.valid) return canonical;

  return {
    valid: true,
    brainIds: canonical.brainIds,
    graph: `/graph?brains=${canonical.value}`,
    search: `/search?brains=${canonical.value}`,
  };
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
