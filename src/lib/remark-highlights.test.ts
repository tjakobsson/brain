import type { Emphasis, Paragraph, Root, Text } from "mdast";
import { VFile } from "vfile";
import { describe, expect, it } from "vitest";
import { remarkHighlights, splitHighlightText } from "./remark-highlights";

function run(text: string): Paragraph {
  const tree: Root = {
    type: "root",
    children: [{ type: "paragraph", children: [{ type: "text", value: text }] }],
  };
  remarkHighlights()(tree, new VFile({ path: "x.md" }));
  return tree.children[0] as Paragraph;
}

describe("remarkHighlights", () => {
  it("shares safe text segments with non-Markdown excerpts", () => {
    expect(splitHighlightText("before ==<tag> & text== after")).toEqual([
      { value: "before ", highlighted: false },
      { value: "<tag> & text", highlighted: true },
      { value: " after", highlighted: false },
    ]);
  });

  it("renders ==text== as a mark element", () => {
    const para = run("this ==matters a lot== here");
    expect(para.children.map((c) => c.type)).toEqual(["text", "emphasis", "text"]);
    expect(para.children[1]).toMatchObject({
      type: "emphasis",
      children: [{ type: "text", value: "matters a lot" }],
      data: { hName: "mark" },
    });
    expect((para.children[0] as Text).value).toBe("this ");
  });

  it("handles multiple highlights", () => {
    const para = run("==one== and ==two==");
    const marks = para.children.filter((c) => c.type === "emphasis") as Emphasis[];
    expect(marks.map((mark) => (mark.children[0] as Text).value)).toEqual(["one", "two"]);
  });

  it("renders highlights across soft line breaks", () => {
    const para = run("before ==first line\nsecond line\nthird line== after");
    expect(para.children.map((c) => c.type)).toEqual(["text", "emphasis", "text"]);
    expect((para.children[0] as Text).value).toBe("before ");
    expect(((para.children[1] as Emphasis).children[0] as Text).value).toBe(
      "first line\nsecond line\nthird line",
    );
    expect((para.children[2] as Text).value).toBe(" after");
  });

  it("keeps HTML-sensitive content in a text node", () => {
    const para = run("==first <tag>\nsecond & final==");
    expect(((para.children[0] as Emphasis).children[0] as Text).value).toBe(
      "first <tag>\nsecond & final",
    );
  });

  it("renders inside authored anchors and other rendered HTML containers", () => {
    const tree: Root = {
      type: "root",
      children: [{
        type: "paragraph",
        children: [
          { type: "html", value: '<a href="/other">' },
          { type: "text", value: "==important==" },
          { type: "html", value: "</a>" },
          { type: "html", value: "<button>" },
          { type: "text", value: "==action==" },
          { type: "html", value: "</button>" },
        ],
      }],
    };

    remarkHighlights()(tree, new VFile({ path: "x.md" }));

    const children = (tree.children[0] as Paragraph).children;
    expect(children.filter((child) => child.type === "emphasis")).toHaveLength(2);
  });

  it("renders inside Markdown links", () => {
    const tree: Root = {
      type: "root",
      children: [{
        type: "paragraph",
        children: [{
          type: "link",
          url: "/other",
          children: [{ type: "text", value: "==important==" }],
        }],
      }],
    };

    remarkHighlights()(tree, new VFile({ path: "x.md" }));

    const link = (tree.children[0] as Paragraph).children[0];
    expect(link).toMatchObject({
      type: "link",
      children: [{ type: "emphasis", data: { hName: "mark" } }],
    });
  });

  it("skips raw-text and non-rendered HTML containers", () => {
    const children: Paragraph["children"] = [];
    const tags = [
      "datalist", "head", "iframe", "noembed", "noframes", "noscript", "option", "plaintext",
      "script", "select", "style", "template", "textarea", "title", "xmp",
    ];
    for (const tag of tags) {
      children.push(
        { type: "html", value: `<${tag}>` },
        { type: "text", value: `==${tag}==` },
        { type: "html", value: `</${tag}>` },
      );
    }
    const tree: Root = { type: "root", children: [{ type: "paragraph", children }] };

    remarkHighlights()(tree, new VFile({ path: "x.md" }));

    const transformed = (tree.children[0] as Paragraph).children;
    expect(transformed.some((child) => child.type === "emphasis")).toBe(false);
    expect(transformed.filter((child) => child.type === "text")).toHaveLength(tags.length);
  });

  it("handles adjacent single-line and multiline highlights", () => {
    const para = run("==one====two\ncontinued==");
    const marks = para.children.filter((c) => c.type === "emphasis") as Emphasis[];
    expect(marks.map((mark) => (mark.children[0] as Text).value)).toEqual([
      "one",
      "two\ncontinued",
    ]);
  });

  it("leaves plain text and lone == alone", () => {
    expect(run("nothing").children).toHaveLength(1);
    const para = run("a == b");
    expect(para.children).toHaveLength(1);
    expect(run("a == b\nwithout a close").children).toHaveLength(1);
  });
});
