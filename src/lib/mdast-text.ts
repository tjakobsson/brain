import type { Content, Parent, PhrasingContent, Root, Text } from "mdast";

/** Splits a text node into zero or more replacement nodes. */
export type TextSplitter = (node: Text) => PhrasingContent[];

const VOID_HTML_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param",
  "source", "track", "wbr",
]);

function updateRawHtmlStack(value: string, stack: string[]): void {
  for (const match of value.matchAll(/<\s*(\/)?\s*([A-Za-z][\w:-]*)\b[^>]*>/g)) {
    const tag = match[2].toLowerCase();
    if (match[1]) {
      const openingIndex = stack.lastIndexOf(tag);
      if (openingIndex >= 0) stack.splice(openingIndex);
    } else if (!VOID_HTML_ELEMENTS.has(tag) && !/\/\s*>$/.test(match[0])) {
      stack.push(tag);
    }
  }
}

/**
 * Walks an mdast tree, applying `split` to every text node and splicing the
 * results in place. Never descends into existing links or images — nesting
 * interactive content inside an anchor produces invalid HTML.
 */
export function transformTextNodes(tree: Root, split: TextSplitter): void {
  processChildren(tree, split);
}

function processChildren(parent: Parent, split: TextSplitter): void {
  const next: Content[] = [];
  const rawHtmlStack: string[] = [];
  for (const child of parent.children) {
    if (child.type === "html") {
      updateRawHtmlStack(child.value, rawHtmlStack);
      next.push(child);
    } else if (child.type === "text" && rawHtmlStack.length === 0) {
      next.push(...split(child as Text));
    } else {
      if (
        rawHtmlStack.length === 0 &&
        child.type !== "link" &&
        child.type !== "image" &&
        child.type !== "linkReference" &&
        child.type !== "imageReference" &&
        "children" in child
      ) {
        processChildren(child as unknown as Parent, split);
      }
      next.push(child);
    }
  }
  parent.children = next;
}
