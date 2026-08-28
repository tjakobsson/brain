import type { Html, Paragraph, Root, Text } from "mdast";
import { VFile } from "vfile";
import { describe, expect, it } from "vitest";
import { remarkHighlights } from "./remark-highlights";

function run(text: string): Paragraph {
  const tree: Root = {
    type: "root",
    children: [{ type: "paragraph", children: [{ type: "text", value: text }] }],
  };
  remarkHighlights()(tree, new VFile({ path: "x.md" }));
  return tree.children[0] as Paragraph;
}

describe("remarkHighlights", () => {
  it("renders ==text== as a mark element", () => {
    const para = run("this ==matters a lot== here");
    expect(para.children.map((c) => c.type)).toEqual(["text", "html", "text"]);
    expect((para.children[1] as Html).value).toBe("<mark>matters a lot</mark>");
    expect((para.children[0] as Text).value).toBe("this ");
  });

  it("handles multiple highlights", () => {
    const para = run("==one== and ==two==");
    const htmls = para.children.filter((c) => c.type === "html") as Html[];
    expect(htmls.map((h) => h.value)).toEqual(["<mark>one</mark>", "<mark>two</mark>"]);
  });

  it("renders highlights across soft line breaks", () => {
    const para = run("before ==first line\nsecond line\nthird line== after");
    expect(para.children.map((c) => c.type)).toEqual(["text", "html", "text"]);
    expect((para.children[0] as Text).value).toBe("before ");
    expect((para.children[1] as Html).value).toBe(
      "<mark>first line\nsecond line\nthird line</mark>",
    );
    expect((para.children[2] as Text).value).toBe(" after");
  });

  it("escapes HTML inside multiline highlights", () => {
    const para = run("==first <tag>\nsecond & final==");
    expect((para.children[0] as Html).value).toBe(
      "<mark>first &lt;tag&gt;\nsecond &amp; final</mark>",
    );
  });

  it("handles adjacent single-line and multiline highlights", () => {
    const para = run("==one====two\ncontinued==");
    const htmls = para.children.filter((c) => c.type === "html") as Html[];
    expect(htmls.map((h) => h.value)).toEqual([
      "<mark>one</mark>",
      "<mark>two\ncontinued</mark>",
    ]);
  });

  it("leaves plain text and lone == alone", () => {
    expect(run("nothing").children).toHaveLength(1);
    const para = run("a == b");
    expect(para.children).toHaveLength(1);
    expect(run("a == b\nwithout a close").children).toHaveLength(1);
  });
});
