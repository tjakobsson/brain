import type { Element, Properties, Root } from "hast";
import { describe, expect, it } from "vitest";
import { isExternalHref, rehypeExternalLinks } from "./rehype-external-links";

function anchor(href: string, properties: Properties = {}): Element {
  return {
    type: "element",
    tagName: "a",
    properties: { href, ...properties },
    children: [{ type: "text", value: href }],
  };
}

function run(link: Element, site?: string): Element {
  const tree: Root = {
    type: "root",
    children: [{
      type: "element",
      tagName: "p",
      properties: {},
      children: [link],
    }],
  };
  rehypeExternalLinks({ site })(tree);
  return link;
}

describe("isExternalHref", () => {
  const site = "https://brain.example/notes/";

  it("classifies cross-origin HTTP and HTTPS links", () => {
    expect(isExternalHref("https://docs.astro.build/", site)).toBe(true);
    expect(isExternalHref("http://brain.example/", site)).toBe(true);
  });

  it("keeps same-origin absolute links internal", () => {
    expect(isExternalHref("https://brain.example/other?view=full#top", site)).toBe(false);
    expect(isExternalHref("https://BRAIN.example:443/other", site)).toBe(false);
  });

  it("treats absolute web URLs as external when no site is configured", () => {
    expect(isExternalHref("https://docs.astro.build/")).toBe(true);
    expect(isExternalHref("http://example.com/")).toBe(true);
    expect(isExternalHref("/notes/local")).toBe(false);
  });

  it.each([
    "notes/local",
    "/notes/local",
    "#heading",
    "attachments/diagram.pdf",
    "mailto:reader@example.com",
    "tel:+46701234567",
  ])("does not classify %s as an external website", (href) => {
    expect(isExternalHref(href, site)).toBe(false);
  });
});

describe("rehypeExternalLinks", () => {
  it("annotates parsed cross-origin anchors and leaves local links alone", () => {
    const external = anchor("https://docs.astro.build/");
    const internal = anchor("https://brain.example/about");
    const tree: Root = {
      type: "root",
      children: [external, internal, { type: "raw", value: '<a href="https://raw.example">raw</a>' }],
    };

    rehypeExternalLinks({ site: "https://brain.example" })(tree);

    expect(external.properties.className).toContain("external-link");
    expect(internal.properties.className).toBeUndefined();
    expect(tree.children[2]).toEqual({
      type: "raw",
      value: '<a href="https://raw.example">raw</a>',
    });
  });

  it("preserves authored classes", () => {
    const link = run(anchor("https://example.com", { className: ["citation", "quiet"] }), "https://brain.example");
    expect(link.properties.className).toEqual(["citation", "quiet", "external-link"]);
  });

  it("preserves authored target behavior without adding target or rel", () => {
    const ordinary = run(anchor("https://example.com"), "https://brain.example");
    const newContext = run(
      anchor("https://example.com", { target: "_blank", rel: ["author"] }),
      "https://brain.example",
    );

    expect(ordinary.properties).not.toHaveProperty("target");
    expect(ordinary.properties).not.toHaveProperty("rel");
    expect(newContext.properties.target).toBe("_blank");
    expect(newContext.properties.rel).toEqual(["author"]);
  });

  it("is idempotent", () => {
    const link = anchor("https://example.com", { className: ["citation"] });
    run(link, "https://brain.example");
    const once = structuredClone(link);

    run(link, "https://brain.example");

    expect(link).toEqual(once);
  });

  it("appends a decorative box-arrow SVG and an accessible label", () => {
    const link = run(anchor("https://example.com"), "https://brain.example");
    const icon = link.children[1] as Element;
    const label = link.children[2] as Element;

    expect(icon).toMatchObject({
      type: "element",
      tagName: "svg",
      properties: {
        ariaHidden: "true",
        className: ["external-link__icon"],
        focusable: "false",
        viewBox: "0 0 16 16",
      },
      children: [{ type: "element", tagName: "path", properties: { d: expect.any(String) } }],
    });
    expect(label).toEqual({
      type: "element",
      tagName: "span",
      properties: { className: ["visually-hidden"] },
      children: [{ type: "text", value: "external site" }],
    });
  });
});
