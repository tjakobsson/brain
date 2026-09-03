import { describe, expect, it, vi } from "vitest";
import {
  connectedDomains,
  createFocusUrlSync,
  graphSessionScope,
  initialGraphFocus,
  neighborhoodHref,
  neighborhoodRoute,
  noteGraphActionRoute,
  noteSlug,
} from "./graph-neighborhood";

const engineering = { brainId: "engineering", compositeId: "engineering/principles" };
const design = { brainId: "design", compositeId: "design/principles" };
const vaultNote = { brainId: "default", compositeId: "default/welcome" };

describe("neighborhood routes", () => {
  it("derives the slug from the composite ID", () => {
    expect(noteSlug(engineering)).toBe("principles");
    expect(noteSlug({ brainId: "default", compositeId: "welcome" })).toBe("welcome");
  });

  it("builds path-only neighborhood routes in both modes", () => {
    expect(neighborhoodRoute(engineering, "workspace")).toBe(
      "/brains/engineering/notes/principles/graph",
    );
    expect(neighborhoodRoute(vaultNote, "vault")).toBe("/notes/welcome/graph");
  });

  it("builds absolute neighborhood links under root and subpath bases", () => {
    expect(neighborhoodHref("/", "http://127.0.0.1:4328", vaultNote, "vault")).toBe(
      "http://127.0.0.1:4328/notes/welcome/graph",
    );
    expect(neighborhoodHref("/vault-repo", "http://127.0.0.1:4329", vaultNote, "vault")).toBe(
      "http://127.0.0.1:4329/vault-repo/notes/welcome/graph",
    );
    expect(neighborhoodHref("/workspace-demo", "http://127.0.0.1:4331", design, "workspace")).toBe(
      "http://127.0.0.1:4331/workspace-demo/brains/design/notes/principles/graph",
    );
    for (const href of [
      neighborhoodHref("/", "http://127.0.0.1:4328", vaultNote, "vault"),
      neighborhoodHref("/vault-repo/", "http://127.0.0.1:4329", engineering, "workspace"),
    ]) {
      const url = new URL(href);
      expect(url.search).toBe("");
      expect(url.hash).toBe("");
    }
  });
});

describe("initial graph focus", () => {
  it("prefers the host attribute over the focus query", () => {
    expect(initialGraphFocus("engineering/principles", "?focus=design%2Fprinciples")).toBe(
      "engineering/principles",
    );
    expect(initialGraphFocus(undefined, "?focus=design%2Fprinciples")).toBe("design/principles");
    expect(initialGraphFocus("", "?focus=design%2Fprinciples")).toBe("design/principles");
  });

  it("ignores absent or repeated focus queries", () => {
    expect(initialGraphFocus(undefined, "")).toBeNull();
    expect(initialGraphFocus(undefined, "?focus=a&focus=b")).toBeNull();
  });
});

describe("graph session scope", () => {
  it("keeps the root and Brain graph scopes as they were", () => {
    expect(graphSessionScope({})).toBe("all");
    expect(graphSessionScope({ neighborhoodFocus: null })).toBe("all");
    expect(graphSessionScope({ activeBrainId: "engineering" })).toBe("brain:engineering:false");
    expect(graphSessionScope({ activeBrainId: "engineering", showRelatedBrains: true }))
      .toBe("brain:engineering:true");
  });

  it("gives each neighborhood page a scope apart from the root and Brain graphs", () => {
    const neighborhood = graphSessionScope({ neighborhoodFocus: "engineering/principles" });
    expect(neighborhood).toBe("neighborhood:engineering/principles");
    expect(new Set([
      neighborhood,
      graphSessionScope({ neighborhoodFocus: "design/principles" }),
      graphSessionScope({}),
      graphSessionScope({ activeBrainId: "engineering" }),
    ]).size).toBe(4);
    // A neighborhood page never mounts under a Brain scope, even if the host
    // also names a Brain.
    expect(graphSessionScope({ activeBrainId: "engineering", neighborhoodFocus: "engineering/principles" }))
      .toBe(neighborhood);
  });
});

describe("focus URL sync", () => {
  const known = ["engineering/principles", "design/principles"];

  it("mirrors pinned focus into a graph page URL as in-session state", () => {
    const history = { replaceState: vi.fn() };
    const sync = createFocusUrlSync({
      neighborhoodPage: false,
      base: "/vault-repo",
      graphRoute: "/brains/engineering",
      knownCompositeIds: known,
      location: { pathname: "/vault-repo/brains/engineering", search: "" },
      history,
    });

    sync("engineering/principles");
    expect(history.replaceState).toHaveBeenCalledWith(
      null,
      "",
      "/vault-repo/brains/engineering?focus=engineering%2Fprinciples",
    );

    sync(null);
    expect(history.replaceState).toHaveBeenCalledTimes(1);
  });

  it("never writes query state on a neighborhood page", () => {
    const history = { replaceState: vi.fn() };
    const sync = createFocusUrlSync({
      neighborhoodPage: true,
      base: "/",
      graphRoute: "/",
      knownCompositeIds: known,
      location: { pathname: "/brains/engineering/notes/principles/graph", search: "" },
      history,
    });

    sync("engineering/principles");
    sync("design/principles");
    sync(null);
    expect(history.replaceState).not.toHaveBeenCalled();
  });
});

describe("note Graph action", () => {
  const nodes = [engineering, design];

  it("targets the originating note's neighborhood when the return context is known", () => {
    expect(
      noteGraphActionRoute("/brains/design/notes/principles/graph", "engineering/principles", nodes, "workspace"),
    ).toBe("/brains/engineering/notes/principles/graph");
  });

  it("falls back to the note's own neighborhood without or with unknown context", () => {
    const own = "/brains/design/notes/principles/graph" as const;
    expect(noteGraphActionRoute(own, null, nodes, "workspace")).toBe(own);
    expect(noteGraphActionRoute(own, undefined, nodes, "workspace")).toBe(own);
    expect(noteGraphActionRoute(own, "research/missing", nodes, "workspace")).toBe(own);
  });
});

describe("connected domains", () => {
  const order = ["engineering", "design", "research", "archive"];
  const focused = { id: "engineering/principles", brainId: "engineering" };

  it("groups the focused note and its neighbors by Brain in declared order", () => {
    const neighbors = [
      { id: "research/evidence", brainId: "research" },
      { id: "design/principles", brainId: "design" },
      { id: "engineering/delivery-loops", brainId: "engineering" },
      { id: "design/interaction-model", brainId: "design" },
    ];
    expect(connectedDomains(focused, neighbors, order)).toEqual([
      { brainId: "engineering", count: 2 },
      { brainId: "design", count: 2 },
      { brainId: "research", count: 1 },
    ]);
  });

  it("always lists the focused note's own Brain, even when every neighbor is foreign", () => {
    const neighbors = [{ id: "design/principles", brainId: "design" }];
    expect(connectedDomains(focused, neighbors, ["design", "engineering"])).toEqual([
      { brainId: "design", count: 1 },
      { brainId: "engineering", count: 1 },
    ]);
  });

  it("lists only the owning Brain for an isolated note", () => {
    expect(connectedDomains(focused, [], order)).toEqual([{ brainId: "engineering", count: 1 }]);
  });

  it("counts each note once and never counts the focused note as its own neighbor", () => {
    const neighbors = [
      { id: "engineering/principles", brainId: "engineering" },
      { id: "research/evidence", brainId: "research" },
      { id: "research/evidence", brainId: "research" },
    ];
    expect(connectedDomains(focused, neighbors, order)).toEqual([
      { brainId: "engineering", count: 1 },
      { brainId: "research", count: 1 },
    ]);
  });

  it("keeps Brains absent from the declared order after it", () => {
    const neighbors = [
      { id: "mystery/note", brainId: "mystery" },
      { id: "design/principles", brainId: "design" },
    ];
    expect(connectedDomains(focused, neighbors, ["design", "engineering"])).toEqual([
      { brainId: "design", count: 1 },
      { brainId: "engineering", count: 1 },
      { brainId: "mystery", count: 1 },
    ]);
  });
});
