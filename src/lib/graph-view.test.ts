import { describe, expect, it } from "vitest";
import type { GraphData } from "./graph-data";
import {
  composeGraphLabel,
  defaultOwnerLabelPreference,
  forceForeignLabel,
  forceLabelsOnNarrowZoom,
  forceLocalLabelsOnNarrowZoom,
  graphEdgeAttributes,
  graphHoverSurface,
  graphNodeAttributes,
  narrowFocusedLabelDecision,
  ownerLabelStorageKey,
  responsiveLabelSettings,
  shortenGraphLabel,
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
      compositeId: "engineering/principles",
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
      compositeId: "design/principles",
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

  it("shortens a long focused label and keeps narrow neighbors selective", () => {
    const measure = (value: string) => [...value].length * 6;
    const label = "◆ @engineering · A deliberately long focused title";
    const shortened = shortenGraphLabel(label, 180, measure);

    expect(measure(shortened)).toBeLessThanOrEqual(180);
    expect(shortened).toMatch(/^◆ @engineering · A/u);
    expect(shortened).toMatch(/…$/u);
    expect(
      narrowFocusedLabelDecision(label, "focused", false, false, (value) =>
        shortenGraphLabel(value, 180, measure)
      ),
    ).toEqual({ label: shortened, forceLabel: true });
    expect(narrowFocusedLabelDecision(label, "neighbor", false, false, (value) => value))
      .toEqual({ label: "", forceLabel: false });
    expect(narrowFocusedLabelDecision("◆ Nearby", "neighbor", false, true, (value) => value))
      .toEqual({ label: "◆ Nearby", forceLabel: false });
    expect(narrowFocusedLabelDecision(label, "focused", true, false, (value) => value)).toBeNull();
  });

  it("omits a shortened label when even an ellipsis cannot fit", () => {
    const measure = (value: string) => [...value].length * 6;
    expect(shortenGraphLabel("A long title", 5, measure)).toBe("");
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
    expect(edge).toMatchObject({ crossBrain: true, mutedForeign: true, color: "#a9a5ae", size: 0.32 });
  });

  it("offers a workspace label with and without its owner", () => {
    const context = { mode: "all", encodeBrains: true } as const;
    const engineering = graphNodeAttributes(data.nodes[0], context);

    // Both readings are prepared up front, so the preference can be applied
    // without rebuilding the graph.
    expect(engineering.label).toBe("◆ @engineering · Principles");
    expect(engineering.titleLabel).toBe("◆ Principles");
    expect(engineering.ownerRequired).toBe(false);
  });

  it("never lets the preference strip a foreign label's brain in a per-brain graph", () => {
    const context = { mode: "brain", brainId: "engineering" } as const;
    const foreign = graphNodeAttributes(data.nodes[1], context);
    const local = graphNodeAttributes(data.nodes[0], context);

    expect(foreign.label).toBe("○ ↗ @design · Principles");
    expect(foreign.ownerRequired).toBe(true);
    // A note in its own Brain has no owner to remove either way.
    expect(local.ownerRequired).toBe(false);
    expect(local.label).toBe(local.titleLabel);
  });

  it("composes a label from its parts", () => {
    expect(composeGraphLabel("◆", "@engineering", "Principles"))
      .toBe("◆ @engineering · Principles");
    expect(composeGraphLabel("◆", null, "Principles")).toBe("◆ Principles");
    expect(composeGraphLabel("○", "↗ @design", "Principles"))
      .toBe("○ ↗ @design · Principles");
  });

  it("defaults owner labels off on a phone and on elsewhere", () => {
    expect(defaultOwnerLabelPreference(true)).toBe(false);
    expect(defaultOwnerLabelPreference(false)).toBe(true);
  });

  it("remembers the owner preference per site base, like the Brain lens", () => {
    expect(ownerLabelStorageKey("/")).toBe("brain-graph-owner-labels:/");
    expect(ownerLabelStorageKey("/vault-repo/")).not.toBe(ownerLabelStorageKey("/"));
  });

  it("labels duplicate titles by owner and status on the full workspace graph", () => {
    const context = { mode: "all", encodeBrains: true } as const;
    const engineering = graphNodeAttributes(data.nodes[0], context);
    const design = graphNodeAttributes(data.nodes[1], context);
    const edge = graphEdgeAttributes(data.edges[0], context);
    expect(engineering.label).toBe("◆ @engineering · Principles");
    expect(design.label).toBe("○ @design · Principles");
    expect(engineering.route).toBe("/brains/engineering/notes/principles");
    expect(edge).toMatchObject({ crossBrain: true, mutedForeign: false, color: "#e0a75a", size: 0.9 });
  });
});
