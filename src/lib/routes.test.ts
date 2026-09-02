import { describe, expect, it } from "vitest";
import {
  brainSelectionContext,
  canonicalBrainSelection,
  combinedRoutes,
  joinBase,
  routes,
  routesFor,
  singularQueryValue,
  stripBase,
  withBrainScope,
  withFragment,
  withGraphContext,
  withGraphFocus,
  withoutGraphFocus,
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
    expect(routes.note("graphs-of-thought")).toBe("/notes/graphs-of-thought");
    expect(routes.vaultAsset("Media/image.png")).toBe("/vault-assets/Media/image.png");
    expect(routes.faviconSvg).toBe("/favicon.svg");
    expect(routes.faviconIco).toBe("/favicon.ico");
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

  it("constructs a canonical graph route", () => {
    expect(combinedRoutes(registry, ["design", "research", "design"])).toEqual({
      valid: true,
      brainIds: ["research", "design"],
      graph: "/graph?brains=research,design",
    });
  });

  it("encodes selected IDs while retaining comma separators", () => {
    const unusualRegistry = [{ id: "brain one" }, { id: "research/design" }] as const;

    expect(combinedRoutes(unusualRegistry, ["research/design", "brain one"])).toEqual({
      valid: true,
      brainIds: ["brain one", "research/design"],
      graph: "/graph?brains=brain%20one,research%2Fdesign",
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

  it("derives chooser, single-brain, and canonical combined routes", () => {
    expect(brainSelectionContext(registry, [])).toEqual({
      valid: true,
      brainIds: [],
      value: "",
      kind: "chooser",
      graph: "/",
    });
    expect(brainSelectionContext(registry, ["engineering"])).toEqual({
      valid: true,
      brainIds: ["engineering"],
      value: "engineering",
      kind: "brain",
      graph: "/brains/engineering",
    });
    expect(brainSelectionContext(registry, ["design", "research", "design"])).toEqual({
      valid: true,
      brainIds: ["research", "design"],
      value: "research,design",
      kind: "combined",
      graph: "/graph?brains=research,design",
    });
  });

  it("does not derive a route when any selected brain is unknown", () => {
    expect(brainSelectionContext(registry, ["research", "missing"])).toEqual({
      valid: false,
      unknownBrainIds: ["missing"],
    });
  });
});

describe("note browsing scope", () => {
  const note = routesFor({ mode: "workspace", brainId: "engineering" }).note("note-a");

  it("omits absent and empty scope", () => {
    expect(withBrainScope(registry, note)).toEqual({
      valid: true,
      brainIds: [],
      value: "",
      route: note,
    });
    expect(withBrainScope(registry, `${note}?brains=research#details`, [])).toEqual({
      valid: true,
      brainIds: [],
      value: "",
      route: `${note}#details`,
    });
  });

  it("adds canonical one-Brain and combined scope before other query state", () => {
    expect(withBrainScope(registry, note, "engineering")).toEqual({
      valid: true,
      brainIds: ["engineering"],
      value: "engineering",
      route: `${note}?brains=engineering`,
    });
    expect(
      withBrainScope(
        registry,
        `${note}?focus=engineering%2Fnote-a#deep-dive`,
        ["design", "research", "design"],
      ),
    ).toEqual({
      valid: true,
      brainIds: ["research", "design"],
      value: "research,design",
      route: `${note}?brains=research,design&focus=engineering%2Fnote-a#deep-dive`,
    });
  });

  it("rejects unknown scope without returning a partial note route", () => {
    expect(withBrainScope(registry, note, ["research", "missing"])).toEqual({
      valid: false,
      unknownBrainIds: ["missing"],
    });
  });
});

describe("focused graph routes", () => {
  const knownCompositeIds = [
    "research/note-a",
    "engineering/note-a",
    "design/note-b",
  ] as const;

  it("adds focus to root, per-Brain, and canonical combined graph routes", () => {
    expect(withGraphFocus(routes.home, knownCompositeIds, "research/note-a")).toBe(
      "/?focus=research%2Fnote-a",
    );
    expect(
      withGraphFocus(
        routesFor({ mode: "workspace", brainId: "engineering" }).graph,
        knownCompositeIds,
        "engineering/note-a",
      ),
    ).toBe("/brains/engineering?focus=engineering%2Fnote-a");
    expect(
      withGraphFocus(
        "/graph?brains=research,design",
        knownCompositeIds,
        "design/note-b",
      ),
    ).toBe("/graph?brains=research,design&focus=design%2Fnote-b");
  });

  it("replaces focus without changing valid Brain state or fragments", () => {
    expect(
      withGraphFocus(
        "/graph?focus=research%2Fnote-a&brains=research,design#neighborhood",
        knownCompositeIds,
        "design/note-b",
      ),
    ).toBe("/graph?brains=research,design&focus=design%2Fnote-b#neighborhood");
  });

  it("removes absent, unknown, and explicitly cleared focus", () => {
    const focused = "/graph?brains=research,design&focus=research%2Fnote-a#neighborhood";

    expect(withGraphFocus(focused, knownCompositeIds, "missing/note")).toBe(
      "/graph?brains=research,design#neighborhood",
    );
    expect(withGraphFocus(focused, knownCompositeIds)).toBe(
      "/graph?brains=research,design#neighborhood",
    );
    expect(withoutGraphFocus(focused)).toBe("/graph?brains=research,design#neighborhood");
  });

  it("keeps focused routes base-correct at root and below a deployment subpath", () => {
    const focused = withGraphFocus(
      "/graph?brains=research,design",
      knownCompositeIds,
      "research/note-a",
    );

    expect(joinBase("", focused)).toBe(
      "/graph?brains=research,design&focus=research%2Fnote-a",
    );
    expect(joinBase("/brain-site", focused)).toBe(
      "/brain-site/graph?brains=research,design&focus=research%2Fnote-a",
    );
  });

  it("composes canonical note scope and originating focus before fragments", () => {
    const note = `${routesFor({ mode: "workspace", brainId: "engineering" }).note("note-a")}#details` as LogicalRoute;
    expect(
      withGraphContext(
        registry,
        knownCompositeIds,
        note,
        ["design", "research", "design"],
        "research/note-a",
      ),
    ).toEqual({
      valid: true,
      brainIds: ["research", "design"],
      value: "research,design",
      route: "/brains/engineering/notes/note-a?brains=research,design&focus=research%2Fnote-a#details",
    });
  });

  it("drops unknown focus while retaining valid scope and rejects unknown scope", () => {
    const note = routesFor({ mode: "workspace", brainId: "engineering" }).note("note-a");
    expect(withGraphContext(registry, knownCompositeIds, note, ["engineering"], "missing/note"))
      .toEqual({
        valid: true,
        brainIds: ["engineering"],
        value: "engineering",
        route: `${note}?brains=engineering`,
      });
    expect(withGraphContext(registry, knownCompositeIds, note, ["engineering", "missing"], "engineering/note-a"))
      .toEqual({ valid: false, unknownBrainIds: ["missing"] });
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
    routes.note("note-a"),
    routes.vaultAsset("Media/image.png"),
    routes.faviconSvg,
    routes.faviconIco,
    workspace.graph,
    workspace.tags,
    workspace.tag("pkm/web"),
    workspace.recent,
    workspace.orphans,
    workspace.note("note-a"),
    workspace.asset("Media/image.png"),
    combined.graph,
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

describe("singularQueryValue", () => {
  it("distinguishes absent, singular, and duplicate parameters", () => {
    expect(singularQueryValue(new URLSearchParams("focus=note"), "brains")).toEqual({
      present: false,
      valid: true,
    });
    expect(singularQueryValue(new URLSearchParams("brains=engineering,design"), "brains"))
      .toEqual({ present: true, valid: true, value: "engineering,design" });
    expect(singularQueryValue(new URLSearchParams("brains=engineering&brains=unknown"), "brains"))
      .toEqual({ present: true, valid: false });
  });
});

describe("stripBase", () => {
  it("returns logical paths for root and subpath deployments", () => {
    expect(stripBase("", "/brains/engineering/notes/missing")).toBe(
      "/brains/engineering/notes/missing",
    );
    expect(stripBase("/", "/brains/engineering/notes/missing")).toBe(
      "/brains/engineering/notes/missing",
    );
    expect(stripBase("/brain-site", "/brain-site/brains/engineering/notes/missing")).toBe(
      "/brains/engineering/notes/missing",
    );
    expect(stripBase("/brain-site/", "/brain-site/")).toBe("/");
  });

  it("rejects paths outside the base, including overlapping prefixes", () => {
    expect(stripBase("/brain", "/brains/engineering")).toBeNull();
    expect(stripBase("/brain-site", "/other/brain-site/notes/missing")).toBeNull();
    expect(stripBase("/notes", "/notes-other/missing")).toBeNull();
    expect(stripBase("/notes", "/notes/notes/missing")).toBe("/notes/missing");
  });

  it("rejects malformed bases and pathnames", () => {
    expect(() => stripBase("brain-site", "/brain-site/missing")).toThrow(
      "Invalid deployment base",
    );
    expect(stripBase("/brain-site", "brain-site/missing")).toBeNull();
    expect(stripBase("/brain-site", "//brain-site/missing")).toBeNull();
  });
});
