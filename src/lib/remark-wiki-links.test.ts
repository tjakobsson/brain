import type { Html, Link, Paragraph, Root, Text } from "mdast";
import { VFile } from "vfile";
import { describe, expect, it } from "vitest";
import { remarkWikiLinks } from "./remark-wiki-links";
import { slugify } from "./slugify";
import { routes } from "./routes";
import type { LinkIndex, VaultNote } from "./vault-scan";

function fakeNote(title: string): VaultNote {
  return {
    slug: slugify(title),
    title,
    route: routes.note(slugify(title)),
    filePath: `/vault/${title}.md`,
    meta: { type: "permanent", status: "draft", tags: [] },
    body: "",
    links: [],
    vaultPath: `${title}.md`,
    source: "",
    frontmatter: {},
    attachments: [],
  };
}

function fakeIndex(titles: string[]): LinkIndex {
  const byTitleKey = new Map(titles.map((t) => [t.toLowerCase(), fakeNote(t)]));
  return {
    notes: [...byTitleKey.values()],
    byTitleKey,
    edges: [],
    backlinks: new Map(),
    unlinkedMentions: new Map(),
    orphans: [],
    unresolved: [],
  };
}

function run(text: string, titles: string[], base = ""): Paragraph {
  const tree: Root = {
    type: "root",
    children: [{ type: "paragraph", children: [{ type: "text", value: text }] }],
  };
  remarkWikiLinks({ index: fakeIndex(titles), base })(tree, new VFile({ path: "Source Note.md" }));
  return tree.children[0] as Paragraph;
}

describe("remarkWikiLinks", () => {
  it("resolves a plain link to the note URL", () => {
    const para = run("See [[Note B]] for more.", ["Note B"]);
    const link = para.children[1] as Link;
    expect(link.type).toBe("link");
    expect(link.url).toBe("/notes/note-b");
    expect((link.children[0] as Text).value).toBe("Note B");
    expect(link.data?.hProperties).toEqual({ className: ["wiki-link"] });
  });

  it("renders the alias as display text", () => {
    const para = run("[[Note B|this note]]", ["Note B"]);
    const link = para.children[0] as Link;
    expect(link.url).toBe("/notes/note-b");
    expect((link.children[0] as Text).value).toBe("this note");
  });

  it("appends a slugified heading anchor", () => {
    const para = run("[[Note B#Deep Dive]]", ["Note B"]);
    expect((para.children[0] as Link).url).toBe("/notes/note-b#deep-dive");
  });

  it("applies a deployment base exactly once", () => {
    const para = run("[[Note B#Deep Dive]]", ["Note B"], "/vault-repo");
    const url = (para.children[0] as Link).url;
    expect(url).toBe("/vault-repo/notes/note-b#deep-dive");
    expect(url).not.toContain("/vault-repo/vault-repo");
  });

  it("preserves surrounding text", () => {
    const para = run("before [[Note B]] after", ["Note B"]);
    expect(para.children.map((c) => c.type)).toEqual(["text", "link", "text"]);
    expect((para.children[0] as Text).value).toBe("before ");
    expect((para.children[2] as Text).value).toBe(" after");
  });

  it("resolves a link after wrapped prose without consuming line breaks", () => {
    const para = run("before\n[[Note B]]\nafter", ["Note B"]);
    expect(para.children.map((c) => c.type)).toEqual(["text", "link", "text"]);
    expect((para.children[0] as Text).value).toBe("before\n");
    expect((para.children[1] as Link).url).toBe("/notes/note-b");
    expect((para.children[2] as Text).value).toBe("\nafter");
  });

  it("renders unwritten targets as a styled span", () => {
    const para = run("Someday [[Future idea]] maybe.", []);
    const html = para.children[1] as Html;
    expect(html.type).toBe("html");
    expect(html.value).toContain("wiki-link--unwritten");
    expect(html.value).toContain("Future idea");
    expect(html.value).toContain("Not yet written");
  });

  it("leaves link-free text untouched", () => {
    const para = run("nothing here", ["Note B"]);
    expect(para.children).toHaveLength(1);
    expect(para.children[0].type).toBe("text");
  });

  it("does not rewrite inside existing markdown links", () => {
    const tree: Root = {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [
            {
              type: "link",
              url: "https://example.com",
              children: [{ type: "text", value: "[[Note B]]" }],
            } as Link,
          ],
        },
      ],
    };
    remarkWikiLinks({ index: fakeIndex(["Note B"]) })(tree, new VFile({ path: "x.md" }));
    const link = (tree.children[0] as Paragraph).children[0] as Link;
    expect(link.type).toBe("link");
    expect(link.url).toBe("https://example.com");
  });
});
