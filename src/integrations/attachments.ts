import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import { copyResolvedAttachments } from "../lib/attachment-output";
import { getWorkspaceSnapshot } from "../lib/vault-state";

export function attachmentIntegration(): AstroIntegration {
  return {
    name: "brain-attachments",
    hooks: {
      "astro:build:done": ({ dir }) => {
        copyResolvedAttachments(getWorkspaceSnapshot().attachments, fileURLToPath(dir));
      },
    },
  };
}
