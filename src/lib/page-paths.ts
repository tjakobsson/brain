import type { WorkspaceSnapshot } from "./vault-state";

export interface ContentEntryLike {
  id: string;
  data: { brainId: string; tags?: readonly string[] };
}

export function vaultNotePagePaths<T extends ContentEntryLike>(
  entries: readonly T[],
  snapshot: WorkspaceSnapshot,
) {
  if (snapshot.mode !== "vault") return [];
  return entries.map((entry) => ({ params: { id: entry.id }, props: { entry } }));
}

export function workspaceNotePagePaths<T extends ContentEntryLike>(
  entries: readonly T[],
  snapshot: WorkspaceSnapshot,
) {
  if (snapshot.mode !== "workspace") return [];
  return entries.map((entry) => {
    const note = snapshot.index.byId.get(entry.id);
    if (!note) throw new Error(`Workspace note ${JSON.stringify(entry.id)} is missing from the index.`);
    return {
      params: { brainId: note.brainId, slug: note.slug },
      props: { entry },
    };
  });
}

export function workspaceBrainPagePaths(snapshot: WorkspaceSnapshot) {
  if (snapshot.mode !== "workspace") return [];
  return snapshot.registry.brains.map((brain) => ({
    params: { brainId: brain.id },
    props: { brain },
  }));
}

export function workspaceTagPagePaths(snapshot: WorkspaceSnapshot) {
  if (snapshot.mode !== "workspace") return [];
  return snapshot.registry.brains.flatMap((brain) => {
    const tags = new Set(
      snapshot.index.notes
        .filter((note) => note.brainId === brain.id)
        .flatMap((note) => note.meta.tags),
    );
    return [...tags].sort().map((tag) => ({
      params: { brainId: brain.id, tag },
      props: { brain, tag },
    }));
  });
}
