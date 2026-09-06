## Context

See proposal.md for motivation and `screenshots/` for the measured baseline. What matters here is that four faults live in code with very different shapes, and that three of the four were invisible against the fixtures this repository ships.

**The fixtures hid the problem.** `examples/demo-vault` has 30 notes. `scripts/generate-stress-vault.mjs` uses `brain-01` and `Generated note 0001`. Measured against a 400-note workspace whose titles and brain ids match `tjakobsson/brain-vault`, the median canvas label is 537 CSS pixels on a 390 pixel viewport and node markers are 1.27 times wider than the gaps between them. Neither fixture can produce those numbers, so no test in the repository can fail on them.

**The touch path.** `wireHoverAndClick` serves both the global graph and every note-page connection map. It tracks `emptyStageTouch`, the position of a touch that landed on empty canvas, and clears focus on release when that value is still set. `cancelMultiTouch`, wired to the container's `touchstart` and `touchmove`, resets it whenever a second contact point appears.

Sigma's touch captor re-emits `downStage` when a pinch drops from two contact points to one, and that re-emission carries `original.type === "touchend"`. The handler's guard is `event.original.type.startsWith("touch")`, which `"touchend"` satisfies, so the handler records a fresh `emptyStageTouch` after `cancelMultiTouch` already cleared it. `cancelMultiTouch` never sees the two-to-one transition because it listens only to `touchstart` and `touchmove`.

Confirmed with trusted CDP touch events. Lifting the second contact point first, and landing both simultaneously, cleared the pin every time. Lifting the first contact point first happened to survive only because the remaining contact point landed on a node and took the `longPress.start` branch.

**Canvas label geometry.** Four sites assume a single line drawn to the right of the marker: `drawGraphNodeLabel` and `drawGraphNodeHover` in `graph-view.ts`, `graphScreenTargets` in `graph-interaction.ts`, and `measureRenderedGraph` in `graph-fit.ts`. All four change under centred multi-line labels, so the layout has to become one function they share rather than four compatible assumptions.

**Sizing.** Sigma defaults to `itemSizesReference: "screen"`, so `scaleSize` returns `size / sqrt(ratio)`. Node size is a fixed pixel count. As a vault grows the fit compresses positions and markers stay the same size, so the graph collapses into itself. `labelSize` is a constant 13, so text does not scale at all. The two behaviours pull in opposite directions as you zoom.

## Goals / Non-Goals

**Goals:**

- One gesture rule that makes camera gestures structurally incapable of clearing focus, rather than a patch for the sequence observed.
- One label layout function that rendering, hit testing and camera fitting all consume, so they cannot disagree about where a label is.
- Fixtures that can actually fail on these faults.
- Scale invariance: a 30-note vault and a 2000-note vault should look like the same product.

**Non-Goals:**

- Reading a label while its node remains off the canvas. Fit view must still recover offscreen nodes and measure their labels at the candidate camera state.
- Changing the force-directed layout itself. Only how it is drawn.
- Changing edge rendering weight or the type and status colour encoding. The overview reads as confetti partly because of colour, but that is a separate judgement about `Meaningful visual encoding` and is not in this change.

## Decisions

### Disqualify the whole touch sequence, not the stray event

Track whether the current touch sequence ever had more than one contact point, and refuse clicks, navigation, and focus clearing for the rest of that sequence. The flag arms on any `touchstart` with `event.touches.length > 1`. Retire it only after the final release and its synthetic click handling have been suppressed, including when both contacts lift in one event; `touchcancel` also ends the sequence without an action.

Also require `event.original.type === "touchstart"` before `downStage` or `downNode` arms `emptyStageTouch` or starts a long press. A `downStage` synthesised from a `touchend` is not a press.

Both guards, not one. The type check alone fixes the observed sequence, but sigma is free to re-emit `downStage` from a `touchstart` in another browser. The sequence flag is the invariant; the type check additionally stops a lift from arming a spurious long-press timer that would pin an unintended node if the reader kept holding.

Rejected: comparing camera state at press and release. That couples tap classification to camera state, and a pinch returning to the same scale would still clear.

Node dragging starts only from a single-contact `touchstart`. When a second contact arrives, finish the drag before capturing the pinch anchor, retaining any positions already moved and releasing its highlight. The two-contact camera handler runs before touch-drag movement; neither simultaneous landing nor Sigma's synthetic `touchend` press may arm dragging.

Drag completion distinguishes a normal release from a pinch handoff. A resize deferred during dragging updates viewport presentation at handoff without starting automatic layout beneath the fingers; any legitimate pre-pinch drag is still saved. Normal release keeps its existing resize-settle behavior.

Sigma's camera starts at angle zero and disables rotation before session restoration. Its `validateState` ignores supplied angles when rotation is disabled, including older saved camera angles. Keep the existing view cache and verify this through the real browser renderer; no migration or cache invalidation is needed to preserve upright restoration with the reader's pan, zoom, and layout intact.

### Centre labels below the node

A right-hand label needs its full length in horizontal room on one side. A centred label needs half its longest line on each side. Combined with wrapping to three lines, a 537 pixel title needs roughly 90 pixels of clearance either side instead of 537 to the right.

This is what makes the width problem tractable at all, and it removes two earlier questions. There is no longer a reason to flip a label to the left, because it is already symmetric. There is no longer a reason to prefer two lines over three, because the two-line limit was justified by a right-hand hit box that is being rewritten anyway.

The layout function takes a label, an available width and a measure callback, and returns rendered lines plus a measured box:

```
   fits on one line               -> [ line ]
   wraps to two or three lines    -> [ line, line, line? ]
   still too wide                 -> shorten the last line with an ellipsis
   not even a shortened line      -> []   (omit)
```

`shortenGraphLabel` stays, demoted from primary mechanism to last-resort fallback. It already understands the `" · "` owner divider, so it needs no change to keep working on the final line.

The box this function returns is what `graphScreenTargets` uses for hit testing and what `measureRenderedGraph` uses for label-aware fitting. Neither recomputes geometry.

### Scale label text by the same law as markers

Rendered label size becomes `labelSize / sqrt(cameraRatio)`, clamped to a legible minimum and a maximum that stops text dominating at close zoom. That is exactly `zoomToSizeRatioFunction` applied to text, so markers and titles grow together and the marker-to-text ratio stays constant at every camera state.

Every viewport, not narrow only. The law is already how markers behave everywhere, and having text follow a different law on desktop would be a second thing to reason about for no benefit.

This is the decision that makes "zoom in to read" true. Without it, wrapping alone still leaves 13 pixel text beside 45 pixel markers at close zoom.

### Node size in graph space

Switch to `itemSizesReference: "positions"`, which makes `scaleSize` return `size * sqrt(ratio) * graphToViewportRatio`. Marker size becomes a graph-space quantity, so as a layout spreads out the fit compresses markers with it and the ratio of marker diameter to node spacing stays constant no matter how large the vault gets. `nodeSize` is recalibrated into graph units against that ratio rather than against a pixel count.

Two floors are needed. A rendering floor so markers stay visible at extreme density, and a hit-testing floor, which `graphScreenTargets` already provides with `Math.max(node.radius, 22)`.

Rejected: deriving size from node count. That is a proxy for what we actually care about, breaks on a vault that is large but sparsely linked, and would need re-tuning per graph context.

### Label selection by collision, not by grid

Today `labelRenderedSizeThreshold: 0` on narrow leaves only `labelGridCellSize: 180` to cull, which picks a fixed handful per screen regardless of whether they fit. That produces six overlapping labels on a 400-node overview and would produce none on an eight-node connection map if the grid cells happened to fall badly.

Replace it with a rule stated in terms of the outcome: do not render a label whose box overlaps an already-rendered label's box or another visible node's marker, or whose text falls below the legible minimum. Marker collision bounds use rendered radii at the current camera state, not raw graph-space sizes. Density then decides. A dense overview yields zero labels, matching the reference behaviour. A sparse connection map labels every node when the boxes fit, which the grid rule could not guarantee.

Selection must be stable frame to frame at a fixed camera state, so it needs a deterministic priority order rather than iteration order. Focused note first, then its neighbors, then by descending degree, then by id.

Local graphs recompute selection when hover preview ends or its preference changes, even if the camera has not moved. F targets the visible marker under the pointer independently of left-click navigation eligibility, so a dimmed unrelated note can receive the pin. Dismissing a context menu releases its held target; F must not act on that stale target when the pointer is now over empty space.

### The owner prefix is a reader preference

Measured, `@capability-backed-product-engineering · ` plus the status marker is roughly 275 of the median label's 537 pixels. More than half of a workspace label is not the title.

`Meaningful visual encoding` requires the inline `@brain` identity only for foreign labels in a per-brain graph. The full workspace graph is required to carry brain identity through accent and legend, which it does without any label text. So the prefix is removable there.

Making it a preference rather than a fixed choice follows the Brain lens: a reader-owned display setting, stored in the reader's own browser per site base, never in a URL. It defaults to off on narrow and on elsewhere, which preserves today's desktop appearance and fixes the phone.

The default is a function of the current layout, not a snapshot taken at mount. Until the reader has chosen, crossing the 700px breakpoint re-evaluates it alongside the renderer's responsive policy, so a graph opened wide and then narrowed drops the prefixes as a narrow load would. Once the reader has chosen, that choice holds for the session even when storage cannot persist it; a failed write must not hand the setting back to the breakpoint.

The preference must not reach the per-brain graph, where a rendered foreign label always keeps its identity.

### The neighbor list is a control that moves focus

Rows call `setFocus(node, true)` to move focus and fit the camera in place. URL sync replaces the address with the target's neighborhood path on both graph and neighborhood pages; no row causes a page load. Clearing also happens in place and restores the context graph's own path.

`setFocus` currently does `if (next !== state.focused) focusDetailsExpanded = false`, which would collapse the bar the reader is reading from. A focus move needs a way to declare it came from inside the bar; every other caller keeps today's collapse.

Rows come from the same neighborhood set the reducers use at the selected reach of one to five links, filtered by `hidden`. Sort by distance, then alphabetically by title, and show distances beyond the first ring. A shared neighborhood's filter visibility exception follows the newly focused neighborhood on row moves until the reader explicitly edits type, status, or tag filters. Moving focus is not a filter edit.

Connected domains remain a direct-neighbor summary regardless of the selected reach. Derive their members from `graph.neighbors(focused)`, filtered by visibility, rather than the inspection state's multi-hop set. Indirect notes neither add a domain nor increase an existing domain's count.

### Keep in-place identity and state aligned

After replacing a focus URL, refresh navigation and site-search owner Brain scope from the current pathname, as the existing site-search contract requires. Cover pinning from the root graph, moving across Brains, and clearing to the context graph path. No new site-search delta is needed.

Render the workspace graph's Home control even when initially hidden. Show it on Brain and neighborhood paths and hide it at the workspace root on every focus transition, matching a fresh load. Touch help describes the existing gestures: tapping an eligible note opens it; long-pressing pins it or moves focus to it.

At widths up to 400px, let the toolbar wrap inside the space beside navigation while retaining 44px controls. Never hide Help to make room. Anchor Help, Legend, and Brain-lens panels below the toolbar's actual height, and reserve room above filter fields for two rows when Home is present. This also handles the control added when focus changes in place.

The layout session key follows the current neighborhood identity, or the unfocused context graph after clearing. Changing that key must not restore another session's node positions during the transition; retain the live layout and use the new key for subsequent persistence.

Changing the session key while a motion is in flight cancels that motion. It was planned for the old key, with the old neighborhood's camera ids, and its `finish` would commit those positions, bounding box, and camera under whatever key is current by then. `setSessionScope` reports the cancellation, and clearing focus then requests a settle for the graph itself; a focus move fits the new neighborhood as before. The flag is consumed by the next focus change whichever motion follows, so a focus move that interrupted motion cannot leave a later clear re-settling the graph. While the replacement settle is pending, debounced and page-leave commits are suppressed, and leaving the page invalidates the new key's stored session instead of committing half-settled positions and a close-up camera under it; the next mount then settles afresh. A persisted page hide, the browser keeping the page for Back, keeps the pending state instead, and a persisted page show settles the owed scope, since the document returns as it was rather than mounting again. Filter-driven settles reset the flag, since they settle the current key either way.

Keep shipped full workspace `neighborhood:<id>` keys unchanged. For focus originating in a Brain graph, append `:brain:<activeBrainId>:<showRelatedBrains>` using the graph's original context, not the focused note's owner. Related-Brains off, related-Brains on, and the full workspace must not overwrite each other's neighborhood layouts or cameras.

### Fit rendered bounds at the candidate camera

Desktop fits include labels selected at the fitted camera, even if an offscreen pan hid them at the starting camera. Focused fits also include the focused title and its actual rendered plate, on desktop and narrow viewports. Measure candidate-camera label selection, rendered marker radii, text, and plate bounds, then use a bounded number of corrections to contain and centre them within the usable viewport. Do not reuse clipped starting-camera bounds or iterate toward a fixed point that can oscillate as label selection changes.

A required title's plate is fixed in screen pixels once its text is at the minimum legible size; zooming out cannot shrink it further. When that plate is wider or taller than the inset viewport allows, the correction passes must not keep zooming out by their plateau step, which collapsed the graph by an order of magnitude on narrow phones with a long unbroken title. Once a plateau step has not shrunk the plate, text is at its floor and the fixed extent still exceeds the available area; the fit then stops zooming but keeps correcting the centre, so the markers stay inside the insets and the plate overflows evenly rather than pinned to one edge.

Only optional labels need the lock against zooming back into a suppressed selection. Required-title-only fits can correct an outward overshoot; retain the tightest measured contained camera if wrapping prevents convergence within eight corrections. Batch reducer settings and omit provisional all-label WebGL frames during planning so large graphs stay within the existing performance budgets.

Font metrics can make a wrapped title wider after a zoom-out step. Before finding a contained view, backtrack to the geometric midpoint between the last narrower camera and the widened candidate; retain that narrower anchor across consecutive wrapping changes. Keep the eight-correction budget and the existing containment assertions.

### Expose local hover preview

Local connection maps expose Hover preview beside Fit view, and Fit view names its Z key in its tooltip and accessible name as the global control does; the map has no Help surface, so the control is where the key is discovered. The button and D shortcut use one toggle handler, update the pressed state together, and persist through the same preference as the global graph. Hide the button only where hover is unavailable, `(hover: none)` or `(pointer: coarse)`, never by width alone: a mouse in a 600px window still hovers and still needs the control, and the toolbar already wraps below 400px.

Toggling the preference on either graph recomputes label selection at once. Re-applying the pointer updates the transient inspection, but does not report a pointer-node change when the target is unchanged, so the toggle handler schedules the label refresh itself rather than relying on that callback.

### Local labels fade, and layouts are cached within a bound

The note-page connection map runs the same arriving/leaving lifecycle as the global graph: when collision selection changes on zoom or when hover preview begins, ends, or is toggled, arriving titles fade in and leaving ones stay drawn while they fade out, then drop from the reducer. Fit planning measures without fades, as on the global graph. The fade state is keyed by the label canvas context, so the two graphs never share it.

A label that inspection or search styling clears is still on its way out if it was drawn a moment ago. Both graphs keep the last drawn text and layout per label and draw a retiring label from that record until its fade-out finishes, on the final pass only, so it never re-enters the candidate set. A selection change inside another change's fade window keeps the earlier leavers retiring rather than replacing the set with the newest ones; a leaver the new selection takes back fades in from where it is: a reversed fade starts with the complement of the interrupted fade's progress, so the label keeps its current opacity and turns back rather than vanishing or snapping to full first. A fade's clock starts at its first rendered frame, not when the selection pass decides it: on a large graph that pass and its re-index can take longer than the fade, and a clock that ran meanwhile made the fade a jump on slower machines. A title cleared by inspection or search styling stays drawn from the moment it is cleared, since a pointer-driven repaint runs the reducer before the next selection pass marks it leaving. Fade frames are plain renders: only opacity changes between them, and Sigma's refresh, even without indexation, runs the reducer over every node, which on a large graph costs more than a frame and turned a fade into two frames. The reducer runs once per selection change and once more for the nodes whose fade-out has finished. A label that is only fading out is not a pointer or touch target: it is marked as leaving and hit-testing ignores it, so a reader cannot open a note through a title that is disappearing, and a touch landing where such a title was reaches the marker behind it instead. When a fade-out finishes, only the retired nodes are repainted; a full re-index in the middle of a press or pinch is avoided.

Label layouts are cached per rendered size, and only the most recent three sizes are kept. Every settled zoom is a distinct floating-point size, and a cache that keeps them all grows by a graph's worth of layouts at every level a reader ever rests at. Panning and a zoom step back still hit the cache; older sizes are dropped whole because no lookup at a new size can use them.

### Fixtures that can fail

`scripts/generate-stress-vault.mjs` gains sentence-length titles and realistic brain ids. Reference distribution from `tjakobsson/brain-vault`: titles min 7, median 37, max 60 characters; longest brain id `capability-backed-product-engineering` at 37. The fixture should sit at or slightly above that so it stresses rather than merely matches.

Titles must be generated, not copied. `brain-vault` is a personal vault in a separate repository, and this repository's fixtures are public and must stay self-contained.

## Risks / Trade-offs

- Centred labels sit below their node, so they collide with nodes underneath rather than with labels to the right. Collision-based selection will suppress more labels than the grid did in vertically dense layouts. → The reference behaviour accepts exactly this, and the neighbor list carries the text that the canvas drops. Check on the 400-note fixture that detailed zoom still labels a useful number of nodes.
- Four sites compute label geometry and only the renderer is obviously wrong when they disagree. Hit testing and fitting fail silently. → The layout function returns the box; the other three consume it. Cover the function directly in vitest and assert the hit box against the returned box rather than recomputing it in the test.
- `itemSizesReference: "positions"` changes marker size everywhere, including desktop and the demo vault, so every existing screenshot baseline shifts. → Expect broad baseline churn and review it deliberately. Re-take `screenshots/` afterwards and compare against the recorded numbers, not against impressions.
- Scaled label text interacts with label-aware camera fitting, which measures labels to decide the camera, while the camera decides the text size. → Remeasure at candidate camera states and bound the corrections. Include selected labels and the actual focused plate even after an offscreen pan; do not iterate to an oscillating fixed point.
- Recalibrating the stress fixture changes what `npm run test:stress-graph` measures, so its performance budgets may need re-baselining alongside the correctness work. → Re-baseline deliberately and record the new numbers, rather than loosening a budget to make a run pass.

## Open Questions

- The narrow default for the owner preference is off and the wide default is on, chosen to fix the phone without changing desktop appearance. A single default in both directions is defensible; this is easy to overturn once the wrapped labels can be seen.
- The overview reads as confetti partly because four brain accents at full saturation compete at 400 nodes. Node sizing is in scope here and colour weight is not. Whether the accents need a lower-emphasis treatment at overview density is worth looking at once markers are separable, and belongs to `Meaningful visual encoding` rather than to this change.
