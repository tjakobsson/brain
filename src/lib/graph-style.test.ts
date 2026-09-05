import { afterEach, describe, expect, it, vi } from "vitest";
import { computeLayout, type LayoutEdge } from "./graph-layout";
import {
  flooredNodeSize,
  GRAPH_HOVER_PLATE_PADDING,
  graphHoverPlate,
  graphLabelBox,
  layoutGraphLabel,
  MAXIMUM_LABEL_LINES,
  MAXIMUM_LABEL_SIZE,
  MINIMUM_LEGIBLE_LABEL_SIZE,
  MAXIMUM_RENDERED_MARKER_PIXELS,
  MINIMUM_RENDERED_MARKER_PIXELS,
  MINIMUM_RENDERED_NODE_RADIUS,
  nodeSize,
  renderedLabelSize,
  easedEdgeSize,
  graphMarkerBox,
  MAXIMUM_RENDERED_EDGE_PIXELS,
  selectGraphLabels,
  defaultHoverPreviewPreference,
  hoverPreviewStorageKey,
} from "./graph-style";
import { graphScreenTargets } from "./graph-interaction";
import {
  beginLabelFades,
  finishedLabelFadeOuts,
  graphEdgeAttributes,
  labelFadeAlpha,
  labelFadesRunning,
  graphLabelAvailableWidth,
  maximumGraphLabelWidth,
} from "./graph-style";

/**
 * A cluster topology shaped like the vaults this project ships: notes chained
 * within a cluster, every tenth note a group hub, and a few links crossing
 * between clusters. The point is a realistic degree spread, not a specific
 * vault.
 */
function clusteredGraph(count: number, clusters: number) {
  const ids = Array.from({ length: count }, (_, index) => `n${String(index).padStart(4, "0")}`);
  const perCluster = Math.ceil(count / clusters);
  const seen = new Set<string>();
  const edges: LayoutEdge[] = [];
  const link = (from: number, to: number) => {
    if (from === to) return;
    const key = [ids[from]!, ids[to]!].sort().join("\u001f");
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ source: ids[from]!, target: ids[to]! });
  };
  for (let index = 0; index < count; index += 1) {
    const start = Math.floor(index / perCluster) * perCluster;
    const size = Math.min(perCluster, count - start);
    link(index, start + ((index - start + 1) % size));
    link(index, start + Math.floor((index - start) / 10) * 10);
    if (index % 10 === 0) link(index, (index + perCluster) % count);
  }
  return { ids, edges };
}

function degrees(ids: readonly string[], edges: readonly LayoutEdge[]): Map<string, number> {
  const counts = new Map(ids.map((id) => [id, 0]));
  for (const edge of edges) {
    counts.set(edge.source, (counts.get(edge.source) ?? 0) + 1);
    counts.set(edge.target, (counts.get(edge.target) ?? 0) + 1);
  }
  return counts;
}

function median(values: readonly number[]): number {
  return [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
}

/** Median distance from a node to its closest neighbor, in graph units. */
function medianNodeSpacing(positions: Record<string, { x: number; y: number }>): number {
  const points = Object.values(positions);
  return median(points.map((point, index) => {
    let closest = Number.POSITIVE_INFINITY;
    for (let other = 0; other < points.length; other += 1) {
      if (other === index) continue;
      closest = Math.min(closest, Math.hypot(point.x - points[other]!.x, point.y - points[other]!.y));
    }
    return closest;
  }));
}

function layoutDensity(count: number, clusters: number) {
  const { ids, edges } = clusteredGraph(count, clusters);
  const positions = computeLayout(ids, edges);
  const degree = degrees(ids, edges);
  const spacing = medianNodeSpacing(positions);
  const sizes = ids.map((id) => nodeSize(degree.get(id)!));
  return {
    spacing,
    diameterOverSpacing: (2 * median(sizes)) / spacing,
    smallestDiameterOverSpacing: (2 * Math.min(...sizes)) / spacing,
    largestDiameterOverSpacing: (2 * Math.max(...sizes)) / spacing,
  };
}

// The committed fixture measured 1.27 before this change, which is what made a
// real vault render as one continuous mass of overlapping colour.
//
// The band is centred on roughly 0.32, not on the 0.15 the reference vault
// measures. 0.15 does separate the markers, but on a 390 pixel viewport at 400
// notes it puts them at 1.9 CSS pixels, at which the per-brain accent colour
// stops being legible and the overview reads as an edge wireframe. Both were
// photographed and compared; see the change's `screenshots/CANDIDATES.md`.
//
// Sigma multiplies the on-screen ratio by `sqrt(cameraRatio)`, so a fitted
// overview near ratio 1.2 renders this as roughly 0.35. The browser assertion
// in `tests/browser/graph-scale.pw.ts` measures that end of it.
const TARGET_BAND = { low: 0.2, high: 0.5 };

describe("node marker density at vault scale", () => {
  const small = layoutDensity(30, 3);
  const large = layoutDensity(400, 5);

  it("puts a median marker inside the target band on a 30-node layout", () => {
    expect(small.diameterOverSpacing).toBeGreaterThan(TARGET_BAND.low);
    expect(small.diameterOverSpacing).toBeLessThan(TARGET_BAND.high);
  });

  it("puts a median marker inside the target band on a 400-node layout", () => {
    expect(large.diameterOverSpacing).toBeGreaterThan(TARGET_BAND.low);
    expect(large.diameterOverSpacing).toBeLessThan(TARGET_BAND.high);
  });

  it("keeps the two vault sizes looking like the same product", () => {
    // The scale invariance this change exists for: a graph-space radius plus a
    // layout whose node spacing barely moves with node count.
    const ratio = large.diameterOverSpacing / small.diameterOverSpacing;
    expect(ratio).toBeGreaterThan(0.6);
    expect(ratio).toBeLessThan(1.6);
    console.info(JSON.stringify({ small, large }));
  });
});

describe("node marker size encoding", () => {
  it("draws a hub visibly larger than a low-connectivity note", () => {
    // Connectivity has to survive the recalibration: a reader should still be
    // able to pick the hubs out of a fitted overview by size alone. Sigma
    // multiplies every marker by the same camera factor, so comparing sizes
    // across the degree range is comparing what gets drawn.
    const { ids, edges } = clusteredGraph(400, 5);
    const degree = degrees(ids, edges);
    const spread = [...degree.values()];
    const lowest = Math.min(...spread);
    const highest = Math.max(...spread);
    expect(highest).toBeGreaterThan(lowest + 4);
    expect(nodeSize(highest)).toBeGreaterThan(nodeSize(lowest) * 1.5);
    // And a hub stands out from the median note, not just from the rarest one.
    expect(nodeSize(highest)).toBeGreaterThan(nodeSize(median(spread)) * 1.2);
  });

  it("orders markers by connectivity across the whole degree range", () => {
    expect(nodeSize(1)).toBeGreaterThan(nodeSize(0));
    for (let degree = 1; degree < 40; degree += 1) {
      expect(nodeSize(degree)).toBeGreaterThan(nodeSize(degree - 1));
    }
  });

  it("never draws a marker below the rendering floor", () => {
    expect(nodeSize(0)).toBeGreaterThanOrEqual(MINIMUM_RENDERED_NODE_RADIUS);
    expect(nodeSize(-1)).toBeGreaterThanOrEqual(MINIMUM_RENDERED_NODE_RADIUS);
  });
});

describe("marker rendering and touch floors", () => {
  // Sigma's own law with `itemSizesReference: "positions"`: a graph-space size
  // times the pixels-per-graph-unit the camera currently gives.
  const scale = (pixelsPerUnit: number) => (size: number) => size * pixelsPerUnit;

  it("barely touches a marker well inside both limits", () => {
    // The ceiling eases rather than clips, so a small marker is nudged rather
    // than resized, and its ordering never changes.
    const size = nodeSize(3);
    const rendered = scale(2)(size);
    const adjusted = scale(2)(flooredNodeSize(size, scale(2)));
    expect(adjusted).toBeLessThan(rendered);
    expect(adjusted / rendered).toBeGreaterThan(0.85);
  });

  it("eases a large marker towards the ceiling without flattening the spread", () => {
    // A sparse vault renders most markers above the ceiling. Clipping them
    // would erase the connectivity encoding entirely, so they compress.
    const pixelsPerUnit = 12;
    const rendered = (degree: number) =>
      scale(pixelsPerUnit)(flooredNodeSize(nodeSize(degree), scale(pixelsPerUnit)));
    const leaf = rendered(1);
    const hub = rendered(11);
    expect(scale(pixelsPerUnit)(nodeSize(11))).toBeGreaterThan(MAXIMUM_RENDERED_MARKER_PIXELS);
    expect(hub).toBeLessThan(MAXIMUM_RENDERED_MARKER_PIXELS);
    // Still visibly ordered, and still visibly different.
    expect(hub).toBeGreaterThan(leaf);
    expect(hub / leaf).toBeGreaterThan(1.15);
  });

  it("never lets a marker reach the ceiling however large the layout gets", () => {
    for (const pixelsPerUnit of [50, 500, 5_000]) {
      const drawn = scale(pixelsPerUnit)(flooredNodeSize(nodeSize(20), scale(pixelsPerUnit)));
      expect(drawn).toBeLessThan(MAXIMUM_RENDERED_MARKER_PIXELS);
    }
  });

  it("stops a marker shrinking below the pixel floor at extreme density", () => {
    // A vault dense enough that a graph unit is a fraction of a pixel.
    const pixelsPerUnit = 0.4;
    const floored = flooredNodeSize(nodeSize(1), scale(pixelsPerUnit));
    expect(scale(pixelsPerUnit)(nodeSize(1))).toBeLessThan(MINIMUM_RENDERED_MARKER_PIXELS);
    expect(scale(pixelsPerUnit)(floored)).toBeCloseTo(MINIMUM_RENDERED_MARKER_PIXELS, 6);
  });

  it("keeps a 44 CSS pixel touch target at the smallest rendered marker", () => {
    const radius = MINIMUM_RENDERED_MARKER_PIXELS;
    const [marker] = graphScreenTargets(
      [{ node: "tiny", x: 200, y: 300, radius }],
      { width: 390, height: 844 },
    );
    expect(marker!.kind).toBe("marker");
    expect(marker!.right - marker!.left).toBeGreaterThanOrEqual(44);
    expect(marker!.bottom - marker!.top).toBeGreaterThanOrEqual(44);
    expect(marker!.radius).toBe(22);
  });

  it("ignores a scale that cannot be measured", () => {
    expect(flooredNodeSize(0.5, () => 0)).toBe(0.5);
    expect(flooredNodeSize(0.5, () => Number.NaN)).toBe(0.5);
  });
});

describe("canvas label layout", () => {
  // A fixed-width font keeps the arithmetic in the test readable: every
  // character is 6 pixels wide.
  const measure = (value: string) => [...value].length * 6;
  const layout = (label: string, width: number) => layoutGraphLabel(label, width, 13, measure);

  it("keeps a label that fits on one line", () => {
    const result = layout("◆ Atomic notes", 200);
    expect(result.lines).toEqual(["◆ Atomic notes"]);
    expect(result.width).toBe(measure("◆ Atomic notes"));
    expect(result.height).toBe(result.lineHeight);
  });

  it("wraps onto two lines at a word boundary", () => {
    const result = layout("Retrieval practice beats rereading", 120);
    expect(result.lines).toHaveLength(2);
    expect(result.lines.join(" ")).toBe("Retrieval practice beats rereading");
    for (const line of result.lines) expect(measure(line)).toBeLessThanOrEqual(120);
  });

  it("wraps onto three lines before it starts shortening", () => {
    const label = "Retrieval practice beats rereading the original source";
    const result = layout(label, 132);
    expect(result.lines).toHaveLength(3);
    expect(result.lines.join(" ")).toBe(label);
    expect(result.lines.some((line) => line.includes("…"))).toBe(false);
  });

  it("never wraps past three lines at any width", () => {
    const label = "An observability budget costs more than a confident guess about the codebase";
    for (let width = 20; width <= 600; width += 7) {
      expect(layout(label, width).lines.length).toBeLessThanOrEqual(MAXIMUM_LABEL_LINES);
    }
  });

  it("stops at a word too wide to break rather than wrapping around it", () => {
    // "observability" alone overflows a 70 pixel line, so it becomes the last
    // line, shortened. Continuing past it would drop the words it swallowed.
    const result = layout("An observability budget costs more than a guess", 70);
    expect(result.lines).toEqual(["An", "observabil…"]);
  });

  it("shortens the last line when three lines still do not fit", () => {
    const label = "An observability budget costs more than a confident guess about the codebase";
    const result = layout(label, 132);
    expect(result.lines).toHaveLength(3);
    expect(result.lines.at(-1)).toMatch(/…$/u);
    // The lines before the last are untouched text, in order.
    expect(label.startsWith(result.lines.slice(0, -1).join(" "))).toBe(true);
    for (const line of result.lines) expect(measure(line)).toBeLessThanOrEqual(132);
  });

  it("never drops words in the middle of a label", () => {
    // An ellipsis has to mean "the text stops here". A shortened middle line
    // would read as continuous text while silently skipping words.
    for (const width of [40, 55, 70, 90, 132, 200]) {
      const label = "An observability budget costs more than a confident guess about the codebase";
      const result = layout(label, width);
      const shortened = result.lines.findIndex((line) => line.includes("…"));
      if (shortened >= 0) expect(shortened).toBe(result.lines.length - 1);
      const intact = result.lines.filter((line) => !line.includes("…")).join(" ");
      expect(label.startsWith(intact)).toBe(true);
    }
  });

  it("shortens a single word too wide to wrap", () => {
    const result = layout("Unbreakablesupercalifragilistic", 60);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]).toMatch(/…$/u);
    expect(measure(result.lines[0]!)).toBeLessThanOrEqual(60);
  });

  it("omits a label when not even a shortened line fits", () => {
    expect(layout("A deliberately long title", 4).lines).toEqual([]);
    expect(layout("A deliberately long title", 4).width).toBe(0);
  });

  it("omits a label with no width, no text or no legible size", () => {
    expect(layout("", 200).lines).toEqual([]);
    expect(layout("   ", 200).lines).toEqual([]);
    expect(layout("Anything", 0).lines).toEqual([]);
    expect(layout("Anything", -10).lines).toEqual([]);
    expect(layoutGraphLabel("Anything", 200, 0, measure).lines).toEqual([]);
  });

  it("keeps the owner prefix readable when it shortens", () => {
    // `shortenGraphLabel` understands the owner divider, so a shortened final
    // line still says which brain the note belongs to.
    const result = layout("◆ @engineering-practice · A very long note title indeed", 90);
    expect(result.lines.at(-1)).toMatch(/…$/u);
    expect(result.lines.join(" ")).toContain("@engineering");
  });
});

describe("canvas label placement", () => {
  const measure = (value: string) => [...value].length * 6;

  it("centres the box on its node and puts it below the marker", () => {
    const layout = layoutGraphLabel("Retrieval practice beats rereading", 120, 13, measure);
    const box = graphLabelBox(layout, { x: 200, y: 300 }, 8, 4)!;
    expect(box.left).toBeCloseTo(200 - layout.width / 2, 6);
    expect(box.right).toBeCloseTo(200 + layout.width / 2, 6);
    expect(box.left + (box.right - box.left) / 2).toBeCloseTo(200, 6);
    // Clear of the marker, and tall enough for every line.
    expect(box.top).toBe(300 + 8 + 4);
    expect(box.bottom - box.top).toBeCloseTo(layout.height, 6);
  });

  it("reaches half as far sideways as the same label drawn to the right", () => {
    // The reason centring makes a real title tractable on a phone.
    const layout = layoutGraphLabel("A durable interface contract", 400, 13, measure);
    const box = graphLabelBox(layout, { x: 0, y: 0 }, 5)!;
    expect(box.right).toBeCloseTo(layout.width / 2, 6);
    expect(box.right).toBeLessThan(measure("A durable interface contract"));
  });

  it("has no box when there is no label to place", () => {
    expect(graphLabelBox(layoutGraphLabel("", 100, 13, measure), { x: 0, y: 0 }, 5)).toBeNull();
  });
});

describe("hover plate geometry", () => {
  const measure = (value: string) => [...value].length * 6;
  const layoutOf = (label: string, width: number) => layoutGraphLabel(label, width, 13, measure);

  it("covers the marker and every line of the label", () => {
    const layout = layoutOf("An observability budget costs more than a guess about it", 120);
    expect(layout.lines).toHaveLength(3);
    const center = { x: 200, y: 100 };
    const plate = graphHoverPlate(center, 6, layout);
    const box = graphLabelBox(layout, center, 6)!;

    expect(plate.top).toBeLessThan(center.y - 6);
    expect(plate.bottom).toBeGreaterThan(box.bottom - 0.001);
    expect(plate.left).toBeLessThan(box.left);
    expect(plate.right).toBeGreaterThan(box.right);
  });

  it("stays centred on the node at any marker radius", () => {
    const layout = layoutOf("Retrieval practice beats rereading", 120);
    for (const radius of [0.6, 6, 45]) {
      const plate = graphHoverPlate({ x: 200, y: 100 }, radius, layout);
      expect((plate.left + plate.right) / 2).toBeCloseTo(200, 6);
      // Never narrower than the marker it has to cover.
      expect(plate.right - plate.left).toBeGreaterThanOrEqual(radius * 2);
      expect(plate.top).toBeLessThanOrEqual(100 - radius);
    }
  });

  it("grows downward as the label wraps onto more lines", () => {
    const label = "An observability budget costs more than a confident guess";
    const heights = [400, 200, 120].map((width) => {
      const layout = layoutOf(label, width);
      const plate = graphHoverPlate({ x: 200, y: 100 }, 6, layout);
      return { lines: layout.lines.length, height: plate.bottom - plate.top };
    });
    expect(heights.map((entry) => entry.lines)).toEqual([1, 2, 3]);
    expect(heights[1]!.height).toBeGreaterThan(heights[0]!.height);
    expect(heights[2]!.height).toBeGreaterThan(heights[1]!.height);
  });

  it("falls back to the marker alone when there is no label", () => {
    const radius = 10;
    const plate = graphHoverPlate({ x: 200, y: 100 }, radius, layoutOf("", 120));
    const height = 2 * (radius + GRAPH_HOVER_PLATE_PADDING);
    expect(plate.bottom - plate.top).toBeCloseTo(height, 6);
    // Wider than it is tall, because the stadium's curve needs the room.
    expect(plate.right - plate.left).toBeGreaterThan(height);
  });

  it("clears the label on every side", () => {
    const layout = layoutOf("Retrieval practice beats rereading", 120);
    const centre = { x: 200, y: 100 };
    const plate = graphHoverPlate(centre, 6, layout);
    const box = graphLabelBox(layout, centre, 6)!;
    expect(box.left - plate.left).toBeGreaterThanOrEqual(GRAPH_HOVER_PLATE_PADDING);
    expect(plate.right - box.right).toBeGreaterThanOrEqual(GRAPH_HOVER_PLATE_PADDING);
    expect(plate.bottom - box.bottom).toBeCloseTo(GRAPH_HOVER_PLATE_PADDING, 6);
    expect(centre.y - 6 - plate.top).toBeCloseTo(GRAPH_HOVER_PLATE_PADDING, 6);
  });
});

describe("status marker line breaking", () => {
  const measure = (value: string) => [...value].length * 6;

  it("keeps the status marker on the same line as the first word", () => {
    const result = layoutGraphLabel("◆ Retrieval practice beats rereading", 120, 13, measure);
    // Never a line that is only the marker.
    expect(result.lines[0]).not.toBe("◆");
    expect(result.lines[0]).toMatch(/^◆\u00a0Retrieval/u);
  });

  it("still wraps the rest of the label at word boundaries", () => {
    const result = layoutGraphLabel("◆ Retrieval practice beats rereading", 90, 13, measure);
    expect(result.lines.length).toBeGreaterThan(1);
    for (const line of result.lines) expect(measure(line)).toBeLessThanOrEqual(90);
  });
});

describe("label text scaling with the camera", () => {
  const base = 11;

  it("grows text by the same law that grows markers", () => {
    // Markers scale by `1 / sqrt(cameraRatio)`; text now does too, so the
    // ratio between a marker and the title under it is constant at every zoom.
    // Inside the clamps: 11px scales freely between roughly 0.84 and 1.49.
    for (const ratio of [0.9, 1, 1.2, 1.4]) {
      expect(renderedLabelSize(base, ratio)).toBeCloseTo(base / Math.sqrt(ratio), 6);
    }
  });

  it("keeps the marker-to-text ratio constant across a zoom range", () => {
    const markerAt = (ratio: number) => nodeSize(4) / Math.sqrt(ratio);
    const ratios = [0.9, 1, 1.2, 1.4];
    const proportions = ratios.map((ratio) => markerAt(ratio) / renderedLabelSize(base, ratio));
    for (const proportion of proportions) expect(proportion).toBeCloseTo(proportions[0]!, 6);
  });

  it("clamps at both ends of the camera range", () => {
    // `minCameraRatio` is 0.05 and `maxCameraRatio` starts at 10.
    expect(renderedLabelSize(base, 0.05)).toBe(MAXIMUM_LABEL_SIZE);
    expect(renderedLabelSize(base, 0.0001)).toBe(MAXIMUM_LABEL_SIZE);
    expect(renderedLabelSize(base, 10)).toBe(MINIMUM_LEGIBLE_LABEL_SIZE);
    // A label never grows past a size that would dominate the canvas.
    expect(MAXIMUM_LABEL_SIZE).toBeLessThan(base * 1.5);
    expect(renderedLabelSize(base, 10_000)).toBe(MINIMUM_LEGIBLE_LABEL_SIZE);
  });

  it("gives one size for one camera state, whoever asks", () => {
    // Layout, rendering, hit testing and fitting all read the same rendered
    // size from the renderer's settings, so there is one value to agree on.
    const ratio = 1.2;
    const size = renderedLabelSize(base, ratio);
    const measure = (value: string) => [...value].length * (size / 2);
    const layout = layoutGraphLabel("Retrieval practice beats rereading", 160, size, measure);
    const box = graphLabelBox(layout, { x: 100, y: 100 }, 6)!;
    const plate = graphHoverPlate({ x: 100, y: 100 }, 6, layout);
    expect(layout.lineHeight).toBeCloseTo(size * 1.15, 6);
    expect(box.bottom - box.top).toBeCloseTo(layout.height, 6);
    expect(plate.bottom).toBeGreaterThanOrEqual(box.bottom);
    expect(renderedLabelSize(base, ratio)).toBe(size);
  });

  it("falls back to the base size for a camera it cannot read", () => {
    expect(renderedLabelSize(base, 0)).toBe(base);
    expect(renderedLabelSize(base, Number.NaN)).toBe(base);
    expect(renderedLabelSize(base, Number.POSITIVE_INFINITY)).toBe(base);
  });
});

describe("collision-based label selection", () => {
  const box = (left: number, top: number, width = 100, height = 20) =>
    ({ left, right: left + width, top, bottom: top + height });

  it("renders every label on a sparse graph", () => {
    const selected = selectGraphLabels([
      { node: "a", box: box(0, 0), priority: 2, degree: 1 },
      { node: "b", box: box(0, 100), priority: 2, degree: 1 },
      { node: "c", box: box(200, 0), priority: 2, degree: 1 },
    ], 13);
    expect(selected).toEqual(new Set(["a", "b", "c"]));
  });

  it("keeps only one of a stack of colliding labels, and draws it only in company", () => {
    const stack = Array.from({ length: 8 }, (_, index) => ({
      node: `n${index}`,
      box: box(index, index),
      priority: 2,
      degree: 1,
    }));
    // One survives the collision, but one label among eight candidates is an
    // accident of where the space happened to be, so nothing is drawn.
    expect(selectGraphLabels(stack, 13).size).toBe(0);
    // With two free-standing labels beside it the survivor is in company.
    const selected = selectGraphLabels([
      ...stack,
      { node: "far-a", box: box(400, 0), priority: 2, degree: 1 },
      { node: "far-b", box: box(400, 100), priority: 2, degree: 1 },
    ], 13);
    expect(selected.size).toBe(3);
    expect(selected.has("n0")).toBe(true);
  });

  it("never draws a lone unrelated label on a large graph", () => {
    // The reported case: a 400-note overview where exactly one peripheral hub
    // had clear space under it. Everything else collides with a marker.
    const marker = { node: "m", box: box(50, 50, 4, 4) };
    const candidates = Array.from({ length: 40 }, (_, index) => ({
      node: `n${index}`,
      box: box(index * 3, 40),
      priority: 2,
      degree: index === 0 ? 30 : 1,
    }));
    expect(selectGraphLabels(candidates, 13, [marker]).size).toBe(0);
  });

  it("lets one label stand for a small graph", () => {
    // Four nodes whose labels all collide: the one that survives is the hub,
    // a quarter of the graph, not an accident of where the space was.
    expect(selectGraphLabels([
      { node: "hub", box: box(0, 0), priority: 2, degree: 9 },
      { node: "b", box: box(4, 4), priority: 2, degree: 1 },
      { node: "c", box: box(8, 8), priority: 2, degree: 1 },
      { node: "d", box: box(12, 12), priority: 2, degree: 1 },
    ], 13)).toEqual(new Set(["hub"]));
    // Five, and one label is less than a quarter, but the floor is three
    // only once a graph is large enough for three to be a small share.
    expect(selectGraphLabels([
      ...Array.from({ length: 5 }, (_, index) => ({
        node: `n${index}`, box: box(index, index), priority: 2, degree: 1,
      })),
    ], 13).size).toBe(0);
  });

  it("never drops an exempt label for want of company", () => {
    // A foreign note in a per-Brain graph: its label says which Brain it comes
    // from, and one such note alone still needs saying.
    const crowd = Array.from({ length: 10 }, (_, index) => ({
      node: `crowd${index}`, box: box(300 + index, index), priority: 2, degree: 1,
    }));
    const selected = selectGraphLabels([
      { node: "foreign", box: box(0, 0), priority: 2, degree: 1, exempt: true },
      ...crowd,
    ], 13);
    expect(selected.has("foreign")).toBe(true);
  });

  it("exempts the inspected neighborhood from needing company", () => {
    // A pinned or hovered neighborhood at a zoomed-out camera: the one
    // neighbor label that fits is drawn alone, because the reader asked for
    // that neighborhood; the one unrelated label that fits is not.
    const candidates = [
      { node: "neighbor", box: box(0, 0), priority: 1, degree: 1 },
      { node: "stranger", box: box(300, 0), priority: 2, degree: 9 },
      // A crowd that all collides with the stranger, so only it and the
      // neighbor can be placed: two labels, one of them unrelated.
      ...Array.from({ length: 10 }, (_, index) => ({
        node: `crowd${index}`,
        box: box(300 + index, index),
        priority: 2,
        degree: 1,
      })),
    ];
    const selected = selectGraphLabels(candidates, 13);
    expect(selected.has("neighbor")).toBe(true);
    expect(selected.has("stranger")).toBe(false);
  });

  it("renders nothing at all when text would be illegibly small", () => {
    const selected = selectGraphLabels([{ node: "a", box: box(0, 0), priority: 2, degree: 1 }], 8);
    expect(selected.size).toBe(0);
  });

  it("prefers the focused note, then its neighbors, then hubs, then id", () => {
    const contenders = [
      { node: "hub", box: box(0, 0), priority: 2, degree: 40 },
      { node: "neighbor", box: box(1, 1), priority: 1, degree: 2 },
      { node: "focused", box: box(2, 2), priority: 0, degree: 1 },
    ];
    expect(selectGraphLabels(contenders, 13)).toEqual(new Set(["focused"]));
    expect(selectGraphLabels(contenders.slice(0, 2), 13)).toEqual(new Set(["neighbor"]));
    expect(selectGraphLabels(contenders.slice(0, 1), 13)).toEqual(new Set(["hub"]));
    // Ties fall back to the id, so the choice never depends on iteration order.
    expect(selectGraphLabels([
      { node: "beta", box: box(0, 0), priority: 2, degree: 3 },
      { node: "alpha", box: box(1, 1), priority: 2, degree: 3 },
    ], 13)).toEqual(new Set(["alpha"]));
  });

  it("picks the same labels however the candidates arrive", () => {
    // Stability frame to frame: the order the graph happens to enumerate its
    // nodes in must not change what a reader sees.
    const contenders = Array.from({ length: 30 }, (_, index) => ({
      node: `n${String(index).padStart(2, "0")}`,
      box: box((index % 6) * 40, Math.floor(index / 6) * 12),
      priority: index === 7 ? 0 : index % 3,
      degree: (index * 7) % 11,
    }));
    const first = selectGraphLabels(contenders, 13);
    const reversed = selectGraphLabels([...contenders].reverse(), 13);
    const shuffled = selectGraphLabels(
      [...contenders].sort((a, b) => a.node.charCodeAt(1) - b.node.charCodeAt(1)),
      13,
    );
    expect([...reversed].sort()).toEqual([...first].sort());
    expect([...shuffled].sort()).toEqual([...first].sort());
  });
});

describe("edge weight across zoom and vault size", () => {
  // Sigma's law with `itemSizesReference: "positions"`: one graph unit maps to
  // some pixel count for the current camera, and every sized item uses it.
  const pixelsPerUnit = (ratio: number) => 1.86 / Math.sqrt(ratio);
  const edge = (crossBrain: boolean) =>
    graphEdgeAttributes(
      {
        source: "a",
        target: "b",
        sourceBrainId: "x",
        targetBrainId: crossBrain ? "y" : "x",
        crossBrain,
      },
      { mode: "all" },
    ).size;

  it("thickens edges as the reader zooms in", () => {
    const overview = edge(false) * pixelsPerUnit(1.12);
    const zoomed = edge(false) * pixelsPerUnit(0.079);
    expect(overview).toBeLessThan(1.2);
    // Faint at the overview, but unmistakably a connection once zoomed in.
    expect(zoomed).toBeGreaterThan(2);
    expect(zoomed / overview).toBeCloseTo(Math.sqrt(1.12 / 0.079), 6);
  });

  it("keeps edges in proportion to the markers they join", () => {
    // Both are graph-space quantities, so the proportion is camera-independent
    // and a link never becomes a hairline beside a growing marker.
    const proportions = [1.12, 0.5, 0.079].map((ratio) =>
      (edge(false) * pixelsPerUnit(ratio)) / (2 * nodeSize(3) * pixelsPerUnit(ratio))
    );
    for (const proportion of proportions) expect(proportion).toBeCloseTo(proportions[0]!, 6);
  });

  it("still marks a cross-brain link as the heavier one", () => {
    expect(edge(true)).toBeGreaterThan(edge(false) * 1.5);
  });
});

describe("labels avoid markers as well as other labels", () => {
  const box = (left: number, top: number, width = 100, height = 20) =>
    ({ left, right: left + width, top, bottom: top + height });
  const candidate = (node: string, left: number, top: number) =>
    ({ node, box: box(left, top), priority: 2, degree: 1 });

  it("skips a label that would be laid over another node's marker", () => {
    const markers = [{ node: "other", box: graphMarkerBox({ x: 50, y: 10 }, 8) }];
    expect(selectGraphLabels([candidate("a", 0, 0)], 13, markers).size).toBe(0);
  });

  it("keeps a label that clears every marker", () => {
    const markers = [{ node: "other", box: graphMarkerBox({ x: 400, y: 400 }, 8) }];
    expect(selectGraphLabels([candidate("a", 0, 0)], 13, markers)).toEqual(new Set(["a"]));
  });

  it("ignores the marker of the node the label belongs to", () => {
    // A label sits directly under its own node, so its own marker can never
    // be the thing that disqualifies it.
    const markers = [{ node: "a", box: graphMarkerBox({ x: 50, y: 0 }, 12) }];
    expect(selectGraphLabels([candidate("a", 0, 0)], 13, markers)).toEqual(new Set(["a"]));
  });

  it("renders almost nothing on a graph too dense to place labels in clear space", () => {
    // The reference behavior for a dense fitted overview: markers and edges,
    // with at most a stray label where the layout happens to leave a gap,
    // rather than a partial set laid over the whole graph.
    // A grid of markers closer together than a label is wide: every label box
    // reaches across a neighbour whichever node it belongs to.
    const markers = Array.from({ length: 60 }, (_, index) => ({
      node: `n${index}`,
      box: graphMarkerBox({ x: (index % 10) * 30, y: Math.floor(index / 10) * 18 }, 6),
    }));
    const candidates = markers.map((marker, index) =>
      candidate(marker.node, (index % 10) * 30 - 50, Math.floor(index / 10) * 18 + 7)
    );
    const selected = selectGraphLabels(candidates, 13, markers);
    expect(selected.size).toBeLessThan(candidates.length * 0.1);
  });

  it("still labels every node on a sparse connection map", () => {
    const markers = [0, 1, 2].map((index) => ({
      node: `n${index}`,
      box: graphMarkerBox({ x: index * 400, y: 0 }, 8) ,
    }));
    const candidates = markers.map((marker, index) => candidate(marker.node, index * 400 - 50, 20));
    expect(selectGraphLabels(candidates, 13, markers).size).toBe(3);
  });
});

describe("edge thickness ceiling", () => {
  const scale = (pixelsPerUnit: number) => (size: number) => size * pixelsPerUnit;
  const normal = graphEdgeAttributes(
    { source: "a", target: "b", sourceBrainId: "x", targetBrainId: "x", crossBrain: false },
    { mode: "all" },
  ).size;
  const cross = graphEdgeAttributes(
    { source: "a", target: "b", sourceBrainId: "x", targetBrainId: "y", crossBrain: true },
    { mode: "all" },
  ).size;

  it("keeps a closely framed neighborhood's links thin", () => {
    // A focused fit puts roughly 12 pixels into a graph unit; ungoverned that
    // drew the links to the focused note as bars several pixels thick.
    const drawn = scale(12)(easedEdgeSize(normal, scale(12)));
    expect(scale(12)(normal)).toBeGreaterThan(4);
    expect(drawn).toBeLessThan(1.6);
  });

  it("never reaches the ceiling however closely a graph is framed", () => {
    for (const pixelsPerUnit of [50, 500, 5_000]) {
      const drawn = scale(pixelsPerUnit)(easedEdgeSize(normal, scale(pixelsPerUnit)));
      expect(drawn).toBeLessThan(MAXIMUM_RENDERED_EDGE_PIXELS);
    }
  });

  it("leaves a faint overview edge almost untouched", () => {
    const overview = scale(1.66);
    expect(overview(easedEdgeSize(normal, overview)) / overview(normal)).toBeGreaterThan(0.7);
  });

  it("keeps a cross-brain link the heavier one at every framing", () => {
    for (const pixelsPerUnit of [1.66, 12, 100]) {
      const s = scale(pixelsPerUnit);
      expect(s(easedEdgeSize(cross, s))).toBeGreaterThan(s(easedEdgeSize(normal, s)));
    }
  });
});

describe("the focused note always keeps its label", () => {
  const box = (left: number, top: number, width = 100, height = 20) =>
    ({ left, right: left + width, top, bottom: top + height });

  it("renders a required label even where nothing else could be placed", () => {
    const markers = Array.from({ length: 20 }, (_, index) => ({
      node: `n${index}`,
      box: graphMarkerBox({ x: index * 12, y: 10 }, 8),
    }));
    const candidates = [
      { node: "focused", box: box(0, 0), priority: 0, degree: 1, required: true },
      { node: "other", box: box(5, 5), priority: 1, degree: 9 },
    ];
    expect(selectGraphLabels(candidates, 13, markers)).toEqual(new Set(["focused"]));
  });

  it("keeps the focused label even below the legible size floor", () => {
    const candidates = [
      { node: "focused", box: box(0, 0), priority: 0, degree: 1, required: true },
      { node: "other", box: box(500, 500), priority: 2, degree: 1 },
    ];
    expect(selectGraphLabels(candidates, 4)).toEqual(new Set(["focused"]));
  });

  it("makes every other label avoid the required one", () => {
    const candidates = [
      { node: "focused", box: box(0, 0), priority: 0, degree: 1, required: true },
      { node: "overlapping", box: box(10, 5), priority: 1, degree: 9 },
      { node: "clear", box: box(400, 400), priority: 1, degree: 9 },
    ];
    expect(selectGraphLabels(candidates, 13)).toEqual(new Set(["focused", "clear"]));
  });
});

describe("label width is independent of where its node sits", () => {
  it("gives the same budget at an edge as in the middle", () => {
    const maximum = maximumGraphLabelWidth(390);
    for (const centerX of [0, 4, 195, 386, 390]) {
      expect(graphLabelAvailableWidth(centerX, 390, maximum)).toBe(maximum);
    }
  });

  it("wraps a title the same way wherever it is on screen", () => {
    const measure = (value: string) => [...value].length * 6;
    const maximum = maximumGraphLabelWidth(390);
    const title = "An observability budget costs more than a confident guess";
    const shapes = [2, 100, 195, 300, 388].map((centerX) =>
      layoutGraphLabel(title, graphLabelAvailableWidth(centerX, 390, maximum), 11, measure).lines);
    for (const shape of shapes) expect(shape).toEqual(shapes[0]);
  });
});

describe("labels fade rather than flicker", () => {
  const owner = () => ({});
  const at = (ms: number) => vi.spyOn(performance, "now").mockReturnValue(ms);

  afterEach(() => vi.restoreAllMocks());

  it("ramps an arriving label from transparent to opaque", () => {
    const context = owner();
    at(0);
    expect(beginLabelFades(context, ["a"], [])).toBe(true);
    expect(labelFadeAlpha(context, "a")).toBe(0);
    at(110);
    expect(labelFadeAlpha(context, "a")).toBeCloseTo(0.5, 1);
    at(220);
    expect(labelFadeAlpha(context, "a")).toBe(1);
  });

  it("ramps a leaving label the other way", () => {
    const context = owner();
    at(0);
    beginLabelFades(context, [], ["a"]);
    expect(labelFadeAlpha(context, "a")).toBe(1);
    at(110);
    expect(labelFadeAlpha(context, "a")).toBeCloseTo(0.5, 1);
    at(220);
    expect(labelFadeAlpha(context, "a")).toBe(0);
  });

  it("draws a label that is not fading at full opacity", () => {
    expect(labelFadeAlpha(owner(), "never-faded")).toBe(1);
  });

  it("forgets an arriving label once it is fully opaque, but keeps a leaving one", () => {
    const context = owner();
    at(0);
    beginLabelFades(context, ["in"], ["out"]);
    at(300);
    labelFadeAlpha(context, "in");
    // The arriving one is done and needs no more frames; the leaving one still
    // has to be taken off the canvas deliberately.
    expect(labelFadesRunning(context)).toBe(true);
    expect(finishedLabelFadeOuts(context)).toEqual(["out"]);
    expect(labelFadesRunning(context)).toBe(false);
  });

  it("reverses a label that starts leaving while it is still arriving", () => {
    const context = owner();
    at(0);
    beginLabelFades(context, ["a"], []);
    at(60);
    expect(beginLabelFades(context, [], ["a"])).toBe(true);
    expect(labelFadeAlpha(context, "a")).toBe(1);
    at(280);
    expect(labelFadeAlpha(context, "a")).toBe(0);
  });

  it("does not restart a fade that is already going the same way", () => {
    const context = owner();
    at(0);
    beginLabelFades(context, ["a"], []);
    at(110);
    expect(beginLabelFades(context, ["a"], [])).toBe(false);
    expect(labelFadeAlpha(context, "a")).toBeCloseTo(0.5, 1);
  });

  it("keeps two graphs' fades apart", () => {
    const one = owner();
    const two = owner();
    at(0);
    beginLabelFades(one, ["a"], []);
    expect(labelFadeAlpha(one, "a")).toBe(0);
    expect(labelFadeAlpha(two, "a")).toBe(1);
  });
});

describe("hover preview preference", () => {
  it("is off until a reader turns it on", () => {
    expect(defaultHoverPreviewPreference()).toBe(false);
  });

  it("is remembered per site base", () => {
    expect(hoverPreviewStorageKey("/")).toBe("brain-graph-hover-preview:/");
    expect(hoverPreviewStorageKey("/vault-repo/")).not.toBe(hoverPreviewStorageKey("/"));
  });
});
