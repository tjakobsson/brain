## 1. Fixtures that can fail

- [x] 1.1 Recalibrate `scripts/generate-stress-vault.mjs` to generate sentence-length titles and realistic brain ids, at or slightly above the reference distribution recorded in `design.md` (titles median 37 max 60 characters, longest brain id 37 characters). Titles must be generated, never copied from a personal vault. Verify by regenerating and asserting the produced title length distribution and longest composed label width in a unit test.
- [x] 1.2 Add a smaller realistic-scale fixture the browser tests can build quickly, around 400 notes across four brains, so label and density assertions do not need the full 2000-note vault. Verify the fixture builds and the browser suite can serve it.
- [x] 1.3 Re-baseline the stress performance budgets against the recalibrated fixture and record the new numbers in the change. Verify with `npm run test:stress-graph`.

## 2. Pinch keeps the pin

- [x] 2.1 Add a multi-touch sequence flag to `wireHoverAndClick` in `src/lib/graph-view.ts`: arm on any container `touchstart` with `event.touches.length > 1`, suppress release actions through the final `touchend` and its synthetic clicks, and end canceled sequences without an action. Verify with a unit test over the flag's transition function covering one-then-two-then-lift in either order, single contact throughout, and a `touchcancel` mid-gesture. Section 11 covers combined-release regression verification.
- [x] 2.2 Require `event.original.type === "touchstart"` before `downStage` arms `emptyStageTouch` and before `downStage` or `downNode` starts a long press. Verify with a unit case asserting a `touchend`-typed press is ignored, and that the existing graph-interaction suite still passes.
- [x] 2.3 Add a browser test that long-presses a node, pinches to zoom with two CDP touch points, and asserts `data-focused-inspection` and the neighborhood pathname both survive, for both lift orders and simultaneous landing. Verify with `npm run test:browser`.
- [x] 2.5 Stop the camera rotating: set `enableCameraRotation: false` in `baseSettings` and drive the two-contact gesture from a `pinchCameraState` in `src/lib/graph-interaction.ts` that holds the midpoint of the contacts and never turns, wired in `wireHoverAndClick` so both graphs get it. Verify with unit tests over the anchor, the zoom limit, and a gesture that is not two contacts.
- [x] 2.6 Add a browser test that pinches with a twist and asserts the drawn graph zoomed without tilting. Confirm it fails against sigma's own pinch. Verify with `npm run test:browser`.
- [x] 2.4 Add the same pinch assertion for a note-page connection map, confirming the shared `wireHoverAndClick` fix covers it. Verify with `npm run test:browser`.

## 3. Node sizing at vault scale

- [x] 3.1 Switch `baseSettings` in `src/lib/graph-view.ts` to `itemSizesReference: "positions"` and re-express `nodeSize` in `src/lib/graph-style.ts` in graph units. Verify with a unit test that marker diameter over median node spacing lands in the target band for both a 30-node and a 400-node layout.
- [x] 3.2 Add a rendering floor so markers stay visible at extreme density, and confirm `graphScreenTargets` keeps its 22px hit radius floor so touch targets survive. Verify with a unit test at the smallest rendered marker size.
- [x] 3.3 Confirm connectivity is still encoded: a high-degree node's marker is visibly larger than a low-degree one at the fitted overview. Verify with a unit test comparing rendered sizes across the degree range.
- [x] 3.4 Re-take `screenshots/before-01-overview-blob.png` conditions on the 400-note fixture and confirm individual markers are separable. Verify against the diameter-over-spacing figure recorded in `screenshots/README.md`.

## 4. Label layout

- [x] 4.1 Add a layout function to `src/lib/graph-style.ts` that takes a label, an available width, a rendered font size and a measure callback, and returns rendered lines plus a measured box: one line when it fits, two or three wrapped at word boundaries, the last line shortened by `shortenGraphLabel` when three still do not fit, and an empty result when not even a shortened line fits. Verify with vitest cases for each branch.
- [x] 4.2 Make `drawGraphNodeLabel` render those lines centred horizontally on the node and below its marker. Verify wrapping and fitted focused-label containment on the 400-note fixture; panning may clip labels without rewrapping them.
- [x] 4.3 Rewrite the label hit box in `graphScreenTargets` in `src/lib/graph-interaction.ts` to consume the box the layout function returns, below and centred rather than right of the node. Verify with vitest that a three-line label's hit box covers every line and matches the returned box.
- [x] 4.4 Update `measureRenderedGraph` in `src/lib/graph-fit.ts` to take label extents from the same box, vertical rather than horizontal. Verify with a unit test that a label-aware fit accounts for a wrapped label's height.
- [x] 4.5 Rewrite `drawGraphNodeHover` for a centred multi-line label, replacing the right-hand pill and its marker-join tangent construction. Verify with vitest over the extracted geometry at small and large marker radii and one to three lines.

## 5. Label text scales with the camera

- [x] 5.1 Derive rendered label size from `labelSize / sqrt(cameraRatio)`, clamped to a legible minimum and a maximum, and use it in the layout function, the renderer, hit testing and fitting. Verify with a unit test that all four report the same size at a given camera state.
- [x] 5.2 Confirm text and markers grow together across a zoom range, and that the clamps hold at `minCameraRatio` and `maxCameraRatio`. Verify with a browser test sampling rendered label width at several camera states on the 400-note fixture.
- [x] 5.3 Confirm label-aware fitting settles with bounded candidate-camera remeasurement and corrections rather than fixed-point oscillation now that measured label size depends on the camera. Verify with the existing fit tests plus a case that fits a graph whose labels are large at the fitted state.

## 6. Label selection by collision

- [x] 6.1 Replace the `labelGridCellSize` selection on narrow with a rule that skips any label whose box overlaps an already-rendered label's box or whose text falls below the legible minimum, using a deterministic priority order: focused note, then neighbors, then descending degree, then id. Verify with a unit test over the selection function.
- [x] 6.2 Confirm a dense fitted overview renders no labels and a sparse note-page connection map renders all of them. Verify with browser assertions on the 400-note fixture and on a note page.
- [x] 6.3 Confirm selection is stable frame to frame at an unchanged camera state. Verify with a browser test comparing `data-rendered-label-ids` across successive frames.
- [x] 6.4 Confirm the focused note stays identifiable by its focus indicator when its label is not selected. Verify with a browser assertion on a pinned neighborhood at the fitted overview.

## 7. Reader-controlled owner prefix

- [x] 7.1 Move owner composition out of `graphNodeAttributes` in `src/lib/graph-style.ts` so a workspace label can be built with or without its owner, leaving per-brain foreign labels always carrying `@brain`. Verify with unit tests over both graph contexts and both preference states.
- [x] 7.2 Add the control to the graph's own surfaces with an accessible name and state, and persist the preference in the reader's browser per site base like the Brain lens. Verify with a browser test that the choice survives a reload and never appears in the URL.
- [x] 7.3 Default the preference to off on narrow viewports and on elsewhere. Verify with browser assertions at both viewport widths with no stored preference.

## 8. Connected neighbors list

- [x] 8.1 Add the list markup to `graph-focus-details` in `src/components/GlobalGraph.astro`, ungated by the `fullWorkspace && neighborhoodPage` condition that gates connected domains. Verify the element is present in the built HTML for vault, brain and workspace modes.
- [x] 8.2 Populate rows from the focused note's neighborhood at the selected reach of one to five links, filtered by `hidden`, ordered by distance then alphabetically, uncapped, hiding the block when the set is empty. Verify with a unit test over the row-derivation function using a filtered graph fixture.
- [x] 8.3 Identify a foreign neighbor in the row regardless of the canvas owner preference. Verify with a workspace-mode browser assertion with the preference off.
- [x] 8.4 Wire rows to `setFocus(node, true)` and give `setFocus` a way to keep `focusDetailsExpanded` true when the move originated in the bar. Verify with a browser test that a row moves focus, refills the list, and leaves the bar expanded.
- [x] 8.5 Style the list in `src/styles/global.css` for 44 by 44 CSS pixel rows on narrow and coarse-pointer layouts, wrapping long titles rather than truncating, scrolling within the bar's height limit. Verify with a browser test on a hub note.
- [x] 8.6 Confirm a row on a note-owned neighborhood page moves focus in place and replaces the address with that neighbor's neighborhood path. Verify with a browser test asserting the resulting URL and no page load.

## 10. The address bar carries the shareable identity

- [x] 10.1 Make `createFocusUrlSync` in `src/lib/graph-neighborhood.ts` write the focused note's neighborhood page path instead of a `focus` query value, and the graph page's own path when focus clears. Verify with unit tests over both transitions and over a focus the graph does not know.
- [x] 10.2 Remove `focus` query state from the graph page: `initialGraphFocus` keeps reading it so existing links still open, but nothing writes it. Verify with a browser test that pinning, moving and clearing focus never puts a query string on the address.
- [x] 10.3 Confirm the address a pinned neighborhood produces is byte-identical to what Copy link produces. Verify with a browser test comparing the two.
- [x] 10.4 Confirm reopening that address gives the same graph focused on the same note. Verify with a browser test.
- [x] 10.5 Add Clear focus and Fit view to the graph context menu, and open the menu on empty graph space with only the actions that do not need a note. Verify with browser tests in each state.
- [x] 10.6 Hold the inspected node while a context menu is open. Verify with a browser test that the node stays inspected as the pointer moves to the menu.
- [x] 10.7 Update the browser assertions that expect `?focus=` on a graph page. Verify with `npm run test:browser`.
- [x] 10.8 Move focus in place on a neighborhood page: `setFocus` no longer navigates to another note's page and `createFocusUrlSync` replaces the address there too. Clearing also happens in place as completed in 10.10. Verify with a unit test over the URL sync and browser tests that the page survives a move from a neighbor row and from a search result, with the address becoming the new neighborhood path.
- [x] 10.9 Fit the camera to the focus before the first painted frame when a page opens already focused, so arriving is never a zoom away from the whole graph. Verify by sampling screen pixels per graph unit every frame on a cold neighborhood page load and confirming the first sample is the fitted value.
- [x] 10.10 Remove the remaining behavioural distinction between a note's neighborhood path and the graph page: one "Clear focus" that clears in place everywhere with the address following, no `data-graph-focus-clear-navigates`, no `neighborhoodPage` branch in the view. Verify with browser tests that clearing on a note path keeps the page and lands on the graph's own address.
- [x] 10.11 Put Clear focus in the collapsed focus bar as a 44px icon segment beside Open, so clearing is one tap from anywhere rather than two behind the disclosure. Verify with browser tests that the control is visible and clears without expanding the bar.
- [x] 10.12 Draw unrelated labels only in company: `selectGraphLabels` drops labels outside the inspected neighborhood when fewer than three, or fewer than a quarter of a small graph's candidates, can be placed. Verify with unit tests over a lone survivor, a tiny graph, and an exempt neighborhood, and a browser test that the 400-note fitted overview renders zero labels.
- [x] 10.13 Centre and fill the fit: `graphFitInsets` no longer charges a corner control that lies inside an already excluded band and counts About at the bottom, and `fitCorrection` scales below 1 so a fit zooms in to fill the usable viewport as well as out. Verify with unit tests over the insets and a small graph, and by measuring marker bounds after Fit view on the 400-note phone fixture.
- [x] 10.14 Keep the focused note's title inside a focus fit: thread `labelIds` through `fitRenderedGraph`, `planRenderedGraphFit` and `measureRenderedGraph` so the focused note's label and plate count towards the bounds even when labels are otherwise excluded. Verify with a unit test over a marker-only fit and a browser test that pins a hub near an edge on the phone fixture and reads the focused title's ink bounds.
- [x] 10.15 Make hover preview a reader preference, off by default on fine pointers: a `hoverPreview` option on `wireHoverAndClick`, a stored preference shared by both graphs, a visible pressed-state toggle in the graph controls hidden where hover does not exist, D to toggle and F to pin, move or lift the pin for the node under the pointer. Verify with browser tests over the default, the toggle and its persistence, and the F key's three outcomes; tests that assert hover emphasis turn the preview on first.
- [x] 10.16 Add C to clear the pin and Z to fit, on both graphs, and draw the hover plate for the node under the pointer whenever it is not dimmed, using a partial refresh of the two nodes concerned rather than a full re-index. Verify with browser tests over the keys and over hover ink appearing for a node hovered by its title rather than its marker.
- [x] 10.17 Make the keys discoverable: key hints in the context menu, the key in Fit view's tooltip, and a Help disclosure in the graph controls listing keys and gestures, keys hidden where there is no keyboard. Verify with browser tests over the menu hints, the tooltip, and Help on desktop and phone.
- [x] 10.18 Let 1 to 5 set how far the lit neighborhood reaches: a breadth-first `neighborhoodWithin` behind the inspection state, edges lit between successive rings, bar rows across rings with distances, a remembered preference, and a refit when the reach changes while pinned. Verify with unit tests over the walk, the edge rule and row order, and a browser test over a chain fixture.

## 9. Verification

Existing checks record earlier implementation and verification. Section 11 tracks PR-review fixes separately; these historical checks do not certify those fixes.

- [x] 9.1 Run `npm test` and confirm the full vitest suite including main-spec validation passes.
- [x] 9.2 Run `npm run test:browser`, review every changed screenshot baseline, and confirm each diff is intended rather than a regression. Expect broad churn from the marker sizing change.
- [x] 9.3 Run `npm run test:stress-graph` against the recalibrated fixture and confirm both correctness and the re-baselined budgets.
- [x] 9.4 Re-take all five shots in `screenshots/` under the recorded conditions, save them alongside the baselines as `after-*.png`, and update `screenshots/README.md` with the new measurements next to the old ones.
- [x] 9.5 Walk the reported flow by hand at 390x844 on the 400-note fixture: open the overview, zoom in and read a title, long-press a hub, pinch to zoom without losing the pin, expand the bar, read the neighbor list, move focus from a row, and toggle the owner preference. Confirm each step matches the scenarios in the delta specs.

## 11. PR review regressions

- [x] 11.1 Verify in-place URL changes refresh pathname-derived navigation and search owner Brain scope for root-graph pinning, cross-Brain moves, and clearing.
- [x] 11.2 Verify the layout session key follows the current neighborhood and unfocused graph without restoring different node positions during either transition. Keep shipped full workspace neighborhood keys unchanged and verify focused Brain sessions remain separate by original active Brain and related-Brains visibility, without overwriting the full workspace layout or camera.
- [x] 11.3 Verify a shared neighborhood's filter visibility exception survives row moves and ends only on an explicit type, status, or tag filter edit; verify distance-first row ordering at reaches one to five and no row navigation reload.
- [x] 11.4 Verify combined two-contact release produces no click, navigation, or focus clear on global and local graphs, alongside both staggered lift orders.
- [x] 11.5 Verify F targets an unrelated visible marker even when left-click navigation is ineligible, and cannot reuse a stale target after context-menu dismissal.
- [x] 11.6 Verify local label selection refreshes after hover preview ends or is toggled, without requiring camera movement.
- [x] 11.7 Verify label collisions use marker sizes rendered at the current camera state, including zoomed-in markers.
- [x] 11.8 Verify desktop Fit view contains labels selected at the candidate camera and the focused title's actual plate, including after offscreen panning. Cover bounded candidate-camera remeasurement and corrections without fixed-point oscillation, and retain narrow focused-title fit coverage.
- [x] 11.9 After final edits, run `openspec validate readable-mobile-graph-neighborhoods --strict`, `npm test`, `npm run test:browser`, and `npm run test:stress-graph`; review the final results before checking off this section. Keep manual task 9.5 pending until the walkthrough is performed.

PR-review verification: strict change validation passed, 675 unit tests passed, 157 browser tests passed, and both stress tests passed without changing the performance budgets. The 2,000-note stress run measured a 365.9 ms maximum frame gap and a 335 ms maximum long task, below the 500 ms limits. The reader confirmed the manual walkthrough in task 9.5 is complete.

## 12. Follow-up review

- [x] 12.1 Keep Home visibility synchronized with in-place focus paths, matching fresh loads on desktop and phone without leaving a divider before the first visible control. Verify root pinning, cross-Brain focus moves, clearing, and reloads in the browser tests.
- [x] 12.2 Correct touch Help to distinguish tap navigation from long-press focus changes and verify the guide in the phone browser test. Keep the existing tap behavior unchanged.
- [x] 12.3 Hand a marker-start touch gesture from node dragging to pinch zoom when a second contact arrives. Verify both lift orders, simultaneous landing, preserved pre-pinch drag positions and focus, no node movement during the pinch even after a deferred resize, and fresh single-touch dragging afterward on global and local graphs.
- [x] 12.4 Keep Connected domains limited to the focused note and visible direct neighbors at every reach. Verify a cross-Brain chain expands connected-note rows without adding indirect domain chips or inflating existing counts.
- [x] 12.5 Keep Help reachable on narrow phones by wrapping the toolbar instead of hiding controls or shrinking touch targets. Verify 320px, 359px, 360px, 375px, and 390px workspace root, Brain, and neighborhood layouts, contained Help/Legend/lens panels, accessible filter fields, and focus transitions without overflow. Verify 320px vault graphs at root, subpath, and custom-domain deployments.
- [x] 12.6 Verify that valid rotated camera caches restore upright on workspace and Brain graphs with the real Sigma renderer, preserving pan, zoom, bounding box, and node positions without refitting or invalidating the cache.
- [x] 12.7 Add a visible local Hover preview toggle with pressed state, shared persistence, and keyboard synchronization; verify desktop containment and touch hiding.
- [x] 12.8 Wait for resize/filter settling and the chained focus fit before capturing the session-isolation test's drag baseline and marker coordinates; retain its pointer, drag, and cache assertions.
- [x] 12.9 Recover from font-dependent wrapping overshoot with bounded fit backtracking and deterministic wrapping regressions, preserving the existing padding assertions and performance budgets.
- [x] 12.10 Make the pending-responsive-camera test dispatch Fit/search in the breakpoint-change task before the resize debounce can expire, after waiting for any sidebar setup resize. Preserve the exact no-extra-settle and camera-completion assertions.
- [x] 12.11 Refresh global label selection when hover preview is toggled under a stationary pointer, on and off, without a camera or pointer move. Verify the neighbors' titles appear and the normal selection returns while the camera and pointer target are unchanged.
- [x] 12.12 Hide the hover-preview controls only where hover is unavailable, not by width. Verify both graphs keep a visible, contained, working control at 1280px to 320px with a fine pointer, and hide it in a touch context at 1024px to 390px.
- [x] 12.13 Re-evaluate the owner-labels default at breakpoint changes until the reader chooses, and keep an explicit choice through breakpoint changes when storage is unavailable or rejects writes. Verify both directions of the 700px crossing with and without a stored preference, that no preference is written by the default, and that failed writes do not surrender the choice.
- [x] 12.14 After final edits, run strict OpenSpec validation, `npm test`, `npm run test:browser`, and `npm run test:stress-graph`; review the results before checking off 12.11 to 12.13.

- [x] 12.15 Give the note-page connection map the global graph's label fade lifecycle: arriving titles fade in, leaving titles stay drawn while fading out, fit planning measures without fades, and unmount cancels a running fade. Verify in the browser that preview beginning and ending on a connection map pass through translucent frames and settle to the expected selections.
- [x] 12.16 Bound the label layout cache to the most recent few rendered sizes, keyed per size with recency eviction. Verify with unit tests over eviction order, hits refreshing recency, and bounded growth across many distinct zoom levels.
- [x] 12.17 After final edits, run strict OpenSpec validation, `npm test`, `npm run test:browser`, and `npm run test:stress-graph`; review the results before checking off 12.15 and 12.16.

- [x] 12.18 Keep a retiring label drawn from its last text and layout when inspection or search styling clears it, on both graphs and on the final pass only. Verify in the browser that inspection beginning on the global graph and on a connection map passes through translucent frames for the titles it removes.
- [x] 12.19 Carry unfinished leavers through a later selection change with a shared helper, taking back any the new selection selects. Verify with unit tests over arrival, departure, carried leavers, and taken-back leavers.
- [x] 12.20 Mark labels that are only fading out as leaving, exclude them from pointer and touch hit-testing, and repaint only retired nodes when a fade-out ends. Verify the connection-map long-press and marker-start pinch tests pass on the CI runner, where the press landed inside the post-fit fade.
- [x] 12.21 After final edits, run strict OpenSpec validation, `npm test`, `npm run test:browser`, and `npm run test:stress-graph`; review the results before checking off 12.18 to 12.20.

- [x] 12.22 Make a reversed label fade continue from its current opacity in either direction. Verify with unit tests that an arriving label turned back keeps its opacity and reaches zero on the shortened path, and that a half-gone label taken back keeps its opacity and reaches full without a fade-out finishing.
- [x] 12.23 After final edits, run strict OpenSpec validation, `npm test`, `npm run test:browser`, and `npm run test:stress-graph`; review the results before checking off 12.22.

- [x] 12.24 Start each label fade's clock at its first rendered frame rather than when the selection pass begins it, and redraw fade frames with a plain render rather than a refresh that re-runs the reducer over every node, so a slow re-index cannot consume the fade before anything is drawn and the fade has frames to run in. Verify with unit tests that a fade holds at its starting opacity until started and then runs its full course, and that reversing an unstarted fade finishes at once.
- [x] 12.25 Keep a title cleared by inspection or search styling drawn from the moment it is cleared until the next selection pass marks it leaving, on both graphs. Verify in the browser that every title the global inspection removes is seen translucent.
- [x] 12.26 After final edits, run strict OpenSpec validation, `npm test`, `npm run test:browser`, and `npm run test:stress-graph`; review the results before checking off 12.24 and 12.25.

- [x] 12.27 Name the Z key on the connection map's Fit view control, in its tooltip and accessible name, as the global control does. Verify in the browser test for the local controls.
- [x] 12.28 After final edits, run strict OpenSpec validation, `npm test`, `npm run test:browser`, and `npm run test:stress-graph`; review the results before checking off 12.27.

- [x] 12.29 Cancel a layout, animation, or camera fit still in flight when the session scope changes, report it, and settle the new scope when focus is cleared. Verify with unit tests over the controller and in the browser that clearing focus before a neighborhood's initial settle finishes leaves and restores an overview rather than the neighborhood's close-up.
- [x] 12.30 After final edits, run strict OpenSpec validation, `npm test`, `npm run test:browser`, and `npm run test:stress-graph`; review the results before checking off 12.29.

- [x] 12.31 Consume the scope-change interruption flag on every focus change, so a focus move that interrupted motion does not leave a later clear re-settling the graph. Verify in the browser that a mid-settle focus move followed by a clear adds no settle request and moves nothing.
- [x] 12.32 Suppress debounced and page-leave commits while the replacement settle is pending, and invalidate the new scope's stored session on leaving the page instead. Verify in the browser that reloading before the graph's own settle finishes settles the graph afresh as an overview.
- [x] 12.33 After final edits, run strict OpenSpec validation, `npm test`, `npm run test:browser`, and `npm run test:stress-graph`; review the results before checking off 12.31 and 12.32.

- [x] 12.34 Keep the pending scope settle across a persisted page hide and settle the owed scope on a persisted page show. Verify in the browser, with synthetic persisted pagehide and pageshow events mid-settle, that a further settle is requested and completes with every marker in view.
- [x] 12.35 Stop the fit's plateau correction once required text is at its minimum size and the fixed plate still exceeds the inset viewport, keeping the tightest measured camera. Verify with a unit test that a required title whose plate cannot fit does not collapse the camera through the correction budget.
- [x] 12.36 After final edits, run strict OpenSpec validation, `npm test`, `npm run test:browser`, and `npm run test:stress-graph`; review the results before checking off 12.34 and 12.35.

- [x] 12.37 When a plateau step has not shrunk a required plate, stop zooming but keep correcting the centre rather than reverting the step, so the markers stay inside the insets and the extent is centred. Verify with the unit test over the unfittable plate.
- [x] 12.38 After final edits, run strict OpenSpec validation, `npm test`, `npm run test:browser`, and `npm run test:stress-graph`; review the results before checking off 12.37.

- [x] 12.39 When a page kept for Back resumes owing a neighborhood scope, settle under the neighborhood's camera ids and refit the pin, as a focused page opening does. Verify in the browser with a mid-settle focus move followed by persisted pagehide and pageshow.
- [x] 12.40 Include the visible connected-notes panel's top edge in the fit's bottom inset on narrow and coarse-pointer layouts. Verify with a unit test over the insets and in the phone browser test that opening the disclosure leaves no neighborhood marker behind the panel.
- [x] 12.41 After final edits, run strict OpenSpec validation, `npm test`, `npm run test:browser`, and `npm run test:stress-graph`; review the results before checking off 12.39 and 12.40.

Thirteenth-review verification: strict change validation passed; 694 unit tests passed; 195 browser tests passed; both stress tests passed with unchanged budgets, the 2,000-note run measuring a 392.7 ms maximum frame gap and a 361 ms maximum long task. The back-forward-cache refit test, the insets unit test, and the phone panel assertion were each run once with their production change stashed and failed, then passed with it restored.

Twelfth-review verification: strict change validation passed; 694 unit tests passed; 194 browser tests passed; both stress tests passed with unchanged budgets, the 2,000-note run measuring a 392.9 ms maximum frame gap and a 362 ms maximum long task. The unfittable-plate unit test, now also asserting marker containment and a centred extent, was run once against the previous revert-and-stop planner and failed, then passed with the centring change.

Eleventh-review verification: strict change validation passed; 694 unit tests passed; 194 browser tests passed; both stress tests passed with unchanged budgets, the 2,000-note run measuring a 388.4 ms maximum frame gap and a 360 ms maximum long task. The new fit unit test and the new back-forward-cache browser test were each run once with their production change stashed and failed, then passed with it restored.

Tenth-review verification: strict change validation passed; 693 unit tests passed; 193 browser tests passed; both stress tests passed with unchanged budgets, the 2,000-note run measuring a 399.8 ms maximum frame gap and a 365 ms maximum long task. Both new browser regressions were run once with the production change stashed and failed, then passed with it restored.

Ninth-review verification: strict change validation passed; 693 unit tests passed; 191 browser tests passed; both stress tests passed with unchanged budgets, the 2,000-note run measuring a 401.7 ms maximum frame gap and a 361 ms maximum long task. The new browser regression was run once with the production fix stashed and failed, then passed with it restored.

Eighth-review verification: strict change validation passed; 692 unit tests passed; 190 browser tests passed; both stress tests passed with unchanged budgets, the 2,000-note run measuring a 379.3 ms maximum frame gap and a 357 ms maximum long task.

Seventh-review verification: strict change validation passed; 692 unit tests passed; 190 browser tests passed; both stress tests passed with unchanged budgets, the 2,000-note run measuring a 384.1 ms maximum frame gap and a 361 ms maximum long task. In-page frame recording on the 400-note fixture showed the inspection fade-out drawn in twelve translucent frames at roughly 18 ms spacing, against two frames before, with every title still drawn in the first frame after D.

Sixth-review verification: strict change validation passed; 690 unit tests passed; 190 browser tests passed; both stress tests passed with unchanged budgets, the 2,000-note run measuring a 384.8 ms maximum frame gap and a 359 ms maximum long task. The global fade stage that failed on the Linux runner now checks that every title inspection removes was seen translucent, rather than assuming a title outside the neighborhood is rendered under that runner's fonts.

Fifth-review verification: strict change validation passed; 689 unit tests passed; 190 browser tests passed once the hovered-node test took its reference frame after the removed titles had finished fading; both stress tests passed with unchanged budgets, the 2,000-note run measuring a 379.5 ms maximum frame gap and a 362 ms maximum long task. The CI regression was replayed locally with the press landing inside the post-fit fade, unthrottled and at 4x CPU throttling, and pinned every time after the fix.

Fourth-review verification: strict change validation passed; 686 unit tests passed; 190 browser tests passed once the mobile reveal test polled for the settled label count instead of reading it during the fade-out; both stress tests passed with unchanged budgets, the 2,000-note run measuring a 399 ms maximum frame gap and a 359 ms maximum long task.

Third-review verification: strict change validation passed; 683 unit tests passed; the browser suite passed once the one outdated fine-pointer toolbar count was corrected for the now-visible Hover preview control; both stress tests passed with unchanged budgets, the 2,000-note run measuring a 390.1 ms maximum frame gap and a 361 ms maximum long task.
