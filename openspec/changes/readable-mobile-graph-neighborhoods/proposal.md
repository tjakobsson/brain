## Why

On a phone you cannot read the graph. Four faults compound, measured on a 390x844 viewport against a 400-note four-brain workspace whose titles and brain ids match a real published vault. Baseline screenshots and full measurements are in `screenshots/`.

- Pinching to zoom, the documented way to reveal labels, silently drops a long-press pin.
- The median canvas label is 537 CSS pixels wide on a 390 pixel screen, and the widest is 713. A single-line label cannot fit a real note title on a phone at any node position. More than half of a workspace label is the owner id rather than the title.
- Node markers are wider than the gaps between them at the fitted overview, so a real vault renders as one mass of overlapping colour. Zooming in inflates markers by `1 / sqrt(ratio)` while label text stays fixed at 13px, so the further you zoom the worse the ratio of marker to text gets.
- The stress fixture cannot reproduce any of this. It uses `brain-01` and `Generated note 0001`, roughly a third of real label width.

Two of these break promises `openspec/specs/` already makes.

## What Changes

- A pinch gesture no longer clears a long-press pin. Sigma re-emits `downStage` with `original.type === "touchend"` when a pinch drops from two contact points to one; the handler in `wireHoverAndClick` reads that as a press on empty canvas and the following `touchup` clears focus. Both the global graph and every note-page connection map go through `wireHoverAndClick`.
- Canvas labels render centred below their node rather than to the right of it, and wrap onto at most three lines at word boundaries. Centring halves the horizontal reach of a label and wrapping cuts it again, so a 537 pixel title becomes roughly 179 pixels per line.
- Canvas label text scales with the camera by the same `sqrt(ratio)` law that already governs marker size, on every viewport. Zooming in makes text bigger instead of only spreading nodes apart.
- Label rendering is decided by collision and legibility rather than by a fixed grid. A dense fitted overview renders no labels, because none can be placed without overlapping. A sparse note-page connection map still labels every node.
- Node size is expressed in graph space rather than screen pixels, so the ratio of marker diameter to node spacing stays roughly constant as a vault grows. A 30-note demo vault and a 2000-note personal vault look like the same product.
- A reader preference controls whether full workspace graph labels carry the owner id. It is remembered in the reader's own browser like the Brain lens, never reaches a URL, and defaults to off on narrow viewports and on elsewhere. Foreign nodes in a per-brain graph always keep their `@brain` identity.
- The focused-neighborhood bar lists the focused note's directly connected neighbors as readable titles, alphabetical and uncapped, scrolling inside the bar's existing height limit. Tapping a row moves focus to that neighbor and the bar stays expanded.
- The stress fixture generates sentence-length titles and realistic brain ids, so `npm run test:stress-graph` can catch label regressions instead of passing on labels a third of real width.

## Capabilities

### New Capabilities

None. Every behavior here extends an existing capability.

### Modified Capabilities

- `graph-interaction-stability`: "Touch long press keeps a neighborhood available for inspection" already ends a pin on a tap on empty space or a tap on a node. It gains an explicit promise that a multi-touch camera gesture is neither.
- `graph-explorer`: label placement, wrapping, camera-relative text size, collision-based label selection, overview node density, the reader-controlled owner prefix, and the connected-neighbors list.

## Impact

- `src/lib/graph-view.ts`: touch sequence classification in `wireHoverAndClick`; `drawGraphNodeLabel` and `drawGraphNodeHover` rewritten for centred multi-line labels; `applyReducers` and `applyLocalReducers` label selection; `baseSettings`; `setFocus` preserving the expanded bar; the neighbor list.
- `src/lib/graph-style.ts`: `nodeSize` recalibrated for graph-space units; `graphNodeAttributes` label composition for the owner preference; `narrowFocusedLabelDecision` replaced by a wrapping layout function; `shortenGraphLabel` kept as the last-resort fallback.
- `src/lib/graph-interaction.ts`: `graphScreenTargets` label hit boxes move from right-of-node to below-node and cover multiple lines.
- `src/lib/graph-fit.ts`: `measureRenderedGraph` label extents become vertical rather than horizontal.
- `src/components/GlobalGraph.astro`, `src/components/GraphLegend.astro`, `src/styles/global.css`: the neighbor list and the owner-prefix control.
- `scripts/generate-stress-vault.mjs`: realistic titles and brain ids.
- `tests/browser/graph-hover.pw.ts` and `tests/stress/`: pinch gestures, label containment, overview density.
- No new dependencies.
