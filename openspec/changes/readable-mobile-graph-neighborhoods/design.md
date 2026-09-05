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

- Reading a label whose node has been panned off the canvas. Panning back is the answer.
- Changing the force-directed layout itself. Only how it is drawn.
- Changing edge rendering weight or the type and status colour encoding. The overview reads as confetti partly because of colour, but that is a separate judgement about `Meaningful visual encoding` and is not in this change.

## Decisions

### Disqualify the whole touch sequence, not the stray event

Track whether the current touch sequence ever had more than one contact point, and refuse to clear focus for the rest of that sequence. The flag arms on any `touchstart` with `event.touches.length > 1` and disarms only on a `touchend` with `event.touches.length === 0`, or on `touchcancel`.

Also require `event.original.type === "touchstart"` before `downStage` or `downNode` arms `emptyStageTouch` or starts a long press. A `downStage` synthesised from a `touchend` is not a press.

Both guards, not one. The type check alone fixes the observed sequence, but sigma is free to re-emit `downStage` from a `touchstart` in another browser. The sequence flag is the invariant; the type check additionally stops a lift from arming a spurious long-press timer that would pin an unintended node if the reader kept holding.

Rejected: comparing camera state at press and release. That couples tap classification to camera state, and a pinch returning to the same scale would still clear.

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

Replace it with a rule stated in terms of the outcome: do not render a label whose box overlaps an already-rendered label's box, or whose text falls below the legible minimum. Density then decides. A dense overview yields zero labels, matching the reference behaviour. A connection map yields all of them, which the grid rule could not guarantee.

Selection must be stable frame to frame at a fixed camera state, so it needs a deterministic priority order rather than iteration order. Focused note first, then its neighbors, then by descending degree, then by id.

### The owner prefix is a reader preference

Measured, `@capability-backed-product-engineering · ` plus the status marker is roughly 275 of the median label's 537 pixels. More than half of a workspace label is not the title.

`Meaningful visual encoding` requires the inline `@brain` identity only for foreign labels in a per-brain graph. The full workspace graph is required to carry brain identity through accent and legend, which it does without any label text. So the prefix is removable there.

Making it a preference rather than a fixed choice follows the Brain lens: a reader-owned display setting, stored in the reader's own browser per site base, never in a URL. It defaults to off on narrow and on elsewhere, which preserves today's desktop appearance and fixes the phone.

The preference must not reach the per-brain graph, where a rendered foreign label always keeps its identity.

### The neighbor list is a control that moves focus

Rows call the existing `setFocus(node, true)`, which brings camera fitting and URL sync for free, and on a neighborhood page already navigates to the target's own neighborhood page.

`setFocus` currently does `if (next !== state.focused) focusDetailsExpanded = false`, which would collapse the bar the reader is reading from. A focus move needs a way to declare it came from inside the bar; every other caller keeps today's collapse.

Rows come from the same neighbor set the reducers use, filtered by `hidden`, so filters, the lens and the graph context are respected without a second notion of visibility. Alphabetical because scanning for a half-remembered title is what the list is for; exploring is what the canvas is for.

### Fixtures that can fail

`scripts/generate-stress-vault.mjs` gains sentence-length titles and realistic brain ids. Reference distribution from `tjakobsson/brain-vault`: titles min 7, median 37, max 60 characters; longest brain id `capability-backed-product-engineering` at 37. The fixture should sit at or slightly above that so it stresses rather than merely matches.

Titles must be generated, not copied. `brain-vault` is a personal vault in a separate repository, and this repository's fixtures are public and must stay self-contained.

## Risks / Trade-offs

- Centred labels sit below their node, so they collide with nodes underneath rather than with labels to the right. Collision-based selection will suppress more labels than the grid did in vertically dense layouts. → The reference behaviour accepts exactly this, and the neighbor list carries the text that the canvas drops. Check on the 400-note fixture that detailed zoom still labels a useful number of nodes.
- Four sites compute label geometry and only the renderer is obviously wrong when they disagree. Hit testing and fitting fail silently. → The layout function returns the box; the other three consume it. Cover the function directly in vitest and assert the hit box against the returned box rather than recomputing it in the test.
- `itemSizesReference: "positions"` changes marker size everywhere, including desktop and the demo vault, so every existing screenshot baseline shifts. → Expect broad baseline churn and review it deliberately. Re-take `screenshots/` afterwards and compare against the recorded numbers, not against impressions.
- Scaled label text interacts with label-aware camera fitting, which measures labels to decide the camera, while the camera decides the text size. → Break the loop by measuring at the current camera state and accepting one settle iteration, as the existing fit already does. Do not iterate to a fixed point.
- Recalibrating the stress fixture changes what `npm run test:stress-graph` measures, so its performance budgets may need re-baselining alongside the correctness work. → Re-baseline deliberately and record the new numbers, rather than loosening a budget to make a run pass.

## Open Questions

- The narrow default for the owner preference is off and the wide default is on, chosen to fix the phone without changing desktop appearance. A single default in both directions is defensible; this is easy to overturn once the wrapped labels can be seen.
- The overview reads as confetti partly because four brain accents at full saturation compete at 400 nodes. Node sizing is in scope here and colour weight is not. Whether the accents need a lower-emphasis treatment at overview density is worth looking at once markers are separable, and belongs to `Meaningful visual encoding` rather than to this change.
