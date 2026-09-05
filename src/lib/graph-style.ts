import type { GraphContext, GraphEdgeDatum, GraphNodeDatum } from "./graph-data";

const TYPE_HUE: Record<string, number> = {
  fleeting: 4,
  literature: 212,
  permanent: 268,
};

const STATUS_SL: Record<string, [number, number]> = {
  draft: [48, 50],
  developing: [66, 57],
  established: [82, 64],
};

function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100;
  const ln = l / 100;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return ln - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  const to = (value: number) => Math.round(255 * value).toString(16).padStart(2, "0");
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
}

export function nodeColor(type: string, status: string): string {
  const hue = TYPE_HUE[type] ?? 268;
  const [saturation, lightness] = STATUS_SL[status] ?? STATUS_SL.draft;
  return hslToHex(hue, saturation, lightness);
}

/**
 * Node marker radius, in graph-space units.
 *
 * Sigma renders node sizes with `itemSizesReference: "positions"`, so this is a
 * distance in the same units as `x` and `y` rather than a pixel count. That is
 * what makes the overview survive a growing vault. A ForceAtlas2 layout keeps
 * roughly the same distance between neighboring nodes however many it places,
 * measured at 9.9 units for a 22-note vault against 7.5 for a 400-note
 * workspace while the bounding box grew 4.3 times, so a radius fixed in graph
 * units keeps marker diameter a roughly constant fraction of the gap between
 * markers at every vault size. A fixed pixel count could not: the fit
 * compressed positions as the vault grew while the markers stayed put, until
 * they merged into one mass of overlapping color.
 *
 * The constants put a median-degree marker at roughly 0.15 of the distance to
 * its nearest neighbor, matching the reference behavior, at both vault sizes.
 */
const NODE_BASE_RADIUS = 0.45;
const NODE_DEGREE_RADIUS = 0.41;

/**
 * The smallest radius a marker is given in graph units, so the reduced size a
 * foreign node is drawn at cannot collapse to nothing.
 */
export const MINIMUM_RENDERED_NODE_RADIUS = 0.18;

/**
 * The smallest radius a marker is drawn at on screen, in CSS pixels.
 *
 * Graph-space sizing is what keeps markers separable, but it also means a large
 * enough vault shrinks every marker together. Below roughly this radius a
 * marker stops reading as a dot and becomes a smudge, so at extreme density the
 * markers stop shrinking and start overlapping instead. Touch targets do not
 * depend on this floor: `graphScreenTargets` floors the hit radius separately
 * and far higher.
 */
export const MINIMUM_RENDERED_MARKER_PIXELS = 0.6;

/**
 * The radius, in CSS pixels, that rendered markers approach but never reach.
 *
 * Graph-space sizing holds marker diameter to a constant fraction of the gap
 * between nodes, which is what makes a small vault and a large one look like
 * the same product. The cost is that a sparse or closely framed graph puts a
 * lot of pixels between neighbors, and a constant fraction of a large gap is a
 * large blob. This is the ceiling to the rendering floor below.
 */
export const MAXIMUM_RENDERED_MARKER_PIXELS = 20;

/**
 * A rendered radius eased towards the ceiling rather than clipped at it.
 *
 * A hard cap would flatten every marker above it to one size, and connectivity
 * is encoded in exactly those differences: on a small vault most markers sit
 * above the ceiling, so clipping would erase the encoding entirely. This curve
 * leaves small markers alone, compresses large ones, and never reorders two
 * markers, so a hub still reads as larger than a leaf.
 */
function easedMarkerRadius(rendered: number): number {
  return (MAXIMUM_RENDERED_MARKER_PIXELS * rendered) /
    (MAXIMUM_RENDERED_MARKER_PIXELS + rendered);
}

/**
 * The thickness, in CSS pixels, that rendered edges approach but never reach.
 *
 * Edges scale with the camera for the same reason markers and text do, so a
 * link stays legible when a reader zooms in. Without a ceiling that law runs
 * away in the other direction: a closely framed neighborhood puts a lot of
 * pixels into a graph unit, and the links to the focused note render as bars.
 * Edges are the connective tissue of the picture, not its subject, so their
 * ceiling is far lower than a marker's.
 */
export const MAXIMUM_RENDERED_EDGE_PIXELS = 2;

/**
 * An edge size eased towards the edge ceiling, by the same curve markers use.
 * Ordering survives, so a cross-brain link stays the heavier one.
 */
export function easedEdgeSize(size: number, scale: (size: number) => number): number {
  const rendered = scale(size);
  if (!Number.isFinite(rendered) || rendered <= 0) return size;
  const target = (MAXIMUM_RENDERED_EDGE_PIXELS * rendered) /
    (MAXIMUM_RENDERED_EDGE_PIXELS + rendered);
  return size * (target / rendered);
}

/**
 * A graph-space marker size adjusted so the marker draws between the pixel
 * floor and the pixel ceiling. `scale` is sigma's own size scaling for the
 * current camera, so hit testing and label-aware fitting see the same size the
 * reader sees.
 */
export function flooredNodeSize(size: number, scale: (size: number) => number): number {
  const rendered = scale(size);
  if (!Number.isFinite(rendered) || rendered <= 0) return size;
  const target = Math.max(MINIMUM_RENDERED_MARKER_PIXELS, easedMarkerRadius(rendered));
  return size * (target / rendered);
}

export function nodeSize(degree: number): number {
  return Math.max(
    MINIMUM_RENDERED_NODE_RADIUS,
    NODE_BASE_RADIUS + Math.sqrt(Math.max(0, degree)) * NODE_DEGREE_RADIUS,
  );
}

export function forceForeignLabel(foreign: boolean, narrow: boolean): boolean {
  return foreign && !narrow;
}

export function foreignLabelMarkWidth(labelSize: number): number {
  return labelSize + 4;
}

export function graphHoverSurface(prefersLight: boolean): string {
  return prefersLight ? "#fff" : "#24232a";
}

export function responsiveLabelSettings(
  narrow: boolean,
  desktopThreshold: number,
  desktopGridCellSize: number,
) {
  return {
    labelRenderedSizeThreshold: narrow ? 0 : desktopThreshold,
    labelGridCellSize: narrow ? 180 : desktopGridCellSize,
  };
}

export function forceLabelsOnNarrowZoom(narrow: boolean, cameraRatio: number): boolean {
  return narrow && cameraRatio <= 0.75;
}

export function forceLocalLabelsOnNarrowZoom(
  narrow: boolean,
  cameraRatio: number,
  fittedRatio: number | null,
): boolean {
  return narrow &&
    Number.isFinite(cameraRatio) &&
    cameraRatio > 0 &&
    fittedRatio !== null &&
    Number.isFinite(fittedRatio) &&
    fittedRatio > 0 &&
    cameraRatio <= fittedRatio * 0.75;
}

export function shortenGraphLabel(
  label: string,
  maximumWidth: number,
  measure: (value: string) => number,
): string {
  if (measure(label) <= maximumWidth) return label;
  const ellipsis = "…";
  if (measure(ellipsis) > maximumWidth) return "";
  const shorten = (value: string, prefix = "", limit = maximumWidth) => {
    if (measure(`${prefix}${ellipsis}`) > limit) return ellipsis;
    const characters = [...value];
    let low = 0;
    let high = characters.length;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      const candidate = `${prefix}${characters.slice(0, middle).join("").trimEnd()}${ellipsis}`;
      if (measure(candidate) <= limit) low = middle;
      else high = middle - 1;
    }
    return `${prefix}${characters.slice(0, low).join("").trimEnd()}${ellipsis}`;
  };

  const divider = " · ";
  const dividerIndex = label.indexOf(divider);
  if (dividerIndex < 0) return shorten(label);

  const owner = label.slice(0, dividerIndex);
  const title = label.slice(dividerIndex + divider.length);
  const titleHint = `${[...title].slice(0, 6).join("")}${ellipsis}`;
  const ownerBudget = maximumWidth - measure(`${divider}${titleHint}`);
  const visibleOwner = measure(owner) <= ownerBudget ? owner : shorten(owner, "", ownerBudget);
  return shorten(title, `${visibleOwner}${divider}`);
}

/** Canvas labels wrap onto at most this many lines before being shortened. */
export const MAXIMUM_LABEL_LINES = 3;

/** Gap between a node's marker and the first line of its label, in pixels. */
export const GRAPH_LABEL_GAP = 4;

/** Line box height as a multiple of the rendered font size. */
const LABEL_LINE_HEIGHT = 1.15;

export interface GraphLabelLayout {
  /** Rendered lines, top to bottom. Empty when no legible label fits. */
  lines: string[];
  /** Widest rendered line, in pixels. */
  width: number;
  /** Height of the whole block, in pixels. */
  height: number;
  /** Distance between the baselines of consecutive lines, in pixels. */
  lineHeight: number;
}

const EMPTY_LABEL_LAYOUT: GraphLabelLayout = { lines: [], width: 0, height: 0, lineHeight: 0 };

/**
 * Lays a canvas label out as centred, wrapped lines, and measures the box they
 * occupy.
 *
 * This is the single source of truth for canvas label geometry. The renderer,
 * hit testing and label-aware camera fitting all consume what it returns rather
 * than each recomputing where a label sits, because only the renderer is
 * obviously wrong when those three disagree: hit testing and fitting fail
 * silently.
 *
 * A label that fits stays on one line. One that does not wraps at word
 * boundaries onto at most three. Text that still does not fit has its last line
 * shortened with an ellipsis, and a label that cannot produce even one legible
 * shortened line is omitted rather than drawn cut off.
 */
export function layoutGraphLabel(
  label: string,
  availableWidth: number,
  fontSize: number,
  measure: (value: string) => number,
): GraphLabelLayout {
  const text = label.trim();
  if (!text || !(availableWidth > 0) || !(fontSize > 0)) return EMPTY_LABEL_LAYOUT;

  const lineHeight = fontSize * LABEL_LINE_HEIGHT;
  const box = (lines: string[]): GraphLabelLayout => {
    const rendered = lines.filter((line) => line.length > 0);
    if (rendered.length === 0) return EMPTY_LABEL_LAYOUT;
    return {
      lines: rendered,
      width: Math.max(...rendered.map(measure)),
      height: rendered.length * lineHeight,
      lineHeight,
    };
  };

  if (measure(text) <= availableWidth) return box([text]);

  // The status marker is not a word: breaking after it would spend a whole line
  // on one glyph and push the title further down.
  // Splitting on `\s` would undo this immediately: in JavaScript `\s` matches a
  // non-breaking space, so the break has to exclude it explicitly.
  const words = text.replace(/^([○◇◆])\s+/u, "$1\u00a0").split(/[^\S\u00a0]+/u);
  const wrapped: string[] = [];
  let next = 0;
  while (next < words.length && wrapped.length < MAXIMUM_LABEL_LINES) {
    let line = words[next]!;
    next += 1;
    if (wrapped.length === MAXIMUM_LABEL_LINES - 1) {
      // The last line takes everything still unplaced and is shortened to fit.
      line = [line, ...words.slice(next)].join(" ");
      next = words.length;
    } else {
      while (next < words.length && measure(`${line} ${words[next]}`) <= availableWidth) {
        line = `${line} ${words[next]}`;
        next += 1;
      }
    }
    if (measure(line) <= availableWidth) {
      wrapped.push(line);
      continue;
    }
    // Only ever the final rendered line: an ellipsis says the text was cut off
    // here, so nothing may follow it. Shortening a middle line instead would
    // drop words silently and leave a label that reads as nonsense.
    wrapped.push(shortenGraphLabel(line, availableWidth, measure));
    break;
  }

  return box(wrapped);
}

/**
 * How wide a centred label may be drawn, wherever its node sits.
 *
 * Deliberately independent of the node's position. Deriving the budget from
 * the distance to the nearer edge kept every label inside the canvas, but it
 * meant the same title wrapped differently depending on where it happened to
 * be: panning reflowed labels continuously, and a label near an edge became a
 * narrow stack of short lines. A label keeps its shape and clips at the edge
 * instead, which is what a reader expects from a map they are dragging around.
 */
export function graphLabelAvailableWidth(
  _centerX: number,
  _viewportWidth: number,
  maximumWidth: number,
): number {
  return Math.max(0, maximumWidth);
}

/** The widest a label is allowed to grow, however much room its node has. */
export function maximumGraphLabelWidth(viewportWidth: number): number {
  return Math.max(120, Math.min(320, viewportWidth - 48));
}

export interface GraphLabelBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Where a laid-out label sits on screen: centred horizontally on its node and
 * below the node's marker.
 *
 * Centring is what makes a real title tractable on a phone. A right-hand label
 * needs its whole length in clear space on one side; a centred one needs half
 * its longest line on each, and wrapping cuts that again.
 */
export function graphLabelBox(
  layout: GraphLabelLayout,
  center: { x: number; y: number },
  markerRadius: number,
  gap: number = GRAPH_LABEL_GAP,
): GraphLabelBox | null {
  if (layout.lines.length === 0) return null;
  const top = center.y + markerRadius + gap;
  return {
    left: center.x - layout.width / 2,
    right: center.x + layout.width / 2,
    top,
    bottom: top + layout.height,
  };
}

/**
 * The smallest rendered label size that is worth drawing, in CSS pixels. Below
 * this a title is not text a reader can read, it is texture.
 */
export const MINIMUM_LEGIBLE_LABEL_SIZE = 9;

/**
 * The largest rendered label size, in CSS pixels.
 *
 * The site's body text runs 12 to 14 pixels, and a canvas title sits at the top
 * of that range and goes no further. Beyond it a zoomed-in graph stops being a
 * graph with labels and becomes a wall of text. Most of what makes a
 * zoomed-in graph readable is collision selection letting more titles through
 * as the nodes separate, not any one of them getting larger.
 */
export const MAXIMUM_LABEL_SIZE = 12;

/**
 * The size a canvas label renders at for a given camera.
 *
 * Node markers already grow by `1 / sqrt(cameraRatio)`; text used to be a fixed
 * pixel count, so zooming in inflated the markers while the titles beside them
 * stayed exactly as hard to read. Putting text under the same law is what makes
 * "zoom in to read it" true rather than just "zoom in to spread them out".
 */
export function renderedLabelSize(baseSize: number, cameraRatio: number): number {
  if (!(cameraRatio > 0) || !Number.isFinite(cameraRatio)) return baseSize;
  return Math.min(MAXIMUM_LABEL_SIZE, Math.max(MINIMUM_LEGIBLE_LABEL_SIZE, baseSize / Math.sqrt(cameraRatio)));
}

/**
 * The rounded plate drawn behind a hovered node's label.
 *
 * The old pill sat to the right of the marker and was joined to it by a tangent
 * construction, which only made sense for a single line of text on one side.
 * A centred, wrapped label needs a plain box that covers the marker and every
 * line below it, so the geometry becomes a rectangle plus a corner radius.
 */
/** Breathing room between a hover plate's edge and what it holds, in pixels. */
export const GRAPH_HOVER_PLATE_PADDING = 7;

export function graphHoverPlate(
  center: { x: number; y: number },
  markerRadius: number,
  layout: GraphLabelLayout,
  padding = GRAPH_HOVER_PLATE_PADDING,
): { left: number; top: number; right: number; bottom: number; radius: number } {
  const box = graphLabelBox(layout, center, markerRadius);
  const top = center.y - markerRadius - padding;
  const bottom = (box ? box.bottom : center.y + markerRadius) + padding;
  // Fully rounded, so the plate reads as the same family as the graph's
  // floating controls rather than as a boxy tooltip. A stadium curves in at its
  // ends, which eats into the corners, so the sides get more room than the top
  // and bottom to keep the text clear of the curve.
  const inlinePadding = padding + (bottom - top) * 0.18;
  const halfWidth = Math.max(markerRadius, box ? (box.right - box.left) / 2 : 0) + inlinePadding;
  return {
    left: center.x - halfWidth,
    right: center.x + halfWidth,
    top,
    bottom,
    radius: Math.min(bottom - top, halfWidth * 2) / 2,
  };
}

/** How long a label takes to fade in once it has been placed. */
const LABEL_FADE_MS = 220;

/**
 * When each newly placed label started fading in, per renderer.
 *
 * Keyed by the label canvas context because that is the only per-renderer
 * handle the draw callback receives, and two graphs must not share fades.
 */
interface LabelFade {
  startedAt: number;
  /** Fading out rather than in, so the label leaves instead of arriving. */
  out: boolean;
}

const labelFadeStarts = new WeakMap<object, Map<string, LabelFade>>();

/**
 * Marks labels as newly placed so they fade in rather than appearing at once.
 *
 * Selection changes in steps as the camera settles, and a step that swaps
 * several titles at once reads as a flicker. Fading in makes the same change
 * feel like the graph resolving.
 */
export function beginLabelFades(
  context: object,
  appearing: Iterable<string>,
  leaving: Iterable<string>,
): boolean {
  const now = performance.now();
  let started = false;
  let fades = labelFadeStarts.get(context);
  if (!fades) {
    fades = new Map();
    labelFadeStarts.set(context, fades);
  }
  for (const [nodes, out] of [[appearing, false], [leaving, true]] as const) {
    for (const node of nodes) {
      if (fades.get(node)?.out === out) continue;
      fades.set(node, { startedAt: now, out });
      started = true;
    }
  }
  return started;
}

/** How far through its fade a label is, 0 to 1. */
function labelFadeProgress(fade: LabelFade): number {
  return Math.min(1, Math.max(0, (performance.now() - fade.startedAt) / LABEL_FADE_MS));
}

/** How opaque a label should be drawn right now, 1 unless it is fading. */
export function labelFadeAlpha(context: object, node: string): number {
  const fade = labelFadeStarts.get(context)?.get(node);
  if (!fade) return 1;
  const progress = labelFadeProgress(fade);
  if (progress >= 1 && !fade.out) {
    labelFadeStarts.get(context)?.delete(node);
    return 1;
  }
  return fade.out ? 1 - progress : progress;
}

/** Whether any label is still fading, so the caller knows to keep drawing. */
export function labelFadesRunning(context: object): boolean {
  return (labelFadeStarts.get(context)?.size ?? 0) > 0;
}

/** Labels whose fade-out has finished, so they can stop being drawn at all. */
export function finishedLabelFadeOuts(context: object): string[] {
  const fades = labelFadeStarts.get(context);
  if (!fades) return [];
  const done: string[] = [];
  for (const [node, fade] of fades) {
    if (fade.out && labelFadeProgress(fade) >= 1) done.push(node);
  }
  for (const node of done) fades.delete(node);
  return done;
}

export interface GraphLabelObstacle {
  node: string;
  box: GraphLabelBox;
}

/** The square a marker occupies on screen, for label collision. */
export function graphMarkerBox(
  center: { x: number; y: number },
  radius: number,
): GraphLabelBox {
  return {
    left: center.x - radius,
    right: center.x + radius,
    top: center.y - radius,
    bottom: center.y + radius,
  };
}

export interface GraphLabelCandidate {
  node: string;
  box: GraphLabelBox;
  /** Lower sorts first: focused note, then its neighbors, then by degree. */
  priority: number;
  degree: number;
  /**
   * Rendered whatever it collides with. The focused note and the node under
   * the pointer are the two the reader has actually asked about, and a graph
   * that will not name them is not answering the question.
   */
  required?: boolean;
  /**
   * Still collision-tested, but never dropped for want of company. A foreign
   * note's label in a per-Brain graph is there to name the Brain it comes
   * from, which matters as much for one such note as for ten.
   */
  exempt?: boolean;
}

function boxesOverlap(a: GraphLabelBox, b: GraphLabelBox): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/**
 * Chooses which labels to render, by collision rather than by a fixed grid.
 *
 * A grid picks a fixed handful per screen whether or not they fit, which put
 * six overlapping labels on a dense overview and could leave a sparse
 * connection map unlabelled depending on where the cells happened to fall.
 * Deciding by overlap states the rule in terms of the outcome instead, and lets
 * density decide: a dense fitted overview yields no labels at all, a connection
 * map yields every one.
 *
 * Order is fully determined — focused note, then neighbors, then descending
 * degree, then id — so the same camera state always picks the same labels and
 * competing labels cannot flicker between frames.
 *
 * Unrelated labels are also drawn only in company. On a zoomed-out graph the
 * one label that fits is the one peripheral hub with empty space under it,
 * which says nothing about the graph being legible and reads as an accident
 * on an otherwise clean overview. Three or more read as intent, so a label
 * outside the inspected neighborhood needs at least `MINIMUM_LABEL_COMPANY`
 * placed alongside it, or a quarter of everything that could carry a label
 * when that is fewer: on a four-node graph the one label that fits is the hub,
 * not an accident. The inspected neighborhood is exempt, because a reader
 * asked for those, and so is any candidate marked `exempt`.
 */
export const MINIMUM_LABEL_COMPANY = 3;

export function selectGraphLabels(
  candidates: readonly GraphLabelCandidate[],
  renderedSize: number,
  markers: readonly GraphLabelObstacle[] = [],
): Set<string> {
  if (renderedSize < MINIMUM_LEGIBLE_LABEL_SIZE) {
    return new Set(candidates.filter((candidate) => candidate.required).map((c) => c.node));
  }
  const ordered = [...candidates].sort((a, b) =>
    a.priority - b.priority ||
    b.degree - a.degree ||
    a.node.localeCompare(b.node)
  );
  const placed: GraphLabelBox[] = [];
  const selected = new Set<string>();
  for (const candidate of ordered) {
    if (candidate.required) {
      // Placed first by priority, and recorded so every other label avoids it.
      placed.push(candidate.box);
      selected.add(candidate.node);
      continue;
    }
    if (placed.some((box) => boxesOverlap(box, candidate.box))) continue;
    // Markers are obstacles too. Avoiding only other labels satisfies the
    // letter of "labels must not overlap" while still blanketing a dense
    // overview with text laid over the graph, which is the unreadable outcome
    // the rule exists to prevent. A label has to land in clear space.
    if (markers.some((marker) =>
      marker.node !== candidate.node && boxesOverlap(marker.box, candidate.box)
    )) continue;
    placed.push(candidate.box);
    selected.add(candidate.node);
  }
  const company = Math.min(MINIMUM_LABEL_COMPANY, Math.ceil(candidates.length / 4));
  if (selected.size < company) {
    for (const candidate of ordered) {
      if (!candidate.required && !candidate.exempt && candidate.priority > 1) {
        selected.delete(candidate.node);
      }
    }
  }
  return selected;
}

export function narrowFocusedLabelDecision(
  label: string,
  role: "focused" | "neighbor" | null,
  detailed: boolean,
  fits: boolean,
  shorten: (value: string) => string,
): { label: string; forceLabel: boolean } | null {
  if (!role || detailed) return null;
  if (role === "focused") return { label: shorten(label), forceLabel: true };
  return { label: fits ? label : "", forceLabel: false };
}

function accentColor(accent: string, status: string): string {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(accent);
  if (!match) return accent;
  const channels = match.slice(1).map((value) => Number.parseInt(value, 16));
  const amount = status === "draft" ? -0.28 : status === "developing" ? 0 : 0.24;
  const target = amount < 0 ? 0 : 255;
  return `#${channels.map((channel) =>
    Math.round(channel + (target - channel) * Math.abs(amount)).toString(16).padStart(2, "0")
  ).join("")}`;
}

const STATUS_MARKER: Record<string, string> = {
  draft: "○",
  developing: "◇",
  established: "◆",
};

/**
 * Composes a node's canvas label from its parts.
 *
 * Owner composition is separated from the rest of a node's attributes so a
 * workspace label can be built with or without its owning Brain, without
 * rebuilding the graph. Measured, the owner and status marker were roughly half
 * the width of a median workspace label, which on a phone is half the room
 * spent on something the accent colour and the legend already say.
 */
export function composeGraphLabel(
  marker: string,
  owner: string | null,
  title: string,
): string {
  return `${marker} ${owner ? `${owner} · ` : ""}${title}`;
}

/**
 * Whether workspace canvas labels carry their note's owning Brain.
 *
 * Off on narrow and on elsewhere with nothing stored: that preserves the
 * desktop appearance, where there is room for an owner, and fixes the phone,
 * where there is not. Brain identity stays available either way through node
 * accent, the legend and the focused-neighborhood bar.
 */
export function defaultOwnerLabelPreference(narrow: boolean): boolean {
  return !narrow;
}

export function ownerLabelStorageKey(base: string): string {
  return `brain-graph-owner-labels:${base}`;
}

/**
 * Whether hovering a node previews its whole neighborhood: dims everything
 * else and reveals the neighbors' titles. Off by default on a fine pointer.
 * A pointer crosses many nodes on its way somewhere, and lighting up each
 * one's neighborhood in passing makes the graph flicker under the hand; a
 * reader who wants the preview turns it on once, and it is remembered like
 * the other display preferences, per site base, never in a URL.
 */
export function defaultHoverPreviewPreference(): boolean {
  return false;
}

export function hoverPreviewStorageKey(base: string): string {
  return `brain-graph-hover-preview:${base}`;
}

/** How far a lit neighborhood reaches, in links; one is the direct neighbors. */
export function defaultNeighborhoodDepth(): number {
  return 1;
}

export function neighborhoodDepthStorageKey(base: string): string {
  return `brain-graph-neighborhood-depth:${base}`;
}

export function graphNodeAttributes(node: GraphNodeDatum, context: GraphContext) {
  const foreign = context.mode === "brain" && node.brainId !== context.brainId;
  const brainEncoded = (context.mode === "all" && context.encodeBrains === true) || foreign;
  const owner = foreign ? `↗ @${node.brainId}` : `@${node.brainId}`;
  const marker = STATUS_MARKER[node.status] ?? "○";
  return {
    label: composeGraphLabel(marker, brainEncoded ? owner : null, node.title),
    /** The same label without its owner; identical when no owner is encoded. */
    titleLabel: composeGraphLabel(marker, null, node.title),
    /**
     * A foreign node in a per-brain graph must always say which Brain it comes
     * from, so the reader preference does not reach it.
     */
    ownerRequired: foreign,
    x: node.x,
    y: node.y,
    size: foreign
      ? Math.max(MINIMUM_RENDERED_NODE_RADIUS, nodeSize(node.degree) * 0.7)
      : nodeSize(node.degree),
    color: foreign
      ? "#8f8b94"
      : brainEncoded
        ? accentColor(node.brainAccent, node.status)
        : nodeColor(node.type, node.status),
    route: node.route,
    compositeId: node.compositeId,
    noteType: node.type,
    status: node.status,
    tags: node.tags,
    brainId: node.brainId,
    brainTitle: node.brainTitle,
    brainAccent: node.brainAccent,
    foreign,
    forceLabel: forceForeignLabel(foreign, false),
    zIndex: foreign ? 0 : 1,
  };
}

export function graphEdgeAttributes(edge: GraphEdgeDatum, context: GraphContext = { mode: "all" }) {
  const mutedForeign = edge.crossBrain && context.mode === "brain";
  return {
    crossBrain: edge.crossBrain,
    color: mutedForeign ? "#a9a5ae" : edge.crossBrain ? "#e0a75a" : undefined,
    // Graph-space units, like node size. An edge that stayed a fixed pixel
    // count would be a hairline at every zoom: the reader would spread the
    // nodes apart and still not be able to tell which ones are connected.
    // Scaling with the camera keeps a link as legible as the notes it joins.
    size: mutedForeign ? 0.32 : edge.crossBrain ? 0.9 : 0.42,
    mutedForeign,
  };
}
