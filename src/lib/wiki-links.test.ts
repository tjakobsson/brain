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
      anchor: null,
      alias: null,
      index: 4,
    });
  });

  it("parses an alias link", () => {
    const links = parseWikiLinks("[[Zettelkasten method|the ZK method]]");
    expect(links[0]).toMatchObject({
      target: "Zettelkasten method",
      alias: "the ZK method",
      anchor: null,
    });
  });

  it("parses a heading anchor link", () => {
    const links = parseWikiLinks("[[Graphs of thought#Clustering]]");
    expect(links[0]).toMatchObject({
      target: "Graphs of thought",
      anchor: "Clustering",
      alias: null,
    });
  });

  it("parses anchor and alias together", () => {
    const links = parseWikiLinks("[[Note#Section|read this]]");
    expect(links[0]).toMatchObject({
      target: "Note",
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

  it("returns nothing for plain markdown and empty text", () => {
    expect(parseWikiLinks("no links [here](page.md)")).toHaveLength(0);
    expect(parseWikiLinks("")).toHaveLength(0);
  });

  it("ignores Obsidian attachment embeds", () => {
    expect(parseWikiLinks("![[diagram.svg|preview]] and [[Note]]")).toMatchObject([
      { raw: "[[Note]]", target: "Note" },
    ]);
  });
});

describe("displayText", () => {
  it("prefers alias, falls back to target", () => {
    expect(displayText(parseWikiLinks("[[A|b]]")[0])).toBe("b");
    expect(displayText(parseWikiLinks("[[A]]")[0])).toBe("A");
  });
});

describe("wikiLinksToText", () => {
  it("replaces links with their display text", () => {
    expect(wikiLinksToText("a [[A|alpha]] and [[B]]")).toBe("a alpha and B");
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
