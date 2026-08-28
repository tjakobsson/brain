import { describe, expect, it } from "vitest";
import {
  canonicalBrainSelection,
  combinedRoutes,
  joinBase,
  routes,
  routesFor,
  withFragment,
  type LogicalRoute,
} from "./routes";

const registry = [{ id: "research" }, { id: "engineering" }, { id: "design" }] as const;

describe("routes", () => {
  it("preserves every single-vault route", () => {
    expect(routes.home).toBe("/");
    expect(routes.graphAlias).toBe("/graph");
    expect(routes.graphData).toBe("/graph-data.json");
    expect(routes.searchIndex).toBe("/search-index.json");
    expect(routes.tags).toBe("/tags");
    expect(routes.tag("pkm")).toBe("/tags/pkm");
    expect(routes.recent).toBe("/recent");
    expect(routes.orphans).toBe("/orphans");
    expect(routes.search).toBe("/search");
    expect(routes.note("graphs-of-thought")).toBe("/notes/graphs-of-thought");
    expect(routes.vaultAsset("Media/image.png")).toBe("/vault-assets/Media/image.png");
    expect(routes.faviconSvg).toBe("/favicon.svg");
    expect(routes.faviconIco).toBe("/favicon.ico");
    expect(routes.pagefind).toBe("/pagefind/");
    expect(routes.pagefindUiCss).toBe("/pagefind/pagefind-ui.css");
    expect(routes.pagefindUiJs).toBe("/pagefind/pagefind-ui.js");
  });

  it("encodes dynamic single-vault route segments", () => {
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

describe("routesFor", () => {
  it("returns unchanged routes in single-vault mode", () => {
    const scoped = routesFor({ mode: "vault" });

    expect(scoped.graph).toBe("/");
    expect(scoped.tags).toBe("/tags");
    expect(scoped.tag("pkm")).toBe("/tags/pkm");
    expect(scoped.recent).toBe("/recent");
    expect(scoped.orphans).toBe("/orphans");
    expect(scoped.search).toBe("/search");
    expect(scoped.note("note-a")).toBe("/notes/note-a");
    expect(scoped.asset("Media/image.png")).toBe("/vault-assets/Media/image.png");
  });

  it("constructs every brain-scoped workspace route", () => {
    const scoped = routesFor({ mode: "workspace", brainId: "engineering" });

    expect(scoped.graph).toBe("/brains/engineering");
    expect(scoped.tags).toBe("/brains/engineering/tags");
    expect(scoped.tag("pkm")).toBe("/brains/engineering/tags/pkm");
    expect(scoped.recent).toBe("/brains/engineering/recent");
    expect(scoped.orphans).toBe("/brains/engineering/orphans");
    expect(scoped.search).toBe("/brains/engineering/search");
    expect(scoped.note("note-a")).toBe("/brains/engineering/notes/note-a");
    expect(scoped.asset("Media/image.png")).toBe(
      "/brains/engineering/assets/Media/image.png",
    );
  });

  it("encodes each dynamic workspace segment without consuming a deployment base", () => {
    const scoped = routesFor({ mode: "workspace", brainId: "R&D / notes" });

    expect(scoped.graph).toBe("/brains/R%26D%20%2F%20notes");
    expect(scoped.note("café / #1")).toBe(
      "/brains/R%26D%20%2F%20notes/notes/caf%C3%A9%20%2F%20%231",
    );
    expect(scoped.tag("systems/web")).toBe(
      "/brains/R%26D%20%2F%20notes/tags/systems%2Fweb",
    );
    expect(scoped.asset("Média/über diagram #1.png")).toBe(
      "/brains/R%26D%20%2F%20notes/assets/M%C3%A9dia/%C3%BCber%20diagram%20%231.png",
    );
  });
});

describe("combined brain selections", () => {
  it("deduplicates and serializes selections in registry order", () => {
    expect(canonicalBrainSelection(registry, ["design", "research", "design"])).toEqual({
      valid: true,
      brainIds: ["research", "design"],
      value: "research,design",
    });
  });

  it("canonicalizes comma-separated query selections", () => {
    expect(canonicalBrainSelection(registry, "engineering,research,engineering")).toEqual({
      valid: true,
      brainIds: ["research", "engineering"],
      value: "research,engineering",
    });
  });

  it("constructs canonical graph and search routes", () => {
    expect(combinedRoutes(registry, ["design", "research", "design"])).toEqual({
      valid: true,
      brainIds: ["research", "design"],
      graph: "/graph?brains=research,design",
      search: "/search?brains=research,design",
    });
  });

  it("encodes selected IDs while retaining comma separators", () => {
    const unusualRegistry = [{ id: "brain one" }, { id: "research/design" }] as const;

    expect(combinedRoutes(unusualRegistry, ["research/design", "brain one"])).toEqual({
      valid: true,
      brainIds: ["brain one", "research/design"],
      graph: "/graph?brains=brain%20one,research%2Fdesign",
      search: "/search?brains=brain%20one,research%2Fdesign",
    });
  });

  it("reports distinct unknown IDs instead of returning partial routes", () => {
    expect(
      combinedRoutes(registry, ["research", "missing", "other", "missing", "design"]),
    ).toEqual({
      valid: false,
      unknownBrainIds: ["missing", "other"],
    });
  });

  it("distinguishes an empty query value from an empty programmatic selection", () => {
    expect(canonicalBrainSelection(registry, "")).toEqual({
      valid: false,
      unknownBrainIds: [""],
    });
    expect(canonicalBrainSelection(registry, [])).toEqual({
      valid: true,
      brainIds: [],
      value: "",
    });
  });
});

describe("joinBase", () => {
  const workspace = routesFor({ mode: "workspace", brainId: "engineering" });
  const combined = combinedRoutes(registry, ["design", "research"]);
  if (!combined.valid) throw new Error("Test registry must contain the selected brains");

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
    workspace.graph,
    workspace.tags,
    workspace.tag("pkm/web"),
    workspace.recent,
    workspace.orphans,
    workspace.search,
    workspace.note("note-a"),
    workspace.asset("Media/image.png"),
    combined.graph,
    combined.search,
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

  it("prefixes workspace and combined routes without changing their selection", () => {
    expect(joinBase("/brain-site", workspace.note("note-a"))).toBe(
      "/brain-site/brains/engineering/notes/note-a",
    );
    expect(joinBase("/brain-site/", combined.graph)).toBe(
      "/brain-site/graph?brains=research,design",
    );
    expect(joinBase("/brain-site", combined.search)).toBe(
      "/brain-site/search?brains=research,design",
    );
  });

  it("preserves fragments", () => {
    expect(joinBase("/vault-repo", withFragment(routes.note("note-a"), "deep-dive"))).toBe(
      "/vault-repo/notes/note-a#deep-dive",
    );
  });

  it("allows deployment bases that overlap application route segments", () => {
    expect(joinBase("/notes", routes.note("note-a"))).toBe("/notes/notes/note-a");
    expect(joinBase("/tags", routes.tag("pkm"))).toBe("/tags/tags/pkm");
  });

  it("rejects malformed bases and logical routes", () => {
    expect(() => joinBase("vault-repo", routes.home)).toThrow("Invalid deployment base");
    expect(() => joinBase("/vault-repo", "//notes/note-a" as LogicalRoute)).toThrow(
      "Invalid logical route",
    );
  });
});
