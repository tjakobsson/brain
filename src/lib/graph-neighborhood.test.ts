import { describe, expect, it, vi } from "vitest";
import {
  connectedDomains,
  createFocusUrlSync,
  neighborRows,
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
  const neighborhoodRouteFor = (compositeId: string) => {
    const [brainId, slug] = compositeId.split("/");
    return `/brains/${brainId}/notes/${slug}/graph`;
  };

  it("makes the address the focused note's neighborhood path", () => {
    const history = { replaceState: vi.fn() };
    const sync = createFocusUrlSync({
      base: "/vault-repo",
      graphRoute: "/brains/engineering",
      knownCompositeIds: known,
      neighborhoodRouteFor,
      location: { pathname: "/vault-repo/brains/engineering", search: "" },
      history,
    });

    // The same pathname the copy action produces, so a reader who copies the
    // address bar gets the shareable identity rather than a weaker form of it.
    sync("engineering/principles");
    expect(history.replaceState).toHaveBeenLastCalledWith(
      null,
      "",
      "/vault-repo/brains/engineering/notes/principles/graph",
    );
  });

  it("returns the address to the graph page when focus clears", () => {
    const history = { replaceState: vi.fn() };
    const sync = createFocusUrlSync({
      base: "/vault-repo",
      graphRoute: "/brains/engineering",
      knownCompositeIds: known,
      neighborhoodRouteFor,
      location: { pathname: "/vault-repo/brains/engineering/notes/principles/graph", search: "" },
      history,
    });

    sync(null);
    expect(history.replaceState).toHaveBeenLastCalledWith(null, "", "/vault-repo/brains/engineering");
  });

  it("never puts focus in a query string", () => {
    const history = { replaceState: vi.fn() };
    const sync = createFocusUrlSync({
      base: "/",
      graphRoute: "/",
      knownCompositeIds: known,
      neighborhoodRouteFor,
      location: { pathname: "/", search: "" },
      history,
    });

    sync("engineering/principles");
    sync("design/principles");
    sync(null);
    for (const call of history.replaceState.mock.calls) {
      expect(String(call[2])).not.toContain("?");
    }
  });

  it("falls back to the graph page for a focus it does not know", () => {
    const history = { replaceState: vi.fn() };
    const sync = createFocusUrlSync({
      base: "/",
      graphRoute: "/",
      knownCompositeIds: known,
      neighborhoodRouteFor,
      location: { pathname: "/brains/engineering/notes/principles/graph", search: "" },
      history,
    });

    sync("nowhere/at-all");
    expect(history.replaceState).toHaveBeenLastCalledWith(null, "", "/");
  });

  it("moves the address with the focus on a neighborhood page", () => {
    // A neighborhood page's pathname is its focus. Moving focus in place
    // rather than by page load is what keeps the camera gliding instead of
    // opening on the whole graph, and the address has to keep up.
    const history = { replaceState: vi.fn() };
    const sync = createFocusUrlSync({
      base: "/",
      graphRoute: "/",
      knownCompositeIds: known,
      neighborhoodRouteFor,
      location: { pathname: "/brains/engineering/notes/principles/graph", search: "" },
      history,
    });

    sync("engineering/principles");
    expect(history.replaceState).not.toHaveBeenCalled();
    sync("design/principles");
    expect(history.replaceState).toHaveBeenLastCalledWith(
      null,
      "",
      "/brains/design/notes/principles/graph",
    );
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

describe("connected neighbor rows", () => {
  const source = (node: string, title: string, brainId: string, brainTitle = brainId) =>
    ({ node, title, brainId, brainTitle });

  it("orders rows alphabetically by title", () => {
    const rows = neighborRows("engineering", [
      source("c", "Zeta", "engineering"),
      source("a", "Alpha", "engineering"),
      source("b", "Mu", "engineering"),
    ]);
    expect(rows.map((row) => row.title)).toEqual(["Alpha", "Mu", "Zeta"]);
  });

  it("breaks a tie on equal titles by node, so the order never wobbles", () => {
    const rows = neighborRows("engineering", [
      source("design/principles", "Principles", "design", "Design"),
      source("engineering/principles", "Principles", "engineering", "Engineering"),
    ]);
    expect(rows.map((row) => row.node)).toEqual(["design/principles", "engineering/principles"]);
  });

  it("marks a neighbor owned by another Brain", () => {
    const rows = neighborRows("engineering", [
      source("design/principles", "Principles", "design", "Design"),
      source("engineering/loops", "Loops", "engineering", "Engineering"),
    ]);
    expect(rows.find((row) => row.node === "design/principles")?.foreignBrainTitle).toBe("Design");
    expect(rows.find((row) => row.node === "engineering/loops")?.foreignBrainTitle).toBeNull();
  });

  it("is uncapped, because a hub is when the list matters most", () => {
    const many = Array.from({ length: 40 }, (_, index) =>
      source(`n${index}`, `Title ${String(index).padStart(2, "0")}`, "engineering"));
    expect(neighborRows("engineering", many)).toHaveLength(40);
  });

  it("has no rows when nothing visible is connected", () => {
    expect(neighborRows("engineering", [])).toEqual([]);
  });
});

describe("neighbor rows across rings", () => {
  it("lists nearer notes first, alphabetical within a ring, and says how far the rest are", () => {
    const rows = neighborRows("eng", [
      { node: "z2", title: "Zeta", brainId: "eng", brainTitle: "Eng", distance: 2 },
      { node: "b1", title: "Beta", brainId: "eng", brainTitle: "Eng", distance: 1 },
      { node: "a2", title: "Alpha", brainId: "design", brainTitle: "Design", distance: 2 },
      { node: "c1", title: "Gamma", brainId: "eng", brainTitle: "Eng" },
    ]);
    expect(rows.map((row) => [row.node, row.distance])).toEqual([["b1", 1], ["c1", 1], ["a2", 2], ["z2", 2]]);
    expect(rows[2]!.foreignBrainTitle).toBe("Design");
  });
});
