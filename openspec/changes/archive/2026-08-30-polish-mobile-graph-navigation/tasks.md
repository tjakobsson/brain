## 1. Coordinate Automatic Graph Motion

- [x] 1.1 Refactor rendered-bounds fitting to derive and apply a reusable bounding-box and camera plan, and verify graph-fit unit tests retain long-label, large-marker, inset, empty-graph, excluded-node, and camera-limit coverage.
- [x] 1.2 Add source-camera conversion for installing a target bounding box without moving the visible source frame, and verify unit tests compare viewport placement before and after conversion.
- [x] 1.3 Drive initial and resize node positions and planned camera state from one generation-scoped animation timeline, and verify motion tests cover shared completion, cancellation, replacement, immediate reduced motion, one session commit, and no follow-up camera animation.
- [x] 1.4 Preserve measured resize debounce for desktop filter-panel changes while ignoring mobile overlay toggles that leave dimensions unchanged, and verify resize-settler tests cover rapid toggles and final-dimension settlement.

## 2. Polish Global And Local Graph UI

- [x] 2.1 Replace narrow global-graph text controls with one four-action horizontal icon pill while preserving desktop text controls, and verify browser tests assert 44-by-44 touch targets, stable Related brains geometry and state, accessible names, no overflow, and no overlap with the collapsed navigation launcher.
- [x] 2.2 Apply collision-managed foreign-label selection on narrow per-brain graphs while retaining foreign treatment and `@brain` on rendered labels, and verify unit and phone browser tests show a readable fitted cluster with many related notes rather than overlapping forced text.
- [x] 2.3 Add one reusable concise legend popover to global graphs and note-page connection maps with context-specific rows, and verify component or browser tests cover content, open state, keyboard and touch operation, Escape and outside dismissal, and focus restoration.
- [x] 2.4 Verify manual and automatic fitting includes only labels rendered at the fitted camera state after related brains are toggled, while desktop related-label behavior and local graph fitting remain covered by graph-fit and browser tests.

## 3. Collapse Mobile Navigation

- [x] 3.1 Refactor shared navigation markup so desktop retains its current rail and secondary panel while mobile gets a four-dot launcher plus direct Brain, Graph, Search, Tags, Recent, and Orphans actions where applicable; verify route and browser tests cover vault, active-brain, workspace, and combined contexts.
- [x] 3.2 Implement mobile disclosure state, focus order, Escape and outside dismissal, and automatic collapse before navigation or Search, and verify keyboard and pointer browser tests cover `aria-expanded`, focus return, quick-switcher focus, and the absence of a nested mobile flyout.
- [x] 3.3 Add safe-area-aware capsule expansion and staggered action transitions with fixed logical interactivity, bounded short-viewport overflow, and an immediate reduced-motion path; verify browser tests inspect collapsed and expanded geometry, scroll containment, and reduced-motion styles.

## 4. End-To-End Verification

- [x] 4.1 Extend phone browser coverage for uncached first load, cached return, desktop and mobile filter-panel toggles, related brains hidden and shown, compact controls, both legends, and collapsed and expanded navigation; verify with `npm run test:browser`.
- [x] 4.2 Run `npm test`, `npm run test:stress-graph`, and `npx astro build` to verify the OpenSpec contract, supported 2,000-note performance, production output, and all graph and navigation regressions.
- [x] 4.3 Capture and visually inspect phone screenshots of global and local graphs, related brains hidden and shown, legend popovers, and collapsed and expanded navigation outside the repository, and report their paths for review.
