import type { APIRoute } from "astro";
import { getLinkIndex } from "../lib/link-index";
import { buildGraphData } from "../lib/graph-data";
import { getWorkspaceSnapshot } from "../lib/vault-state";

/**
 * The vault's graph dataset as static JSON — one node per note (with
 * precomputed ForceAtlas2 position), one edge per resolved wiki-link.
 * Consumed by the global graph page and the per-note local graph island.
 */
export const GET: APIRoute = () => {
  const index = getLinkIndex();
  const snapshot = getWorkspaceSnapshot();
  const payload = buildGraphData(index, snapshot.registry, snapshot.mode);

  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
  });
};
