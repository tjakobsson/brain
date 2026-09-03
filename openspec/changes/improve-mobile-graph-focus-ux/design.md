## Context

The graph uses fixed-pixel Sigma labels and an iterative rendered-bounds fitter. Focus forces the selected note and direct-neighbor labels to render. On a narrow viewport, one long label can remain wider than the available area at every camera ratio, so each correction zooms the node coordinates farther out while the label width stays fixed. The fitter can also raise the configured zoom-out limit. The result resembles a single line even though the underlying node positions remain two-dimensional.

The focus status section is an absolute overlay. Its coarse-pointer layout stacks the title, actions, and connected domains, but the fit inset calculation currently accounts only for top controls and right navigation. See `proposal.md` for the user-facing problem and `specs/graph-explorer/spec.md` for the changed behavior.

## Goals / Non-Goals

**Goals:**

- Keep focused marker geometry readable when labels are wider than a phone viewport.
- Preserve full-title and focus actions without leaving a tall card over the graph.
- Make the camera use the graph area that is actually visible around persistent overlays.
- Produce visual evidence at representative phone widths and review it before declaring the UX complete.

**Non-Goals:**

- Rerun graph layout when the reader presses Fit.
- Change graph-space positions, neighborhood membership, URLs, desktop focus behavior, or the Brain lens.
- Add label collision detection to Sigma or add a graph dependency.
- Turn the focus bar into a draggable modal bottom sheet.

## Decisions

### Fit narrow graphs in two phases

First compute a camera that contains the included node markers in the usable viewport. Then apply the narrow label policy at that fixed camera state. Label measurement may decide whether to render or shorten text, but it cannot increase the camera ratio beyond the marker fit.

This ends the impossible correction loop caused by fixed-pixel labels. It also follows the graph's existing progressive-label model, where the fitted overview is selective and zooming in reveals more titles. Wide viewports retain rendered-label fitting because they have enough horizontal room and the current behavior is useful there.

The rejected alternative is a larger minimum label font or a hard-coded camera ratio alone. Either limit can still fail with a sufficiently long title or dense neighborhood because it leaves labels in control of graph framing.

### Keep manual Fit camera-only

Fit continues to recover the overview without rerunning ForceAtlas2 or responsive settling. The current coordinates in the reported case already form a useful composition when manually zoomed in, and moving nodes would violate the reader's expectation that Fit changes the camera rather than the graph.

The rejected alternative is a radial focused-neighborhood layout on phones. It could create clean spacing, but it would discard spatial continuity with the workspace graph and broaden this change beyond the demonstrated problem.

### Bound canvas labels and keep the full title in HTML

The focused canvas label remains present at the fitted overview. If its measured width exceeds available screen space, render a shortened form that retains the ownership prefix and enough title text to identify it. Direct-neighbor labels use the existing density and narrow-width eligibility rules at the marker-fit camera. The HTML focus bar exposes the complete title, so canvas truncation does not discard the information.

The implementation should reuse the existing label reducer and narrow-label lifecycle rather than fork a second renderer. Zooming into detailed mode restores eligible full labels as it does today.

The rejected alternative is allowing long labels to clip at the viewport edge. Clipping looks broken and can hide the distinguishing part of titles.

### Derive fit insets from intersecting persistent overlays

Extend the existing asymmetric inset calculation to include the visible focus bar. Use its actual bounding rectangle, as with the graph controls and site navigation, so the calculation also handles the expanded state and safe-area placement. Fit centers the graph in the remaining rectangle rather than the full canvas.

The rejected alternative is a fixed bottom inset. It would drift as text size, connected domains, localization, or viewport width changes.

### Use a collapsed bar with explicit expansion

On narrow and coarse-pointer views, the default focus presentation is one row with an ellipsized title, a direct Open action, and a disclosure control. Expansion reveals the complete title, Copy link, connected domains, and Clear where clearing is valid. Existing desktop presentation can remain unchanged.

Keep the collapsed bar at or below 72 CSS pixels, including its border and padding. Controls remain at least 44 CSS pixels in both states. The disclosure exposes its state to assistive technology and preserves focus when toggled.

The rejected alternative is removing the focus UI. The persistent focus state still needs a complete title and keyboard-accessible actions outside the canvas.

### Treat screenshots as required verification evidence

Store baseline and final screenshots under `openspec/changes/improve-mobile-graph-focus-ux/evidence/`. Capture at least a 390 CSS-pixel-wide focused neighborhood matching the reported long-title case in collapsed and expanded states. Also capture a 320 CSS-pixel-wide collapsed state to expose tighter wrapping and control collisions.

The implementing assistant must inspect the actual images, not only confirm that screenshot files exist. Review graph scale, node separation, label clipping and overlap, overlay occlusion, title truncation, touch-control placement, and collapsed height. If the evidence does not clearly meet the spec, or if visual judgment remains uncertain, pause and ask the user to review the screenshots before marking visual verification complete.

## Risks / Trade-offs

- [Some neighbor titles are absent at the fitted overview] -> Keep the focused title, reveal more labels on zoom, and retain graph search and note opening paths.
- [Shortened labels can make similar titles harder to distinguish] -> Preserve the ownership prefix and use available width rather than a fixed character count.
- [An expanded focus bar leaves little graph area on short phones] -> Treat expansion as temporary and return to a compact collapsed default without changing focus.
- [DOM overlay measurements can be stale during a state transition] -> Fit only after the current focus-bar layout has rendered, using the established refresh and scheduling path.
- [Automated assertions can pass while the graph still looks poor] -> Require stored screenshots and direct visual inspection, with a user-review pause for ambiguous results.

## Migration Plan

Ship the fit policy, focus bar, tests, and screenshot evidence together. No persisted graph data or URL migration is required. Rollback restores the prior label-aware narrow fit and focus card; existing focused links remain compatible.
