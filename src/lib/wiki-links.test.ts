import { describe, expect, it } from "vitest";
import {
  displayText,
  parseWikiLinks,
  stripCode,
  stripMarkdownLinks,
  wikiLinksToText,
} from "./wiki-links";

describe("parseWikiLinks", () => {
  it("parses a plain link", () => {
    const links = parseWikiLinks("See [[Note Title]] for more.");
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      raw: "[[Note Title]]",
      target: "Note Title",
      targetBrainId: null,
      anchor: null,
      alias: null,
      index: 4,
    });
  });

  it("parses an alias link", () => {
    const links = parseWikiLinks("[[Zettelkasten method|the ZK method]]");
    expect(links[0]).toMatchObject({
      target: "Zettelkasten method",
      targetBrainId: null,
      alias: "the ZK method",
      anchor: null,
    });
  });

  it("parses a heading anchor link", () => {
    const links = parseWikiLinks("[[Graphs of thought#Clustering]]");
    expect(links[0]).toMatchObject({
      target: "Graphs of thought",
      targetBrainId: null,
      anchor: "Clustering",
      alias: null,
    });
  });

  it("parses anchor and alias together", () => {
    const links = parseWikiLinks("[[Note#Section|read this]]");
    expect(links[0]).toMatchObject({
      target: "Note",
      targetBrainId: null,
      anchor: "Section",
      alias: "read this",
    });
  });

  it("parses multiple links with correct indices", () => {
    const text = "[[A]] then [[B|bee]]";
    const links = parseWikiLinks(text);
    expect(links).toHaveLength(2);
    expect(links[0].index).toBe(0);
    expect(links[1].index).toBe(11);
    expect(links[1].alias).toBe("bee");
  });

  it("trims whitespace around parts", () => {
    const links = parseWikiLinks("[[  Spaced Note  |  alias  ]]");
    expect(links[0].target).toBe("Spaced Note");
    expect(links[0].alias).toBe("alias");
  });

  it.each([
    ["[[@design/Interaction model]]", "design", "Interaction model", null, null],
    ["[[@product-design/Interaction model|the model]]", "product-design", "Interaction model", null, "the model"],
    ["[[@research/Cognitive load#Measurements]]", "research", "Cognitive load", "Measurements", null],
    ["[[@research/Cognitive load#Measurements|the data]]", "research", "Cognitive load", "Measurements", "the data"],
    ["[[@people/Email @ work]]", "people", "Email @ work", null, null],
    ["[[  @brain-2/  Spaced Note  #  Deep Dive  |  alias  ]]", "brain-2", "Spaced Note", "Deep Dive", "alias"],
  ])(
    "parses a foreign link: %s",
    (source, targetBrainId, target, anchor, alias) => {
      expect(parseWikiLinks(source)).toMatchObject([
        { raw: source, targetBrainId, target, anchor, alias, index: 0, length: source.length },
      ]);
    },
  );

  it.each([
    "[[@/Note]]",
    "[[@brain]]",
    "[[@brain/]]",
    "[[@brain/   ]]",
    "[[@Brain/Note]]",
    "[[@brain_id/Note]]",
    "[[@-brain/Note]]",
    "[[@brain-/Note]]",
    "[[@brain--id/Note]]",
    "[[@brain id/Note]]",
    "[[@@brain/Note]]",
    "[[@brain//Note]]",
    "[[@brain/folder/Note]]",
    "[[@Bad/Note#Heading|alias]]",
  ])("rejects a malformed leading brain namespace instead of treating it as a local title: %s", (source) => {
    expect(parseWikiLinks(source)).toEqual([]);
  });

  it.each([
    ["[[Email @ work]]", "Email @ work"],
    ["[[name@example.com]]", "name@example.com"],
    ["[[Note@brain]]", "Note@brain"],
    ["[[Note @brain/section]]", "Note @brain/section"],
  ])("preserves an ordinary @ in a local title: %s", (source, target) => {
    expect(parseWikiLinks(source)).toMatchObject([{ target, targetBrainId: null }]);
  });

  it("returns nothing for plain markdown and empty text", () => {
    expect(parseWikiLinks("no links [here](page.md)")).toHaveLength(0);
    expect(parseWikiLinks("")).toHaveLength(0);
  });

  it("ignores Brain attachment embeds", () => {
    expect(parseWikiLinks("![[diagram.svg|preview]] and [[Note]]")).toMatchObject([
      { raw: "[[Note]]", target: "Note" },
    ]);
  });

  it("normalizes soft-wrapped fields while preserving raw source offsets", () => {
    const raw = "[[@product-design/Interaction\n  model#Deep\n Dive|the\n  model]]";
    const source = `Before ${raw} after`;

    expect(parseWikiLinks(source)).toEqual([{
      raw,
      target: "Interaction model",
      targetBrainId: "product-design",
      anchor: "Deep Dive",
      alias: "the model",
      index: 7,
      length: raw.length,
    }]);
  });

  it.each([
    ["[[Wrapped\nlocal target]]", "Wrapped local target"],
    ["[[Future\nidea]]", "Future idea"],
    ["[[Note#Deep\nsection]]", "Note"],
    ["[[Note|read\nthis]]", "Note"],
  ])("parses a soft-wrapped wiki-link: %j", (source, target) => {
    expect(parseWikiLinks(source)).toMatchObject([{ raw: source, target }]);
  });

  it("continues to exclude soft-wrapped attachment embeds", () => {
    expect(parseWikiLinks("![[diagram\n.svg|preview]] and [[Note\nTitle]]")).toMatchObject([
      { raw: "[[Note\nTitle]]", target: "Note Title" },
    ]);
  });

  it.each([
    "[[Note\n\nTitle]]",
    "[[Note\n  \nTitle]]",
    "[[Note  \nTitle]]",
    "[[Note\\\nTitle]]",
    "[[Note\n# Heading]]",
    "[[Note\n> quote]]",
    "[[Note\n- list item]]",
    "[[Note\n1. list item]]",
    "[[Note\n    code]]",
    "[[Note\n```code]]",
  ])("rejects a wiki-link crossing a hard break or block boundary: %j", (source) => {
    expect(parseWikiLinks(source)).toEqual([]);
  });
});

describe("displayText", () => {
  it("returns the alias or unqualified target title", () => {
    expect(displayText(parseWikiLinks("[[A|b]]")[0])).toBe("b");
    expect(displayText(parseWikiLinks("[[A]]")[0])).toBe("A");
    expect(displayText(parseWikiLinks("[[@design/A]]")[0])).toBe("A");
    expect(displayText(parseWikiLinks("[[@design/A|b]]")[0])).toBe("b");
  });
});

describe("wikiLinksToText", () => {
  it("reduces local and foreign links using their display text", () => {
    expect(wikiLinksToText("[[A]], [[@design/B]], and [[@research/C#Part|cee]]")).toBe(
      "A, B, and cee",
    );
  });

  it("leaves malformed namespaces literal while reducing later valid links", () => {
    expect(wikiLinksToText("[[@Bad/A]] then [[B]] and [[Email @ work]]")).toBe(
      "[[@Bad/A]] then B and Email @ work",
    );
  });

  it("reduces soft-wrapped wiki-links to normalized display text", () => {
    expect(wikiLinksToText("See [[Note\nTitle]] or [[Other|the\n  alias]].")).toBe(
      "See Note Title or the alias.",
    );
  });
});

describe("stripCode", () => {
  it("removes fenced blocks and inline code", () => {
    const text = "before ```\ncode [[Not a link]]\n``` middle `inline [[x]]` after";
    const stripped = stripCode(text);
    expect(stripped).not.toContain("Not a link");
    expect(stripped).not.toContain("inline");
    expect(stripped).toContain("before");
    expect(stripped).toContain("after");
  });
});

describe("stripMarkdownLinks", () => {
  it("keeps visible text, drops URLs and images", () => {
    expect(stripMarkdownLinks("a [shown](page.md) ![alt](img.png)")).toBe("a shown alt");
  });
});
