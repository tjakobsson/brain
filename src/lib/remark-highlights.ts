import type { Html, PhrasingContent, Root, Text } from "mdast";
import type { VFile } from "vfile";
import { transformTextNodes } from "./mdast-text";

const HIGHLIGHT_RE = /==([^=]+?)==/g;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function splitHighlights(node: Text): PhrasingContent[] {
  const matches = [...node.value.matchAll(HIGHLIGHT_RE)];
  if (matches.length === 0) return [node];

  const out: PhrasingContent[] = [];
  let cursor = 0;
  for (const match of matches) {
    const index = match.index;
    if (index > cursor) {
      out.push({ type: "text", value: node.value.slice(cursor, index) });
    }
    const mark: Html = { type: "html", value: `<mark>${escapeHtml(match[1])}</mark>` };
    out.push(mark);
    cursor = index + match[0].length;
  }
  if (cursor < node.value.length) {
    out.push({ type: "text", value: node.value.slice(cursor) });
  }
  return out;
}

/** Renders Brain `==highlighted text==` syntax as `<mark>`. */
export function remarkHighlights() {
  return (tree: Root, _file: VFile) => {
    transformTextNodes(tree, splitHighlights);
  };
}
