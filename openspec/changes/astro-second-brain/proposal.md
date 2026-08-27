## Why

A personal knowledge base written with an AI co-author lives as plain markdown in this repo, but markdown files alone give no sense of *connection* — the emergent structure that makes a Zettelkasten more than a folder of text. Obsidian solves this with its graph view and bidirectional links, but we don't want to depend on Obsidian as an editor or renderer. We want a beautiful, static, publishable site built with Astro where the graph and the web of note-to-note connections are the star of the experience.

## What Changes

- Scaffold a new Astro site (greenfield — the repo currently contains only OpenSpec metadata) using content collections with the `glob()` loader pointed at a `vault/` directory of plain markdown notes.
- Define the authoring contract for notes: title-slug filenames, zod-validated frontmatter (`type`, `status`, `tags`), and Obsidian-compatible `[[wiki-link]]` syntax with alias and heading-anchor support. The AI author follows this contract; the build enforces it.
- Resolve wiki-links at build time into real links; broken links produce build warnings and visibly distinct "unwritten note" styling (Obsidian-style).
- Compute a link index at build time: backlinks ("linked mentions" with surrounding context), unlinked mentions (notes that mention a title without linking it), and orphan detection.
- Render two graph experiences powered by sigma.js + graphology: a global graph centerpiece page with ForceAtlas2 layout precomputed at build time, filterable/searchable via sigma reducers; and a per-note local graph island showing the note's neighborhood.
- Add site search: full-text search (Pagefind) plus a Cmd+K quick switcher over note titles.
- Zettelkasten support: note types (fleeting / literature / permanent), plain-language status labels (draft / developing / established), tag pages, a "recently changed" view, and an orphans report page for vault hygiene.
- The vault remains plain markdown with wiki-links — openable in Obsidian at any time with zero lock-in.

## Capabilities

### New Capabilities

- `vault-conventions`: The authoring contract for the vault — directory layout, title-slug filenames, frontmatter schema (title, type, status, tags, dates), and wiki-link syntax rules the AI author must follow. Enforced by zod schema validation and build-time checks.
- `note-publishing`: Rendering vault notes to site pages — wiki-link resolution to URLs (aliases, heading anchors, unwritten-note styling), Obsidian callouts and highlights, tag pages, per-note metadata display (type, status, dates).
- `link-intelligence`: The build-time link index — backlinks with context snippets, unlinked mention detection, orphan report, and the `graph-data.json` artifact that feeds all graph views.
- `graph-explorer`: The global graph page and per-note local graph — precomputed ForceAtlas2 layout, sigma.js WebGL rendering, filtering by type/status/tag, search with camera focus, hover neighborhood highlight, click-to-navigate.
- `site-search`: Full-text search (Pagefind) and a Cmd+K quick switcher over note titles and tags.

### Modified Capabilities

(none — greenfield project, no existing specs)

## Impact

- **New code**: entire Astro site — `astro.config.ts`, `src/content.config.ts`, remark plugins, layout/link-index build library, sigma graph islands, page templates, vault directory.
- **Dependencies**: `astro`, `astro:content` glob loader, `zod`, `sigma` (v3), `graphology`, `graphology-layout-forceatlas2`, remark ecosystem (`remark-wiki-link` or custom resolver, callouts/highlights plugin), Pagefind. All dependencies are governed by the project dependency policy: pinned to the latest stable + secure patch at install time, permissive licenses only — copyleft requires an agreed exception recorded as an ADR.
- **Content**: `vault/` directory seeded with initial notes following the authoring contract; an `AGENTS.md` documenting the contract so the AI author follows it.
- **Deployment**: static build output (`astro build`) — deploy target (Netlify / GitHub Pages / local-only) is intentionally left open; the build must remain plain static output compatible with any static host.
- **Out of scope**: in-browser editing, link autocomplete UI, file watching, rename-refactoring tooling, Canvas, Dataview-style queries. Writing and restructuring notes is the AI author's job at the file level.
