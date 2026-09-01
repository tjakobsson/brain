## 1. Baseline Review Evidence

- [x] 1.1 Create `screenshots/README.md` and capture the current combined graph at an iPhone-sized standalone viewport, a desktop dense-neighborhood hover with a long title, and the large graph in Microsoft Edge after `Ctrl-+`; verify every before image is stored under this change's `screenshots/` directory and the README records route, browser, viewport, zoom, color scheme, and interaction state.

## 2. Unified Brain Context

- [x] 2.1 Centralize canonical zero-, one-, and multi-Brain selection and route derivation for the root chooser, shared layout, and combined graph; verify route and unit tests cover unknown IDs, ordering, shareable combined URLs, and transitions among chooser, single-Brain, and combined contexts.
- [x] 2.2 Move the existing Brain context control into the always-visible portion of the right navigation pill, add the fixed satellite-dot state for multiple selected Brains, and synchronize its tooltip and accessible name; verify component and browser tests cover single and combined states without relying on color.
- [x] 2.3 Extend the context panel with selected-set controls and an explicit apply action, preserving current selection on open and updating the graph, URL, quick switcher, and applicable navigation together; verify browser tests change between zero, one, and multiple selected Brains on desktop and phone layouts.
- [x] 2.4 Remove the permanent combined-context banner and duplicate Brain fieldset from graph Filters while retaining type, status, tag, Related brains, Fit view, and Legend behavior; verify combined graph tests assert the banner and duplicate controls are absent and the graph regains their former viewport space.
- [x] 2.5 Update navigation-pill sizing, safe-area placement, panel bounds, and graph fit insets for the persistent context control; verify the control and left graph-control pill remain contained and non-overlapping at the smallest supported phone width, desktop width, and an iPhone standalone-style viewport.

## 3. Neighborhood Inspection

- [x] 3.1 Revise the shared inspection reducer so unrelated markers and edges fade, unrelated titles are hidden, and inspected-neighborhood titles retain normal styling and forced visibility; verify unit tests cover global and local attributes, light and dark themes, search composition, and restoration after inspection ends.
- [x] 3.2 Extract shared screen-space marker and rendered-title target geometry for pointer and touch, including foreign Brain marks, viewport clipping, deterministic overlap resolution, and long titles; verify focused unit tests cover marker, title, clipped, foreign, overlapping, and absent-label targets.
- [x] 3.3 Integrate shared title targets with transient pointer inspection, pointer selection, pinned touch inspection, and teardown so crossing a highlighted title retains inspection and entering another target transfers it; verify browser tests exercise long-title traversal, click identity, touch long press, empty-stage clearing, and unchanged graph and camera geometry in both graph sizes.
- [x] 3.4 Add dense global and local graph rendering assertions that only inspected-neighborhood titles remain while unrelated markers stay visible; verify focused light- and dark-scheme screenshots or canvas assertions prove the quieter label treatment without hover oscillation.

## 4. Responsive Hover Stability

- [x] 4.1 Funnel host resize observations and responsive label-policy changes through one shared scheduling invariant for global and local renderers; verify unit tests prove a burst, including a breakpoint transition, applies final dimensions and settings with exactly one settle/refit request.
- [x] 4.2 Add browser regression coverage for effective viewport changes and fractional display scales around the responsive breakpoint, then inspect settled global and local node markers and titles; verify coordinates, camera state, hover identity, settle counts, and click targets remain stable after the transition.
- [x] 4.3 Reproduce the original large-graph case in Microsoft Edge with increased browser zoom and confirm the graph no longer jumps while hovering markers or long titles; verify the result is documented with browser version and zoom level in the change screenshot README.

## 5. Visual Evidence And Contract Verification

- [x] 5.1 Capture matching after images for every baseline state under this change's `screenshots/` directory and update `screenshots/README.md` with relative before/after comparisons; verify the files render from the repository and clearly show reclaimed phone space, the unified dotted Brain control, quieter inspection labels, and stable Edge zoom hover.
- [x] 5.2 Run `openspec validate unify-brain-context-and-graph-inspection --strict`, `npm test`, `npx astro build`, and the affected Playwright component/browser suites; resolve every failure and confirm the implementation, tests, and review screenshots satisfy all four delta specs.

## 6. Context Placement Revision

- [x] 6.1 Remove the Brain selector from shared navigation and restore the standalone navigation pill across workspace pages; verify browser tests cover focus order, expansion, safe areas, and long note titles without a reserved Brain control.
- [x] 6.2 Add the owning Brain to note metadata alongside type, status, and tags with visible non-color identity; verify note-page browser tests cover desktop and phone wrapping for short and long Brain IDs.
- [x] 6.3 Move the canonical Brain selector to the rightmost segment of the left full-graph control pill, preserving explicit Apply, zero/one/many routing, URL, graph, quick-switcher, and navigation synchronization; verify single and combined graph tests cover desktop and phone layouts without a duplicate Filters fieldset or navigation control.
- [x] 6.4 Refresh affected screenshots, run strict OpenSpec validation, `npm test`, `npx astro build`, and affected Playwright suites, and resolve every failure.
