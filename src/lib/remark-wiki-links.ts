import path from "node:path";
import type { Link, PhrasingContent, Root, Text } from "mdast";
import type { VFile } from "vfile";
import { getLinkIndex } from "./link-index";
import { transformTextNodes } from "./mdast-text";
import { resolveWikiLinkTarget, type LinkIndex, type VaultNote } from "./vault-scan";
import { displayText, parseWikiLinks, type WikiLink } from "./wiki-links";
import { slugify } from "./slugify";
import { joinBase, withFragment } from "./routes";
import { getWorkspaceSnapshot } from "./vault-state";

export interface RemarkWikiLinksOptions {
  /** Injectable for tests; defaults to the shared workspace link index. */
  index?: LinkIndex;
  /** Deployment base applied when the Markdown link is rendered. */
  base?: string;
  /** Narrows synthetic test fixtures whose paths do not identify an owner. */
  sourceBrainId?: string;
  /** Injectable presentation metadata for workspace rendering tests. */
  brainAccents?: ReadonlyMap<string, string>;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findSource(index: LinkIndex, file: VFile, brainId?: string): VaultNote | undefined {
  const source = file.path ? path.resolve(file.path) : "";
  return index.notes.find(
    (note) =>
      path.resolve(note.filePath) === source &&
      (brainId === undefined || note.brainId === brainId),
  );
}

function unwrittenNode(
  link: WikiLink,
  kind: "missing-note" | "unknown-brain",
  brainId: string,
  sourceBrainId: string | undefined,
  accent: string | undefined,
): PhrasingContent {
  const text = displayText(link);
  const unknownClass = kind === "unknown-brain" ? " wiki-link--unknown-brain" : "";
  const foreign = sourceBrainId !== undefined && brainId !== sourceBrainId;
  const foreignClass = foreign ? " wiki-link--foreign" : "";
  const title = kind === "unknown-brain"
    ? `Unknown brain: ${brainId}`
    : `Not yet written in @${brainId}: ${link.target}`;
  const marker = kind === "unknown-brain" ? "?" : "↗";
  const badge = foreign
    ? `<span class="brain-badge"><span aria-hidden="true">${marker}</span> @${escapeHtml(brainId)}</span>`
    : "";
  const style = accent ? ` style="--brain-accent: ${escapeHtml(accent)}"` : "";
  return {
    type: "html",
    value:
      `<span class="wiki-link wiki-link--unwritten${foreignClass}${unknownClass}"${style} ` +
      `data-brain-id="${escapeHtml(brainId)}" title="${escapeHtml(title)}">` +
      `<span>${escapeHtml(text)}</span>${badge}</span>`,
  };
}

function toLinkNode(
  link: WikiLink,
  index: LinkIndex,
  source: VaultNote | undefined,
  base: string,
  brainAccents: ReadonlyMap<string, string>,
): PhrasingContent {
  if (!source) {
    const brainId = link.targetBrainId ?? "unknown";
    return unwrittenNode(link, "missing-note", brainId, undefined, brainAccents.get(brainId));
  }
  const resolution = resolveWikiLinkTarget(index, source.brainId, link);
  if (resolution.kind !== "resolved") {
    return unwrittenNode(
      link,
      resolution.kind,
      resolution.targetBrainId,
      source.brainId,
      brainAccents.get(resolution.targetBrainId),
    );
  }

  const route = withFragment(resolution.note.route, link.anchor ? slugify(link.anchor) : "");
  const foreign = resolution.note.brainId !== source.brainId;
  const node: Link = {
    type: "link",
    url: joinBase(base, route),
    children: [
      { type: "text", value: displayText(link) },
      ...(foreign
        ? [{
            type: "html" as const,
            value: `<span class="brain-badge"><span aria-hidden="true">↗</span> @${escapeHtml(resolution.targetBrainId)}</span>`,
          }]
        : []),
    ],
    data: {
      hProperties: {
        className: ["wiki-link", ...(foreign ? ["wiki-link--foreign"] : [])],
        ...(foreign ? {
          "data-brain-id": resolution.targetBrainId,
          style: `--brain-accent: ${brainAccents.get(resolution.targetBrainId) ?? "var(--accent)"}`,
        } : {}),
      },
    },
  };
  return node;
}

function splitTextNode(
  node: Text,
  index: LinkIndex,
  source: VaultNote | undefined,
  base: string,
  brainAccents: ReadonlyMap<string, string>,
): PhrasingContent[] {
  const links = parseWikiLinks(node.value);
  if (links.length === 0) return [node];

  const out: PhrasingContent[] = [];
  let cursor = 0;
  for (const link of links) {
    if (link.index > cursor) out.push({ type: "text", value: node.value.slice(cursor, link.index) });
    out.push(toLinkNode(link, index, source, base, brainAccents));
    cursor = link.index + link.length;
  }
  if (cursor < node.value.length) out.push({ type: "text", value: node.value.slice(cursor) });
  return out;
}

function potentialTargets(index: LinkIndex, source: VaultNote | undefined): VaultNote[] {
  if (!source) return [];
  const targets: VaultNote[] = [];
  for (const [targetId, sources] of index.unlinkedMentions) {
    if (!sources.some((candidate) => candidate.id === source.id)) continue;
    const target = index.byId.get(targetId);
    if (target) targets.push(target);
  }
  return targets.sort((a, b) => b.title.length - a.title.length || a.title.localeCompare(b.title));
}

function splitPotentialLinks(node: Text, targets: readonly VaultNote[]): PhrasingContent[] {
  if (targets.length === 0) return [node];
  const byTitle = new Map(targets.map((target) => [target.title.toLowerCase(), target]));
  const pattern = new RegExp(`\\b(${targets.map((target) => escapeRegExp(target.title)).join("|")})\\b`, "gi");
  const matches = [...node.value.matchAll(pattern)];
  if (matches.length === 0) return [node];

  const out: PhrasingContent[] = [];
  let cursor = 0;
  for (const match of matches) {
    const index = match.index;
    const target = byTitle.get(match[0].toLowerCase());
    if (!target) continue;
    if (index > cursor) out.push({ type: "text", value: node.value.slice(cursor, index) });
    const label = `Potential link to ${target.title}. This is plain text, not an authored link.`;
    out.push({
      type: "html",
      value: `<span class="potential-link" tabindex="0" aria-label="${escapeHtml(label)}" data-potential-link-label="${escapeHtml(label)}">${escapeHtml(match[0])}</span>`,
    });
    cursor = index + match[0].length;
  }
  if (cursor < node.value.length) out.push({ type: "text", value: node.value.slice(cursor) });
  return out;
}

export function remarkWikiLinks(options: RemarkWikiLinksOptions = {}) {
  const base = options.base ?? "";
  return (tree: Root, file: VFile) => {
    const index = options.index ?? getLinkIndex();
    const source = findSource(index, file, options.sourceBrainId);
    const brainAccents = options.brainAccents ?? new Map(
      getWorkspaceSnapshot().registry.brains.map((brain) => [brain.id, brain.accent]),
    );
    transformTextNodes(tree, (node) => splitTextNode(node, index, source, base, brainAccents));
    const targets = potentialTargets(index, source);
    transformTextNodes(tree, (node) => splitPotentialLinks(node, targets));
  };
}
