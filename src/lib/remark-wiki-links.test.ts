import type { Html, Link, Paragraph, Root, Text } from "mdast";
import { VFile } from "vfile";
import { describe, expect, it } from "vitest";
import { remarkWikiLinks } from "./remark-wiki-links";
import { slugify } from "./slugify";
import { routes } from "./routes";
import type { LinkIndex, VaultNote } from "./vault-scan";
import { compositeNoteId, SINGLE_BRAIN_ID } from "./note-identity";
import path from "node:path";
import { createWorkspaceSnapshot } from "./vault-loader";

function fakeNote(title: string): VaultNote {
  return {
    id: slugify(title),
    brainId: SINGLE_BRAIN_ID,
    compositeId: compositeNoteId(SINGLE_BRAIN_ID, slugify(title)),
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
  const source = fakeNote("Source Note");
  const byTitleKey = new Map(titles.map((t) => [t.toLowerCase(), fakeNote(t)]));
  byTitleKey.set(source.title.toLowerCase(), source);
  return {
    notes: [...byTitleKey.values()],
    byId: new Map([...byTitleKey.values()].map((note) => [note.id, note])),
    byBrainAndTitleKey: new Map([[SINGLE_BRAIN_ID, byTitleKey]]),
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
  remarkWikiLinks({ index: fakeIndex(titles), base, brainAccents: new Map() })(
    tree,
    new VFile({ path: "/vault/Source Note.md" }),
  );
  return tree.children[0] as Paragraph;
}

function runWorkspace(text: string, source: string): Paragraph {
  const snapshot = createWorkspaceSnapshot({
    mode: "workspace",
    vaultDir: path.resolve("examples/demo-vault"),
    workspacePath: path.resolve("examples/demo-workspace/workspace.json"),
    outputDir: path.resolve("dist"),
    exclusions: [],
    strictLinks: false,
  });
  const tree: Root = {
    type: "root",
    children: [{ type: "paragraph", children: [{ type: "text", value: text }] }],
  };
  remarkWikiLinks({
    index: snapshot.index,
    brainAccents: new Map(snapshot.registry.brains.map((brain) => [brain.id, brain.accent])),
  })(tree, new VFile({ path: source }));
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

  it("resolves local and foreign targets from the exact source owner", () => {
    const workspace = path.resolve("examples/demo-workspace/brains");
    const engineering = runWorkspace(
      "[[Principles]] and [[@design/Principles#Rationale|design rules]]",
      path.join(workspace, "engineering", "Principles.md"),
    );
    const design = runWorkspace(
      "[[Principles]]",
      path.join(workspace, "design", "Principles.md"),
    );

    expect((engineering.children[0] as Link).url).toBe(
      "/brains/engineering/notes/principles",
    );
    expect((engineering.children[2] as Link).url).toBe(
      "/brains/design/notes/principles#rationale",
    );
    expect((engineering.children[2] as Link).data?.hProperties).toMatchObject({
      className: ["wiki-link", "wiki-link--foreign"],
      "data-brain-id": "design",
      style: "--brain-accent: #b56cff",
    });
    expect((engineering.children[2] as Link).children).toEqual([
      { type: "text", value: "design rules" },
      {
        type: "html",
        value: '<span class="brain-badge"><span aria-hidden="true">↗</span> @design</span>',
      },
    ]);
    expect((design.children[0] as Link).url).toBe("/brains/design/notes/principles");
  });

  it("distinguishes missing foreign notes from unknown brains", () => {
    const source = path.resolve(
      "examples/demo-workspace/brains/engineering/Principles.md",
    );
    const paragraph = runWorkspace(
      "[[@design/Future interaction]] and [[@missing-brain/Unknown principle]]",
      source,
    );
    expect((paragraph.children[0] as Html).value).toContain(
      'data-brain-id="design"',
    );
    expect((paragraph.children[0] as Html).value).toContain("@design");
    expect((paragraph.children[0] as Html).value).toContain("--brain-accent: #b56cff");
    expect((paragraph.children[0] as Html).value).toContain("Not yet written in @design");
    expect((paragraph.children[2] as Html).value).toContain("wiki-link--unknown-brain");
    expect((paragraph.children[2] as Html).value).toContain("Unknown brain: missing-brain");
    expect((paragraph.children[2] as Html).value).toContain(">?</span> @missing-brain");
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
    remarkWikiLinks({ index: fakeIndex(["Note B"]), brainAccents: new Map() })(
      tree,
      new VFile({ path: "/vault/Source Note.md" }),
    );
    const link = (tree.children[0] as Paragraph).children[0] as Link;
    expect(link.type).toBe("link");
    expect(link.url).toBe("https://example.com");
  });
});
