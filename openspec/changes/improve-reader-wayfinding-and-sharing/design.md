## Context

See `proposal.md` for motivation and the six delta specs for observable behavior. Combined selection currently exists only on `/graph?brains=...`; graph nodes, rendered note links, and quick-switcher results navigate to bare namespaced note routes. Note pages then pass their owning Brain as the layout's active context, so Graph and Search collapse to that owner. Graph interaction already separates transient pointer hover from touch-pinned inspection, has shared marker/title hit testing, and can camera-focus a search result, but none of those states is URL-addressable. The generic legend popover aligns to its trigger's right edge even when the global trigger sits near the left viewport edge.

The generator already reads one semantic package version for its CLI, emits a compact title/tag/Brain search index, and requires deterministic output across identical builds. Markdown output does not classify external origins, no custom `404.html` exists, and the local static server returns plain text for missing files. The solution must remain static, base-path-correct, progressively usable without client JavaScript, and dependency-free at runtime.

## Goals / Non-Goals

**Goals:**

- Separate immutable note ownership from an optional reader-selected browsing scope.
- Represent only semantic graph focus and Brain selection in shareable URLs.
- Reuse one persistent focus model across pointer context menus, touch long press, graph search, note-page Graph actions, and shared links.
- Keep recovery, provenance, and link-destination cues available on every supported deployment base and input mode.
- Preserve deterministic builds and existing graph-space positions.

**Non-Goals:**

- Encode camera coordinates, dragged layout positions, filters, or expanded panels in shared links.
- Add server-side sessions, redirects, analytics, online update checks, or a backend search service.
- Force external links into new tabs or annotate email and telephone links as external websites.
- Add direct keyboard traversal among canvas nodes; graph search remains the keyboard route into focus.
- Change canonical note identity, namespaced note paths, Markdown source, or persisted graph layouts.

## Decisions

### Carry browsing scope explicitly and keep ownership separate

Use the existing canonical Brain selection model for an optional `brains` query on note routes. A note route remains namespaced by its owner; the query records only the reader's current browsing scope. Direct note visits without valid scope continue to default to the owner. Graph-node navigation, quick-switcher note results, rendered internal note links, nearby-note links, and mentions preserve a valid scope. Explicitly entering a Brain, returning to the chooser, or applying another graph selection establishes a new scope.

Static note markup cannot know a request query at build time. Mark internal note destinations so one shared layout script can append the current canonical scope without changing fragments or non-note links; graph and switcher navigation use the same route helper directly. Keep no-JavaScript behavior as the current owner-scoped fallback.

Using `sessionStorage` as the source of truth was rejected because direct links and multiple tabs would acquire hidden or stale context. Using browser history as Graph navigation was rejected because new tabs, reloads, and shared note URLs would not have a deterministic graph destination.

### Model pinning as interaction and focus as URL state

Use `focus=<composite-note-id>` on global graph URLs. Rename or clearly separate inspection focus from the existing layout-motion `pinnedId` terminology so a semantic focus cannot be confused with a node held fixed during settling. Pinning or moving focus updates the URL with `history.replaceState`; clearing it removes only `focus`. The URL retains canonical `brains` selection where applicable.

Extend the shared graph target geometry to handle `contextmenu` events over either markers or rendered titles. Prevent the native menu only when a target resolves, and render a viewport-clamped DOM menu with Pin/Move focus, Copy neighborhood link, and Open note. A compact focused-state region exposes the focused title plus Copy, Open, and Clear controls after the menu closes, providing visible state and keyboard/touch access. Touch long press and graph-search activation call the same focus transition.

Focus uses the existing inspection reducer for one-hop emphasis and adds a persistent non-color-only marker to the subject. While focus exists, pointer movement may retain context-menu targeting but MUST NOT replace or add hover emphasis, and lower-emphasis unrelated nodes MUST NOT act as left-click navigation targets. The focused note and emphasized direct neighbors remain navigable; Move focus here and Open note remain explicit context-menu actions for unrelated nodes. Fit view targets the focused note and visible direct neighbors while focus exists, then returns to fitting all visible nodes after Clear. On restore, initialize the same focused reducer state used by interactive focus, validate that the composite ID belongs to the selected graph, make the subject and direct neighborhood visible despite stored filter history, force their titles, reveal only directly connected foreign boundary notes when general Related Brains is off, and fit rendered bounds for that neighborhood after layout restoration or initial settling. A later explicit filter or selection that excludes the subject clears focus and canonicalizes the URL.

Serializing the current camera was rejected because it is viewport-dependent and would create poor phone links from desktop views. Filtering the graph down to the neighborhood was rejected because faint unrelated markers provide valuable orientation and the existing inspection language already communicates local context.

### Separate graph return from explicit note focus

The shared navigation Graph action returns from a note to the canonical graph for its browsing scope without adding focus. A direct note returns to its owning Brain graph; a note carrying a valid combined scope returns to that combined graph. A separate always-visible focused-neighborhood action adds the current note's composite identity and remains available even when the note has no connection map. This preserves an unpinned graph journey while keeping explicit focused entry deterministic.

### Keep single-Brain entry primary and add explicit escape routes

Retain each chooser card's Enter Brain link as its primary action. Relabel card checkboxes as secondary combination controls and keep the fixed combination action absent before any selection. After one selection, reveal guidance to choose another; after two, enable the combined action. Add an always-visible Home icon so every note, report, and graph can return to the chooser without expanding navigation or reintroducing the rejected shared Brain selector. Place it beside Filters on graph pages and as a standalone top-left action on content pages. The standalone control mirrors the right navigation pill's size, top alignment, and edge inset. Omit it on the chooser itself and remove the duplicate Brains destination from expandable navigation.

Keep a small bounded About/version disclosure on the Brain chooser only, containing selectable `Brain v<semantic-version>` text and, when suitable, a release destination. Do not place About in expandable navigation. Inject the same package-derived value into a `<meta name="generator">` element on every page. Do not add timestamps or require repository metadata, which may be absent from released containers and would weaken reproducibility.

A permanently fixed version watermark was rejected because it would compete with graph nodes, the chooser action bar, safe areas, and narrow note content.

### Classify external web links in the rendered HTML tree

Add a build-time rendered-HTML transform that resolves each authored HTTP(S) destination against the configured site origin. Mark only different-origin web links, including supported authored raw HTML links, with one semantic class and accessible external-site text. Style article links with a solid underline and a small conventional box-and-arrow SVG treatment distinct from the existing cross-Brain arrow and badge. Keep the icon decorative and the accessible text authoritative.

Pure `href^="http"` CSS was rejected because it misclassifies same-origin absolute links and cannot supply reliable accessible semantics. Runtime DOM mutation was rejected because this classification is deterministic at build time. Automatically setting `target="_blank"` was rejected because externality and new browsing context are separate concerns.

### Generate one contextual 404 and serve it with real failure status

Create `src/pages/404.astro` with shared layout, a no-JavaScript root recovery link, and a Search trigger. Its client enhancement strips the configured base, canonicalizes a valid `brains` query first, then recognizes only `/brains/<known-id>/` route grammar, and otherwise uses all published notes. Fetch the existing compact search index, filter note entries to that scope, and choose the initial recommendation using a stable hash of pathname, search, and candidate identities. Show title, owner, and tags; an optional Another note action advances deterministically.

Teach static and live serving to return generated `404.html` with status 404 for unknown in-base routes while preserving the requested browser URL. Keep outside-base and missing-resource responses unsuccessful. GitHub Pages consumes the same generated document. Reuse the visual recovery component for invalid combined selections where practical, while accepting that a static existing `/graph` document cannot change HTTP status from client-side query validation.

Build-time random selection was rejected because it violates reproducibility. `Math.random()` on every load was rejected because broken links would jump unpredictably and browser coverage would be flaky. Embedding a second recommendation dataset was rejected because the compact switcher index already provides the required fields.

### Scope the legend correction to global controls

Use the existing global-legend modifier to align its desktop popover from the trigger's left edge while preserving the right-aligned local connection-map legend and the current fixed narrow/coarse-pointer placement. Extend containment coverage to open the global legend with Filters closed at supported desktop and phone dimensions.

Changing the generic legend alignment was rejected because the local legend is intentionally anchored on the right side of a note header. Dynamic positioning JavaScript was rejected because the known global and local placements can be expressed reliably in CSS.

## Risks / Trade-offs

- [Scope queries make shared note URLs longer] -> Keep them optional, canonical, and separate from note identity; direct note URLs remain unchanged.
- [Runtime propagation can miss one class of note link] -> Centralize route recognition, mark generated note destinations, and test graph, wiki-link, mention, nearby-note, and switcher paths.
- [Focus restoration can race layout and responsive settling] -> Parse early, apply visibility before fit, and schedule one focus fit after the final restored or initial layout state.
- [A custom canvas context menu can regress native behavior or accessibility] -> Suppress only resolved targets, clamp the menu, use normal DOM menu semantics, and expose equivalent focused-state controls and graph-search entry.
- [Focused visibility can conflict with stored or active filters] -> Focus wins only during initial shared restoration; subsequent explicit exclusion clears focus predictably.
- [External-origin classification lacks a canonical origin in some local builds] -> Treat absolute HTTP(S) links as external when no site origin is configured and cover configured same-origin behavior separately.
- [A 404 enhancement depends on client data] -> Keep root recovery and Search usable without JavaScript and reserve recommendation space to avoid disruptive layout movement.
- [Persistent controls can compete for narrow viewport width] -> Keep Home separate from expanded navigation, compact the graph control rail at the narrowest supported width, and verify About remains bounded on the chooser.

## Migration Plan

Ship route-context helpers, focus state, navigation and chooser changes, external-link rendering, provenance, 404 generation and serving, legend containment, and their tests together. Existing note and graph URLs remain valid: absent `brains` or `focus` values preserve current owner-scoped behavior, and invalid focus is discarded without hiding a valid graph. No source content or persisted data migration is required.

Rollback removes the optional query propagation and focused controls, restores the former chooser and navigation contents, drops external annotations and custom 404 serving, and ignores any shared `focus` query. Canonical note paths and graph layout storage remain usable in either direction.
