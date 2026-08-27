import { describe, expect, it } from "vitest";
import { joinBase, routes, withFragment, type LogicalRoute } from "./routes";

describe("routes", () => {
  it("constructs logical note and encoded tag routes", () => {
    expect(routes.note("graphs-of-thought")).toBe("/notes/graphs-of-thought");
    expect(routes.tag("Café notes/#1")).toBe("/tags/Caf%C3%A9%20notes%2F%231");
    expect(routes.vaultAsset("Média/über diagram.png")).toBe(
      "/vault-assets/M%C3%A9dia/%C3%BCber%20diagram.png",
    );
  });

  it("adds encoded fragments to logical routes", () => {
    expect(withFragment(routes.note("note-a"), "deep dive")).toBe(
      "/notes/note-a#deep%20dive",
    );
  });
});

describe("joinBase", () => {
  const applicationRoutes: LogicalRoute[] = [
    routes.home,
    routes.graphAlias,
    routes.graphData,
    routes.searchIndex,
    routes.tags,
    routes.tag("pkm"),
    routes.recent,
    routes.orphans,
    routes.search,
    routes.note("note-a"),
    routes.vaultAsset("Media/image.png"),
    routes.faviconSvg,
    routes.faviconIco,
    routes.pagefind,
    routes.pagefindUiCss,
    routes.pagefindUiJs,
  ];

  it("preserves root-relative routes at a domain root", () => {
    for (const route of applicationRoutes) {
      expect(joinBase("", route)).toBe(route);
      expect(joinBase("/", route)).toBe(route);
    }
  });

  it("prefixes every application route exactly once", () => {
    for (const route of applicationRoutes) {
      const joined = joinBase("/vault-repo", route);
      expect(joined.startsWith("/vault-repo/")).toBe(true);
      expect(joined).not.toContain("/vault-repo/vault-repo");
    }
  });

  it("normalizes a trailing base slash and preserves the home slash", () => {
    expect(joinBase("/vault-repo/", routes.home)).toBe("/vault-repo/");
    expect(joinBase("/vault-repo/", routes.note("note-a"))).toBe(
      "/vault-repo/notes/note-a",
    );
  });

  it("preserves fragments", () => {
    expect(joinBase("/vault-repo", withFragment(routes.note("note-a"), "deep-dive"))).toBe(
      "/vault-repo/notes/note-a#deep-dive",
    );
  });

  it("rejects routes that already include the base", () => {
    expect(() =>
      joinBase("/vault-repo", "/vault-repo/notes/note-a" as LogicalRoute),
    ).toThrow("already includes deployment base");
  });

  it("rejects malformed bases and logical routes", () => {
    expect(() => joinBase("vault-repo", routes.home)).toThrow("Invalid deployment base");
    expect(() => joinBase("/vault-repo", "//notes/note-a" as LogicalRoute)).toThrow(
      "Invalid logical route",
    );
  });
});
