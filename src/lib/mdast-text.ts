import type { Content, Parent, PhrasingContent, Root, Text } from "mdast";

/** Splits a text node into zero or more replacement nodes. */
export type TextSplitter = (node: Text) => PhrasingContent[];

export interface TransformTextOptions {
  skipRawHtmlContainers?: "all" | "unsafe" | "non-rendered";
  skipLinks?: boolean;
}

const VOID_HTML_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param",
  "source", "track", "wbr",
]);

const NON_RENDERED_RAW_HTML_ELEMENTS = new Set([
  "datalist", "head", "iframe", "noembed", "noframes", "noscript", "option", "plaintext", "script",
  "select", "style", "template", "textarea", "title", "xmp",
]);

const UNSAFE_RAW_HTML_ELEMENTS = new Set([
  ...NON_RENDERED_RAW_HTML_ELEMENTS,
  "a",
  "button",
]);

export function updateRawHtmlStack(value: string, stack: string[]): void {
  const tokens = value.matchAll(
    /<!--[\s\S]*?(?:-->|$)|<!\[CDATA\[[\s\S]*?(?:\]\]>|$)|<![^>]*>|<\?[\s\S]*?(?:\?>|$)|<\s*(\/)?\s*([A-Za-z][\w:-]*)\b(?:[^>"']|"[^"]*"|'[^']*')*>/g,
  );
  for (const match of tokens) {
    if (!match[2]) continue;
    const tag = match[2].toLowerCase();
    if (match[1]) {
      const openingIndex = stack.lastIndexOf(tag);
      if (openingIndex >= 0) stack.splice(openingIndex);
    } else if (!VOID_HTML_ELEMENTS.has(tag) && !/\/\s*>$/.test(match[0])) {
      stack.push(tag);
    }
  }
}

export function hasUnsafeRawHtmlContainer(stack: readonly string[]): boolean {
  return stack.some((tag) => UNSAFE_RAW_HTML_ELEMENTS.has(tag));
}

function hasNonRenderedRawHtmlContainer(stack: readonly string[]): boolean {
  return stack.some((tag) => NON_RENDERED_RAW_HTML_ELEMENTS.has(tag));
}

/**
 * Walks an mdast tree, applying `split` to every text node and splicing the
 * results in place. By default, it does not descend into links or images,
 * since transforms that create interactive content must not nest it in anchors.
 */
export function transformTextNodes(
  tree: Root,
  split: TextSplitter,
  options: TransformTextOptions = {},
): void {
  processChildren(
    tree,
    split,
    options.skipRawHtmlContainers ?? "all",
    options.skipLinks ?? true,
  );
}

function processChildren(
  parent: Parent,
  split: TextSplitter,
  skipRawHtmlContainers: "all" | "unsafe" | "non-rendered",
  skipLinks: boolean,
): void {
  const next: Content[] = [];
  const rawHtmlStack: string[] = [];
  for (const child of parent.children) {
    if (child.type === "html") {
      updateRawHtmlStack(child.value, rawHtmlStack);
      next.push(child);
    } else if (
      child.type === "text" &&
      !insideSkippedRawHtml(rawHtmlStack, skipRawHtmlContainers)
    ) {
      next.push(...split(child as Text));
    } else {
      const insideSkippedHtml = insideSkippedRawHtml(rawHtmlStack, skipRawHtmlContainers);
      if (
        !insideSkippedHtml &&
        (!skipLinks || child.type !== "link") &&
        child.type !== "image" &&
        (!skipLinks || child.type !== "linkReference") &&
        child.type !== "imageReference" &&
        "children" in child
      ) {
        processChildren(child as unknown as Parent, split, skipRawHtmlContainers, skipLinks);
      }
      next.push(child);
    }
  }
  parent.children = next;
}

function insideSkippedRawHtml(
  stack: readonly string[],
  policy: "all" | "unsafe" | "non-rendered",
): boolean {
  if (policy === "unsafe") return hasUnsafeRawHtmlContainer(stack);
  if (policy === "non-rendered") return hasNonRenderedRawHtmlContainer(stack);
  return stack.length > 0;
}
