import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { scanVault } from "./vault-scan";

let dir: string;

function writeNote(name: string, body: string, frontmatter = "---\n---\n") {
  const filePath = path.join(dir, name);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${frontmatter}${body}`);
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "vault-scan-"));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("scanVault", () => {
  it("builds the title map with URLs derived from titles", () => {
    writeNote("Graphs of thought.md", "Body.");
    const index = scanVault(dir);
    const note = index.byTitleKey.get("graphs of thought");
    expect(note).toBeDefined();
    expect(note?.route).toBe("/notes/graphs-of-thought");
    expect(note?.meta).toEqual({ type: "permanent", status: "draft", tags: [] });
  });

  it("applies caller exclusion patterns before indexing notes", () => {
    writeNote("Published.md", "Links [[Private]].");
    writeNote("Archive/Private.md", "Hidden.");

    const index = scanVault(dir, ["Archive/**"]);

    expect(index.notes.map((note) => note.title)).toEqual(["Published"]);
    expect(index.unresolved).toMatchObject([{ target: "Private" }]);
  });

  it("records attachment references only from publishable notes", () => {
    writeNote("Published.md", "![[image.png]] and [Note](Note.md)");
    writeNote("Private/Excluded.md", "![[private.pdf]]");

    const index = scanVault(dir, ["Private/**"]);

    expect(index.notes).toHaveLength(1);
    expect(index.notes[0].attachments.map((reference) => reference.target)).toEqual(["image.png"]);
  });

  it("throws on duplicate titles, naming both files", () => {
    writeNote("Same Title.md", "One.");
    writeNote("sub/Same Title.md", "Two.");
    expect(() => scanVault(dir)).toThrowError(/Duplicate note title "Same Title"[\s\S]*Same Title\.md[\s\S]*sub/);
  });

  it("records resolved edges only, excluding unwritten targets", () => {
    writeNote("Note A.md", "Links to [[Note B]] and [[Future idea]].");
    writeNote("Note B.md", "Nothing.");
    const index = scanVault(dir);
    expect(index.edges).toMatchObject([{ source: "note-a", target: "note-b" }]);
  });

  it("deduplicates repeated links and ignores self-links", () => {
    writeNote("Note A.md", "[[Note B]] then [[Note B]] again and [[Note A]].");
    writeNote("Note B.md", "Nothing.");
    expect(scanVault(dir).edges).toMatchObject([{ source: "note-a", target: "note-b" }]);
  });

  it("captures backlinks with the context line as readable prose", () => {
    writeNote("Note A.md", "This builds on [[Note B]] in practice.");
    writeNote("Note B.md", "Nothing.");
    const backlinks = scanVault(dir).backlinks.get("note-b");
    expect(backlinks).toHaveLength(1);
    expect(backlinks?.[0].source.slug).toBe("note-a");
    expect(backlinks?.[0].context).toBe("This builds on Note B in practice.");
  });

  it("indexes wrapped links with explicit blockquote continuation prefixes", () => {
    writeNote("Note A.md", "> [[Note\n> B]]");
    writeNote("Note B.md", "Linked from a blockquote.");

    expect(scanVault(dir).edges).toMatchObject([{ source: "note-a", target: "note-b" }]);
  });

  it("indexes wrapped links using ordered-list continuation indentation", () => {
    writeNote("Note A.md", "10. [[Note\n    B]]");
    writeNote("Note B.md", "Linked from a list.");

    expect(scanVault(dir).edges).toMatchObject([{ source: "note-a", target: "note-b" }]);
  });

  it("indexes wrapped links in blockquotes nested under list items", () => {
    writeNote("Note A.md", "- > [[Note\n  > B]]");
    writeNote("Note B.md", "Linked from a nested blockquote.");

    expect(scanVault(dir).edges).toMatchObject([{ source: "note-a", target: "note-b" }]);
  });

  it("does not index wiki-link delimiters spanning GFM table rows", () => {
    writeNote("Source.md", "| Value |\n| --- |\n| [[Note\n| shown]] |");
    writeNote("Note.md", "Not linked across table rows.");

    expect(scanVault(dir).edges).toEqual([]);
    expect(scanVault(dir).backlinks.get("note")).toBeUndefined();
  });

  it("detects unlinked mentions without double-reporting linked notes", () => {
    writeNote("Note A.md", "The Zettelkasten method deserves study.");
    writeNote("Note B.md", "Links [[Zettelkasten method]] and also says Zettelkasten method in prose.");
    writeNote("Zettelkasten method.md", "The canonical note.");
    const mentions = scanVault(dir).unlinkedMentions.get("zettelkasten-method");
    expect(mentions?.map((n) => n.slug)).toEqual(["note-a"]);
  });

  it("does not treat authored link labels as unlinked mentions", () => {
    writeNote(
      "Source.md",
      "[[Other|Principles]], [Principles](/other), [Principles][ref], <a href=\"/other\">Principles</a>, and <script>Principles</script>.\n\n[ref]: /other \"Principles\"",
    );
    writeNote("Other.md", "Linked by its alias.");
    writeNote("Principles.md", "Only present in authored link labels.");

    expect(scanVault(dir).unlinkedMentions.get("principles")).toBeUndefined();
  });

  it("does not treat callout type markers as unlinked mentions", () => {
    writeNote("Source.md", "> [!note]\n> Read this carefully.");
    writeNote("Note.md", "A note title that matches the callout type.");

    expect(scanVault(dir).unlinkedMentions.get("note")).toBeUndefined();
  });

  it("ignores mentions inside code blocks", () => {
    writeNote("Note A.md", "```\nMentions Note B here.\n```");
    writeNote("Note B.md", "Nothing.");
    expect(scanVault(dir).unlinkedMentions.get("note-b")).toBeUndefined();
  });

  it("ignores soft-wrapped wiki-links inside fenced and inline code", () => {
    writeNote(
      "Note A.md",
      "```\n[[Note\nB]]\n```\n\n`ignored [[Note\nB]]`\n\n<div>\n[[Note\nB]]\n</div>\n\nRecords [[Note\nC]].",
    );
    writeNote("Note B.md", "Not linked.");
    writeNote("Note C.md", "Linked.");

    const index = scanVault(dir);
    expect(index.edges).toMatchObject([{ source: "note-a", target: "note-c" }]);
    expect(index.edges.some((edge) => edge.target === "note-b")).toBe(false);
    expect(index.backlinks.get("note-b")).toBeUndefined();
    expect(index.unresolved).toEqual([]);
  });

  it("ignores very short titles for mention detection", () => {
    writeNote("Note A.md", "This body says Pi several times.");
    writeNote("Pi.md", "Short title.");
    expect(scanVault(dir).unlinkedMentions.get("pi")).toBeUndefined();
  });

  it("records unresolved links with their source file", () => {
    writeNote("Note A.md", "Links to [[Note B]] and [[Future idea]] and again [[Future idea]].");
    writeNote("Note B.md", "Nothing.");
    const index = scanVault(dir);
    expect(index.unresolved).toHaveLength(1);
    expect(index.unresolved[0]).toMatchObject({ raw: "[[Future idea]]", target: "Future idea" });
    expect(index.unresolved[0].source).toContain("Note A.md");
  });

  it("reports orphans as notes with zero inbound links", () => {
    writeNote("Note A.md", "Links to [[Note B]].");
    writeNote("Note B.md", "Linked.");
    writeNote("Lonely Note.md", "No one links here.");
    const index = scanVault(dir);
    expect(index.orphans.map((n) => n.slug).sort()).toEqual(["lonely-note", "note-a"]);
  });
});
