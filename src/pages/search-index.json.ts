import type { APIRoute } from "astro";
import { getLinkIndex } from "../lib/link-index";
import { routesFor, type LogicalRoute } from "../lib/routes";
import { getWorkspaceSnapshot } from "../lib/vault-state";

/**
 * Small title/tag index for the quick switcher — deliberately separate from
 * This compact index answers "jump to X" in keystrokes without indexing note bodies.
 */
export const GET: APIRoute = () => {
  const index = getLinkIndex();
  const snapshot = getWorkspaceSnapshot();
  const brains = new Map(snapshot.registry.brains.map((brain) => [brain.id, brain]));

  const entries: {
    title: string;
    route: LogicalRoute;
    kind: "note" | "tag";
    tags: string[];
    brainId: string;
    brainTitle: string;
    brainAccent: string;
  }[] =
    index.notes.map((n) => ({
      title: n.title,
      route: n.route,
      kind: "note",
      tags: n.meta.tags,
      brainId: n.brainId,
      brainTitle: brains.get(n.brainId)?.title ?? n.brainId,
      brainAccent: brains.get(n.brainId)?.accent ?? "#5b4bc4",
    }));

  for (const brain of snapshot.registry.brains) {
    const tags = new Set(
      index.notes.filter((note) => note.brainId === brain.id).flatMap((note) => note.meta.tags),
    );
    const contextualRoutes = routesFor(
      snapshot.mode === "workspace"
        ? { mode: "workspace", brainId: brain.id }
        : { mode: "vault" },
    );
    for (const tag of [...tags].sort()) {
      entries.push({
        title: `#${tag}`,
        route: contextualRoutes.tag(tag),
        kind: "tag",
        tags: [tag],
        brainId: brain.id,
        brainTitle: brain.title,
        brainAccent: brain.accent,
      });
    }
  }

  return new Response(JSON.stringify(entries), {
    headers: { "Content-Type": "application/json" },
  });
};
