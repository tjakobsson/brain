## Why

Readers can currently lose their selected Brain context when they open a note, cannot preserve or share a graph neighborhood, and encounter weak recovery cues when links leave the site or lead to missing pages. Recent graph-control consolidation also left the desktop legend off-canvas and made combined selection more prominent than entering one Brain, so the reader journey needs a coherent wayfinding and sharing model.

## What Changes

- Preserve an optional selected-Brain browsing scope across graph, note, and quick-switcher navigation while continuing to identify each note by its owning Brain.
- Let readers pin a graph neighborhood, copy a canonical focused-graph link, restore that focus from a URL, and open a note directly in its focused full-graph context.
- Keep the global graph legend inside the viewport on desktop and mobile.
- Add a shared-navigation destination for the Brain chooser and a quiet About surface that identifies the generator version embedded in the static site.
- Rebalance the root chooser so entering one Brain is the primary default and combining multiple Brains becomes a secondary action revealed by selection.
- Give authored external web links a visible and accessible external-site treatment without forcing a new browsing tab.
- Publish a custom, base-path-safe 404 page with deterministic note suggestions scoped to valid Brain context inferred from the missing URL.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `brain-workspaces`: Preserve reader-selected browsing scope through notes, prioritize single-Brain entry in the chooser, and recover within a valid Brain scope on missing pages.
- `graph-explorer`: Add persistent and shareable focused neighborhoods and require every graph popover to remain viewport-contained.
- `site-navigation`: Add Brain-chooser and version-provenance destinations and make note-page Graph navigation focus the current note in the retained scope.
- `note-publishing`: Distinguish external web links visually and accessibly while retaining normal same-tab navigation.
- `site-search`: Keep quick-switcher navigation and graph search aligned with retained Brain scope and focused graph state.
- `portable-site-generation`: Embed deterministic generator-version metadata and emit a custom 404 document that static and live serving paths return with correct base paths and status.

## Impact

- Affects shared layout and navigation, Brain chooser presentation, note-page links, route and selection helpers, graph interaction and camera state, graph controls and popovers, quick-switcher navigation, Markdown rendering, generated metadata, the static/live server, and browser fixtures.
- Adds optional query state for browsing scope and focused graph nodes without changing canonical note identity or generated note paths.
- Reuses existing graph data, compact search data, interaction reducers, and package version metadata; no new runtime dependency is expected.
- Requires focused route, rendering, accessibility, deterministic-output, local-server, subpath, desktop, touch, and browser regression coverage.
