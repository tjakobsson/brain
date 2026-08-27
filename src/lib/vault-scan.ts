import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { VAULT_DIR } from "./vault-path";
import {
  parseWikiLinks,
  stripCode,
  stripMarkdownLinks,
  wikiLinksToText,
  type WikiLink,
} from "./wiki-links";
import { slugify } from "./slugify";
import { routes, type LogicalRoute } from "./routes";
import { createVaultManifest, type VaultManifest } from "./vault-manifest";
import {
  parseAttachmentReferences,
  type AttachmentReference,
} from "./attachment-references";

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
  /** The line of prose the link appears in, wiki syntax reduced to display text. */
  context: string;
}

export interface UnresolvedLink {
  /** File containing the link. */
  source: string;
  raw: string;
  target: string;
}

export interface LinkIndex {
  notes: VaultNote[];
  byTitleKey: Map<string, VaultNote>;
  /** Resolved links only, deduplicated, no self-loops. Slugs on both ends. */
  edges: { source: string; target: string }[];
  /** Target slug → linking notes with context. */
  backlinks: Map<string, Backlink[]>;
  /** Target slug → notes that mention the title in prose without linking. */
  unlinkedMentions: Map<string, VaultNote[]>;
  /** Notes with zero inbound links. */
  orphans: VaultNote[];
  /** Wiki-links whose target does not exist. Reported as build warnings. */
  unresolved: UnresolvedLink[];
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
  return wikiLinksToText(stripMarkdownLinks(body.slice(lineStart, lineEnd)))
    .replace(/^[\s>*-]+/, "")
    .trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Plain prose a mention can hide in: no code, wiki syntax reduced to display text. */
function searchableText(body: string): string {
  return stripMarkdownLinks(wikiLinksToText(stripCode(body)));
}

export function buildLinkIndex(manifest: VaultManifest): LinkIndex {
  const notes: VaultNote[] = manifest.entries
    .filter((entry) => entry.kind === "markdown")
    .map((entry) => {
      const source = fs.readFileSync(entry.absolutePath, "utf8");
      const { data, content } = matter(source);
      const title = path.basename(entry.path, path.extname(entry.path));
      return {
        slug: slugify(title),
        title,
        route: routes.note(slugify(title)),
        filePath: entry.absolutePath,
        meta: readMeta(data),
        body: content,
        links: parseWikiLinks(content),
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
        `Duplicate note title "${note.title}" in vault:\n` +
          `  ${existing.filePath}\n  ${note.filePath}\n` +
          `Note titles must be unique across the vault.`,
      );
    }
    byTitleKey.set(key, note);
  }

  const noteTitles = new Set(byTitleKey.keys());
  for (const note of notes) {
    note.attachments = parseAttachmentReferences(note.source, noteTitles);
  }

  const edges: { source: string; target: string }[] = [];
  const backlinks = new Map<string, Backlink[]>();
  const unresolved: UnresolvedLink[] = [];
  const unresolvedSeen = new Set<string>();
  const linkedPairs = new Set<string>();
  const edgeSeen = new Set<string>();

  for (const note of notes) {
    for (const link of note.links) {
      const target = byTitleKey.get(link.target.toLowerCase());
      if (!target) {
        const key = `${note.filePath}${link.raw}`;
        if (!unresolvedSeen.has(key)) {
          unresolvedSeen.add(key);
          unresolved.push({ source: note.filePath, raw: link.raw, target: link.target });
        }
        continue;
      }
      if (target.slug === note.slug) continue;
      const pairKey = `${note.slug}->${target.slug}`;
      linkedPairs.add(pairKey);
      if (edgeSeen.has(pairKey)) continue;
      edgeSeen.add(pairKey);
      edges.push({ source: note.slug, target: target.slug });
      backlinks.set(target.slug, [
        ...(backlinks.get(target.slug) ?? []),
        { source: note, context: extractContext(note.body, link) },
      ]);
    }
  }

  const unlinkedMentions = new Map<string, VaultNote[]>();
  const mentionable = notes.filter((n) => n.title.length >= MIN_MENTION_TITLE_LENGTH);
  const textBySlug = new Map(notes.map((n) => [n.slug, searchableText(n.body)]));
  for (const target of mentionable) {
    const pattern = new RegExp(`\\b${escapeRegExp(target.title)}\\b`, "i");
    for (const candidate of notes) {
      if (candidate.slug === target.slug) continue;
      if (linkedPairs.has(`${candidate.slug}->${target.slug}`)) continue;
      if (pattern.test(textBySlug.get(candidate.slug) ?? "")) {
        unlinkedMentions.set(target.slug, [
          ...(unlinkedMentions.get(target.slug) ?? []),
          candidate,
        ]);
      }
    }
  }

  const orphans = notes.filter((n) => !backlinks.has(n.slug));

  return { notes, byTitleKey, edges, backlinks, unlinkedMentions, orphans, unresolved };
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
