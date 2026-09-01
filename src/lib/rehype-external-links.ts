import type { Element, Root, RootContent } from "hast";

export interface RehypeExternalLinksOptions {
  site?: string | URL;
}

const EXTERNAL_LINK_CLASS = "external-link";
const EXTERNAL_LINK_ICON_CLASS = "external-link__icon";

function asWebUrl(value: string | URL, base?: URL): URL | undefined {
  try {
    const url = value instanceof URL ? value : new URL(value, base);
    return url.protocol === "http:" || url.protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
}

/** Reports whether an href points to an external HTTP(S) origin. */
export function isExternalHref(href: string, site?: string | URL): boolean {
  const siteUrl = site === undefined ? undefined : asWebUrl(site);
  const targetUrl = asWebUrl(href, siteUrl);
  if (!targetUrl) return false;
  return siteUrl === undefined || targetUrl.origin !== siteUrl.origin;
}

function hasClass(element: Element, className: string): boolean {
  return element.properties.className?.includes(className) ?? false;
}

function externalIcon(): Element {
  return {
    type: "element",
    tagName: "svg",
    properties: {
      ariaHidden: "true",
      className: [EXTERNAL_LINK_ICON_CLASS],
      fill: "none",
      focusable: "false",
      stroke: "currentColor",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: 1.5,
      viewBox: "0 0 16 16",
    },
    children: [{
      type: "element",
      tagName: "path",
      properties: {
        d: "M8.5 2.5h5v5m0-5-6 6M12 9v3.25a1.25 1.25 0 0 1-1.25 1.25h-7A1.25 1.25 0 0 1 2.5 12.25v-7A1.25 1.25 0 0 1 3.75 4H7",
      },
      children: [],
    }],
  };
}

function externalLabel(): Element {
  return {
    type: "element",
    tagName: "span",
    properties: { className: ["visually-hidden"] },
    children: [{ type: "text", value: "external site" }],
  };
}

function annotate(anchor: Element): void {
  if (!hasClass(anchor, EXTERNAL_LINK_CLASS)) {
    anchor.properties.className = [
      ...(anchor.properties.className ?? []),
      EXTERNAL_LINK_CLASS,
    ];
  }
  if (!anchor.children.some(
    (child) => child.type === "element" && hasClass(child, EXTERNAL_LINK_ICON_CLASS),
  )) {
    anchor.children.push(externalIcon());
  }
  if (!anchor.children.some(
    (child) =>
      child.type === "element" &&
      child.tagName === "span" &&
      hasClass(child, "visually-hidden") &&
      child.children.some((label) => label.type === "text" && label.value === "external site"),
  )) {
    anchor.children.push(externalLabel());
  }
}

function visit(node: Root | RootContent, site?: string | URL): void {
  if (node.type !== "root" && node.type !== "element") return;
  if (
    node.type === "element" &&
    node.tagName === "a" &&
    typeof node.properties.href === "string" &&
    isExternalHref(node.properties.href, site)
  ) {
    annotate(node);
  }
  for (const child of node.children) visit(child, site);
}

/** Annotates external links in a parsed HAST tree without changing navigation behavior. */
export function rehypeExternalLinks(options: RehypeExternalLinksOptions = {}) {
  return (tree: Root) => visit(tree, options.site);
}
