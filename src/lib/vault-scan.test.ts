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

  it("normalizes list-wrapped links in backlink context", () => {
    writeNote("Note A.md", "10. This builds on [[Note\n    B]] in practice.");
    writeNote("Note B.md", "Nothing.");

    expect(scanVault(dir).backlinks.get("note-b")?.[0].context).toBe(
      "This builds on Note B in practice.",
    );
  });

  it("indexes wrapped links with explicit blockquote continuation prefixes", () => {
    writeNote("Note A.md", "> [[Note\n> B]]");
    writeNote("Note B.md", "Linked from a blockquote.");

    expect(scanVault(dir).edges).toMatchObject([{ source: "note-a", target: "note-b" }]);
  });

  it("indexes wrapped links with lazy blockquote continuations", () => {
    writeNote("Note A.md", "> [[Note\nB]]");
    writeNote("Note B.md", "Linked from a lazy blockquote continuation.");

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

  it("indexes wrapped links in blockquotes nested two list levels deep", () => {
    writeNote("Note A.md", "- outer\n  - > [[Note\n    > B]]");
    writeNote("Note B.md", "Linked from a deeply nested blockquote.");

    expect(scanVault(dir).edges).toMatchObject([{ source: "note-a", target: "note-b" }]);
  });

  it("indexes wiki-links inside benign inline HTML wrappers", () => {
    writeNote("Note A.md", "<span>[[Note B]]</span>");
    writeNote("Note B.md", "Linked from an inline wrapper.");

    expect(scanVault(dir).edges).toMatchObject([{ source: "note-a", target: "note-b" }]);
  });

  it("does not index wiki-links inside unsafe inline HTML containers", () => {
    writeNote("Note A.md", "Intro <script>[[Note B]]</script>");
    writeNote("Note B.md", "Not linked from executable text.");

    expect(scanVault(dir).edges).toEqual([]);
  });

  it("indexes wiki-links after tag-like text in HTML comments", () => {
    writeNote("Note A.md", "Intro <!-- <script> --> [[Note B]]");
    writeNote("Note B.md", "Linked after a comment.");

    expect(scanVault(dir).edges).toMatchObject([{ source: "note-a", target: "note-b" }]);
  });

  it("resolves wrapped wiki-link targets containing character references", () => {
    writeNote("Source.md", "See [[Research &amp;\nDevelopment]].");
    writeNote("Research & Development.md", "Decoded target.");

    const index = scanVault(dir);
    expect(index.edges).toMatchObject([{ source: "source", target: "research-development" }]);
    expect(index.unresolved).toEqual([]);
  });

  it("normalizes whitespace introduced by decoded character references", () => {
    writeNote("Source.md", "See [[Research&NewLine;Development]].");
    writeNote("Research Development.md", "Decoded target.");

    expect(scanVault(dir).edges).toMatchObject([
      { source: "source", target: "research-development" },
    ]);
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

  it("indexes only the longest non-overlapping potential title", () => {
    writeNote("Source.md", "A Data Model clarifies this.");
    writeNote("Data.md", "Short title.");
    writeNote("Data Model.md", "Long title.");

    const index = scanVault(dir);
    expect(index.unlinkedMentions.get("data")).toBeUndefined();
    expect(index.unlinkedMentions.get("data-model")?.map((note) => note.id)).toEqual(["source"]);
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

  it("does not treat wrapped list-link aliases as unlinked mentions", () => {
    writeNote("Source.md", "10. [[Other\n    target|Principles]]");
    writeNote("Other target.md", "Linked from a list.");
    writeNote("Principles.md", "Only present as the authored alias.");

    expect(scanVault(dir).unlinkedMentions.get("principles")).toBeUndefined();
  });

  it("does not treat text in nested raw HTML containers as an unlinked mention", () => {
    writeNote("Source.md", "Intro <span><span>ignored</span>Principles</span>");
    writeNote("Principles.md", "Only present inside nested HTML.");

    expect(scanVault(dir).unlinkedMentions.get("principles")).toBeUndefined();
  });

  it("keeps prose after self-closing HTML with quoted greater-than signs searchable", () => {
    writeNote("Source.md", 'Intro <svg aria-label="1 > 0" /> Principles');
    writeNote("Principles.md", "Mentioned after authored HTML.");

    expect(scanVault(dir).unlinkedMentions.get("principles")).toHaveLength(1);
  });

  it("does not treat nested callout type markers as unlinked mentions", () => {
    writeNote(
      "Source.md",
      "> [!note]\n> Read this carefully.\n\n- > [!note]\n  > Nested in a list.\n\n> > [!note]\n> > Nested in a quote.\n\n10. Item\n    > [!note]\n    > Ordered continuation.\n\n- Item\n  > [!note]\n  > Unordered continuation.\n\n* Item\n    > > [!note]\n    > > Unordered continuation and two quote depths.\n\n- Outer\n  1. Inner\n     > [!note]\n     > Nested list continuation.\n\n123456789. Item\n           > [!note]\n           > Wide ordered marker.",
    );
    writeNote("Note.md", "A note title that matches the callout type.");

    expect(scanVault(dir).unlinkedMentions.get("note")).toBeUndefined();
  });

  it("keeps callout-like text outside blockquotes searchable", () => {
    writeNote("Source.md", "[!warning] > comparison\n\nOrdinary prose\n    > [!warning]");
    writeNote("Warning.md", "A title matching ordinary prose.");

    expect(scanVault(dir).unlinkedMentions.get("warning")).toHaveLength(1);
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
