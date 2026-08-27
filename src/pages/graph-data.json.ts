import type { APIRoute } from "astro";
import { getLinkIndex } from "../lib/link-index";
import { computeLayout } from "../lib/graph-layout";

/**
 * The vault's graph dataset as static JSON — one node per note (with
 * precomputed ForceAtlas2 position), one edge per resolved wiki-link.
 * Consumed by the global graph page and the per-note local graph island.
 */
export const GET: APIRoute = () => {
  const index = getLinkIndex();

  const degree = new Map<string, number>();
  for (const edge of index.edges) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }

  const positions = computeLayout(
    index.notes.map((n) => n.slug),
    index.edges,
  );

  const payload = {
    nodes: index.notes.map((n) => ({
      id: n.slug,
      title: n.title,
      route: n.route,
      type: n.meta.type,
      status: n.meta.status,
      tags: n.meta.tags,
      degree: degree.get(n.slug) ?? 0,
      x: positions[n.slug].x,
      y: positions[n.slug].y,
    })),
    edges: index.edges,
  };

  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
  });
};
