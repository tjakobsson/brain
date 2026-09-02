import { describe, expect, it, vi } from "vitest";
import {
  createFocusUrlSync,
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
