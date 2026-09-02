## Why

Shared workspace links currently carry their destination in the query string (`/graph?brains=a,b&focus=a%2Fnote`), and an authenticating proxy in front of a static site, such as privately published GitHub Pages behind SSO, returns a cold visitor to the pathname alone. The copied neighborhood link then lands on the "Choose a valid set of Brains" recovery card instead of the neighborhood, and it does so again every time the proxy's session cookie expires. Fragments are dropped by the same hop, so no query-side encoding can survive. Only the pathname does. Brains in a workspace are also meant to signal which domains a note touches, not to gate what a reader may see, and the chooser-first model works against that.

## What Changes

- Give every note a generated focused-neighborhood page at `<note path>/graph/` (`/brains/<id>/notes/<slug>/graph/` in workspace mode, `/notes/<slug>/graph/` in vault mode). This path is the only shareable identity for a neighborhood; the copied neighborhood link, the note-page Graph action, and the note's focused-neighborhood action all use it.
- Make the workspace root graph show every configured Brain by default. The root page becomes the full workspace graph instead of a chooser that must be satisfied before any graph exists.
- **BREAKING**: Remove reader-selected combined views and the `?brains=` query grammar. `/graph` no longer exists as a combined-view route; combined-view URLs, the "Choose a valid set of Brains" recovery card, and query-scope propagation through note, search, tag, recent, and orphan links are removed. Root `/tags`, `/recent`, and `/orphans` become workspace-wide aggregates instead of redirecting to a chooser.
- Replace Brain selection with a personal Brain lens: a reader can dim configured Brains through checkboxes in the full-graph Brain control. Dimming never removes nodes, is remembered in the reader's own browser only, is never encoded in any URL, and never narrows a destination opened by URL.
- Make focus outrank the lens: a focused neighborhood renders at full emphasis regardless of dimmed Brains, and the focused page lists the domains present in that neighborhood with their marks, accents, and counts so a reader sees which Brains the note connects to.
- Retain `/brains/<id>/` as a per-Brain graph and keep the existing `?focus=` behavior for in-session pinning on graph pages, where no cold proxy hop occurs.
- Keep vault-mode behavior unchanged except for the new note-owned neighborhood page and its use by copy and Graph actions.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `brain-workspaces`: Replace the chooser and reader-selected combined view with a default full-workspace graph and a locally remembered Brain lens; require shareable destinations to be identified by pathname alone; remove selected-scope propagation and the selection-recovery card; update missing-page recovery to path-only scope.
- `graph-explorer`: Add the note-owned focused-neighborhood page; define lens dimming as non-removing emphasis with focus precedence; list connected domains on a focused page; change the copied neighborhood link to the path form; change filtering and search requirements from selected-Brain scope to lens and full-workspace scope.
- `site-navigation`: Route the note-page Graph action and the current-note focused action to the note-owned neighborhood page; make Home open the full workspace graph; drop the combined-view and chooser-specific navigation rules.
- `site-search`: Default the quick switcher to the full workspace on workspace-level pages and to the active Brain on Brain pages, with no retained selected-Brain scope on note routes.
- `portable-site-generation`: Drop selected-Brain query scope from the not-found page's recommendation priority so it infers context from the namespaced path or the whole workspace only.

## Impact

- Routes: `routes.ts` loses `withBrainScope`, `withGraphContext`, `combinedRoutes`, and `brainSelectionContext`; gains a note-neighborhood route. `graph.astro`, `WorkspaceRouteRedirect.astro`, and the combined-graph branch of `GlobalGraph.astro` are removed. New dynamic pages under `notes/[slug]/graph` for both modes; root `tags`, `recent`, and `orphans` pages render workspace aggregates.
- Graph runtime: `graph-view.ts` drops combined-selection state and query-scope note links; adds lens state persisted in `localStorage`, dim rendering, focus precedence, and domain chips. `not-found.ts` drops query-scope recovery.
- Navigation and search: `BaseLayout.astro`, `NotePage.astro`, the quick switcher, and `BrainChooser.astro` change destinations and defaults; the chooser's Brain cards move into the full-graph Brain control as the lens legend.
- Tests: route, not-found, graph-data, and graph-interaction unit tests plus workspace, subpath, and graph-hover Playwright suites change substantially; `?brains=` assertions are removed and cold path-only neighborhood links are added.
- Docs and fixtures: README URL examples and the demo workspace screenshots update. No new runtime dependency and no Markdown or frontmatter contract change.
- Compatibility: previously shared `/graph?brains=` and `?brains=`-scoped note URLs stop resolving to combined views; note URLs still open the note, and `/graph` falls back to the full workspace graph.
