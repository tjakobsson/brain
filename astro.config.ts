import { defineConfig } from "astro/config";
import path from "node:path";
import remarkCallout from "@r4ai/remark-callout";
import { unified } from "@astrojs/markdown-remark";
import { remarkPotentialLinks, remarkWikiLinks } from "./src/lib/remark-wiki-links";
import { remarkHighlights } from "./src/lib/remark-highlights";
import { joinBase, routes } from "./src/lib/routes";
import { internalSettings } from "./src/lib/internal-settings";
import { remarkAttachments } from "./src/lib/remark-attachments";
import { attachmentIntegration } from "./src/integrations/attachments";

export default defineConfig({
  site: internalSettings.site,
  base: internalSettings.base || "/",
  outDir: internalSettings.output,
  cacheDir: internalSettings.work ? path.join(internalSettings.work, "astro") : undefined,
  integrations: [attachmentIntegration()],
  redirects: internalSettings.mode === "vault"
    ? { [routes.graphAlias]: joinBase(internalSettings.base, routes.home) }
    : {},
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
