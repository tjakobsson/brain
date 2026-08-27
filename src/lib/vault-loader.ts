import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Loader } from "astro/loaders";
import { buildLinkIndex } from "./vault-scan";
import { createVaultManifest } from "./vault-manifest";
import { publishVaultSnapshot } from "./vault-state";
import { resolveAttachments } from "./attachment-resolution";

interface VaultLoaderOptions {
  vaultDir: string;
  outputDir: string;
  exclusions: readonly string[];
  strictLinks: boolean;
}

export function vaultLoader(options: VaultLoaderOptions): Loader {
  return {
    name: "brain-manual-vault",
    async load(context) {
      const manifest = createVaultManifest({
        vaultDir: options.vaultDir,
        outputDir: options.outputDir,
        exclusions: options.exclusions,
      });
      const index = buildLinkIndex(manifest);
      const attachments = resolveAttachments(index, manifest);
      if (index.notes.length === 0) {
        throw new Error("Vault contains no publishable Markdown notes after exclusions.");
      }
      publishVaultSnapshot({ manifest, index, attachments });

      if (index.unresolved.length > 0) {
        for (const link of index.unresolved) {
          const message = `[wiki-links] unresolved link ${link.raw} in ${link.source}`;
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
          id: note.slug,
          data: note.frontmatter,
          filePath: note.filePath,
        });
        const rendered = await context.renderMarkdown(note.source, {
          fileURL: pathToFileURL(note.filePath),
        });
        loaded.push({
          id: note.slug,
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
