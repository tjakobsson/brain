import type { Image, Paragraph, Root, Text } from "mdast";
import { VFile } from "vfile";
import { describe, expect, it } from "vitest";
import type { ResolvedAttachment } from "./attachment-resolution";
import { remarkAttachments } from "./remark-attachments";

const attachment: ResolvedAttachment = {
  source: {
    slug: "source",
    title: "Source",
    route: "/notes/source",
    filePath: "/vault/Source.md",
    meta: { type: "permanent", status: "draft", tags: [] },
    body: "",
    links: [],
    vaultPath: "Source.md",
    source: "",
    frontmatter: {},
    attachments: [],
  },
  reference: {
    kind: "obsidian-embed",
    raw: "![[diagram.png]]",
    target: "diagram.png",
    anchor: null,
    alias: null,
    index: 7,
  },
  entry: {
    path: "Media/diagram.png",
    absolutePath: "/vault/Media/diagram.png",
    realPath: "/vault/Media/diagram.png",
    kind: "file",
  },
};

describe("remarkAttachments", () => {
  it("renders an embed after wrapped prose without consuming line breaks", () => {
    const tree: Root = {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [{ type: "text", value: "before\n![[diagram.png]]\nafter" }],
        },
      ],
    };
    remarkAttachments({ attachments: [attachment] })(
      tree,
      new VFile({ path: "/vault/Source.md" }),
    );

    const paragraph = tree.children[0] as Paragraph;
    expect(paragraph.children.map((child) => child.type)).toEqual(["text", "image", "text"]);
    expect((paragraph.children[0] as Text).value).toBe("before\n");
    expect((paragraph.children[1] as Image).url).toBe("/vault-assets/Media/diagram.png");
    expect((paragraph.children[2] as Text).value).toBe("\nafter");
  });
});
