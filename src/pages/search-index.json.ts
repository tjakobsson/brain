import type { APIRoute } from "astro";
import { getLinkIndex } from "../lib/link-index";
import { routes, type LogicalRoute } from "../lib/routes";

/**
 * Small title/tag index for the quick switcher — deliberately separate from
 * Pagefind's full-text index: this one answers "jump to X" in keystrokes.
 */
export const GET: APIRoute = () => {
  const index = getLinkIndex();

  const entries: { title: string; route: LogicalRoute; kind: "note" | "tag"; tags: string[] }[] =
    index.notes.map((n) => ({
      title: n.title,
      route: n.route,
      kind: "note",
      tags: n.meta.tags,
    }));

  const tags = new Set(index.notes.flatMap((n) => n.meta.tags));
  for (const tag of [...tags].sort()) {
    entries.push({ title: `#${tag}`, route: routes.tag(tag), kind: "tag", tags: [tag] });
  }

  return new Response(JSON.stringify(entries), {
    headers: { "Content-Type": "application/json" },
  });
};
