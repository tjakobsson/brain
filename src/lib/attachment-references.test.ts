import { describe, expect, it } from "vitest";
import { parseAttachmentReferences } from "./attachment-references";

describe("parseAttachmentReferences", () => {
  it("parses standard images and file links", () => {
    const references = parseAttachmentReferences(
      "![diagram](../Media/flow%20chart.png) and [paper](</Files/Research paper.pdf#page=2>)",
    );

    expect(references).toMatchObject([
      {
        kind: "markdown-image",
        target: "../Media/flow%20chart.png",
        anchor: null,
        raw: "![diagram](../Media/flow%20chart.png)",
      },
      {
        kind: "markdown-link",
        target: "/Files/Research paper.pdf",
        anchor: "page=2",
        raw: "[paper](</Files/Research paper.pdf#page=2>)",
      },
    ]);
  });

  it("preserves spaces, Unicode names, aliases, and anchors in Brain embeds", () => {
    expect(parseAttachmentReferences("![[Média/über diagram.png#crop|Wide preview]]")).toMatchObject([
      {
        kind: "brain-embed",
        target: "Média/über diagram.png",
        anchor: "crop",
        alias: "Wide preview",
      },
    ]);
  });

  it("parses filename-only and vault-root references", () => {
    expect(parseAttachmentReferences("![[diagram.png]]\n[download](/Files/report.pdf)"))
      .toMatchObject([
        { kind: "brain-embed", target: "diagram.png" },
        { kind: "markdown-link", target: "/Files/report.pdf" },
      ]);
  });

  it("parses a Brain embed after wrapped prose with its source offset", () => {
    const source = "before\n![[diagram.png]]\nafter";
    expect(parseAttachmentReferences(source)).toMatchObject([
      {
        kind: "brain-embed",
        raw: "![[diagram.png]]",
        target: "diagram.png",
        index: source.indexOf("![[diagram.png]]"),
      },
    ]);
  });

  it.each([
    "![[diagram\n.png]]",
    "![[diagram.png#crop\narea]]",
    "![[diagram.png|wide\npreview]]",
  ])("rejects a line break inside embed delimiters: %j", (source) => {
    expect(parseAttachmentReferences(source)).toEqual([]);
  });

  it("does not treat note links, transclusions, external URLs, or anchors as attachments", () => {
    const noteTitles = new Set(["note title"]);
    const source = [
      "[[Note Title]]",
      "![[Note Title]]",
      "![[Folder/Other.md#Heading]]",
      "[Other](Folder/Other.md)",
      "[web](https://example.com/file.pdf)",
      "[mail](mailto:reader@example.com)",
      "[heading](#local)",
      "![remote](//cdn.example.com/image.png)",
    ].join("\n");

    expect(parseAttachmentReferences(source, noteTitles)).toEqual([]);
  });

  it("ignores attachment-looking syntax inside code", () => {
    const source = "`![[inline.png]]`\n```md\n![[block.png]]\n```\n![[real.png]]";
    expect(parseAttachmentReferences(source).map((reference) => reference.target)).toEqual([
      "real.png",
    ]);
  });

  it("returns references in source order with source offsets", () => {
    const source = "Before ![[first.png]] then ![second](second.png).";
    const references = parseAttachmentReferences(source);
    expect(references.map((reference) => reference.raw)).toEqual([
      "![[first.png]]",
      "![second](second.png)",
    ]);
    expect(references.map((reference) => source.slice(reference.index, reference.index + reference.raw.length)))
      .toEqual(references.map((reference) => reference.raw));
  });
});
