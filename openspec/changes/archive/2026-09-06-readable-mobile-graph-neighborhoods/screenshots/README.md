# Baseline screenshots

Captured before implementation, so the same shots can be retaken afterwards and compared.

Conditions for every shot: Chromium, 390x844 viewport, `deviceScaleFactor: 2`, `hasTouch`, `isMobile`. Touch gestures are trusted events dispatched through CDP `Input.dispatchTouchEvent`.

Shots 01 and 02 use a generated four-brain workspace of 400 notes, sized and named to match a real published vault rather than the current stress fixture. Titles are sentence-length (min 35, median 56, max 77 characters) and brain ids run to 37 characters, matching `tjakobsson/brain-vault`, where titles measure min 7, median 37, max 60 and the longest brain id is `capability-backed-product-engineering`. The committed fixture from `scripts/generate-stress-vault.mjs` uses `brain-01` and `Generated note 0001`, which is roughly a third of the real label width and cannot reproduce any of this.

Shots 03 to 05 use `examples/demo-vault`, whose smaller node count keeps a single pinned neighborhood legible enough to photograph.

## before-01-overview-blob.png

The fitted overview of the 400-note workspace.

| measurement | value |
| --- | --- |
| camera ratio | 1.000 |
| median node diameter | 15.7 CSS px |
| median nearest-neighbor spacing | 12.3 CSS px |
| diameter / spacing | **1.27** |
| labels rendered | 6 |

Nodes are wider than the gaps between them, so the graph renders as one mass of overlapping color. The eight labels the 180px label grid selects land on top of each other. The reference screenshot at comparable node count measures roughly 0.15 for the same ratio.

**After**: node size expressed in graph space, so diameter over spacing stays roughly constant as a vault grows. Individual dots separated at the overview. No labels rendered here at all, because none can be placed without colliding.

## before-02-detailed-zoom-labels.png

The same workspace at camera ratio 0.12.

| measurement | value |
| --- | --- |
| median node diameter | 45.2 CSS px |
| median nearest-neighbor spacing | 102.6 CSS px |
| label font size | 13 px, unchanged from the overview |
| **median label width** | **537 CSS px** |
| **widest label** | **713 CSS px** |
| viewport width | 390 CSS px |
| labels rendered | 40 |

The median label is 1.4 times the width of the phone it is being drawn on, and the widest is 1.8 times. Not one label in this frame is readable end to end. A single line can never fit a real title at this viewport, whatever the node position.

Two things make it that wide. Titles are sentences, and in workspace mode every label is prefixed with its owner, so the status marker plus `@capability-backed-product-engineering · ` spends roughly 275 of the median label's 537 pixels. More than half of a workspace label is not the title.

The relationship is also inverted. Zooming in grows node markers by `1 / sqrt(ratio)` while label text stays at a fixed 13px, so markers become balloons beside text that never gets easier to read.

**After**: labels centered below their node, wrapping to at most three lines, with font size scaling by the same `sqrt(ratio)` law that already governs marker size. A 537px label wraps to roughly 179px per line, which fits a 390px viewport with room on both sides. Zooming in makes text bigger, not just further apart. The owner prefix becomes a reader preference, off by default on narrow, which removes roughly half the width before wrapping starts.

## after-01-overview-blob.png

Task 3.4. The same shot on the 400-note realistic workspace after node sizing
moved into graph space.

| measurement | before | after |
| --- | --- | --- |
| camera ratio | 1.000 | 1.120 |
| median node diameter | 15.7 CSS px | **3.51 CSS px** |
| median nearest-neighbor spacing | 12.3 CSS px | 10.87 CSS px |
| **diameter / spacing** | **1.27** | **0.322** |
| rendered label size | 13 px | 10.4 px |
| labels rendered | 6 | 9 |

Markers are separable: a 7 CSS pixel gap between neighbours where there used to
be a 3 pixel overlap. Cluster structure and the cross-brain links are readable
for the first time, and each brain's accent colour is legible per node.

Two notes on how the number was chosen. The reference vault measures roughly
0.15, and that ratio does separate the markers, but at this node count and
viewport it draws them at 1.9 CSS pixels, where the accent colour stops being
legible and the overview reads as an edge wireframe. Both were photographed
before choosing; see `CANDIDATES.md`.

Edges also changed, which was not in the original plan. At 400 notes the edge
mesh was dark enough that a canvas label could not be read against it, so every
edge became thinner and lighter: default edge grey lightened in both colour
schemes, cross-brain accent softened from `#d97706` to `#e0a75a`, and sizes cut
from 1/2.4/0.75 to 0.42/0.9/0.32. Sigma's `minEdgeThickness` drops to 0.5 so a
sub-pixel edge at overview density still renders as a line rather than
vanishing. The graph legend's swatches follow the canvas.

Those sizes are graph-space units, like node size. An intermediate version
pinned edges to a fixed pixel thickness, on the reasoning that edge weight was
out of scope; that turned out to be the same mistake this change exists to fix,
one axis over. Markers and text grew with the camera while edges stayed
hairlines, so zooming in to inspect a neighbourhood left the reader unable to
tell which notes were connected. Everything in the picture now scales together.

## after-02-detailed-zoom-labels.png

Task 4.2 and 5.2. The same workspace zoomed to camera ratio 0.079, close to the
0.12 the baseline was shot at.

| measurement | before | after |
| --- | --- | --- |
| median node diameter | 45.2 CSS px | 10.6 CSS px |
| median nearest-neighbor spacing | 102.6 CSS px | 154.4 CSS px |
| label font size | 13 px, unchanged from the overview | **12 px, up from 10.4** |
| **median label line** | 537 CSS px | **238 CSS px** |
| **widest label line** | 713 CSS px | **256 CSS px** |
| viewport width | 390 CSS px | 390 CSS px |
| labels rendered | 40 | 3 |

Every rendered line now fits the phone with room on both sides, where before not
one label in the frame was readable end to end. Three things did that: centring
the label under its node instead of running it to the right, wrapping onto up to
three lines, and dropping the owner prefix, which on a phone was spending more
than half the label on something the accent and legend already say.

Text also grew with the camera, 10.4 px at the fitted overview to 12 px here, so
zooming in makes a title bigger rather than only pushing nodes apart. The range
is deliberately narrow, and sits below body copy rather than beside it. The
site's own body text is 12 to 14 px, and successive attempts at a 22 px, a 17 px
and a 13 px ceiling were each legible but loud: a zoomed-in graph became a wall
of text. Most of what makes zooming useful is
collision selection letting more titles through as the nodes separate, not any
one title getting larger.

## after-03-pinned-neighbors.png

Task 6.4 and 8.x context. A long press pins "Maps of content" on the demo vault;
the shot is taken from the equivalent `?focus=` URL for reproducibility.

| measurement | before | after |
| --- | --- | --- |
| neighbors labelled | **0 of 7** | **7 of 7** |
| labels rendered | 9 | 8 |
| median node diameter | not recorded | 16.4 CSS px |
| median nearest-neighbor spacing | not recorded | 68.6 CSS px |
| diameter / spacing | not recorded | 0.239 |

The neighborhood emphasis was already working: the focused note and its
neighbors stay at full colour while the rest of the vault fades. What changed is
that the neighbors are now readable. Before, `narrowFocusedLabelDecision` blanked
any neighbor label that did not already fit, so nine labels rendered across the
canvas and not one of them belonged to the neighborhood. Now every one of the
seven neighbors is labelled, plus the focused note.

The note has degree 11 but seven distinct neighbors: the vault links some pairs
more than once.

Markers needed a ceiling as well as a floor. Graph-space sizing holds diameter
to a constant fraction of the gap between nodes, which is what makes a small
vault and a large one look alike, but a sparse or closely framed graph puts a
lot of pixels into that gap and a constant fraction of a large gap is a blob.
This vault rendered at 27.7 CSS px per marker before the ceiling. Clipping at a
maximum would have flattened the connectivity encoding outright, because on a
22-note vault every marker sits above any sensible maximum, so rendered radius
eases towards 20 px instead: 11.5-16.3 px became 7.3-9.0 px, still ordered by
degree, and the 400-note overview barely moved.

One thing is still visibly imperfect and is recorded rather than hidden.
"Retrieval cues beat filing" runs across a marker, because collision selection
only avoids label-on-label overlap; `design.md` predicts this in its Risks
section.

## after-desktop-*.png

The same three shots at 1440x900, `deviceScaleFactor: 2`. Desktop is not a
second design: the same law produces both, and only the inputs differ. Rendered
label size is identical at an identical camera state (10.4 px at the fitted
overview on both), and marker diameter differs only because a wider viewport
puts more pixels between the same nodes.

| shot | markers | diameter | spacing | labels |
| --- | --- | --- | --- | --- |
| phone-01 / desktop-01 | 400 | 3.5 / 7.1 px | 10.9 / 25.2 px | 1 / 1 |
| phone-03 / desktop-03 | 22 | 16.4 / 24.3 px | 68.6 / 172.6 px | 6 / 8 |

The one real difference is the owner prefix, which defaults on for wide
viewports and off for narrow, so a workspace label carries `@brain` on desktop
and not on a phone.

Capturing these found three bugs that the phone shots had hidden.

**Suppressed labels at the fitted camera.** A focus fit installs a custom
bounding box, and the normalized coordinates in sigma's cached display data go
stale against it until the next indexation. Reading a node's position from there
put it thousands of pixels off screen, which collapsed its label width budget to
zero and silently dropped every label on the graph. Positions now come from
graph coordinates through `graphToViewport`, which reads the current camera
directly.

**A miscounted label stat.** Sigma adds a node to `getNodeDisplayedLabels()`
before it checks whether the label has any text, so every label collision
selection suppressed still counted as displayed. `data-rendered-labels` read 36
where one title was painted. It now counts only labels that carry text, which
also matters because the browser assertions measure it.

**Labels laid over the graph.** Avoiding only other labels satisfied the letter
of the collision rule while still blanketing a dense overview with 22 titles
printed across the markers, which is the unreadable outcome the rule exists to
prevent. Markers are obstacles now too, so a label has to land in clear space.
The 400-note overview went from 22 labels to 1, which is the reference
behaviour, and the sparse connection map still labels every node.

## after-06-cross-brain-neighborhood.png, after-desktop-06-...

Shot 06 and shot 07 are the same page in the same state. 06 has the focused
bar collapsed, so the canvas is what you see; 07 has it expanded, so the bar is.
They are a pair rather than two versions of one thing: 57 px against 302 px.


Shots 01 to 05 could not show a cross-brain link: 03 to 05 use the demo vault,
which has no brains at all, and 01 and 02 are unfocused. This pins a note in the
400-note workspace that links out to two other Brains.

| measurement | phone | desktop |
| --- | --- | --- |
| neighborhood size | 13 | 13 |
| labels rendered | 1 | 9 |
| median node diameter | 11.0 CSS px | 18.3 CSS px |

Cross-brain links read as thin orange lines out to a differently accented node,
and the owner prefix appears on desktop and not on the phone, which is the
preference default working. Desktop labels each carry `@brain · Title`.

Edges needed a ceiling for the same reason markers did, and this shot is what
showed it. Graph-space thickness scales with the camera, which is what makes a
link legible when a reader zooms in, but a closely framed neighborhood puts a
lot of pixels into a graph unit and the links to the focused note rendered as
bars. `easedEdgeSize` applies the marker curve with a much lower ceiling, 2 CSS
px, because edges are the connective tissue of the picture and not its subject.
A cross-brain link stays the heavier of the two at every framing.

Two things this shot records rather than hides. On the phone one label renders
for a thirteen-neighbor note, and it is a neighbor's rather than the focused
note's: priority orders which labels are attempted, not which can be placed, and
a note surrounded by neighbors has no clear space beneath it. The focused note
stays identifiable by its ring and its title is complete in the bar, which is
what the spec asks, but reading the neighborhood off the canvas is not possible
here. That is the case the connected-neighbors list exists for.

And the focused-neighborhood bar overlaps the About control on a narrow viewport
once the focused title is long enough to push the bar to its full width. That
looks pre-existing rather than caused by this change, and it is not covered by
any task in it.

## after-desktop-07-hover-while-pinned.png, after-07-focus-bar-narrow.png

Three fixes that came out of reviewing the cross-brain shots.

**Pointing at a node reveals its title, even while a neighborhood is pinned.**
Inspection is frozen while a pin is active so a drifting pointer cannot disturb
it, which was decided when every neighbor carried a label. Now that collision
selection can omit some, freezing inspection also left a reader unable to
identify what they were pointing at: measured on a thirteen-neighbor note with
four unlabelled, hovering one changed nothing at all on any canvas. The pointer
target is now tracked separately from inspection state, so the node under the
cursor always shows its title while the pin's emphasis stays exactly as it was.

**Connected domains appear wherever a workspace graph takes focus.** The chips
were gated to note-owned neighborhood pages, so the workspace graph could focus
a note that reached into three Brains and say nothing about them. Which Brains a
neighborhood reaches into is the same question on either surface.

**The About action gives way to the focus bar on narrow.** The bar takes the
full width there, so About sat on top of it and swallowed the Open control. It
hides while focus is active and returns when focus is cleared.

**The bar became one segmented control, and the details became an overlay.**
It was a pill containing pills: a stadium wrapping a title, an `Open` pill and a
`•••` pill, each with its own border and radius. The control cluster at the top
of the graph has never done that, and next to it the bar read as a different
system. It is now a single stadium with flush segments divided by a hairline,
the title as plain text in the first segment, exactly as the cluster is built.
The `•••` became a chevron that points at where the panel opens and turns over
once it is open, so the control says which way it goes.

Expanding no longer grows the bar downward into a panel. The details open above
it and join it: one card, with only its outer corners rounded.

Joining them is what removed the last duplication. As a separate floating panel
it had to name the note it was about, and the bar underneath was naming the same
note at the same time, so the title appeared twice on one screen. Now the title
stays exactly where it was in the collapsed bar and simply stops truncating, so
expanding reveals the rest of it in place. The complete title is still available
when expanded, which is what the compact-bar requirement asks for, but it is one
title rather than a truncated one and a full one.

The title deliberately stays at the bottom of the card rather than moving to the
top of it. Expanding then adds without rearranging: nothing the reader was
already looking at moves.

| | before | after |
| --- | --- | --- |
| collapsed | 57 px | **48 px** |
| expanded, bar | ~420 px, half the screen | **48 px** |
| expanded, card | included above | **306 px**, one joined surface |

The domain chips were sized to their own text, so three Brains of three
different name lengths gave three different widths and a ragged trailing edge
that read as scattered rather than as a list. They are one column now, each the
full width of the panel, with the Brain mark and title on the leading edge and
the count pinned to the trailing one. They keep their accent borders: with the
owner prefix off on narrow, that border is one of the ways a Brain stays
identifiable, so the chips are deliberately excluded from the rule that gives
the panel's action pills their neutral border and fill.

A first pass at density shrank the panel's text instead, reaching 269 px. That
was the wrong lever: a Brain name worth showing is worth reading. The text is
back at 0.8rem and a name that does not fit wraps inside its chip, which costs
20 px on this neighborhood and nothing at all on the two Brains whose names fit
one line. Density came from padding, gaps and the wasted second copy of the
title, not from type size.

Setting the title segment to `display: flex` cost the space between "Focused:"
and the title, and the ellipsis with it, because flex drops whitespace between
items. It is a grid item aligned to centre instead.

**An earlier pass on the same bar.** It stacked full-width blocks
and printed the focused title twice, once truncated in the summary row and once
in full below it, and took roughly half the screen. The title now appears once:
the summary line stops truncating when the bar expands, which is where the
complete title requirement is met, so the separate full-title paragraph goes
away. Actions and domain chips flow as wrapping pills in the same language as
the graph's other controls.

| | before | after |
| --- | --- | --- |
| collapsed | 57 px | 57 px |
| expanded | ~420 px, 50% of a 844 px screen | **302 px, 36%** |

Touch targets stay at 44 px. An intermediate version cut them to 40 to save
height, which the compact-bar requirement does not allow, and that is the floor
on how short this can get: three Brains at 44 px plus a label is most of what
remains. Collapsing connected domains behind their own disclosure would buy
another 180 px if it is wanted.

**A focused note now always keeps its canvas label.** It used to go through
collision selection like any other, so the note the reader had explicitly asked
about could be the one left unnamed while a neighbour was labelled: measured on
the cross-brain neighborhood, the focused note had no label and a neighbour did.
The focused note and the node under the pointer are now placed first and
unconditionally, and every other label routes around them.

## after-08-zoomed-neighbour-link.png

The focused note and a neighbour framed together, zoomed until the link between
them is 308 CSS px long, at camera ratio 0.388.

| measurement | value |
| --- | --- |
| median node diameter | 15.6 CSS px |
| rendered label size | 12 px |
| labels rendered | 8 |

This is what "zoom in to read it" is supposed to mean. The links read as links,
neighbours carry their titles, and the cross-brain link is still legible as the
orange one. Two labels are clipped by an edge of the frame, both belonging to
nodes that are themselves only partly visible, which is what the containment
promise excludes.

## Rounded corners

The graph's floating controls were three different shapes. The control cluster,
the About action, the Brain chips and the nav pills are all fully rounded, while
the focused-neighborhood bar was a 10 px rounded rectangle, its buttons were
6 px, and the plate behind a canvas label was an 8 px box. Sitting over the same
canvas, they read as three unrelated systems.

They are one family now, and the canvas plate carries a little margin of its own:
7 px around the label, and more than that at the sides, because a stadium curves
in at its ends and text set against that curve reads as cramped even when the
straight-line gap is even. It is derived from the plate's height rather than
fixed, so a one-line label and a three-line one are both clear of it.
 The collapsed bar is a stadium like the control
cluster; expanded it keeps a 22 px radius, because a stadium that tall bows its
sides. Its buttons are pills. The canvas plate behind a focused or hovered
label is fully rounded, which is visible on the focused note in shot 08. The
context menu keeps its 6 px corners on purpose: it is a menu, not a floating
control.

## Keeping the set consistent

Every `after-*` shot comes from one script, `.generated/readable-graph-screenshots.mjs`,
run once per viewport profile:

```
node .generated/readable-graph-screenshots.mjs            # 390x844, dsf 2, touch
PROFILE=desktop node .generated/readable-graph-screenshots.mjs   # 1440x900, dsf 2
```

Both profiles produce shots 01, 02, 03, 06, 07, 08 and 09 from the same code
path, so a rendering change cannot leave half the record describing an older
build. Several shots did go stale during this change, more than once, and each
time the fix was to re-shoot rather than reason about what had moved.

| shot | what it is for |
| --- | --- |
| 01 | the fitted overview, marker density |
| 02 | detailed zoom, label wrapping and size |
| 03 | a pinned neighborhood on the demo vault |
| 06 | a pinned neighborhood with cross-brain links |
| 07 | the focused bar expanded |
| 08 | a neighbour link at reading distance |
| 09 | the focused bar collapsed |

## Which Brain the focused note is in

Turning the owner prefix off on narrow removed `@brain` from the canvas, and
nothing put it back. The focus bar named the note and not its Brain, and the
connected-domain chips listed three Brains without saying which one the note
lived in. The counts hinted at it, eleven against one and one, but that is
inference rather than an answer.

That is a requirement, not a preference. `Reader-controlled brain identity in
workspace labels` says that with the preference off, brain identity must remain
available through node accent, the graph legend, **and the focused-neighborhood
bar**. The bar was the part that had quietly stopped holding up its end.

The chip for the note's own Brain now carries its accent at full strength with a
heavier border, and says "· this note" in words rather than relying on the
colour alone. The other Brains in the list are the ones its neighbours reach
into, which is a different relationship and now looks like one.

## Reaching for the context menu

Right-clicking a node opened a menu about that node and emphasized it, and then
moving the pointer towards the menu took the emphasis away, because leaving the
node cleared the transient inspection. The menu was left naming a node the
reader could no longer pick out, which on a 400-node overview is most of the
information gone.

The pointer now stops changing what is inspected while the menu is open. Opening
the menu also emphasizes its node up front rather than relying on the hover that
happened to precede it, so the menu and the emphasis always agree. Closing the
menu releases the hold and the pointer resumes.

Traced through the sequence, the inspected node is the same at every step:
hovering it, opening the menu on it, and with the pointer arrived at the menu.

## Connected notes

Shot 07. The focused note's directly connected neighbours, as text rows.

On the phone this is what makes a neighbourhood legible at all. Shot 06 is the
same note at the same moment: thirteen neighbours, and the canvas places two
labels, because collision selection will not lay text over markers. The list
carries the other eleven. Titles are complete and wrap rather than truncate,
ordered alphabetically because scanning for a half-remembered title is what a
list is for, and uncapped because a hub is exactly when a reader needs them all.
The panel scrolls at 384 px rather than the list being cut short.

A row moves focus and the panel stays open, refilling with the new note's
neighbours; on a note-owned neighbourhood page, where focus identity is the page
itself, a row navigates to that neighbour's own page instead.

Connected domains comes first and connected notes second. Domains is a
three-chip summary and the note list is long, so the other order buried the
summary under thirteen rows.

## Label layout resolves when the camera stops

Reported as the pinch gesture feeling wrong, and measurable: on the 400-note
workspace at 390x844, the median frame gap while zooming was 36ms against 10ms
at rest, with a 95th percentile of 54ms. Under a third of the frame budget was
left for the gesture itself.

Both passes of `applyReducers` need a full re-index, because sigma runs a node
reducer only while indexing, and laying a label out measures text for every
candidate. Doing that twice on every frame of a pinch is the cost. It is not
avoidable per frame, so it stopped happening per frame: label layout and
selection now resolve 120ms after the camera stops moving.

| measurement, zooming a 400-note graph | before | after |
| --- | --- | --- |
| median frame gap | 36.5 ms | **11.1 ms** |
| 95th percentile | 53.7 ms | 27.2 ms |
| worst frame | 67 ms | 35.4 ms |
| frames drawn in the same span | 78 | 129 |

Nothing is stale that a reader could read: labels are drawn from node positions,
so they track their nodes through the whole gesture. Only their wrapping and
which of them are placed waits for the camera to settle, and mid-pinch is not
when a title is being read.

## Labels fade, and keep their shape

Two changes, both about a graph feeling steady under a reader's hand.

**A label's width no longer depends on where its node is.** The budget used to
be twice the node's distance from the nearer edge, which guaranteed nothing was
ever clipped but meant the same title wrapped differently depending on where it
sat: dragging the graph reflowed labels continuously, and a label near an edge
collapsed into a narrow stack of short lines. The budget is now the same
everywhere and a label near an edge is simply clipped by it. That trades the
containment promise for a label that holds its shape while you move the graph,
which is what makes a map feel steady under a drag.

**Labels fade in and out.** Selection resolves in steps as the camera settles,
and a step that swaps several titles at once read as a flicker. Arriving titles
now ramp up over 220ms and leaving ones ramp down, so the same change reads as
the graph resolving. Fading is driven by a redraw that skips re-indexing, since
nothing about the graph has changed except how opaque some text is, and a label
on its way out keeps being drawn until it has finished leaving.

## Arriving on a neighborhood already focused

Reported as motion sickness: following a neighborhood link zoomed out and then
back in rather than simply arriving. An earlier note here claimed this fixed
on the strength of camera ratios sampled per frame. That measurement was
wrong in kind, not degree: sigma's camera ratio is relative to the bounding
box the camera is framed in, and a focus fit changes that box, so a ratio
trace across a fit compares numbers in different units. What follows replaces
it, measured in screen pixels per graph unit, which is the zoom a reader sees
whatever the framing.

Two things were happening.

**Every move on a neighborhood page was a page load.** A neighborhood page
sent a focus move to `window.location.assign`, so tapping a neighbor row
opened a new page, which painted the whole graph at its default camera and
then ran the arrival settle. The graph page, by contrast, moved focus in
place with one animated fit. That is why the reported flow was specific to
"after reading a note and coming back": the note's Graph action lands on a
neighborhood page, and from then on every move reloaded.

| move focus from a neighbor row | zoom path, px per graph unit | reversals | page loads |
| --- | --- | --- | --- |
| graph page, before and after | 2.08 → 16.38, monotone | 0 | 0 |
| neighborhood page, before | 12.59 → 1.5 (whole graph) → drift toward the new fit over 900 ms | 1 | 1 |
| neighborhood page, after | 12.59 → 1.89, monotone | **0** | **0** |

Moves now happen in place on a neighborhood page too, and the address is
replaced with the new note's neighborhood path, so it is still the string
Copy link produces.

Which raised the better question: why was a note's path a different kind of
page at all? It never was, technically. It is the same `GlobalGraph`
component generated at the note's path with the note focused, because a
static site needs a file at every shareable address. The behavioural
differences were added on the premise that "the pathname is the focus, so it
cannot be cleared here", and that premise stopped holding the moment the
graph page began rewriting its own pathname to the neighborhood path when
focused and back on clear. So the distinction is gone: one "Clear focus"
everywhere, clearing in place with the address following, and no
`neighborhoodPage` branch left in the view. The only trace is a cache key, so
a note path's close-up is never restored as the graph page's saved camera.

**Arrival painted the whole graph first.** A page opening already focused
rendered the default camera and then fitted. The fit now runs before the
first frame is painted. Read directly from the renderer on the dev build,
which exposes it, sampling every animation frame from the first script on the
page:

| cold neighborhood page | first frame with a camera | later frames |
| --- | --- | --- |
| a hub with 13 neighbors | 2.08 px/unit, the fitted value | unchanged |
| a median note | 13.22 px/unit, the fitted value | unchanged |

No frame shows the whole graph, and nothing zooms after the first one.

## One way out of a focused view

There were three names for one idea. The bar said "Clear" on a graph page and
"Whole graph" on a neighborhood page, and the context menu said "Clear focus"
and hid itself on exactly the pages where the bar showed something. The bar and
the menu now offer the same action under the same name in both places: "Clear
focus" where focus can be cleared in place, and "Whole graph" on a neighborhood
page, where the pathname is the focus and leaving it means going somewhere.

## The pinch that tilted the graph

Reported as a pinch that jumps. Measured on the 400-note fixture at 390x844
with trusted CDP touch events, by fitting the similarity transform that maps
the graph's drawn markers before a gesture onto the same markers after it. The
fit gives three numbers a reader would recognise: how much the graph grew, how
far it turned, and whether what sat between the two contacts stayed there.

| gesture | | zoom | tilt | anchor slip |
| --- | --- | --- | --- | --- |
| even spread | before | 1.82x | 0 deg | 0 px |
| | after | 1.82x | 0 deg | 0 px |
| spread with a 12 degree twist | before | 1.82x | **12.09 deg** | 0 px |
| | after | 1.82x | **0 deg** | 0 px |
| twist alone, contacts kept the same distance apart | before | 1.00x | **14.80 deg** | 0 px |
| | after | 1.00x | **0 deg** | 0 px |
| thumb still, one finger travels | before | 1.82x | 0 deg | 0 px |
| | after | 1.82x | 0 deg | 0 px |

The zoom was never the problem, and neither was the anchor: a two-contact
similarity that matches both contacts matches their midpoint too, so the graph
was always scaling around the right place. What sigma also did was read the
angle between the contacts as a camera rotation, one degree of graph tilt per
degree of twist. A hand makes a pinch by rotating two fingers around a knuckle,
so every pinch turned the graph a little, under labels that stay level, and the
tilt stayed until some later fit set the angle back to zero and snapped it
upright. That snap is the jump.

The camera no longer rotates at all, and the gesture is driven from
`pinchCameraState` rather than sigma's own: it holds the midpoint of the two
contacts, which is symmetric between the fingers, and never turns. Turning two
fingers without moving them apart is now not a gesture. The zoom figures are
identical before and after, so the gesture feels the same in the one dimension
it was already right in.

## Clearing focus from the bar

Reported as needlessly hard to reach: on a phone, Clear focus lived in the
panel behind the disclosure, so leaving a focused view took a tap to open the
panel and a second tap to find the button in it. It is now a segment of the
collapsed bar itself, beside Open, a 44 px icon on the compact bar and a text
button on wide layouts. One tap from anywhere focus exists.

## One label on an overview

Reported from the phone: zoomed out to the whole brain, a single title sat
under one node at the bottom and made the overview look unbalanced. That one
label was a peripheral hub with empty space under it. It fit because of where
it sat, not because the graph was legible there, and one caption on a clean
overview reads as an accident where three read as intent.

Unrelated labels are now drawn only in company: at least three placed
together, or a quarter of what could carry a label on a graph too small for
three, so the one label a four-node map can fit is still drawn.
The inspected neighborhood is exempt, since the reader asked for it.

Measured on the 400-note fixture at 390x844 with CDP-synthesized touch
pinches and no pointer anywhere near the canvas, because a pointer hovering
the node under the wheel had contaminated an earlier reading of this table:

| camera ratio | median marker radius | nodes whose label could be laid out | labels rendered |
| --- | --- | --- | --- |
| 1.12 (fitted overview) | 1.8 px | few | **0** (was 1) |
| 0.53 | 2.5 px | 371 | **0**: the one or two that fit are not drawn alone |
| 0.25 | 3.4 px | 130 | 12 |
| 0.12 | 4.5 px | 27 | 12 |
| 0.06 | 6.0 px | 8 | 8 |

The 30-note demo vault still labels 13 of 22 at its fitted phone overview and
all 22 on desktop, because there the company is real.

Chasing this also showed that label selection was not re-run when a hover
ended: leaving a node left its neighborhood's labels standing and every other
label hidden until the next camera move. Selection now follows the hover out
as well as in.

## The fit that sat off centre

Reported from the phone after pressing Fit view: the whole graph sat low and
to the left, and smaller than it needed to be. Measured by reading marker
bounds after Fit view at 390x844 on the 400-note fixture:

| | marker span | centre | size |
| --- | --- | --- | --- |
| before | x 52–290, y 198–694 | (171, 446) of (195, 422) | 238 x 497 |
| after | x 28–362, y 74–774 | **(195, 424)** | **334 x 699** |

Two causes. The insets: the navigation button, which sits inside the band
already excluded for the toolbar, was charged again as a 72 px band down the
right edge, and About was not counted at the bottom at all, so the usable
area was 24 px off centre both ways. And the size: the fit only ever zoomed
out, so a tall graph on a tall phone stopped at whatever size it started and
left a third of the height empty, which is what made the asymmetric insets
visible. Corner controls inside an excluded band now cost nothing more, About
counts at the bottom, and a fit zooms in to fill the room it has as readily
as it zooms out to make things fit.

## The focused title cut at the edge

Reported straight after the fill: with a hub pinned whose neighbors reach far
down the graph, the focus fit fills the height, the focused note lands near
the left edge, and its centred title and plate run off the screen. Labels
clip at the edge by design when a reader pans, and a marker-only fit is what
keeps long titles from shrinking the composition, but the focused note's own
title is the one label a fit exists to show. It now counts towards the fit's
bounds, plate included; other neighborhood titles still do not.

## Hover that lights up the room

Reported from the desktop: hovering a node lit up its whole neighborhood, and
since a pointer crosses many nodes on its way anywhere, the graph flickered
under the hand. That behavior is now a preference, hover preview, off by
default on a fine pointer. Off, a hover still gives the pointer and the
node's own title; on, it dims the rest and reveals the neighbors' titles as
before. A control in the graph's pill toggles it and shows its state, D
toggles it from the keyboard, and the choice is remembered per site base. F
pins the note under the pointer, moves the pin to it, or lifts the pin when
it is already the pinned note. Touch long press, search and the context menu
pin exactly as they did. C clears the pin and Z fits the view, the same acts
as the two controls.

Hovering also now shows the title of whatever the pointer is over, dimmed
notes excepted. The renderer only drew its plate when the pointer sat on the
marker by its own hit test, and on a dense graph with two-pixel markers that
almost never happened, while the graph's wider hit area was already saying
"you are on this note". The plate follows the pointer node instead, and only
the two nodes concerned are repainted, so a hover costs no re-index.

Keys nobody can find are keys nobody uses. The context menu shows F, C and Z
beside the actions they duplicate, Fit view's tooltip says "(Z)", and a Help
control in the pill opens a short guide: keys on a keyboard layout, touch
gestures on a phone, where the key list is hidden rather than left to
describe a keyboard the reader does not have.

The keys 1 to 5 set how far a lit neighborhood reaches, for a hover preview
and for a pin alike. The walk is breadth-first, so a note reachable two ways
keeps its shorter distance; edges stay lit only between successive rings, so
a reach of three reads as paths outward rather than a tangle; the bar lists
every lit note, nearer rings first, with "2 links away" and so on beyond the
first; and pressing a number while pinned re-lights and refits at once.

## Retaking these

Task 9.4 retakes all five under the same conditions and saves them as `after-*.png` beside the baselines, with the new measurements recorded next to the old ones in this file. The scripts that produced them are reproducible from the conditions above: 390x844, `deviceScaleFactor: 2`, `hasTouch`, `isMobile`, trusted CDP touch events, and a generated four-brain workspace matching the title and brain-id distribution described at the top.

## before-03-pinned-neighbors-unlabelled.png

A long press pins "Maps of content", degree 11, on the demo vault.

Nine labels render across the whole canvas, but of the eleven direct neighbors, none is labelled. `narrowFocusedLabelDecision` blanks any neighbor label that does not already fit, and the focused label itself is shortened to a width budget. The focus bar names the focused note and nothing else.

**After**: the neighbors are readable. On the canvas because labels wrap and fit, and as text in the focus bar's connected-neighbors list.

## before-04-pinch-dropped-the-pin.png

Same pin, then a two-finger pinch to zoom.

| | before pinch | after pinch |
| --- | --- | --- |
| `data-focused-inspection` | present | **absent** |
| focus query | `?focus=default%2Fmaps-of-content` | none |
| camera ratio | 1.441 | 0.379 |

The camera zoomed and the pin vanished. Sigma re-emits `downStage` with `original.type === "touchend"` when the pinch drops to one contact point; the handler records that as a press on empty canvas and the following `touchup` clears focus. Note also that "Retrieval cues" and "stop helping" are both cut off by the canvas edges.

**After**: pinned, panned and zoomed all leave the pin in place. Only a single-contact tap on empty canvas clears it.

## before-05-zoomed-labels-clipped.png

The pin held while the camera is driven to ratio 0.6 in code, showing what a working pinch would give you today.

Twelve labels render, and four of the five neighbor labels visible in frame are cut off: "Retrieval cues beat", "Improv", "ty and trust", "uilding a Second Brain". Fixing the pinch alone would deliver this.

**After**: no rendered label is cut off by a canvas edge, because centering below the node halves the horizontal reach and wrapping cuts it again.

## Stress budgets after recalibrating the fixture

Task 1.3. Measured against the recalibrated `scripts/generate-stress-vault.mjs`,
whose titles now run min 39, median 61, max 79 characters and whose longest
brain id is `engineering-practice-and-delivery-systems` at 41. The reference
vault measures min 7, median 37, max 60 and 37, so the fixture sits slightly
above it, which is what it is for.

One budget moved. `graph-data.json` for the 2,000-note workspace grew from
1,345,085 to 2,710,042 bytes, because a title and an owner id are most of what a
graph node carries. The ceiling in `scripts/stress-build.test.ts` rose from
2 MiB to 3 MiB, which keeps roughly 14% headroom. It was raised to the measured
size plus margin, not to whatever made the run pass.

Every timing budget in `npm run test:stress-graph` held unchanged:

| measurement | demo workspace | 2,000-note workspace | budget |
| --- | --- | --- | --- |
| motion | 958 ms | 1,169 ms | < 2,500 ms |
| filter | 69 ms | 137 ms | < 500 ms |
| search | 22 ms | 89 ms | < 500 ms |
| max frame gap | 27 ms | 332 ms | < 500 ms |
| max long task | 0 ms | 311 ms | < 500 ms |

These were the fixture-only numbers, taken before the rendering work in sections
3 to 6.

## Stress budgets after the rendering work

Task 9.3. Re-measured with marker sizing, label layout, camera-scaled text and
collision selection all in place. Two consecutive runs, so these are the shape
of the cost rather than one sample.

| measurement | before this change | after | budget |
| --- | --- | --- | --- |
| motion | 1,169 ms | 1,680 / 1,665 ms | < 2,500 ms |
| filter | 137 ms | 207 / 204 ms | < 500 ms |
| search | 89 ms | 156 / 159 ms | < 500 ms |
| max frame gap | 332 ms | 400 / 395 ms | < 500 ms |
| max long task | 311 ms | 370 / 366 ms | < 500 ms |

Every budget holds, and none was loosened. The cost is real though: laying out
and selecting labels runs the node reducer twice per refresh and measures text
for every candidate, which at 2,000 nodes shows up in all five numbers. The
budget with the least room left is the frame gap, at 400 ms against 500, where
before it was 332. That is the one to watch if the fixture grows again, and the
first place to look would be the two-pass refresh: the layout pass exists only
to discover the boxes collision selection needs.
