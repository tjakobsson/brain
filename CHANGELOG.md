# Changelog

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
