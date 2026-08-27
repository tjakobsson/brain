/**
 * Shared parser for Obsidian-style wiki-links:
 *   [[Note Title]]            → target only
 *   [[Note Title|alias]]      → alias = display text
 *   [[Note Title#Heading]]    → anchor into the target note
 *   [[Note Title#H|alias]]    → both
 *
 * Used by BOTH the vault scanner (link index) and the remark plugin
 * (rendering) so the syntax can never drift between the two.
 */

export interface WikiLink {
  /** The full raw match, e.g. "[[Note Title#Heading|alias]]". */
  raw: string;
  /** Note title being linked (case preserved). */
  target: string;
  /** Heading anchor within the target, or null. */
  anchor: string | null;
  /** Display-text alias, or null. */
  alias: string | null;
  /** Character offset of the match in the source text. */
  index: number;
  /** Length of the raw match. */
  length: number;
}

const WIKI_LINK_RE = /(?<!!)\[\[([^\]|#\n]+?)(?:#([^\]|\n]+?))?(?:\|([^\]\n]+?))?\]\]/g;

export function parseWikiLinks(text: string): WikiLink[] {
  const links: WikiLink[] = [];
  for (const match of text.matchAll(WIKI_LINK_RE)) {
    links.push({
      raw: match[0],
      target: match[1].trim(),
      anchor: match[2]?.trim() ?? null,
      alias: match[3]?.trim() ?? null,
      index: match.index,
      length: match[0].length,
    });
  }
  return links;
}

/** What a reader sees for a wiki-link: the alias if present, else the target. */
export function displayText(link: WikiLink): string {
  return link.alias ?? link.target;
}

/** Replace every wiki-link with its display text (what a reader sees). */
export function wikiLinksToText(text: string): string {
  return text.replace(WIKI_LINK_RE, (_raw, target: string, _anchor: string | undefined, alias: string | undefined) =>
    (alias ?? target).trim(),
  );
}

/** Remove fenced code blocks and inline code spans. */
export function stripCode(text: string): string {
  return text.replace(/```[\s\S]*?(?:```|$)/g, " ").replace(/`[^`\n]*`/g, " ");
}

/** Reduce markdown links/images to their visible text. */
export function stripMarkdownLinks(text: string): string {
  return text.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1");
}
