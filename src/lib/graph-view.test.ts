import { describe, expect, it } from "vitest";
import type { GraphData } from "./graph-data";
import { graphEdgeAttributes, graphNodeAttributes } from "./graph-style";

const data: GraphData = {
  mode: "workspace",
  brains: [
    { id: "engineering", title: "Engineering", accent: "#3366cc" },
    { id: "design", title: "Design", accent: "#b56cff" },
  ],
  nodes: [
    {
      id: "engineering/principles",
      brainId: "engineering",
      brainTitle: "Engineering",
      brainAccent: "#3366cc",
      title: "Principles",
      route: "/brains/engineering/notes/principles",
      type: "permanent",
      status: "established",
      tags: [],
      degree: 1,
      x: 0,
      y: 0,
    },
    {
      id: "design/principles",
      brainId: "design",
      brainTitle: "Design",
      brainAccent: "#b56cff",
      title: "Principles",
      route: "/brains/design/notes/principles",
      type: "literature",
      status: "draft",
      tags: [],
      degree: 1,
      x: 1,
      y: 1,
    },
  ],
  edges: [{
    source: "engineering/principles",
    target: "design/principles",
    sourceBrainId: "engineering",
    targetBrainId: "design",
    crossBrain: true,
  }],
};

describe("brain-aware graph rendering data", () => {
  it("marks foreign nodes and cross-brain edges without color alone", () => {
    const context = { mode: "brain", brainId: "engineering" } as const;
    const local = graphNodeAttributes(data.nodes[0], context);
    const foreign = graphNodeAttributes(data.nodes[1], context);
    const edge = graphEdgeAttributes(data.edges[0]);

    expect(foreign.label).toBe("○ ↗ @design · Principles");
    expect(foreign.foreign).toBe(true);
    expect(foreign.forceLabel).toBe(true);
    expect(foreign.size).toBeGreaterThan(local.size);
    expect(edge).toMatchObject({ crossBrain: true, size: 2.4 });
  });

  it("labels duplicate titles by owner and status in combined views", () => {
    const context = { mode: "combined", brainIds: ["engineering", "design"] } as const;
    const engineering = graphNodeAttributes(data.nodes[0], context);
    const design = graphNodeAttributes(data.nodes[1], context);
    expect(engineering.label).toBe("◆ @engineering · Principles");
    expect(design.label).toBe("○ @design · Principles");
    expect(engineering.route).toBe("/brains/engineering/notes/principles");
  });
});
