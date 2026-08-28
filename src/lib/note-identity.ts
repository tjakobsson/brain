export type InputMode = "vault" | "workspace";

export const SINGLE_BRAIN_ID = "default";

/** Encodes a note tuple without relying on a delimiter that either member could contain. */
export function compositeNoteId(brainId: string, noteId: string): string {
  return `${encodeURIComponent(brainId)}/${encodeURIComponent(noteId)}`;
}

export function noteId(mode: InputMode, brainId: string, slug: string): string {
  return mode === "vault" ? slug : compositeNoteId(brainId, slug);
}
