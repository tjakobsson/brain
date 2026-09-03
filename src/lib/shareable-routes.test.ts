import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  workspaceBrainPagePaths,
  workspaceNotePagePaths,
  workspaceTagPagePaths,
} from "./page-paths";
import { joinBase, routes, routesFor, type LogicalRoute } from "./routes";
import { createWorkspaceSnapshot } from "./vault-loader";
import type { WorkspaceSnapshot } from "./vault-state";

// Every destination a reader can share must survive a proxy that keeps only the
// pathname. This enumerates the generated pages for both public fixtures through
// the same route builders the site uses and rejects any query or fragment.

const outputDir = path.resolve("dist");
const bases = ["/", "/vault-repo", "/workspace-demo/"];

function siteWideTags(snapshot: WorkspaceSnapshot): string[] {
  return [...new Set(snapshot.index.notes.flatMap((note) => note.meta.tags))].sort();
}

function vaultDestinations(snapshot: WorkspaceSnapshot): LogicalRoute[] {
  const scope = routesFor({ mode: "vault" });
  return [
    scope.graph,
    scope.tags,
    scope.recent,
    scope.orphans,
    ...siteWideTags(snapshot).map((tag) => scope.tag(tag)),
    ...snapshot.index.notes.flatMap((note) => [scope.note(note.id), scope.neighborhood(note.id)]),
  ];
}

function workspaceDestinations(snapshot: WorkspaceSnapshot): LogicalRoute[] {
  const entries = snapshot.index.notes.map((note) => ({
    id: note.id,
    data: { brainId: note.brainId, tags: note.meta.tags },
  }));
  return [
    routes.home,
    routes.tags,
    routes.recent,
    routes.orphans,
    ...siteWideTags(snapshot).map((tag) => routes.tag(tag)),
    ...workspaceBrainPagePaths(snapshot).flatMap(({ params }) => {
      const scope = routesFor({ mode: "workspace", brainId: params.brainId });
      return [scope.graph, scope.tags, scope.recent, scope.orphans];
    }),
    ...workspaceTagPagePaths(snapshot).map(({ params }) =>
      routesFor({ mode: "workspace", brainId: params.brainId }).tag(params.tag),
    ),
    ...workspaceNotePagePaths(entries, snapshot).flatMap(({ params }) => {
      const scope = routesFor({ mode: "workspace", brainId: params.brainId });
      return [scope.note(params.slug), scope.neighborhood(params.slug)];
    }),
  ];
}

function expectPathnameOnly(destinations: readonly LogicalRoute[]) {
  expect(destinations.length).toBeGreaterThan(0);
  expect(new Set(destinations).size).toBe(destinations.length);
  for (const destination of destinations) {
    expect(destination, destination).toMatch(/^\/(?!\/)/);
    expect(destination, destination).not.toMatch(/[?#]/);
    for (const base of bases) {
      const url = new URL(joinBase(base, destination), "http://brain.localhost");
      expect(url.search, `${base} ${destination}`).toBe("");
      expect(url.hash, `${base} ${destination}`).toBe("");
      expect(url.pathname, `${base} ${destination}`).toBe(joinBase(base, destination));
    }
  }
}

describe("shareable destinations of the demo workspace", () => {
  const snapshot = createWorkspaceSnapshot({
    mode: "workspace",
    vaultDir: path.resolve("examples/demo-vault"),
    workspacePath: path.resolve("examples/demo-workspace/workspace.json"),
    outputDir,
    exclusions: [],
    strictLinks: false,
  });
  const destinations = workspaceDestinations(snapshot);

  it("enumerates the root graph, every Brain graph, the reports, and every note", () => {
    const brainIds = snapshot.registry.brains.map((brain) => brain.id);
    const notes = snapshot.index.notes;

    expect(brainIds.length).toBeGreaterThan(1);
    expect(destinations).toContain("/");
    expect(destinations).toContain("/tags");
    expect(destinations).toContain("/recent");
    expect(destinations).toContain("/orphans");
    for (const brainId of brainIds) {
      expect(destinations).toContain(`/brains/${encodeURIComponent(brainId)}`);
      expect(destinations).toContain(`/brains/${encodeURIComponent(brainId)}/tags`);
      expect(destinations).toContain(`/brains/${encodeURIComponent(brainId)}/recent`);
      expect(destinations).toContain(`/brains/${encodeURIComponent(brainId)}/orphans`);
    }
    expect(destinations.filter((route) => /\/notes\/[^/]+$/.test(route))).toHaveLength(notes.length);
    expect(destinations.filter((route) => /\/notes\/[^/]+\/graph$/.test(route))).toHaveLength(
      notes.length,
    );
    expect(destinations).toContain("/brains/engineering/notes/principles/graph");
    expect(destinations).toContain("/brains/design/notes/principles/graph");
    expect(destinations.some((route) => /^\/tags\/[^/]+$/.test(route))).toBe(true);
    expect(destinations.some((route) => /^\/brains\/[^/]+\/tags\/[^/]+$/.test(route))).toBe(true);
  });

  it("identifies every destination by pathname alone under any base", () => {
    expectPathnameOnly(destinations);
  });
});

describe("shareable destinations of the demo vault", () => {
  const snapshot = createWorkspaceSnapshot({
    mode: "vault",
    vaultDir: path.resolve("examples/demo-vault"),
    outputDir,
    exclusions: [],
    strictLinks: false,
  });
  const destinations = vaultDestinations(snapshot);

  it("enumerates the graph, the reports, every tag, and every note", () => {
    const notes = snapshot.index.notes;

    expect(destinations).toContain("/");
    expect(destinations).toContain("/tags");
    expect(destinations).toContain("/recent");
    expect(destinations).toContain("/orphans");
    expect(destinations.filter((route) => /^\/notes\/[^/]+$/.test(route))).toHaveLength(notes.length);
    expect(destinations.filter((route) => /^\/notes\/[^/]+\/graph$/.test(route))).toHaveLength(
      notes.length,
    );
    expect(destinations).toContain("/notes/welcome");
    expect(destinations).toContain("/notes/welcome/graph");
    expect(destinations.some((route) => /^\/tags\/[^/]+$/.test(route))).toBe(true);
    expect(destinations.some((route) => /^\/brains\//.test(route))).toBe(false);
  });

  it("identifies every destination by pathname alone under any base", () => {
    expectPathnameOnly(destinations);
  });
});
