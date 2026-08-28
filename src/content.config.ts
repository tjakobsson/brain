import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { internalSettings } from "./lib/internal-settings";
import { workspaceLoader } from "./lib/vault-loader";

const notes = defineCollection({
  loader: workspaceLoader({
    mode: internalSettings.mode,
    vaultDir: internalSettings.vault,
    workspacePath: internalSettings.workspace,
    outputDir: internalSettings.output,
    exclusions: internalSettings.exclusions,
    strictLinks: internalSettings.strictLinks,
  }),
  schema: z.object({
    brainId: z.string(),
    title: z.string().optional(),
    type: z.enum(["fleeting", "literature", "permanent"]).default("permanent"),
    status: z.enum(["draft", "developing", "established"]).default("draft"),
    tags: z.array(z.string()).default([]),
    created: z.coerce.date().optional(),
    updated: z.coerce.date().optional(),
  }),
});

export const collections = { notes };
