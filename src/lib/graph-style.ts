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
  const brainEncoded = context.mode === "combined" || foreign;
  const owner = foreign ? `↗ @${node.brainId}` : `@${node.brainId}`;
  return {
    label: `${STATUS_MARKER[node.status] ?? "○"} ${brainEncoded ? `${owner} · ` : ""}${node.title}`,
    x: node.x,
    y: node.y,
    size: nodeSize(node.degree) + (foreign ? 2 : 0),
    color: brainEncoded
      ? accentColor(node.brainAccent, node.status)
      : nodeColor(node.type, node.status),
    route: node.route,
    noteType: node.type,
    status: node.status,
    tags: node.tags,
    brainId: node.brainId,
    brainTitle: node.brainTitle,
    foreign,
    forceLabel: foreign,
    zIndex: foreign ? 2 : 1,
  };
}

export function graphEdgeAttributes(edge: GraphEdgeDatum) {
  return {
    crossBrain: edge.crossBrain,
    color: edge.crossBrain ? "#d97706" : undefined,
    size: edge.crossBrain ? 2.4 : 1,
  };
}
