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

  it("leaves plain text and lone == alone", () => {
    expect(run("nothing").children).toHaveLength(1);
    const para = run("a == b");
    expect(para.children).toHaveLength(1);
  });
});
