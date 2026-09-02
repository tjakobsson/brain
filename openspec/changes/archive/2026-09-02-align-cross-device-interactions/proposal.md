## Why

Desktop and touch devices currently present different navigation and graph-control structures, making the interface less predictable across devices. Two visual regressions compound that inconsistency: iOS Safari can inflate fenced-code typography, and graph neighborhood inspection leaves unrelated labels prominent enough to compete with the selected neighborhood.

## What Changes

- Use the same collapsed four-dot navigation launcher and in-place expanded action pill on every viewport, while preserving context-aware destinations, keyboard operation, dismissal, and reduced-motion behavior.
- Use the same compact icon pill for global graph controls on desktop and touch layouts, with accessible names and pointer tooltips.
- Strengthen graph neighborhood inspection so unrelated nodes, labels, and edges recede while the selected node, its neighbors, their labels, and incident edges retain full emphasis.
- Add an explicit touch long-press gesture that keeps neighborhood emphasis active after release, clears on the next empty-stage tap, and does not interfere with tap navigation or node dragging.
- Prevent narrow WebKit browsers from automatically inflating fenced-code text while preserving the intended font size, compact copy-control placement, and horizontal scrolling.
- Add focused desktop, touch, and WebKit regression coverage for the unified behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `site-navigation`: Replace the desktop-only expanded rail and secondary flyout with the same collapsible primary navigation used on touch layouts.
- `graph-explorer`: Present compact icon-pill graph controls on every viewport instead of only narrow or coarse-pointer layouts.
- `graph-interaction-stability`: Define stronger neighborhood emphasis and persistent touch long-press inspection without graph or camera movement.
- `code-block-rendering`: Require fenced-code typography to remain at its intended size in narrow WebKit layouts.

## Impact

- Navigation markup, state handling, responsive styles, focus management, and browser coverage in `src/layouts/BaseLayout.astro`, `src/styles/global.css`, and navigation tests.
- Global graph controls, graph interaction state, Sigma reducers and label rendering, touch gesture handling, and graph unit/browser tests in `src/components/GlobalGraph.astro`, `src/lib/graph-interaction.ts`, `src/lib/graph-view.ts`, and related suites.
- Fenced-code CSS and browser coverage in `src/styles/global.css` and `tests/browser/code-blocks.pw.ts`.
- Browser CI may need focused WebKit installation and execution. No runtime dependency or persisted-data migration is expected.
