import type { Nodes, Parent } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";

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

function hasOnlySoftBreaks(value: string): boolean {
  if (!value.includes("\n")) return true;
  if (/\r(?!\n)/.test(value) || /\n[\t ]*\r?\n/.test(value)) return false;
  if (/(?:[\t ]{2,}|\\)\r?\n/.test(value)) return false;
  return !/\r?\n(?: {4}|\t| {0,3}(?:#{1,6}(?:[\t ]|$)|>|(?:[-+*]|\d+[.)])[\t ]+|\[[^\]\r\n]+\]:[\t ]*|(?:(?:\*[\t ]*){3,}|(?:_[\t ]*){3,}|(?:-[\t ]*){3,})(?=\r?\n|$)|(?:=+|-+)[\t ]*(?=\r?\n|$)|`{3,}|~{3,}|<))/.test(value);
}

function normalizeField(value: string): string {
  return value.replace(/[\t ]*\r?\n[\t ]*/g, " ").trim();
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

export function parseWikiLinks(text: string): WikiLink[] {
  const links: WikiLink[] = [];
  let searchIndex = 0;
  while (searchIndex < text.length) {
    WIKI_LINK_RE.lastIndex = searchIndex;
    const match = WIKI_LINK_RE.exec(text);
    if (!match) break;
    searchIndex = match.index + match[0].length;

    if (!hasOnlySoftBreaks(match[0])) {
      const nestedOffset = match[0].indexOf("[[", 2);
      if (nestedOffset >= 0) searchIndex = match.index + nestedOffset;
      continue;
    }
    const target = parseTarget(normalizeField(match[1]));
    if (!target) {
      const nestedOffset = match[0].indexOf("[[", 2);
      if (nestedOffset >= 0) searchIndex = match.index + nestedOffset;
      continue;
    }

    links.push({
      raw: match[0],
      ...target,
      anchor: match[2] === undefined ? null : normalizeField(match[2]),
      alias: match[3] === undefined ? null : normalizeField(match[3]),
      index: match.index,
      length: match[0].length,
    });
  }
  WIKI_LINK_RE.lastIndex = 0;
  return links;
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
  const tree = fromMarkdown(text);

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
  const tree = fromMarkdown(text);

  function mask(start: number, end: number): void {
    for (let index = start; index < end; index += 1) {
      if (masked[index] !== "\n" && masked[index] !== "\r") masked[index] = " ";
    }
  }

  for (const match of text.matchAll(/<a\b[^>]*>[\s\S]*?<\/a\s*>/gi)) {
    mask(match.index, match.index + match[0].length);
  }

  function visit(node: Nodes): void {
    if (node.type === "link" || node.type === "image") {
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
