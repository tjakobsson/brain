import { defineConfig } from "astro/config";
import path from "node:path";
import remarkCallout from "@r4ai/remark-callout";
import { unified } from "@astrojs/markdown-remark";
import rehypeRaw from "rehype-raw";
import { remarkPotentialLinks, remarkWikiLinks } from "./src/lib/remark-wiki-links";
import { remarkHighlights } from "./src/lib/remark-highlights";
import { internalSettings } from "./src/lib/internal-settings";
import { remarkAttachments } from "./src/lib/remark-attachments";
import { rehypeExternalLinks } from "./src/lib/rehype-external-links";
import { attachmentIntegration } from "./src/integrations/attachments";

export default defineConfig({
  site: internalSettings.site,
  base: internalSettings.base || "/",
  outDir: internalSettings.output,
  cacheDir: internalSettings.work ? path.join(internalSettings.work, "astro") : undefined,
  integrations: [attachmentIntegration()],
  markdown: {
    shikiConfig: {
      themes: {
        light: "github-light",
        dark: "github-dark",
      },
    },
    processor: unified({
      remarkPlugins: [
        [remarkAttachments, { base: internalSettings.base }],
        [remarkWikiLinks, { base: internalSettings.base }],
        remarkHighlights,
        remarkCallout,
        remarkPotentialLinks,
      ],
      rehypePlugins: [
        rehypeRaw,
        [rehypeExternalLinks, { site: internalSettings.site }],
      ],
    }),
  },
  vite: {
    cacheDir: internalSettings.work ? path.join(internalSettings.work, "vite") : undefined,
    optimizeDeps: {
      // Imported from inline island scripts; pre-declare so the dev server
      // bundles them up front instead of re-optimizing mid-page-load.
      include: ["sigma", "graphology"],
    },
  },
});
