import path from "node:path";
import type { Image, Link, Parent, PhrasingContent, Root, Text } from "mdast";
import type { VFile } from "vfile";
import type { ResolvedAttachment } from "./attachment-resolution";
import { joinBase, routes } from "./routes";
import { getVaultSnapshot } from "./vault-state";

interface RemarkAttachmentsOptions {
  base?: string;
  attachments?: ResolvedAttachment[];
}

const IMAGE_EXTENSIONS = new Set([".avif", ".bmp", ".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"]);

function attachmentUrl(base: string, attachment: ResolvedAttachment): string {
  const url = joinBase(base, routes.vaultAsset(attachment.entry.path));
  return attachment.reference.anchor
    ? `${url}#${encodeURIComponent(attachment.reference.anchor)}`
    : url;
}

function embeddedNode(base: string, attachment: ResolvedAttachment): PhrasingContent {
  const url = attachmentUrl(base, attachment);
  const label = attachment.reference.alias ?? path.posix.basename(attachment.entry.path);
  if (IMAGE_EXTENSIONS.has(path.posix.extname(attachment.entry.path).toLowerCase())) {
    return { type: "image", url, alt: label } as Image;
  }
  return { type: "link", url, children: [{ type: "text", value: label }] } as Link;
}

function transformChildren(parent: Parent, attachments: ResolvedAttachment[], base: string): void {
  const next: Parent["children"] = [];
  for (const child of parent.children) {
    if (child.type === "image" || child.type === "link") {
      const start = child.position?.start.offset;
      const destination = (child as Image | Link).url.split("#", 1)[0];
      const kind = child.type === "image" ? "markdown-image" : "markdown-link";
      const attachment = attachments.find(
        (item) =>
          item.reference.kind === kind &&
          (item.reference.index === start || item.reference.target === destination),
      );
      if (attachment) (child as Image | Link).url = attachmentUrl(base, attachment);
      if ("children" in child) transformChildren(child, attachments, base);
      next.push(child);
      continue;
    }

    if (child.type === "text") {
      const text = child as Text;
      const embedded = attachments
        .filter((item) => item.reference.kind === "obsidian-embed")
        .map((item) => ({ item, index: text.value.indexOf(item.reference.raw) }))
        .filter((match) => match.index !== -1)
        .sort((left, right) => left.index - right.index);
      if (embedded.length > 0) {
        let cursor = 0;
        for (const { item: attachment, index: relative } of embedded) {
          if (relative > cursor) next.push({ type: "text", value: text.value.slice(cursor, relative) });
          next.push(embeddedNode(base, attachment));
          cursor = relative + attachment.reference.raw.length;
        }
        if (cursor < text.value.length) next.push({ type: "text", value: text.value.slice(cursor) });
        continue;
      }
    }

    if ("children" in child) transformChildren(child, attachments, base);
    next.push(child);
  }
  parent.children = next;
}

export function remarkAttachments(options: RemarkAttachmentsOptions = {}) {
  const base = options.base ?? "";
  return (tree: Root, file: VFile) => {
    const all = options.attachments ?? getVaultSnapshot().attachments;
    const source = file.path ? path.resolve(file.path) : "";
    const attachments = all.filter(
      (item) =>
        path.resolve(item.source.filePath) === source ||
        (file.basename !== undefined && file.basename === path.basename(item.source.filePath)),
    );
    if (attachments.length > 0) transformChildren(tree, attachments, base);
  };
}
