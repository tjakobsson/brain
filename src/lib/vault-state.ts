import type { LinkIndex } from "./vault-scan";
import type { VaultManifest } from "./vault-manifest";
import type { ResolvedAttachment } from "./attachment-resolution";

export interface VaultSnapshot {
  manifest: VaultManifest;
  index: LinkIndex;
  attachments: ResolvedAttachment[];
}

const SNAPSHOT = Symbol.for("brain.vault-snapshot");
const processState = process as typeof process & { [SNAPSHOT]?: VaultSnapshot };

export function publishVaultSnapshot(snapshot: VaultSnapshot): void {
  processState[SNAPSHOT] = snapshot;
}

export function getVaultSnapshot(): VaultSnapshot {
  const snapshot = processState[SNAPSHOT];
  if (!snapshot) {
    throw new Error(
      "Vault snapshot is unavailable. The brain-vault content loader must complete first.",
    );
  }
  return snapshot;
}
