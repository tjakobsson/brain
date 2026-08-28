## 1. Rendered graph fitting

- [x] 1.1 Add a shared camera-fit utility that measures included node markers and rendered label rectangles, applies bounded camera corrections inside an inset host rectangle, and handles empty graphs; verify unit tests cover long labels, large markers, excluded nodes, and stable convergence.
- [x] 1.2 Integrate the shared fitter with global manual and automatic camera fits without moving nodes or weakening cancellation and reduced-motion behavior; verify the graph motion unit tests and new rendered-bounds cases pass.
- [x] 1.3 Add a Fit view control to each rendered local connection map and use the shared fitter for its initial and reader-triggered camera fits; verify browser tests pan or zoom a local graph, activate Fit view, and assert its markers and rendered labels are within the inset graph viewport.
- [x] 1.4 Extend global graph browser coverage with long-title, high-degree, and filtered-node cases; verify Fit view includes visible rendered extents and excludes hidden nodes after loading, filtering, panning, and zooming.

## 2. Persistent pill navigation

- [x] 2.1 Replace the duplicated desktop navigation and scroll-compaction behavior with one fixed pill containing base-safe Graph, quick-switcher Search, and native expand actions plus an attached Tags, Recent, Orphans, and Search menu; verify markup exposes distinct accessible names and disclosure state without a hamburger icon.
- [x] 2.2 Update shared responsive styles and page spacing so the pill remains usable on desktop, narrow, and coarse-pointer layouts while full-bleed graph sizing no longer reserves the removed header row; verify screenshot or geometry assertions show no overlap with standard content or graph controls.
- [x] 2.3 Update browser tests for the always-present desktop pill, stable note-page scrolling, direct Graph and Search behavior, expanded-menu links, keyboard focus, mobile and coarse-pointer layouts, and non-root base paths; verify the targeted Playwright suite passes.

## 3. Integration verification

- [x] 3.1 Run `npm test`, `npx astro build`, and `npm run test:browser`; fix regressions and verify the generated static site satisfies both delta specs without adding dependencies.
