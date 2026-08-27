export type LogicalRoute = `/${string}`;

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
