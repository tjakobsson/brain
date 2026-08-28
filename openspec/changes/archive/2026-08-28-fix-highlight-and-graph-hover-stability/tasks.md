## 1. Multiline inline markup

- [x] 1.1 Add highlight parser regression cases for one and multiple soft line breaks, surrounding prose, escaped HTML characters, adjacent spans, and unmatched delimiters; verify `npx vitest run src/lib/remark-highlights.test.ts` passes after the parser fix.
- [x] 1.2 Update highlight matching to allow line breaks inside one text-node-bounded `==...==` span without weakening delimiter or escaping rules; verify the multiline cases produce one `<mark>` region and existing highlight tests still pass.
- [x] 1.3 Audit the wiki-link, attachment, and other custom inline transforms for line-break assumptions, document each intended Obsidian-compatible boundary in focused tests, and verify all affected unit test files pass without broadening unsupported multiline syntax.

## 2. Stable graph hover

- [x] 2.1 Add graph interaction regression coverage that records node coordinates and camera state across enter, stationary hover, node-to-node transition, and leave; verify the tests also assert that hover does not trigger layout or camera work.
- [x] 2.2 Route global node-entry intent through the existing motion and camera cancellation paths before refreshing hover emphasis, without restarting canceled motion on leave; verify the graph interaction tests preserve the current frame and later explicit motion triggers still work.
- [x] 2.3 Keep shared global and local hover reducers geometry-neutral while preserving neighborhood emphasis and title display; verify reducer tests show unchanged position, size, and visibility attributes for unfiltered nodes.
- [x] 2.4 Add a browser regression that holds the pointer over a node in a dense or controlled graph, detects hover-state churn, and clicks without moving; verify `npm run test:browser` confirms the hovered node stays in place and is the node selected.

## 3. Integration verification

- [x] 3.1 Run `npm test`, `npm run test:browser`, and `npx astro build`; verify the full suite and static build pass with no new unresolved-link, frontmatter, or runtime warnings caused by this change.
