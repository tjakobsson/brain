import { describe, expect, it } from "vitest";
import { noteIdFromEntry, slugify } from "./slugify";

describe("slugify", () => {
  it("creates a readable title slug", () => {
    expect(slugify("Graphs of thought")).toBe("graphs-of-thought");
  });
});

describe("noteIdFromEntry", () => {
  it("ignores vault subfolders", () => {
    expect(noteIdFromEntry("sources/books/Graphs of thought.md")).toBe("graphs-of-thought");
  });

  it("handles Windows path separators", () => {
    expect(noteIdFromEntry("sources\\books\\Graphs of thought.md")).toBe("graphs-of-thought");
  });
});
