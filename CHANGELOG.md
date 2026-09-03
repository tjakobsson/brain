# Changelog

## 1.6.0 - 2026-09-03

- Give every note its own neighborhood page at `<note path>/graph/`, so Copy link, the note-page Graph action, and the focused-neighborhood action emit pathname-only URLs that survive SSO proxies which drop query strings and fragments.
- Render the full workspace graph at the root instead of a Brain chooser, moving the chooser's hierarchy, accents, and Enter actions into the graph's Brain control.
- Add a personal Brain lens that dims unchecked Brains in place while keeping them hoverable, clickable, and searchable; it is stored in the reader's browser, never in a URL, and focused neighborhoods always render at full emphasis and list connected domains as chips.
- Aggregate the root tags, recent, and orphans reports across every Brain with owner labels.
- Breaking: remove `?brains=` combined views and the chooser page. `/graph` and old `/graph?brains=` links open the full workspace graph, and quick-switcher scope and not-found recovery derive from the pathname only.

## 1.5.1 - 2026-09-02

- Preserve validated Brain scope and originating graph focus across every note-navigation path, including the quick switcher, while recovering clearly from malformed shared context.

## 1.5.0 - 2026-09-02

- Retain the reader's Brain browsing scope across notes, graphs, wiki-links, mentions, and the quick switcher instead of collapsing to each note's owning Brain.
- Share a focused graph neighborhood by URL, with context-menu and long-press targeting, a persistent non-color focus marker, and Copy, Open, and Clear actions.
- Separate returning to the retained graph from opening the current note's own focused neighborhood.
- Make entering a Brain the primary chooser action and reveal combination guidance only after a selection begins.
- Add an always-visible Home action beside the graph filters and report the generated version from package metadata.
- Mark external web links with a distinct treatment and an accessible external-site name while keeping same-tab navigation.
- Serve a custom not-found page with no-JavaScript recovery, search, and a scoped note recommendation, and return HTTP 404 for unknown in-base routes from preview and live serving.
- Keep global graph legends inside small and coarse-pointer viewports.

## 1.4.0 - 2026-09-01

- Move Brain selection into the full-graph controls and show each note's owning Brain in its metadata, keeping shared navigation compact and graph context explicit.
- Focus graph inspection on the selected note and its immediate neighbors, with stable marker and title targets across pointer, touch, browser zoom, and responsive layout changes.

## 1.3.0 - 2026-08-31

- Unify compact navigation and graph controls across desktop and touch layouts, with persistent neighborhood inspection and theme-aware graph rendering.
- Recompose connection maps after container changes while preserving motion and reader input during settling, resizing, and visibility changes.
- Resolve wiki-links consistently across Markdown containers, authored HTML, decoded entities, and wrapped source lines.
- Improve Brain card layout, tooltip positioning, highlights, callouts, and narrow WebKit code blocks.

## 1.2.3 - 2026-08-30

- Place fenced-code copy controls alongside the first line without reducing their target size or hiding horizontally scrollable code.

## 1.2.2 - 2026-08-30

- Reveal every eligible visible graph title after substantial mobile zoom while preserving selective labels in the fitted overview.

## 1.2.1 - 2026-08-30

- Collapse mobile navigation into a four-dot launcher with direct contextual actions, predictable focus, and reduced-motion support.
- Group mobile graph controls into a compact touch-friendly pill and add contextual legends to global and local graphs.
- Select related-brain labels by available space on narrow viewports instead of forcing every label into the graph.
- Coordinate graph settling and camera fitting during initial load, resizing, and filter changes to prevent follow-up camera movement.

## 1.2.0 - 2026-08-30

- Add versioned workspace inputs to the source command, container, composite Action, and reusable Pages workflow.
- Extend the maintained v1 Action and reusable-workflow interfaces with mutually exclusive workspace inputs.
- Add a per-brain graph toggle for directly related notes from other brains.
- Fit rendered graph markers and labels within global and local graph viewports.
- Consolidate navigation into a persistent rail with the workspace chooser and quick switcher across viewport sizes.
- Replace dedicated search pages and Pagefind indexing with the keyboard-accessible Fuse quick switcher.
- Render Markdown tables and callouts with compact, responsive light and dark treatments.
- Add line numbers and accessible copy controls to fenced code blocks.
- Use the Brain mark for the favicon, workspace chooser, contextual navigation, and foreign graph labels.

## 1.1.0 - 2026-08-28

- Add build-time syntax highlighting for fenced code blocks with light and dark themes.
- Preserve Obsidian highlights across soft line breaks.
- Keep graph nodes stable while they are hovered so clicks select the intended note.
- Display note timestamps consistently in UTC.

## 1.0.0 - 2026-08-28

- Generate a static, searchable site from a plain Markdown Obsidian vault.
- Resolve wiki-links, backlinks, tags, attachments, unresolved links, and note metadata.
- Explore the vault through global and local interactive graphs on desktop and mobile.
- Build, preview, or live-reload from source or the non-root multi-platform OCI image.
- Publish through the composite GitHub Action or reusable GitHub Pages workflow.
- Validate duplicate titles, frontmatter, attachments, output paths, and optional strict links.
