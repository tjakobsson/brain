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

const WIKI_LINK_RE = /(?<!!)\[\[([^\]|#\n]+?)(?:#([^\]|\n]+?))?(?:\|([^\]\n]+?))?\]\]/g;
const BRAIN_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
  for (const match of text.matchAll(WIKI_LINK_RE)) {
    const target = parseTarget(match[1]);
    if (!target) continue;

    links.push({
      raw: match[0],
      ...target,
      anchor: match[2]?.trim() ?? null,
      alias: match[3]?.trim() ?? null,
      index: match.index,
      length: match[0].length,
    });
  }
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

/** Remove fenced code blocks and inline code spans. */
export function stripCode(text: string): string {
  return text.replace(/```[\s\S]*?(?:```|$)/g, " ").replace(/`[^`\n]*`/g, " ");
}

/** Reduce markdown links/images to their visible text. */
export function stripMarkdownLinks(text: string): string {
  return text.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1");
}
