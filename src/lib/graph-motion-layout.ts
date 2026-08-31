import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";
import { adaptPositionsToViewport, type GraphPositions, type LayoutRequest } from "./graph-motion-core";

export function computeResponsiveTargets(request: LayoutRequest): GraphPositions {
  const graph = new Graph({ multi: true });
  const nodes = [...request.nodes].sort((a, b) => a.id.localeCompare(b.id));
  for (const node of nodes) {
    graph.addNode(node.id, {
      x: node.x,
      y: node.y,
      size: node.size,
      fixed: node.id === request.pinnedId,
    });
  }

  const edges = request.edges
    .filter(({ source, target }) => graph.hasNode(source) && graph.hasNode(target))
    .sort((a, b) => `${a.source}\u001f${a.target}`.localeCompare(`${b.source}\u001f${b.target}`));
  edges.forEach((edge, index) => {
    graph.addDirectedEdgeWithKey(`motion-edge-${index}`, edge.source, edge.target);
  });

  if (graph.order > 1 && request.iterations > 0) {
    forceAtlas2.assign(graph, {
      iterations: request.iterations,
      settings: { ...forceAtlas2.inferSettings(graph), gravity: 1.5 },
    });
  }

  const positions: GraphPositions = {};
  graph.forEachNode((id, attributes) => {
    positions[id] = { x: attributes.x as number, y: attributes.y as number };
  });
  return adaptPositionsToViewport(
    positions,
    request.width,
    request.height,
    request.pinnedId,
    request.fitViewportAspect ? 4 : undefined,
  );
}
