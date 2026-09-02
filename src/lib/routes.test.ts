import { describe, expect, it } from "vitest";
import {
  joinBase,
  routes,
  routesFor,
  singularQueryValue,
  stripBase,
  withFragment,
  withGraphFocus,
  withoutGraphFocus,
  type LogicalRoute,
} from "./routes";

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
    expect(routes.neighborhood("graphs-of-thought")).toBe("/notes/graphs-of-thought/graph");
    expect(routes.vaultAsset("Media/image.png")).toBe("/vault-assets/Media/image.png");
    expect(routes.faviconSvg).toBe("/favicon.svg");
    expect(routes.faviconIco).toBe("/favicon.ico");
  });

  it("encodes dynamic single-vault route segments", () => {
    expect(routes.tag("Café notes/#1")).toBe("/tags/Caf%C3%A9%20notes%2F%231");
    expect(routes.note("café / #1?x")).toBe("/notes/caf%C3%A9%20%2F%20%231%3Fx");
    expect(routes.neighborhood("café / #1?x")).toBe("/notes/caf%C3%A9%20%2F%20%231%3Fx/graph");
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
    expect(scoped.neighborhood("note-a")).toBe("/notes/note-a/graph");
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
    expect(scoped.neighborhood("note-a")).toBe("/brains/engineering/notes/note-a/graph");
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
    expect(scoped.neighborhood("café / #1")).toBe(
      "/brains/R%26D%20%2F%20notes/notes/caf%C3%A9%20%2F%20%231/graph",
    );
    expect(scoped.tag("systems/web")).toBe(
      "/brains/R%26D%20%2F%20notes/tags/systems%2Fweb",
    );
    expect(scoped.asset("Média/über diagram #1.png")).toBe(
      "/brains/R%26D%20%2F%20notes/assets/M%C3%A9dia/%C3%BCber%20diagram%20%231.png",
    );
  });
});

describe("note neighborhood routes", () => {
  const vault = routesFor({ mode: "vault" });
  const workspace = routesFor({ mode: "workspace", brainId: "engineering" });

  it("places the neighborhood beneath the note path in both modes", () => {
    expect(vault.neighborhood("note-a")).toBe(`${vault.note("note-a")}/graph`);
    expect(workspace.neighborhood("note-a")).toBe(`${workspace.note("note-a")}/graph`);
    expect(routes.neighborhood("note-a")).toBe(vault.neighborhood("note-a"));
  });

  it("keeps a note slug named graph distinct from the neighborhood segment", () => {
    expect(vault.note("graph")).toBe("/notes/graph");
    expect(vault.neighborhood("graph")).toBe("/notes/graph/graph");
    expect(workspace.neighborhood("graph")).toBe("/brains/engineering/notes/graph/graph");
  });

  it("stays base-correct at a domain root", () => {
    expect(joinBase("/", vault.neighborhood("note-a"))).toBe("/notes/note-a/graph");
    expect(joinBase("", workspace.neighborhood("note-a"))).toBe(
      "/brains/engineering/notes/note-a/graph",
    );
  });

  it("stays base-correct below a deployment subpath", () => {
    expect(joinBase("/vault-repo", vault.neighborhood("note-a"))).toBe(
      "/vault-repo/notes/note-a/graph",
    );
    expect(joinBase("/vault-repo/", workspace.neighborhood("note-a"))).toBe(
      "/vault-repo/brains/engineering/notes/note-a/graph",
    );
    expect(joinBase("/vault-repo", workspace.neighborhood("café / #1?x"))).toBe(
      "/vault-repo/brains/engineering/notes/caf%C3%A9%20%2F%20%231%3Fx/graph",
    );
  });
});

describe("shareable destinations", () => {
  const slugs = ["note-a", "café / #1?x=y&z", "graph"];
  const tags = ["pkm", "systems/web", "Café notes/#1?q"];
  const scopes = [
    routesFor({ mode: "vault" }),
    routesFor({ mode: "workspace", brainId: "engineering" }),
    routesFor({ mode: "workspace", brainId: "R&D / notes?#" }),
  ];
  const shareable: LogicalRoute[] = [
    ...slugs.map((slug) => routes.note(slug)),
    ...slugs.map((slug) => routes.neighborhood(slug)),
    ...scopes.flatMap((scope) => [
      scope.graph,
      scope.tags,
      scope.recent,
      scope.orphans,
      ...tags.map((tag) => scope.tag(tag)),
      ...slugs.map((slug) => scope.note(slug)),
      ...slugs.map((slug) => scope.neighborhood(slug)),
    ]),
  ];

  it("identifies every shareable route by pathname alone", () => {
    expect(shareable.length).toBeGreaterThan(0);
    for (const route of shareable) {
      expect(route, route).not.toMatch(/[?#]/);
      expect(joinBase("/vault-repo", route), route).not.toMatch(/[?#]/);
    }
  });
});

describe("focused graph routes", () => {
  const knownCompositeIds = [
    "research/note-a",
    "engineering/note-a",
    "design/note-b",
  ] as const;
  const engineering = routesFor({ mode: "workspace", brainId: "engineering" });

  it("adds focus to root and per-Brain graph routes", () => {
    expect(withGraphFocus(routes.home, knownCompositeIds, "research/note-a")).toBe(
      "/?focus=research%2Fnote-a",
    );
    expect(withGraphFocus(engineering.graph, knownCompositeIds, "engineering/note-a")).toBe(
      "/brains/engineering?focus=engineering%2Fnote-a",
    );
  });

  it("adds return-context focus to note routes", () => {
    expect(withGraphFocus(engineering.note("note-a"), knownCompositeIds, "design/note-b")).toBe(
      "/brains/engineering/notes/note-a?focus=design%2Fnote-b",
    );
    expect(withGraphFocus(routes.note("note-a"), knownCompositeIds, null)).toBe(
      "/notes/note-a",
    );
  });

  it("replaces focus without changing other query state or fragments", () => {
    expect(
      withGraphFocus(
        "/brains/engineering?other=1&focus=research%2Fnote-a#neighborhood",
        knownCompositeIds,
        "design/note-b",
      ),
    ).toBe("/brains/engineering?other=1&focus=design%2Fnote-b#neighborhood");
  });

  it("removes absent, unknown, and explicitly cleared focus", () => {
    const focused = "/brains/engineering?focus=research%2Fnote-a#neighborhood";

    expect(withGraphFocus(focused, knownCompositeIds, "missing/note")).toBe(
      "/brains/engineering#neighborhood",
    );
    expect(withGraphFocus(focused, knownCompositeIds)).toBe("/brains/engineering#neighborhood");
    expect(withoutGraphFocus(focused)).toBe("/brains/engineering#neighborhood");
    expect(withoutGraphFocus("/?other=1&focus=research%2Fnote-a")).toBe("/?other=1");
  });

  it("keeps focused routes base-correct at root and below a deployment subpath", () => {
    const focused = withGraphFocus(routes.home, knownCompositeIds, "research/note-a");

    expect(joinBase("", focused)).toBe("/?focus=research%2Fnote-a");
    expect(joinBase("/brain-site", focused)).toBe("/brain-site/?focus=research%2Fnote-a");
    expect(
      joinBase(
        "/brain-site/",
        withGraphFocus(engineering.graph, knownCompositeIds, "engineering/note-a"),
      ),
    ).toBe("/brain-site/brains/engineering?focus=engineering%2Fnote-a");
  });
});

describe("joinBase", () => {
  const workspace = routesFor({ mode: "workspace", brainId: "engineering" });

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
    routes.neighborhood("note-a"),
    routes.vaultAsset("Media/image.png"),
    routes.faviconSvg,
    routes.faviconIco,
    workspace.graph,
    workspace.tags,
    workspace.tag("pkm/web"),
    workspace.recent,
    workspace.orphans,
    workspace.note("note-a"),
    workspace.neighborhood("note-a"),
    workspace.asset("Media/image.png"),
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

  it("prefixes workspace routes without changing their Brain path", () => {
    expect(joinBase("/brain-site", workspace.note("note-a"))).toBe(
      "/brain-site/brains/engineering/notes/note-a",
    );
    expect(joinBase("/brain-site/", workspace.neighborhood("note-a"))).toBe(
      "/brain-site/brains/engineering/notes/note-a/graph",
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
    expect(singularQueryValue(new URLSearchParams("other=value"), "focus")).toEqual({
      present: false,
      valid: true,
    });
    expect(singularQueryValue(new URLSearchParams("focus=engineering%2Fnote-a"), "focus"))
      .toEqual({ present: true, valid: true, value: "engineering/note-a" });
    expect(singularQueryValue(new URLSearchParams("focus=a&focus=b"), "focus"))
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
