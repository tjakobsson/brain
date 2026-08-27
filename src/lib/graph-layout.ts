import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";
import seedrandom from "seedrandom";

export interface LayoutEdge {
  source: string;
  target: string;
}

/**
 * Precomputes ForceAtlas2 positions for the graph at build time.
 *
 * Determinism is a hard requirement (spec: stable layout across loads), so
 * initial positions come from a per-node-id seeded PRNG and iteration order
 * is fixed by sorting node ids. Same vault → same layout, every build.
 */
export function computeLayout(
  nodeIds: string[],
  edges: LayoutEdge[],
  iterations = 400,
): Record<string, { x: number; y: number }> {
  const graph = new Graph();

  for (const id of [...nodeIds].sort()) {
    const rng = seedrandom(`brain:${id}`);
    graph.addNode(id, { x: rng() * 2 - 1, y: rng() * 2 - 1 });
  }
  for (const edge of edges) {
    if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
      graph.addEdge(edge.source, edge.target);
    }
  }

  if (graph.order > 1) {
    // Slightly stronger gravity than inferred: keeps unconnected notes
    // (orphans) from drifting arbitrarily far from the clusters.
    forceAtlas2.assign(graph, {
      iterations,
      settings: { ...forceAtlas2.inferSettings(graph), gravity: 1.5 },
    });
  }

  const positions: Record<string, { x: number; y: number }> = {};
  graph.forEachNode((id, attrs) => {
    positions[id] = {
      x: Number((attrs.x as number).toFixed(4)),
      y: Number((attrs.y as number).toFixed(4)),
    };
  });
  return positions;
}
