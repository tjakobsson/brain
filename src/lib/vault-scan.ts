import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { VAULT_DIR } from "./vault-path";
import {
  markdownWikiLinksToText,
  parseMarkdownWikiLinks,
  stripAuthoredLinks,
  stripCode,
  stripMarkdownLinks,
  type WikiLink,
} from "./wiki-links";
import { slugify } from "./slugify";
import { routesFor, type LogicalRoute } from "./routes";
import { createVaultManifest, type VaultManifest } from "./vault-manifest";
import {
  parseAttachmentReferences,
  type AttachmentReference,
} from "./attachment-references";
import { compositeNoteId, noteId, SINGLE_BRAIN_ID, type InputMode } from "./note-identity";

export { VAULT_DIR } from "./vault-path";

/** Titles shorter than this are never matchable as unlinked mentions (noise floor). */
const MIN_MENTION_TITLE_LENGTH = 4;

export interface NoteMeta {
  type: "fleeting" | "literature" | "permanent";
  status: "draft" | "developing" | "established";
  tags: string[];
  created?: string;
  updated?: string;
}

export interface VaultNote {
  /** Public collection and graph identity. Kept as the slug in single-vault mode. */
  id: string;
  /** Stable ownership boundary for titles, links, mentions, and attachments. */
  brainId: string;
  /** Globally unique tuple identity, including in single-vault mode. */
  compositeId: string;
  slug: string;
  /** Filename stem — the canonical identity and link target. */
  title: string;
  route: LogicalRoute;
  filePath: string;
  meta: NoteMeta;
  /** Markdown body without frontmatter. */
  body: string;
  links: WikiLink[];
  vaultPath: string;
  source: string;
  frontmatter: Record<string, unknown>;
  attachments: AttachmentReference[];
}

export interface Backlink {
  source: VaultNote;
  sourceBrainId: string;
  targetBrainId: string;
  /** The line of prose the link appears in, wiki syntax reduced to display text. */
  context: string;
}

export interface UnresolvedLink {
  kind: "missing-note" | "unknown-brain";
  sourceBrainId: string;
  targetBrainId: string;
  /** File containing the link. */
  source: string;
  raw: string;
  target: string;
}

export interface LinkEdge {
  source: string;
  target: string;
  sourceBrainId: string;
  targetBrainId: string;
  crossBrain: boolean;
}

export interface LinkIndex {
  notes: VaultNote[];
  byId: Map<string, VaultNote>;
  byBrainAndTitleKey: Map<string, Map<string, VaultNote>>;
  byTitleKey: Map<string, VaultNote>;
  /** Resolved links only, deduplicated, no self-loops. */
  edges: LinkEdge[];
  /** Target note ID -> linking notes with context. */
  backlinks: Map<string, Backlink[]>;
  /** Target note ID -> same-brain notes that mention the title without linking. */
  unlinkedMentions: Map<string, VaultNote[]>;
  /** Notes with zero inbound links. */
  orphans: VaultNote[];
  /** Wiki-links whose target does not exist. Reported as build warnings. */
  unresolved: UnresolvedLink[];
}

export interface BrainManifestInput {
  brainId: string;
  manifest: VaultManifest;
}

export type WikiLinkResolution =
  | { kind: "resolved"; targetBrainId: string; note: VaultNote }
  | { kind: "missing-note" | "unknown-brain"; targetBrainId: string };

export function resolveWikiLinkTarget(
  index: Pick<LinkIndex, "byBrainAndTitleKey">,
  sourceBrainId: string,
  link: WikiLink,
): WikiLinkResolution {
  const targetBrainId = link.targetBrainId ?? sourceBrainId;
  const targetBrain = index.byBrainAndTitleKey.get(targetBrainId);
  if (!targetBrain) return { kind: "unknown-brain", targetBrainId };
  const note = targetBrain.get(link.target.toLowerCase());
  return note
    ? { kind: "resolved", targetBrainId, note }
    : { kind: "missing-note", targetBrainId };
}

const NOTE_TYPES = ["fleeting", "literature", "permanent"] as const;
const NOTE_STATUSES = ["draft", "developing", "established"] as const;

function readMeta(data: Record<string, unknown>): NoteMeta {
  return {
    type: (NOTE_TYPES as readonly string[]).includes(String(data.type))
      ? (data.type as NoteMeta["type"])
      : "permanent",
    status: (NOTE_STATUSES as readonly string[]).includes(String(data.status))
      ? (data.status as NoteMeta["status"])
      : "draft",
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    created: data.created != null ? String(data.created) : undefined,
    updated: data.updated != null ? String(data.updated) : undefined,
  };
}

function extractContext(body: string, link: WikiLink): string {
  const lineStart = body.lastIndexOf("\n", link.index) + 1;
  const lineEndIdx = body.indexOf("\n", link.index + link.length);
  const lineEnd = lineEndIdx === -1 ? body.length : lineEndIdx;
  return markdownWikiLinksToText(stripMarkdownLinks(body.slice(lineStart, lineEnd)))
    .replace(/^(?:\s{0,3}(?:>\s*|[-+*]\s+|\d+[.)]\s+))+/, "")
    .trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Plain prose a mention can hide in, excluding code and authored links. */
function searchableText(body: string): string {
  return stripCode(stripAuthoredLinks(body)).replace(
    /^((?:(?: {0,3}>[\t ]*)|(?: {0,3}(?:[-+*]|\d+[.)])[\t ]+))*)\[![^\]\r\n]+\]/gim,
    (marker, prefix: string) => prefix.includes(">") ? " ".repeat(marker.length) : marker,
  );
}

function scanBrain(input: BrainManifestInput, mode: InputMode): VaultNote[] {
  const notes: VaultNote[] = input.manifest.entries
    .filter((entry) => entry.kind === "markdown")
    .map((entry) => {
      const source = fs.readFileSync(entry.absolutePath, "utf8");
      const { data, content } = matter(source);
      const title = path.basename(entry.path, path.extname(entry.path));
      const slug = slugify(title);
      const links = parseMarkdownWikiLinks(content);
      return {
        id: noteId(mode, input.brainId, slug),
        brainId: input.brainId,
        compositeId: compositeNoteId(input.brainId, slug),
        slug,
        title,
        route: routesFor({ mode, brainId: input.brainId }).note(slug),
        filePath: entry.absolutePath,
        meta: readMeta(data),
        body: content,
        links,
        vaultPath: entry.path,
        source,
        frontmatter: data,
        attachments: [],
      };
    });

  const byTitleKey = new Map<string, VaultNote>();
  for (const note of notes) {
    const key = note.title.toLowerCase();
    const existing = byTitleKey.get(key);
    if (existing) {
      throw new Error(
        `Duplicate note title "${note.title}" in brain "${input.brainId}":\n` +
          `  ${existing.filePath}\n  ${note.filePath}\n` +
          `Note titles must be unique within one brain.`,
      );
    }
    byTitleKey.set(key, note);
  }

  const noteTitles = new Set(byTitleKey.keys());
  for (const note of notes) {
    note.attachments = parseAttachmentReferences(note.source, noteTitles);
  }

  return notes;
}

export function buildWorkspaceLinkIndex(
  inputs: readonly BrainManifestInput[],
  mode: InputMode = "workspace",
): LinkIndex {
  const notes = inputs.flatMap((input) => scanBrain(input, mode));
  const byId = new Map(notes.map((note) => [note.id, note]));
  const byBrainAndTitleKey = new Map<string, Map<string, VaultNote>>();
  for (const input of inputs) byBrainAndTitleKey.set(input.brainId, new Map());
  for (const note of notes) {
    byBrainAndTitleKey.get(note.brainId)?.set(note.title.toLowerCase(), note);
  }
  // This compatibility map is authoritative only for single-vault callers.
  const byTitleKey = mode === "vault"
    ? (byBrainAndTitleKey.get(inputs[0]?.brainId ?? SINGLE_BRAIN_ID) ?? new Map())
    : new Map<string, VaultNote>();

  const edges: LinkEdge[] = [];
  const backlinks = new Map<string, Backlink[]>();
  const unresolved: UnresolvedLink[] = [];
  const unresolvedSeen = new Set<string>();
  const linkedPairs = new Set<string>();
  const edgeSeen = new Set<string>();

  for (const note of notes) {
    for (const link of note.links) {
      const resolution = resolveWikiLinkTarget(
        { byBrainAndTitleKey },
        note.brainId,
        link,
      );
      if (resolution.kind !== "resolved") {
        const { kind, targetBrainId } = resolution;
        const key = JSON.stringify([note.id, kind, targetBrainId, link.raw]);
        if (!unresolvedSeen.has(key)) {
          unresolvedSeen.add(key);
          unresolved.push({
            kind,
            sourceBrainId: note.brainId,
            targetBrainId,
            source: note.filePath,
            raw: link.raw,
            target: link.target,
          });
        }
        continue;
      }
      const target = resolution.note;
      if (target.id === note.id) continue;
      const pairKey = JSON.stringify([note.id, target.id]);
      linkedPairs.add(pairKey);
      if (edgeSeen.has(pairKey)) continue;
      edgeSeen.add(pairKey);
      edges.push({
        source: note.id,
        target: target.id,
        sourceBrainId: note.brainId,
        targetBrainId: target.brainId,
        crossBrain: note.brainId !== target.brainId,
      });
      backlinks.set(target.id, [
        ...(backlinks.get(target.id) ?? []),
        {
          source: note,
          sourceBrainId: note.brainId,
          targetBrainId: target.brainId,
          context: extractContext(note.body, link),
        },
      ]);
    }
  }

  const unlinkedMentions = new Map<string, VaultNote[]>();
  const mentionable = notes.filter((n) => n.title.length >= MIN_MENTION_TITLE_LENGTH);
  const textById = new Map(notes.map((n) => [n.id, searchableText(n.body)]));
  for (const candidate of notes) {
    const targets = mentionable
      .filter((target) =>
        candidate.brainId === target.brainId &&
        candidate.id !== target.id &&
        !linkedPairs.has(JSON.stringify([candidate.id, target.id]))
      )
      .sort((a, b) => b.title.length - a.title.length || a.title.localeCompare(b.title));
    if (targets.length === 0) continue;

    const byTitle = new Map(targets.map((target) => [target.title.toLowerCase(), target]));
    const pattern = new RegExp(
      `\\b(${targets.map((target) => escapeRegExp(target.title)).join("|")})\\b`,
      "gi",
    );
    for (const match of (textById.get(candidate.id) ?? "").matchAll(pattern)) {
      const target = byTitle.get(match[0].toLowerCase());
      if (!target || unlinkedMentions.get(target.id)?.some((source) => source.id === candidate.id)) {
        continue;
      }
      unlinkedMentions.set(target.id, [
        ...(unlinkedMentions.get(target.id) ?? []),
        candidate,
      ]);
    }
  }

  const orphans = notes.filter((n) => !backlinks.has(n.id));

  return {
    notes,
    byId,
    byBrainAndTitleKey,
    byTitleKey,
    edges,
    backlinks,
    unlinkedMentions,
    orphans,
    unresolved,
  };
}

export function buildLinkIndex(manifest: VaultManifest): LinkIndex {
  return buildWorkspaceLinkIndex([{ brainId: SINGLE_BRAIN_ID, manifest }], "vault");
}

export function scanVault(vaultDir: string = VAULT_DIR, exclusions: string[] = []): LinkIndex {
  return buildLinkIndex(
    createVaultManifest({
      vaultDir,
      outputDir: path.resolve(vaultDir, "..", "dist"),
      exclusions,
    }),
  );
}
