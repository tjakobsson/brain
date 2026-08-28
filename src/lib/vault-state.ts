import type { LinkIndex } from "./vault-scan";
import type { VaultManifest } from "./vault-manifest";
import type { ResolvedAttachment } from "./attachment-resolution";
import type { InputMode } from "./note-identity";
import type { WorkspaceDefinition } from "./workspace.mjs";

export interface WorkspaceSnapshot {
  mode: InputMode;
  registry: WorkspaceDefinition;
  manifests: ReadonlyMap<string, VaultManifest>;
  index: LinkIndex;
  attachments: ResolvedAttachment[];
  /** Single-vault compatibility alias for the only manifest. */
  manifest: VaultManifest;
}

export type VaultSnapshot = WorkspaceSnapshot;

const SNAPSHOT = Symbol.for("brain.workspace-snapshot");
const processState = process as typeof process & { [SNAPSHOT]?: WorkspaceSnapshot };

export function publishWorkspaceSnapshot(snapshot: WorkspaceSnapshot): void {
  processState[SNAPSHOT] = snapshot;
}

export function getWorkspaceSnapshot(): WorkspaceSnapshot {
  const snapshot = processState[SNAPSHOT];
  if (!snapshot) {
    throw new Error(
      "Workspace snapshot is unavailable. The brain content loader must complete first.",
    );
  }
  return snapshot;
}

export function publishVaultSnapshot(snapshot: WorkspaceSnapshot): void {
  publishWorkspaceSnapshot(snapshot);
}

export function getVaultSnapshot(): WorkspaceSnapshot {
  return getWorkspaceSnapshot();
}
