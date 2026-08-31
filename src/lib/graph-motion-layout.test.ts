import { describe, expect, it } from "vitest";
import { computeResponsiveTargets } from "./graph-motion-layout";
import { motionPlan, type LayoutRequest } from "./graph-motion-core";

const REQUEST: LayoutRequest = {
  generation: 1,
  nodes: [
    { id: "a", x: -1, y: -0.5, size: 5 },
    { id: "b", x: 1, y: -0.5, size: 5 },
    { id: "c", x: 0, y: 1, size: 5 },
    { id: "d", x: 2, y: 1.5, size: 5 },
  ],
  edges: [
    { source: "a", target: "b" },
    { source: "b", target: "c" },
    { source: "c", target: "a" },
    { source: "c", target: "d" },
  ],
  width: 390,
  height: 844,
  iterations: 20,
};

describe("computeResponsiveTargets", () => {
  it("returns deterministic targets for repeated worker inputs", () => {
    expect(computeResponsiveTargets(REQUEST)).toEqual(computeResponsiveTargets(REQUEST));
  });

  it("is independent of node and edge input order", () => {
    const reversed = {
      ...REQUEST,
      nodes: [...REQUEST.nodes].reverse(),
      edges: [...REQUEST.edges].reverse(),
    };
    expect(computeResponsiveTargets(reversed)).toEqual(computeResponsiveTargets(REQUEST));
  });

  it("anchors the pinned node at its input position", () => {
    const positions = computeResponsiveTargets({ ...REQUEST, pinnedId: "c" });
    expect(positions.c).toEqual({ x: 0, y: 1 });
  });

  it("fits a clustered local layout more closely to a portrait viewport", () => {
    const positions = computeResponsiveTargets({
      ...REQUEST,
      nodes: REQUEST.nodes.map((node, index) => ({
        ...node,
        x: index,
        y: index % 2 === 0 ? -0.01 : 0.01,
      })),
      pinnedId: "a",
      fitViewportAspect: true,
    });
    const xs = Object.values(positions).map(({ x }) => x);
    const ys = Object.values(positions).map(({ y }) => y);
    const aspect = (Math.max(...xs) - Math.min(...xs)) / (Math.max(...ys) - Math.min(...ys));

    expect(aspect).toBeLessThan(0.85);
    expect(positions.a).toEqual({ x: 0, y: -0.01 });
  });

  it("ignores edges outside the active graph", () => {
    const positions = computeResponsiveTargets({
      ...REQUEST,
      edges: [...REQUEST.edges, { source: "a", target: "missing" }],
    });
    expect(Object.keys(positions).sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("computes a 2,000-node target set within the worker deadline", () => {
    const count = 2000;
    const nodes = Array.from({ length: count }, (_, index) => {
      const angle = (index / count) * Math.PI * 2;
      return { id: `node-${index}`, x: Math.cos(angle), y: Math.sin(angle), size: 4 };
    });
    const edges = Array.from({ length: count * 2 }, (_, index) => ({
      source: `node-${index % count}`,
      target: `node-${(index * 17 + 1) % count}`,
    }));
    const plan = motionPlan("initial", count);
    const started = performance.now();
    const positions = computeResponsiveTargets({
      generation: 1,
      nodes,
      edges,
      width: 1440,
      height: 900,
      iterations: plan.iterations,
    });
    const elapsed = performance.now() - started;
    expect(Object.keys(positions)).toHaveLength(count);
    expect(elapsed).toBeLessThan(plan.workerTimeout);
  });
});
