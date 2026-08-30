## Why

The 1.2.0 mobile graph experience exposes several connected problems: automatic settling ends with a second camera movement, text controls collide with the persistent navigation rail, related-brain labels collapse the graph into unreadable overlap, and graph encodings lack a concise explanation at the point of use. The always-expanded mobile navigation rail also occupies scarce canvas and reading space even when the reader is not navigating.

## What Changes

- Coordinate node settling and camera framing as one continuous transition on uncached graph visits and responsive resizes, including desktop filter-panel width changes.
- Replace mobile global-graph text controls with accessible icon actions in one compact horizontal pill that stays clear of the right edge.
- Keep related-brain graphs readable on narrow viewports by using collision-aware label selection instead of forcing every foreign label into the fitted view.
- Add concise, context-aware legend popovers to global graphs and note-page connection maps.
- Collapse the mobile navigation rail to a single four-dot launcher by default; expanding it reveals all applicable destinations directly with a polished transition and no nested secondary menu.
- Preserve the established always-visible navigation rail on desktop, reduced-motion behavior, graph session restoration, and manual Fit view semantics.
- Add mobile visual, interaction, accessibility, and graph-fitting regression coverage.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `responsive-graph-motion`: Make initial and resize-triggered node and camera motion complete as one coordinated transition.
- `graph-explorer`: Add compact mobile graph controls, readable related-brain labeling, and concise legends for global and local graphs.
- `site-navigation`: Make the navigation rail fully collapsible on mobile through a four-dot launcher that directly reveals every applicable action.

## Impact

- Affects global and local graph markup, styling, rendered-label policy, fitting and motion coordination, mobile navigation markup and state, and their unit and browser tests.
- Primarily touches `src/components/GlobalGraph.astro`, `src/components/NotePage.astro`, `src/layouts/BaseLayout.astro`, `src/lib/graph-fit.ts`, `src/lib/graph-motion.ts`, `src/lib/graph-view.ts`, `src/lib/graph-style.ts`, and `src/styles/global.css`.
- Does not change routes, graph data, session cache formats, dependencies, or desktop navigation behavior.
