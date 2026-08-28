import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Loader } from "astro/loaders";
import { buildWorkspaceLinkIndex } from "./vault-scan";
import { createVaultManifest } from "./vault-manifest";
import { publishWorkspaceSnapshot } from "./vault-state";
import { resolveAttachments } from "./attachment-resolution";
import { loadWorkspaceManifest, type WorkspaceDefinition } from "./workspace.mjs";
import { SINGLE_BRAIN_ID, type InputMode } from "./note-identity";

interface CommonLoaderOptions {
  mode: InputMode;
  vaultDir: string;
  workspacePath?: string;
  outputDir: string;
  exclusions: readonly string[];
  strictLinks: boolean;
}

export interface VaultLoaderOptions extends Omit<CommonLoaderOptions, "mode" | "workspacePath"> {}

export interface WorkspaceLoaderOptions extends CommonLoaderOptions {}

export function createWorkspaceSnapshot(options: WorkspaceLoaderOptions) {
  const registry = options.mode === "workspace"
    ? loadWorkspaceManifest(options.workspacePath ?? "")
    : implicitRegistry(options);
  const manifests = new Map(registry.brains.map((brain) => [
    brain.id,
    createVaultManifest({
      vaultDir: brain.path,
      outputDir: options.outputDir,
      exclusions: [...options.exclusions, ...brain.effectiveExclusions],
    }),
  ]));
  const index = buildWorkspaceLinkIndex(
    registry.brains.map((brain) => ({ brainId: brain.id, manifest: manifests.get(brain.id)! })),
    options.mode,
  );
  for (const brain of registry.brains) {
    if (!index.notes.some((note) => note.brainId === brain.id)) {
      throw new Error(`Brain "${brain.id}" contains no publishable Markdown notes after exclusions.`);
    }
  }
  const attachments = registry.brains.flatMap((brain) =>
    resolveAttachments(index, manifests.get(brain.id)!, {
      mode: options.mode,
      brainId: brain.id,
    })
  );
  const manifest = manifests.get(registry.brains[0].id)!;
  return {
    mode: options.mode,
    registry,
    manifests,
    manifest,
    index,
    attachments,
  } satisfies import("./vault-state").WorkspaceSnapshot;
}

function implicitRegistry(options: CommonLoaderOptions): WorkspaceDefinition {
  return {
    version: 1,
    title: "Brain",
    exclusions: [...options.exclusions],
    groups: [],
    brains: [{
      id: SINGLE_BRAIN_ID,
      title: "Brain",
      path: options.vaultDir,
      configuredPath: options.vaultDir,
      accent: "#5b4bc4",
      exclusions: [],
      effectiveExclusions: [],
    }],
    manifestPath: "",
  };
}

export function formatUnresolvedLinkDiagnostic(link: import("./vault-scan").UnresolvedLink): string {
  const source = `brain "${link.sourceBrainId}" file ${link.source}`;
  return link.kind === "unknown-brain"
    ? `[wiki-links] unknown brain "${link.targetBrainId}" for ${link.raw} in ${source}`
    : `[wiki-links] missing note "${link.target}" in brain "${link.targetBrainId}" for ${link.raw} in ${source}`;
}

export function workspaceLoader(options: WorkspaceLoaderOptions): Loader {
  return {
    name: "brain-workspace",
    async load(context) {
      const snapshot = createWorkspaceSnapshot(options);
      const { index } = snapshot;
      publishWorkspaceSnapshot(snapshot);

      if (index.unresolved.length > 0) {
        for (const link of index.unresolved) {
          const message = formatUnresolvedLinkDiagnostic(link);
          if (options.strictLinks) context.logger.error(message);
          else context.logger.warn(message);
        }
        if (options.strictLinks) {
          throw new Error(`Strict link validation failed with ${index.unresolved.length} unresolved link(s).`);
        }
      }

      const loaded = [];
      for (const note of index.notes) {
        const data = await context.parseData({
          id: note.id,
          data: { ...note.frontmatter, brainId: note.brainId },
          filePath: note.filePath,
        });
        const rendered = await context.renderMarkdown(note.source, {
          fileURL: pathToFileURL(note.filePath),
        });
        loaded.push({
          id: note.id,
          data,
          body: note.body,
          filePath: path.relative(context.config.root.pathname, note.filePath),
          digest: context.generateDigest(note.source),
          rendered,
          assetImports: rendered.metadata?.imagePaths,
        });
      }

      context.store.clear();
      for (const entry of loaded) context.store.set(entry);
    },
  };
}

export function vaultLoader(options: VaultLoaderOptions): Loader {
  return workspaceLoader({ ...options, mode: "vault" });
}
