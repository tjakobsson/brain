import type { Nodes, Parent, Root } from "mdast";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfm } from "micromark-extension-gfm";

/**
 * Shared parser for Brain wiki-links:
 *   [[Note Title]]                     -> local target
 *   [[Note Title|alias]]               -> alias = display text
 *   [[Note Title#Heading]]             -> anchor into the target note
 *   [[@brain-id/Note Title#H|alias]]   -> target in another brain
 *
 * Used by BOTH the vault scanner (link index) and the remark plugin
 * (rendering) so the syntax can never drift between the two.
 */

export interface WikiLink {
  /** The full raw match, e.g. "[[Note Title#Heading|alias]]". */
  raw: string;
  /** Note title being linked (case preserved). */
  target: string;
  /** Explicit target brain ID, or null when the link is local to its source brain. */
  targetBrainId: string | null;
  /** Heading anchor within the target, or null. */
  anchor: string | null;
  /** Display-text alias, or null. */
  alias: string | null;
  /** Character offset of the match in the source text. */
  index: number;
  /** Length of the raw match. */
  length: number;
}

const WIKI_LINK_RE = /(?<!!)\[\[([^\]|#]+?)(?:#([^\]|]+?))?(?:\|([^\]]+?))?\]\]/g;
const BRAIN_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function parseMarkdown(text: string): Root {
  return fromMarkdown(text, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });
}

function hasOnlySoftBreaks(value: string): boolean {
  if (!value.includes("\n")) return true;
  if (/\r(?!\n)/.test(value) || /\n[\t ]*\r?\n/.test(value)) return false;
  if (/(?:[\t ]{2,}|\\)\r?\n/.test(value)) return false;
  if (/\r?\n(?: {4}|\t)/.test(value)) return false;
  const tree = parseMarkdown(value);
  return tree.children.length === 1 &&
    tree.children[0].type === "paragraph" &&
    tree.children[0].children.length === 1 &&
    tree.children[0].children[0].type === "text";
}

function normalizeField(value: string): string {
  return value.replace(/[\t ]*\r?\n[\t ]*/g, " ").trim();
}

function blockquoteDepth(linePrefix: string): number {
  let depth = 0;
  let rest = linePrefix;
  while (true) {
    const marker = /^ {0,3}>[\t ]?/.exec(rest);
    if (!marker) return depth;
    depth += 1;
    rest = rest.slice(marker[0].length);
  }
}

function stripBlockquotePrefixes(value: string, depth: number): string {
  if (depth === 0 || !value.includes("\n")) return value;
  return value.replace(/\r?\n([^\r\n]*)/g, (lineBreak, line: string) => {
    let rest = line;
    for (let level = 0; level < depth; level += 1) {
      const marker = /^ {0,3}>[\t ]?/.exec(rest);
      if (!marker) return lineBreak;
      rest = rest.slice(marker[0].length);
    }
    return `\n${rest}`;
  });
}

function parseTarget(value: string): Pick<WikiLink, "target" | "targetBrainId"> | null {
  const target = value.trim();
  if (!target.startsWith("@")) return { target, targetBrainId: null };

  const slash = target.indexOf("/");
  if (slash < 2) return null;

  const targetBrainId = target.slice(1, slash);
  const namespacedTarget = target.slice(slash + 1).trim();
  if (!BRAIN_ID_RE.test(targetBrainId) || namespacedTarget.length === 0 || namespacedTarget.includes("/")) {
    return null;
  }

  return { target: namespacedTarget, targetBrainId };
}

function parseWikiLinksInRanges(
  text: string,
  textRanges: readonly { start: number; end: number }[] | null,
): WikiLink[] {
  const links: WikiLink[] = [];
  let searchIndex = 0;
  while (searchIndex < text.length) {
    WIKI_LINK_RE.lastIndex = searchIndex;
    const match = WIKI_LINK_RE.exec(text);
    if (!match) break;
    searchIndex = match.index + match[0].length;
    const lineStart = text.lastIndexOf("\n", match.index) + 1;
    const quoteDepth = blockquoteDepth(text.slice(lineStart, match.index));
    const candidate = stripBlockquotePrefixes(match[0], quoteDepth);
    const matchEnd = match.index + match[0].length;
    const insideTextNode = textRanges?.some(({ start, end }) =>
      start <= match.index && end >= matchEnd
    ) ?? false;

    if (
      (textRanges !== null && !insideTextNode) ||
      (textRanges === null && !hasOnlySoftBreaks(candidate))
    ) {
      const nestedOffset = match[0].indexOf("[[", 2);
      if (nestedOffset >= 0) searchIndex = match.index + nestedOffset;
      continue;
    }
    const target = parseTarget(normalizeField(stripBlockquotePrefixes(match[1], quoteDepth)));
    if (!target) {
      const nestedOffset = match[0].indexOf("[[", 2);
      if (nestedOffset >= 0) searchIndex = match.index + nestedOffset;
      continue;
    }

    links.push({
      raw: match[0],
      ...target,
      anchor: match[2] === undefined
        ? null
        : normalizeField(stripBlockquotePrefixes(match[2], quoteDepth)),
      alias: match[3] === undefined
        ? null
        : normalizeField(stripBlockquotePrefixes(match[3], quoteDepth)),
      index: match.index,
      length: match[0].length,
    });
  }
  WIKI_LINK_RE.lastIndex = 0;
  return links;
}

export function parseWikiLinks(text: string): WikiLink[] {
  return parseWikiLinksInRanges(text, null);
}

/** Parse only source ranges that Astro's GFM parser exposes as renderable text nodes. */
export function parseMarkdownWikiLinks(text: string): WikiLink[] {
  const ranges: { start: number; end: number }[] = [];
  const tree = parseMarkdown(text);

  function visit(node: Nodes): void {
    if (
      node.type === "link" ||
      node.type === "image" ||
      node.type === "linkReference" ||
      node.type === "imageReference"
    ) return;
    if (
      node.type === "text" &&
      node.position?.start.offset !== undefined &&
      node.position.end.offset !== undefined
    ) {
      ranges.push({ start: node.position.start.offset, end: node.position.end.offset });
      return;
    }
    if ("children" in node) {
      for (const child of (node as Parent).children) visit(child);
    }
  }

  visit(tree);
  return parseWikiLinksInRanges(text, ranges);
}

/** Link text only; renderers identify a foreign target separately from its title. */
export function displayText(link: WikiLink): string {
  return link.alias ?? link.target;
}

/** Replace every wiki-link with its display text (what a reader sees). */
export function wikiLinksToText(text: string): string {
  const links = parseWikiLinks(text);
  if (links.length === 0) return text;

  let result = "";
  let cursor = 0;
  for (const link of links) {
    result += text.slice(cursor, link.index) + displayText(link);
    cursor = link.index + link.length;
  }
  return result + text.slice(cursor);
}

/** Remove code and raw HTML nodes skipped by remark text transforms. */
export function stripCode(text: string): string {
  const masked = text.split("");
  const tree = parseMarkdown(text);

  function visit(node: Nodes): void {
    if (node.type === "code" || node.type === "inlineCode" || node.type === "html") {
      const start = node.position?.start.offset ?? 0;
      const end = node.position?.end.offset ?? start;
      for (let index = start; index < end; index += 1) {
        if (masked[index] !== "\n" && masked[index] !== "\r") masked[index] = " ";
      }
      return;
    }
    if ("children" in node) {
      for (const child of (node as Parent).children) visit(child);
    }
  }

  visit(tree);
  return masked.join("");
}

/** Remove authored wiki-links and Markdown links from mention-search prose. */
export function stripAuthoredLinks(text: string): string {
  const masked = text.split("");
  const tree = parseMarkdown(text);

  function mask(start: number, end: number): void {
    for (let index = start; index < end; index += 1) {
      if (masked[index] !== "\n" && masked[index] !== "\r") masked[index] = " ";
    }
  }

  for (const match of text.matchAll(/<a\b[^>]*>[\s\S]*?<\/a\s*>/gi)) {
    mask(match.index, match.index + match[0].length);
  }

  function visit(node: Nodes): void {
    if (
      node.type === "link" ||
      node.type === "image" ||
      node.type === "linkReference" ||
      node.type === "imageReference" ||
      node.type === "definition"
    ) {
      const start = node.position?.start.offset ?? 0;
      mask(start, node.position?.end.offset ?? start);
      return;
    }
    if ("children" in node) {
      for (const child of (node as Parent).children) visit(child);
    }
  }

  visit(tree);
  const withoutMarkdownLinks = masked.join("");
  for (const link of parseWikiLinks(withoutMarkdownLinks)) {
    mask(link.index, link.index + link.length);
  }
  return masked.join("");
}

/** Reduce markdown links/images to their visible text. */
export function stripMarkdownLinks(text: string): string {
  return text.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1");
}
