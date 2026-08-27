import { describe, expect, it } from "vitest";
import { computeLayout } from "./graph-layout";

const NODES = ["alpha", "beta", "gamma", "delta", "epsilon"];
const EDGES = [
  { source: "alpha", target: "beta" },
  { source: "beta", target: "gamma" },
  { source: "gamma", target: "alpha" },
];

describe("computeLayout", () => {
  it("is deterministic: same input, same positions", () => {
    const first = computeLayout(NODES, EDGES);
    const second = computeLayout(NODES, EDGES);
    expect(first).toEqual(second);
  });

  it("assigns every node a finite position", () => {
    const positions = computeLayout(NODES, EDGES);
    for (const id of NODES) {
      expect(Number.isFinite(positions[id].x)).toBe(true);
      expect(Number.isFinite(positions[id].y)).toBe(true);
    }
  });

  it("spreads nodes apart (no degenerate single point)", () => {
    const positions = computeLayout(NODES, EDGES);
    const xs = new Set(Object.values(positions).map((p) => p.x));
    expect(xs.size).toBeGreaterThan(1);
  });

  it("handles a single isolated node", () => {
    const positions = computeLayout(["solo"], []);
    expect(positions.solo).toBeDefined();
    expect(Number.isFinite(positions.solo.x)).toBe(true);
  });

  it("ignores edges to missing nodes", () => {
    const positions = computeLayout(["a", "b"], [{ source: "a", target: "ghost" }]);
    expect(Object.keys(positions).sort()).toEqual(["a", "b"]);
  });
});
