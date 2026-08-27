import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import { copyResolvedAttachments } from "../lib/attachment-output";
import { getVaultSnapshot } from "../lib/vault-state";

export function attachmentIntegration(): AstroIntegration {
  return {
    name: "brain-manual-attachments",
    hooks: {
      "astro:build:done": ({ dir }) => {
        copyResolvedAttachments(getVaultSnapshot().attachments, fileURLToPath(dir));
      },
    },
  };
}
