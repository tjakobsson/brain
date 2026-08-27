import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { internalSettings } from "./lib/internal-settings";
import { vaultLoader } from "./lib/vault-loader";

const notes = defineCollection({
  loader: vaultLoader({
    vaultDir: internalSettings.vault,
    outputDir: internalSettings.output,
    exclusions: internalSettings.exclusions,
    strictLinks: internalSettings.strictLinks,
  }),
  schema: z.object({
    title: z.string().optional(),
    type: z.enum(["fleeting", "literature", "permanent"]).default("permanent"),
    status: z.enum(["draft", "developing", "established"]).default("draft"),
    tags: z.array(z.string()).default([]),
    created: z.coerce.date().optional(),
    updated: z.coerce.date().optional(),
  }),
});

export const collections = { notes };
