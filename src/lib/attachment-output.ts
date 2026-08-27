import fs from "node:fs";
import path from "node:path";
import type { ResolvedAttachment } from "./attachment-resolution";

export function copyResolvedAttachments(attachments: ResolvedAttachment[], output: string): void {
  const entries = new Map(attachments.map((attachment) => [attachment.entry.path, attachment.entry]));
  for (const [vaultPath, entry] of [...entries].sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  )) {
    const destination = path.join(output, "vault-assets", ...vaultPath.split("/"));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(entry.realPath, destination);
  }
}
