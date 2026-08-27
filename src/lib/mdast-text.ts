import type { Content, Parent, PhrasingContent, Root, Text } from "mdast";

/** Splits a text node into zero or more replacement nodes. */
export type TextSplitter = (node: Text) => PhrasingContent[];

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
  for (const child of parent.children) {
    if (child.type === "text") {
      next.push(...split(child as Text));
    } else {
      if (child.type !== "link" && child.type !== "image" && "children" in child) {
        processChildren(child as unknown as Parent, split);
      }
      next.push(child);
    }
  }
  parent.children = next;
}
