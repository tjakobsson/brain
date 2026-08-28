import type { Image, Link, Nodes, Parent, Text } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";

export interface AttachmentReference {
  kind: "markdown-image" | "markdown-link" | "brain-embed";
  raw: string;
  target: string;
  anchor: string | null;
  alias: string | null;
  index: number;
}

const EMBED_RE = /!\[\[([^\]|#\n]+?)(?:#([^\]|\n]+?))?(?:\|([^\]\n]+?))?\]\]/gu;

function isParent(node: Nodes): node is Parent {
  return "children" in node;
}

function splitAnchor(destination: string): { target: string; anchor: string | null } {
  const hash = destination.indexOf("#");
  return hash === -1
    ? { target: destination, anchor: null }
    : { target: destination.slice(0, hash), anchor: destination.slice(hash + 1) || null };
}

function isExternal(target: string): boolean {
  return (
    target === "" ||
    target.startsWith("#") ||
    target.startsWith("//") ||
    /^[a-z][a-z\d+.-]*:/iu.test(target)
  );
}

function decodedPath(target: string): string {
  try {
    return decodeURIComponent(target);
  } catch {
    return target;
  }
}

function isMarkdown(target: string): boolean {
  return decodedPath(target).toLowerCase().endsWith(".md");
}

function offset(node: Nodes): number {
  return node.position?.start.offset ?? 0;
}

export function parseAttachmentReferences(
  source: string,
  noteTitles: ReadonlySet<string> = new Set(),
): AttachmentReference[] {
  const references: AttachmentReference[] = [];
  const tree = fromMarkdown(source);

  function visit(node: Nodes): void {
    if (node.type === "image" || node.type === "link") {
      const destination = (node as Image | Link).url;
      const { target, anchor } = splitAnchor(destination);
      if (!isExternal(destination) && !isMarkdown(target)) {
        const start = offset(node);
        references.push({
          kind: node.type === "image" ? "markdown-image" : "markdown-link",
          raw: source.slice(start, node.position?.end.offset ?? start),
          target,
          anchor,
          alias: null,
          index: start,
        });
      }
    } else if (node.type === "text") {
      const text = node as Text;
      for (const match of text.value.matchAll(EMBED_RE)) {
        const target = match[1].trim();
        const noteKey = target.replace(/\.md$/iu, "").toLowerCase();
        if (isMarkdown(target) || noteTitles.has(noteKey)) continue;
        references.push({
          kind: "brain-embed",
          raw: match[0],
          target,
          anchor: match[2]?.trim() ?? null,
          alias: match[3]?.trim() ?? null,
          index: offset(text) + match.index,
        });
      }
    }

    if (isParent(node)) {
      for (const child of node.children) visit(child);
    }
  }

  visit(tree);
  return references.sort((a, b) => a.index - b.index);
}
