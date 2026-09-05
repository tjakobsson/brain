# Overview marker candidates

**Chosen: candidate C.** Kept here as the record of what was compared and why.
`after-01-overview-blob.png` is candidate C retaken under the shot's own name.

Three ways to finish task 3.1/3.2, all on the 400-note realistic workspace at
390x844, `deviceScaleFactor: 2`. Compare each against
`before-01-overview-blob.png`, which measured 1.27 and rendered as one mass of
overlapping colour.

Median nearest-neighbour spacing is 10.87 CSS px in all three: only the marker
size and the edge weight differ.

## candidate-a-markers-reference.png

Marker diameter 1.88 CSS px, ratio **0.173**.

Matches the ~0.15 figure `design.md` recorded from the reference vault. Cluster
structure reads clearly, but the markers are hairlines: the overview reads as an
edge wireframe, and the per-brain accent colour that
`Reader-controlled brain identity in workspace labels` relies on when the owner
prefix is off is not legible at this size.

## candidate-b-markers-larger.png

Marker diameter 3.84 CSS px, ratio **0.353**.

Markers read as individual coloured dots, hubs are visibly larger, and brain
accent is legible at the overview. Above the recorded reference figure. Edges
are left as candidate A has them.

## candidate-c-markers-larger-edges-preserved.png

Marker diameter 3.84 CSS px, ratio **0.353**, plus edges converted back to the
screen thickness they had before this change.

`itemSizesReference` is a renderer-wide setting, so moving node size into graph
space moved *edge* thickness with it, and edges came out heavier than before.
`design.md` lists edge rendering weight as a Non-Goal, so arguably this variant
is the one that actually honours it: the edge reducer asks for the pixel
thickness edges already had and lets sigma's scaling do the arithmetic. The
cross-brain edges return to the weight they have in `before-01`, and the markers
become the figure rather than the ground.
