import { describe, expect, it } from "vitest";
import { compositeNoteId, noteId } from "./note-identity";

describe("note identity", () => {
  it("encodes tuple members without delimiter collisions", () => {
    expect(compositeNoteId("a/b", "c")).not.toBe(compositeNoteId("a", "b/c"));
    expect(compositeNoteId("engineering", "principles")).toBe("engineering/principles");
  });

  it("preserves single-vault IDs while namespacing workspace IDs", () => {
    expect(noteId("vault", "default", "principles")).toBe("principles");
    expect(noteId("workspace", "engineering", "principles")).toBe(
      "engineering/principles",
    );
  });
});
