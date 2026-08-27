import type { Link, PhrasingContent, Root, Text } from "mdast";
import type { VFile } from "vfile";
import { getLinkIndex } from "./link-index";
import { transformTextNodes } from "./mdast-text";
import type { LinkIndex } from "./vault-scan";
import { displayText, parseWikiLinks, type WikiLink } from "./wiki-links";
import { slugify } from "./slugify";
import { joinBase, withFragment } from "./routes";

export interface RemarkWikiLinksOptions {
  /** Injectable for tests; defaults to the shared Phase-1 link index. */
  index?: LinkIndex;
  /** Deployment base applied when the Markdown link is rendered. */
  base?: string;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function toLinkNode(link: WikiLink, index: LinkIndex, file: VFile, base: string): PhrasingContent {
  const target = index.byTitleKey.get(link.target.toLowerCase());
  const text = displayText(link);

  if (!target) {
    const node: PhrasingContent = {
      type: "html",
      value:
        `<span class="wiki-link wiki-link--unwritten" ` +
        `title="Not yet written: ${escapeHtml(link.target)}">${escapeHtml(text)}</span>`,
    };
    return node;
  }

  const route = withFragment(target.route, link.anchor ? slugify(link.anchor) : "");
  const node: Link = {
    type: "link",
    url: joinBase(base, route),
    children: [{ type: "text", value: text }],
    data: { hProperties: { className: ["wiki-link"] } },
  };
  return node;
}

function splitTextNode(node: Text, index: LinkIndex, file: VFile, base: string): PhrasingContent[] {
  const links = parseWikiLinks(node.value);
  if (links.length === 0) return [node];

  const out: PhrasingContent[] = [];
  let cursor = 0;
  for (const link of links) {
    if (link.index > cursor) {
      out.push({ type: "text", value: node.value.slice(cursor, link.index) });
    }
    out.push(toLinkNode(link, index, file, base));
    cursor = link.index + link.length;
  }
  if (cursor < node.value.length) {
    out.push({ type: "text", value: node.value.slice(cursor) });
  }
  return out;
}

function processChildren(tree: Root, index: LinkIndex, file: VFile, base: string): void {
  transformTextNodes(tree, (node) => splitTextNode(node, index, file, base));
}

/**
 * Phase 2: resolve Obsidian wiki-links against the Phase-1 link index.
 * Resolvable → real anchor; unresolvable → "unwritten" span + build warning.
 */
export function remarkWikiLinks(options: RemarkWikiLinksOptions = {}) {
  const base = options.base ?? "";
  return (tree: Root, file: VFile) => {
    const index = options.index ?? getLinkIndex();
    processChildren(tree, index, file, base);
  };
}
