import { describe, expect, it } from "vitest";
import type { GraphData } from "./graph-data";
import {
  forceForeignLabel,
  forceLabelsOnNarrowZoom,
  forceLocalLabelsOnNarrowZoom,
  graphEdgeAttributes,
  graphHoverSurface,
  graphNodeAttributes,
  responsiveLabelSettings,
} from "./graph-style";

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
  it("uses a phone label grid that can reveal more titles while zooming", () => {
    expect(responsiveLabelSettings(true, 14, 180)).toEqual({
      labelRenderedSizeThreshold: 0,
      labelGridCellSize: 180,
    });
    expect(responsiveLabelSettings(false, 14, 180)).toEqual({
      labelRenderedSizeThreshold: 14,
      labelGridCellSize: 180,
    });
    expect(forceLabelsOnNarrowZoom(true, 0.75)).toBe(true);
    expect(forceLabelsOnNarrowZoom(true, 0.76)).toBe(false);
    expect(forceLabelsOnNarrowZoom(false, 0.5)).toBe(false);
  });

  it("uses the dark hover surface unless light mode is preferred", () => {
    expect(graphHoverSurface(true)).toBe("#fff");
    expect(graphHoverSurface(false)).toBe("#24232a");
  });

  it("reveals local labels relative to each graph's fitted view", () => {
    expect(forceLocalLabelsOnNarrowZoom(true, 0.75, 1)).toBe(true);
    expect(forceLocalLabelsOnNarrowZoom(true, 0.76, 1)).toBe(false);
    expect(forceLocalLabelsOnNarrowZoom(true, 1.5, 2)).toBe(true);
    expect(forceLocalLabelsOnNarrowZoom(true, 1.51, 2)).toBe(false);
    expect(forceLocalLabelsOnNarrowZoom(true, 0.9, 1)).toBe(false);
    expect(forceLocalLabelsOnNarrowZoom(false, 0.5, 1)).toBe(false);
  });

  it("keeps local labels selective without valid camera ratios", () => {
    expect(forceLocalLabelsOnNarrowZoom(true, 0.5, null)).toBe(false);
    expect(forceLocalLabelsOnNarrowZoom(true, 0.5, 0)).toBe(false);
    expect(forceLocalLabelsOnNarrowZoom(true, 0.5, Number.NaN)).toBe(false);
    expect(forceLocalLabelsOnNarrowZoom(true, 0, 1)).toBe(false);
    expect(forceLocalLabelsOnNarrowZoom(true, Number.POSITIVE_INFINITY, 1)).toBe(false);
  });

  it("marks foreign nodes and cross-brain edges without color alone", () => {
    const context = { mode: "brain", brainId: "engineering" } as const;
    const local = graphNodeAttributes(data.nodes[0], context);
    const foreign = graphNodeAttributes(data.nodes[1], context);
    const edge = graphEdgeAttributes(data.edges[0], context);

    expect(foreign.label).toBe("○ ↗ @design · Principles");
    expect(foreign.foreign).toBe(true);
    expect(foreign.forceLabel).toBe(true);
    expect(forceForeignLabel(foreign.foreign, true)).toBe(false);
    expect(forceForeignLabel(foreign.foreign, false)).toBe(true);
    expect(foreign.color).toBe("#8f8b94");
    expect(foreign.brainAccent).toBe("#b56cff");
    expect(foreign.size).toBeLessThan(local.size);
    expect(foreign.zIndex).toBe(0);
    expect(edge).toMatchObject({ crossBrain: true, mutedForeign: true, color: "#8f8b94", size: 0.75 });
  });

  it("labels duplicate titles by owner and status in combined views", () => {
    const context = { mode: "combined", brainIds: ["engineering", "design"] } as const;
    const engineering = graphNodeAttributes(data.nodes[0], context);
    const design = graphNodeAttributes(data.nodes[1], context);
    const edge = graphEdgeAttributes(data.edges[0], context);
    expect(engineering.label).toBe("◆ @engineering · Principles");
    expect(design.label).toBe("○ @design · Principles");
    expect(engineering.route).toBe("/brains/engineering/notes/principles");
    expect(edge).toMatchObject({ crossBrain: true, mutedForeign: false, color: "#d97706", size: 2.4 });
  });
});
