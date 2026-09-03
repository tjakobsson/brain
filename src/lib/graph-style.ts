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

export function nodeSize(degree: number): number {
  return 3.5 + Math.sqrt(degree) * 2.5;
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

export function graphNodeAttributes(node: GraphNodeDatum, context: GraphContext) {
  const foreign = context.mode === "brain" && node.brainId !== context.brainId;
  const brainEncoded = (context.mode === "all" && context.encodeBrains === true) || foreign;
  const owner = foreign ? `↗ @${node.brainId}` : `@${node.brainId}`;
  return {
    label: `${STATUS_MARKER[node.status] ?? "○"} ${brainEncoded ? `${owner} · ` : ""}${node.title}`,
    x: node.x,
    y: node.y,
    size: foreign ? Math.max(3, nodeSize(node.degree) * 0.7) : nodeSize(node.degree),
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
    color: mutedForeign ? "#8f8b94" : edge.crossBrain ? "#d97706" : undefined,
    size: mutedForeign ? 0.75 : edge.crossBrain ? 2.4 : 1,
    mutedForeign,
  };
}
