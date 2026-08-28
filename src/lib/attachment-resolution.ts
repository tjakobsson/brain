import fs from "node:fs";
import path from "node:path";
import type { AttachmentReference } from "./attachment-references";
import type { LinkIndex, VaultNote } from "./vault-scan";
import type { VaultManifest, VaultManifestEntry } from "./vault-manifest";
import { routesFor } from "./routes";
import { SINGLE_BRAIN_ID, type InputMode } from "./note-identity";

export interface ResolvedAttachment {
  brainId: string;
  source: VaultNote;
  reference: AttachmentReference;
  entry: VaultManifestEntry;
  route: import("./routes").LogicalRoute;
  outputPath: string;
}

export interface AttachmentResolutionOptions {
  mode?: InputMode;
  brainId?: string;
}

export class AttachmentResolutionError extends Error {
  constructor(public readonly diagnostics: string[]) {
    super(`Attachment resolution failed:\n${diagnostics.map((item) => `- ${item}`).join("\n")}`);
    this.name = "AttachmentResolutionError";
  }
}

function within(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`));
}

function decodeTarget(target: string): string {
  try {
    return decodeURIComponent(target);
  } catch {
    return target;
  }
}

function normalizedCandidate(note: VaultNote, reference: AttachmentReference): string {
  const target = decodeTarget(reference.target).replaceAll("\\", "/");
  if (reference.kind === "brain-embed") return path.posix.normalize(target.replace(/^\/+/, ""));
  if (target.startsWith("/")) return path.posix.normalize(target.slice(1));
  return path.posix.normalize(path.posix.join(path.posix.dirname(note.vaultPath), target));
}

function unavailableReason(manifest: VaultManifest, candidate: string): "outside the vault" | "excluded" | "missing" {
  const logical = path.resolve(manifest.root, ...candidate.split("/"));
  if (!within(manifest.root, logical)) return "outside the vault";
  try {
    const real = fs.realpathSync(logical);
    return within(manifest.root, real) ? "excluded" : "outside the vault";
  } catch {
    return "missing";
  }
}

export function resolveAttachments(
  index: LinkIndex,
  manifest: VaultManifest,
  options: AttachmentResolutionOptions = {},
): ResolvedAttachment[] {
  const mode = options.mode ?? "vault";
  const brainId = options.brainId ?? SINGLE_BRAIN_ID;
  const byPath = new Map(manifest.entries.map((entry) => [entry.path, entry]));
  const filesByName = new Map<string, VaultManifestEntry[]>();
  for (const entry of manifest.entries) {
    if (entry.kind !== "file") continue;
    const name = path.posix.basename(entry.path);
    filesByName.set(name, [...(filesByName.get(name) ?? []), entry]);
  }

  const resolved: ResolvedAttachment[] = [];
  const diagnostics: string[] = [];
  for (const note of index.notes.filter((candidate) => candidate.brainId === brainId)) {
    for (const reference of note.attachments) {
      const candidate = normalizedCandidate(note, reference);
      let entry = byPath.get(candidate);

      if (!entry && reference.kind === "brain-embed" && !reference.target.includes("/")) {
        const matches = filesByName.get(path.posix.basename(candidate)) ?? [];
        if (matches.length === 1) entry = matches[0];
        else if (matches.length > 1) {
          diagnostics.push(
            `${mode === "workspace" ? `brain "${brainId}" ` : ""}${note.vaultPath}: ${reference.raw} is ambiguous; matches ${matches.map((match) => match.path).join(", ")}`,
          );
          continue;
        }
      }

      if (!entry) {
        diagnostics.push(
          `${mode === "workspace" ? `brain "${brainId}" ` : ""}${note.vaultPath}: ${reference.raw} is ${unavailableReason(manifest, candidate)} (${candidate})`,
        );
      } else if (entry.kind === "file") {
        const route = routesFor({ mode, brainId }).asset(entry.path);
        resolved.push({
          brainId,
          source: note,
          reference,
          entry,
          route,
          outputPath: mode === "vault"
            ? path.posix.join("vault-assets", entry.path)
            : path.posix.join("brains", brainId, "assets", entry.path),
        });
      }
    }
  }

  if (diagnostics.length > 0) throw new AttachmentResolutionError(diagnostics);
  return resolved;
}
