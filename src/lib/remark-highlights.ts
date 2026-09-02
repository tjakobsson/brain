import type { Emphasis, PhrasingContent, Root, Text } from "mdast";
import type { VFile } from "vfile";
import { transformTextNodes } from "./mdast-text";

const HIGHLIGHT_RE = /==([^=]+?)==/g;

export interface HighlightSegment {
  value: string;
  highlighted: boolean;
}

export function splitHighlightText(value: string): HighlightSegment[] {
  const matches = [...value.matchAll(HIGHLIGHT_RE)];
  if (matches.length === 0) return [{ value, highlighted: false }];

  const segments: HighlightSegment[] = [];
  let cursor = 0;
  for (const match of matches) {
    const index = match.index;
    if (index > cursor) {
      segments.push({ value: value.slice(cursor, index), highlighted: false });
    }
    segments.push({ value: match[1], highlighted: true });
    cursor = index + match[0].length;
  }
  if (cursor < value.length) {
    segments.push({ value: value.slice(cursor), highlighted: false });
  }
  return segments;
}

function splitHighlights(node: Text): PhrasingContent[] {
  const segments = splitHighlightText(node.value);
  if (segments.length === 1 && !segments[0].highlighted) return [node];
  return segments.map(({ value, highlighted }) => highlighted
    ? {
        type: "emphasis",
        children: [{ type: "text", value }],
        data: { hName: "mark" },
      } satisfies Emphasis
    : { type: "text", value });
}

/** Renders Brain `==highlighted text==` syntax as `<mark>`. */
export function remarkHighlights() {
  return (tree: Root, _file: VFile) => {
    transformTextNodes(tree, splitHighlights, {
      skipRawHtmlContainers: "non-rendered",
      skipLinks: false,
    });
  };
}
