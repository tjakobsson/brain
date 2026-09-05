## MODIFIED Requirements

### Requirement: Progressive mobile graph labels
Global and note-page local graphs SHALL select canvas labels by legibility rather than by a fixed density grid. A label MUST NOT be rendered when its rendered box would overlap another rendered label's box, or when its text would render below the minimum legible size. Selection MUST be recomputed as the camera changes, so zooming in reveals labels that were suppressed and zooming out suppresses them again, without moving nodes or changing node visibility. Where several labels compete for the same space, selection MUST be stable across frames at an unchanged camera state rather than flickering between candidates. A label outside the inspected neighborhood MUST NOT be rendered on its own or in a pair: such labels are rendered only when at least three can be placed, or at least a quarter of the nodes that could carry a label when that is fewer, so a zoomed-out graph is either legibly labelled or clean rather than captioned at one peripheral node. Labels of the focused or hovered neighborhood are exempt, as are the labels of foreign notes in a per-Brain graph, which exist to name the Brain they belong to. A note-page local graph MUST determine its own selection from its own camera state so behavior stays consistent across neighborhood topology and connection-map dimensions.

Label collision checks MUST also exclude overlaps with other visible node markers, using their rendered sizes at the current camera state rather than raw graph-space sizes. Local label selection MUST refresh when hover preview ends or is toggled, without waiting for a camera change.

#### Scenario: Read a dense overview on a phone
- **WHEN** a reader opens the fitted overview of a graph dense enough that no label can be placed without overlapping another
- **THEN** the graph renders markers and edges with no labels at all, rather than a partial set that overlaps into unreadable text

#### Scenario: Zoom out until one label would stand alone
- **WHEN** a reader zooms a large graph out to where only one or two unrelated labels could be placed without colliding
- **THEN** no unrelated label is rendered, and labels return as the reader zooms in far enough for several to be placed together

#### Scenario: Read a sparse connection map
- **WHEN** a reader opens a note-page connection map whose labels all fit without overlapping
- **THEN** every node is labelled at the fitted overview

#### Scenario: Inspect nodes by zooming on a phone
- **WHEN** a reader zooms into a graph on a narrow viewport
- **THEN** labels appear as separation grows, including titles omitted at the fitted overview, without moving nodes

#### Scenario: Return from detailed zoom
- **WHEN** a reader zooms back out
- **THEN** labels are suppressed again as they begin to collide, without changing node visibility or position

#### Scenario: Hold a stable selection
- **WHEN** the camera is not moving and several labels compete for the same space
- **THEN** the same labels stay rendered from frame to frame

#### Scenario: Inspect different note neighborhoods
- **WHEN** readers zoom equally far from the fitted overview in local graphs with different neighborhood sizes or fitted camera scales
- **THEN** both local graphs reveal newly separable titles without requiring either graph to cross one absolute camera ratio

#### Scenario: Preserve the fitted overview
- **WHEN** a narrow graph is initially fitted or the reader returns it to the fitted overview
- **THEN** label selection returns to what that camera state allows, so dense graphs do not collapse into overlapping text

#### Scenario: Avoid a zoomed marker
- **WHEN** zoom enlarges a visible node marker into a candidate label's box
- **THEN** collision selection uses that marker's current rendered radius and suppresses the overlapping label

#### Scenario: Restore local labels after preview
- **WHEN** a reader ends hover preview on a note-page connection map or turns the preference off without moving the camera
- **THEN** the map recomputes normal label selection and removes preview-only titles without leaving stale label visibility

### Requirement: Readable focused labels on narrow graphs
A rendered canvas label SHALL be positioned centred horizontally on its node and below the node's marker, and MUST wrap onto at most three lines at word boundaries so that no line exceeds the label's available width. A label whose text still does not fit three lines MUST be shortened with a trailing ellipsis, and MUST be omitted when not even a shortened first line fits. A label's available width MUST NOT depend on where its node sits, so the same title keeps the same shape wherever it is on screen and panning never reflows it; a label near an edge is clipped by that edge rather than rewrapped to avoid it. Labels arriving in or leaving the rendered set MUST change opacity over time rather than appearing and disappearing between frames. Meeting these constraints MUST NOT change the camera scale or any graph-space node position. At a fitted narrow-screen overview the focused note SHALL remain identifiable on the canvas by its persistent focus indicator whether or not its label is rendered, and its complete title MUST remain available through the focused-neighborhood bar.

#### Scenario: Read a long title at detailed zoom
- **WHEN** a reader zooms a narrow graph until labels are selected and a visible node's title is wider than the available width
- **THEN** the title wraps onto up to three centred lines below its node within the available width; an edge may clip those lines without rewrapping them

#### Scenario: Fit a focused neighborhood with long titles
- **WHEN** a focused note and its direct neighbors have titles that cannot all be placed legibly at the narrow fitted overview
- **THEN** the focused note stays identifiable by its focus indicator, labels are selected by the progressive label behavior, and the node composition does not change to make room for text

#### Scenario: Read the complete focused title
- **WHEN** the focused note's canvas label is shortened or not rendered on a narrow viewport
- **THEN** the reader can read the complete title in the focused-neighborhood bar

#### Scenario: Zoom into omitted neighbor labels
- **WHEN** a reader zooms in enough to create meaningful separation after a narrow focused fit
- **THEN** direct-neighbor labels appear according to the progressive label behavior without moving nodes

#### Scenario: Pan a labelled graph
- **WHEN** a reader drags a graph so a labelled node moves from the middle towards an edge
- **THEN** that label keeps the same lines and the same width throughout, and is clipped by the edge rather than rewrapped as it approaches it

#### Scenario: Reveal a label
- **WHEN** label selection changes because the camera settled somewhere new
- **THEN** titles joining the canvas fade in and titles leaving it fade out, rather than the set changing between one frame and the next

#### Scenario: Exhaust the wrapped width
- **WHEN** a title does not fit three lines at the available width
- **THEN** the label is shortened with a trailing ellipsis, or omitted when even a shortened first line does not fit, and the camera scale is unchanged

### Requirement: Compact mobile focused-neighborhood bar
On a narrow global graph or neighborhood page, persistent focus information SHALL appear as a compact bar no more than 72 CSS pixels tall in its collapsed state. The collapsed bar MUST show a single-line focused-note title, an action that opens the note, an action that clears focus, and a control that reveals secondary focus information and actions. Clearing focus MUST be one activation away whenever focus exists, never only behind the disclosure. The expanded state MUST make the complete focused-note title, copy-link action, and connected-domain information when present available without permanently consuming graph space. Interactive controls MUST retain touch targets of at least 44 by 44 CSS pixels and expose accessible names and expanded state.

#### Scenario: Inspect a focused graph on a phone
- **WHEN** a focused neighborhood appears on a narrow viewport
- **THEN** the focus bar remains at most 72 CSS pixels tall, identifies the focused note on one line, and leaves the rest of the graph visible

#### Scenario: Open the focused note directly
- **WHEN** a touch reader uses the collapsed focus bar
- **THEN** the reader can open the focused note without first expanding the bar

#### Scenario: Clear focus from the collapsed bar
- **WHEN** a touch reader uses the collapsed focus bar
- **THEN** the reader can clear focus in one tap without first expanding the bar

#### Scenario: Reveal secondary focus actions
- **WHEN** a reader expands the focus bar
- **THEN** the complete title and applicable copy and domain controls become available with accessible touch targets, and clearing focus remains available

#### Scenario: Collapse focus details
- **WHEN** a reader closes the expanded focus bar
- **THEN** the bar returns to its compact state without clearing graph focus or changing node positions

### Requirement: Reader-controlled graph fitting
The global graph and each note page's local graph SHALL provide a visible Fit view control. On viewports wider than the narrow graph breakpoint, activating Fit view MUST place the complete rendered bounds of every included node marker and every label rendered at the fitted camera state inside the usable graph viewport with visible padding, provided each individual rendered item can fit within that viewport. On narrow viewports, Fit view MUST frame every included node marker with visible padding before selecting labels for the resulting camera state; label width MUST NOT make the camera zoom out beyond that marker-based fit, with one exception: while a neighborhood is focused, the focused note's own rendered title and its plate MUST be inside the usable viewport after the fit, because that is the one title the reader asked to read. The usable graph viewport MUST exclude intersecting persistent controls and focused-neighborhood UI from its fitted area; a control that lies entirely within an area already excluded MUST NOT shrink the usable viewport further. A fit MUST scale the included bounds to fill the usable viewport along whichever dimension constrains them, zooming in when the bounds are smaller than the room they have as well as out when they are larger, and MUST centre them within that usable viewport.

Desktop fitting MUST measure labels selected at the candidate camera state, not just labels visible before fitting. On every viewport, a focused fit MUST include the focused title and its actual rendered plate bounds. Fitting MUST remeasure candidate-camera marker and label geometry with bounded corrections, rather than iterating to an oscillating fixed point as label selection or text size changes.

#### Scenario: Fit the global graph
- **WHEN** a reader activates Fit view on the global graph after loading, filtering, zooming, or panning
- **THEN** all included visible node markers fit inside the unobscured graph viewport without clipping

#### Scenario: Fit a tall graph on a phone
- **WHEN** a reader activates Fit view on a graph taller than it is wide on a narrow viewport
- **THEN** the markers span the usable height within padding and sit centred between the left and right edges, rather than stopping at a smaller size and drifting towards whichever side has the larger inset

#### Scenario: Fit a focused note near an edge on a phone
- **WHEN** a focused neighborhood's marker-based fit would place the focused note close enough to an edge that its centred title would be cut
- **THEN** the fit makes room for that title and its plate, while other neighborhood titles may still be clipped at the edge

#### Scenario: Corner controls do not double-count
- **WHEN** a control such as the navigation button sits inside the band already excluded for the toolbar
- **THEN** it does not also exclude a band along its own edge, so the fit stays centred

#### Scenario: Fit a local connection map
- **WHEN** a reader activates Fit view on a note page's connection map after zooming or panning
- **THEN** every node marker in that local graph fits inside the unobscured graph viewport without clipping

#### Scenario: Fit a long title on a phone
- **WHEN** a narrow graph includes a rendered non-focused note title whose full width would require zooming farther out than the marker-based fit
- **THEN** Fit view preserves the marker-based camera scale and selects, shortens, or omits that canvas label instead of shrinking the node composition

#### Scenario: Fit around focused-neighborhood UI
- **WHEN** persistent focused-neighborhood UI intersects the graph while Fit view runs
- **THEN** every included node marker is framed within the graph area that remains visible around that UI

#### Scenario: Fit long and highly connected notes
- **WHEN** a wide graph contains a long rendered note title or a node marker enlarged by high connectivity
- **THEN** Fit view accounts for that rendered extent rather than fitting only the node's center point

#### Scenario: Fit only included nodes
- **WHEN** global graph filters hide one or more nodes
- **THEN** Fit view excludes the hidden nodes and their labels when calculating the fitted camera state

#### Scenario: Recover labels after an offscreen pan
- **WHEN** a desktop reader pans nodes and their labels offscreen and then activates Fit view
- **THEN** the fit includes every included marker and label selected at the fitted camera, even when that label was not visible at the starting camera

#### Scenario: Fit the actual focused plate on desktop
- **WHEN** a desktop reader fits a focused neighborhood whose title plate extends beyond its marker bounds, including after an offscreen pan
- **THEN** the focused title and its actual rendered plate fit within the usable viewport with padding, together with the included markers and selected labels

#### Scenario: Settle camera-dependent label bounds
- **WHEN** a candidate fit changes rendered marker sizes, text sizes, or label selection
- **THEN** fitting remeasures at the candidate camera and settles with bounded corrections without oscillating between label sets

### Requirement: Hover neighborhood highlight
Inspecting a node in either graph SHALL retain full emphasis for that node, visible neighbors within the selected reach of one to five links, their titles, and edges joining successive rings. The default reach is one link, emphasizing direct neighbors and incident edges. Unrelated node markers and edges MUST remain visible with a substantially lower-emphasis treatment, while unrelated titles MUST be hidden for the duration of inspection. Every title in the inspected neighborhood MUST remain rendered while eligible for the viewport, including when normal density selection would omit it.

On fine-pointer layouts, whether a hover begins such an inspection SHALL be a reader preference, hover preview, that is off by default: a pointer crosses many nodes on its way somewhere, and a graph that lights up each one's neighborhood in passing flickers under the hand. With hover preview off, hovering MUST still show the pointer affordance and the hovered node's own title, and MUST NOT dim the rest of the graph or reveal the neighbors' titles. A visible control on the graph MUST toggle hover preview and expose its pressed state, the D key MUST toggle it, and the choice MUST be remembered per site base in the reader's browser, never in a URL. Persistent inspection by touch long press, keyboard search, or the context menu is unaffected by the preference. The F key MUST pin the node under the pointer, move the pin to it when another note is pinned, or lift the pin when it is already the pinned note; C MUST clear the pin; Z MUST fit the view, the focused neighborhood when there is one and every visible note otherwise. Keys MUST NOT act while the reader is typing in a field. How far a lit neighborhood reaches SHALL be the reader's choice, one to five links, one by default, the same reach for a hover preview and for a pin; the keys 1 to 5 set it, and pressed while a note is pinned they re-light the pin to the new reach and refit the view to it at once. Within a reach beyond one link, the lit edges are those joining successive rings, so what stays lit reads as the paths outward, and the focused-neighborhood bar MUST list every lit note, nearer rings first, saying how many links away any note beyond the first ring is. The choice is remembered per site base in the reader's browser, never in a URL. Every key MUST be discoverable where its action already is: the context menu MUST show the key beside each item that has one, a control's tooltip MUST name its key, and the graph MUST offer a Help control that opens a short guide to its keys and gestures, showing keys only where a keyboard is expected and touch gestures where touch is. Whatever the preference, hovering a node that is not dimmed or receded MUST show that node's title, whether the pointer is on its marker or on its rendered title, so a reader can always learn what they are pointing at.

F MUST target a visible marker under the pointer independently of its left-click navigation eligibility. Dismissing a context menu MUST release its held node target; subsequent keyboard actions MUST NOT reuse it as though the pointer still targeted that node.

#### Scenario: Hover with preview off
- **WHEN** a fine-pointer reader hovers a node with hover preview off
- **THEN** the pointer changes and the node's own title shows, while every other marker, edge and title stays as it was

#### Scenario: Hover reveals connections
- **WHEN** a reader with hover preview on and the default one-link reach hovers a node
- **THEN** the node, its incident edges, its direct neighbors, and their titles stay prominent while unrelated markers and edges recede and unrelated titles disappear

#### Scenario: Turn hover preview on and off
- **WHEN** a reader presses D or activates the hover preview control
- **THEN** the preference flips, the control shows the new state, whatever the pointer is over follows the new setting at once, and the choice survives a reload

#### Scenario: Pin from the keyboard
- **WHEN** a reader presses F while pointing at an unpinned note, then at another note, then at the pinned note
- **THEN** the first press pins that note, the second moves the pin, and the third lifts it

#### Scenario: Pin an unrelated marker
- **WHEN** a reader points at a visible unrelated marker while another neighborhood is pinned and presses F
- **THEN** the pin moves to that marker even though its lower-emphasis state prevents left-click navigation

#### Scenario: Dismiss a menu before pressing F
- **WHEN** a reader dismisses a node's context menu, leaves the pointer over empty graph space, and presses F
- **THEN** the former menu target is not pinned, moved to, or unpinned

#### Scenario: Reach further
- **WHEN** a reader with a note pinned presses 3, then 1
- **THEN** the pin lights the notes within three links and the view refits to them, the bar lists the second and third rings with their distances, and pressing 1 returns the pin to the direct neighbors

#### Scenario: Find the keys
- **WHEN** a reader opens the context menu, hovers Fit view, or opens Help
- **THEN** the menu shows F, C and Z beside Pin, Clear focus and Fit view, the Fit view tooltip names Z, and Help lists the keys on a keyboard layout and the touch gestures on a touch one

#### Scenario: Clear and fit from the keyboard
- **WHEN** a reader presses C while a note is pinned, or Z at any time
- **THEN** C clears the pin exactly as the Clear focus control does, and Z fits the view exactly as the Fit view control does

#### Scenario: Read the title under the pointer
- **WHEN** a fine-pointer reader hovers a node with hover preview off, on its marker or on its title
- **THEN** the node's full title shows on its plate, and no other node changes

#### Scenario: Inspect a dense graph
- **WHEN** a reader inspects a node whose neighborhood overlaps many unrelated labelled notes
- **THEN** only titles belonging to the inspected node and its visible neighbors within the selected reach remain, without changing node positions or the camera

#### Scenario: End inspection
- **WHEN** pointer or persistent touch inspection ends
- **THEN** normal label selection and visual emphasis return without changing graph geometry

## ADDED Requirements

### Requirement: Two-finger zoom keeps the graph level
A two-contact gesture on a graph canvas SHALL change only how far the camera is zoomed and where it is centered. It MUST NOT rotate the graph, whatever angle the contacts turn through. The graph position between the two contacts when the gesture begins MUST stay between them for as long as the gesture continues, including at the closest and furthest camera scales the graph allows.

#### Scenario: Pinch with the twist a hand naturally adds
- **WHEN** a reader spreads two contacts apart and the line between them turns a few degrees on the way
- **THEN** the graph zooms in and markers, edges and titles keep the orientation they had

#### Scenario: Turn two contacts without moving them apart
- **WHEN** a reader turns two contacts while keeping them the same distance apart
- **THEN** the graph does not move

#### Scenario: Zoom around what is between the fingers
- **WHEN** a reader pinches anywhere on the canvas
- **THEN** whatever sat between the two contacts when the gesture began is still between them when it ends

#### Scenario: Pinch past the zoom limit
- **WHEN** a reader keeps spreading two contacts after the camera has reached the closest scale the graph allows
- **THEN** the graph stops zooming and does not drift away from the contacts


### Requirement: Canvas label text scales with the camera
Canvas label text SHALL scale with the camera by the same law that governs node marker size, on every viewport, so that zooming in enlarges titles rather than only separating nodes. Scaled text MUST stay within a minimum and maximum rendered size so that labels neither become illegibly small when zoomed out nor dominate the canvas when zoomed far in. Label layout, hit testing, and label-aware camera fitting MUST all use the same rendered size at any given camera state.

#### Scenario: Zoom in to read a title
- **WHEN** a reader zooms into a graph
- **THEN** node markers and label text grow together, and a title that was too small to read becomes readable

#### Scenario: Clamp at the extremes
- **WHEN** a reader zooms to the closest or furthest camera state the graph allows
- **THEN** rendered label text stays within its legible size bounds rather than growing or shrinking without limit

#### Scenario: Tap a scaled label
- **WHEN** a reader taps a rendered label at any camera state
- **THEN** the tap targets the node that label belongs to

### Requirement: Legible graph overview at vault scale
The fitted overview of a graph SHALL keep individual node markers visually separable as a vault grows. Marker size MUST be derived from the layout so that the ratio of marker diameter to the distance between neighboring nodes stays roughly constant across vault sizes, rather than a fixed screen size that makes markers overlap once a layout is dense. Relative size differences that encode connectivity MUST be preserved, and markers MUST remain visible and keep touch targets of at least 44 by 44 CSS pixels on coarse-pointer layouts however small they are drawn.

#### Scenario: Open a large vault on a phone
- **WHEN** a reader opens the fitted overview of a vault with several hundred notes on a narrow viewport
- **THEN** individual markers are separable rather than merging into one continuous mass

#### Scenario: Compare vault sizes
- **WHEN** a reader opens the fitted overview of a small vault and of a much larger one
- **THEN** markers occupy a comparable share of the space between neighboring nodes in both

#### Scenario: Hubs still stand out
- **WHEN** a note has many more links than the median visible note
- **THEN** its marker is visibly larger than low-connectivity markers at the fitted overview

#### Scenario: Tap a small marker
- **WHEN** a touch reader taps a marker drawn smaller than a comfortable touch target
- **THEN** the tap still selects that node

### Requirement: Reader-controlled brain identity in workspace labels
On the full workspace graph, whether canvas labels carry their note's owning brain identity SHALL be a reader preference. The control MUST be reachable from the graph's own surfaces and expose its state accessibly. The preference MUST be remembered in the reader's own browser, MUST NOT appear in any URL, and MUST default to off on narrow viewports and on elsewhere. With the preference off, brain identity MUST remain available through node accent, the graph legend, and the focused-neighborhood bar. This preference MUST NOT affect a per-brain graph, where a rendered foreign label always carries its explicit `@brain` identity.

#### Scenario: Read workspace titles without owners
- **WHEN** a reader opens the full workspace graph on a narrow viewport without having changed the preference
- **THEN** canvas labels show note titles only, and brain identity is still conveyed by node accent and the legend

#### Scenario: Turn owner identity back on
- **WHEN** a reader enables owner identity from the graph's controls
- **THEN** workspace canvas labels include the owning brain, and the choice is still in effect on the next visit

#### Scenario: Keep focus links clean
- **WHEN** a reader copies a neighborhood link while the preference is set
- **THEN** the copied link carries no trace of the preference

#### Scenario: Preserve foreign identity in a per-brain graph
- **WHEN** a reader views a per-brain graph containing a rendered foreign label while the preference is off
- **THEN** that foreign label still carries its explicit `@brain` identity

### Requirement: Connected neighbors listed as readable text
Secondary focused-neighborhood information SHALL include the complete titles of the focused note's visible neighbors within the selected reach of one to five links as a list of text rows, so a reader can read them without zooming or panning the canvas. The list MUST appear wherever the focused-neighborhood bar's secondary information appears, on both narrow and wide viewports. Titles MUST NOT be shortened; a title too wide for one line MUST wrap. The list MUST be ordered by distance then alphabetically by title within each ring, MUST identify distances beyond one link, and MUST include every neighbor within reach that the current filters, lens and context leave visible, including any active shared-neighborhood visibility exception. It MUST NOT be capped, scrolling within the bar's existing height limit instead. In workspace mode, a neighbor owned by another Brain MUST be identifiable as foreign regardless of the reader's label preference. Each row MUST be an interactive control that moves graph focus to that neighbor, with a touch target of at least 44 by 44 CSS pixels on narrow and coarse-pointer layouts. Moving focus from a row MUST happen in place on both graph and note-owned neighborhood paths, replace the address with the new neighborhood path, leave the secondary information expanded, and refill the list at the selected reach. It MUST NOT load another page. When the focused note has no visible connected neighbors, the list MUST be absent rather than empty.

#### Scenario: Read neighbor titles without zooming
- **WHEN** a touch reader pins a neighborhood on a phone at the default one-link reach and expands the focus bar
- **THEN** every visible directly connected neighbor's complete title is readable as text, in alphabetical order, without changing the camera

#### Scenario: Read several rings in order
- **WHEN** a reader selects a reach from two to five links and expands the focus bar
- **THEN** the list includes all visible neighbors within that reach, nearest ring first and alphabetical within each ring, with distances shown beyond the first ring

#### Scenario: Read neighbor titles on a wide viewport
- **WHEN** a reader focuses a neighborhood on a wide viewport where secondary focus information is already visible
- **THEN** the same connected-neighbor list is present

#### Scenario: Walk the graph from the list
- **WHEN** a reader activates a neighbor row on a graph page
- **THEN** graph focus moves to that neighbor, the list refills with that note's neighbors, and the secondary information stays expanded

#### Scenario: Follow a neighbor from a neighborhood page
- **WHEN** a reader activates a neighbor row on a note-owned neighborhood page
- **THEN** focus moves in place, the address becomes that neighbor's neighborhood path without a page load, and the updated list stays expanded

#### Scenario: Scroll a hub's neighbors
- **WHEN** the focused note has more neighbors than fit the bar's height limit
- **THEN** every neighbor is still listed and the list scrolls within the bar

#### Scenario: Recognize a foreign neighbor
- **WHEN** a listed neighbor is owned by another Brain in workspace mode
- **THEN** the row identifies that ownership even when canvas labels are showing titles only

#### Scenario: Hide the list when filters remove the neighborhood
- **WHEN** filters, the Brain lens or the graph context leave the focused note with no visible connected neighbors
- **THEN** no connected-neighbor list is shown

### Requirement: Shareable focused graph neighborhoods
The global graph SHALL let a reader persist the neighborhood currently inspected by pointer, touch, or graph search. A focused neighborhood MUST retain full emphasis for the focused note, its visible neighbors within the selected reach, their titles, and edges joining successive rings while preserving unrelated markers as lower-emphasis orientation context, and MUST outrank the reader's Brain lens inside that neighborhood. The focused note MUST have a persistent non-color-only indicator distinct from transient hover. The shareable identity of a focused neighborhood MUST be the focused note's neighborhood page path; the copied neighborhood link MUST be that path with no query string or fragment. While a reader pins focus on a graph page, that page's address MUST become that same neighborhood page path, so that a reader who copies the address from the browser gets the shareable identity rather than a weaker form of it, and clearing focus MUST return the address to the graph page's own path. A graph page's query string MUST NOT carry which note is focused; it remains available for state that only enriches a view, such as filters, where losing it changes nothing about which note or destination opens. Focus links MUST NOT encode transient filters, lens state, dragged positions, or raw camera coordinates.

Every in-place focus URL change MUST refresh navigation and site-search owner Brain scope from the current pathname, including pinning from the root graph, crossing Brain ownership, and clearing focus. The layout session key MUST follow the current neighborhood identity or unfocused context graph. Focused sessions originating in a Brain graph MUST also retain that graph's active Brain and related-Brains visibility state, separate from each other and from the full workspace neighborhood session. Existing full workspace `neighborhood:<id>` keys MUST remain unchanged. Changing that key MUST preserve live node positions rather than restoring another session's positions during the transition.

On a fine-pointer desktop graph, invoking the context menu over an eligible node marker or rendered title SHALL offer actions to pin or move focus, copy the focused-neighborhood link, and open the note. Invoking it over empty graph space SHALL offer the actions that are about the graph itself rather than a note, including clearing an active focus and fitting the view. This replaces the browser's own menu over empty graph space, which the graph previously left alone: reaching clear-focus and fit-view from anywhere on the canvas is worth more than the native menu over a canvas that offers nothing to save or inspect. Touch long press and keyboard-accessible graph search MUST reach the same focused state. A reader MUST be able to copy and clear focus without relying on another right-click.

Secondary-button and context-menu gestures MUST NOT begin or continue node dragging. While a neighborhood is focused, pointer movement over other nodes MUST NOT replace the focused emphasis, reveal another neighborhood, or move graph nodes. While a context menu is open, pointer movement MUST NOT change which node is inspected, so the node the menu names stays identifiable while the reader reaches for it. Lower-emphasis unrelated nodes MUST NOT navigate on left-click, while context-menu Move focus here and Open note remain available. Fit view MUST fit the focused note and its visible neighbors within the selected reach while focus exists and fit all visible nodes after focus is cleared.

#### Scenario: Pin a hovered neighborhood
- **WHEN** a desktop reader opens the context menu over a hovered note marker or rendered title and chooses Pin neighborhood
- **THEN** that note remains visibly focused after the pointer leaves and the graph page's address becomes that note's neighborhood page path

#### Scenario: Copy the address from the browser
- **WHEN** a reader pins a neighborhood and copies the URL from the browser's address bar rather than using the copy action
- **THEN** the copied URL is the same pathname-only neighborhood link the copy action produces

#### Scenario: Reopen a pinned address
- **WHEN** a reader opens the address a pinned neighborhood produced
- **THEN** the same graph opens focused on the same note, through that note's own neighborhood page

#### Scenario: Clear focus
- **WHEN** a reader clears focus on a graph page
- **THEN** the focus indicator is removed and the address returns to that graph page's own path

#### Scenario: Pin from the root workspace graph
- **WHEN** a reader pins a note from the root workspace graph without loading another page
- **THEN** navigation and site search use the owner Brain derived from the new neighborhood pathname rather than retaining root scope

#### Scenario: Keep Home consistent with the current graph path
- **WHEN** a reader pins, moves, or clears focus in place on a workspace graph
- **THEN** the Home control is visible on Brain and neighborhood paths and hidden at the workspace root, matching a fresh load of the resulting URL on desktop and phone

#### Scenario: Move focus across Brains
- **WHEN** a reader moves focus in place from a note in one Brain to a note in another
- **THEN** the address, navigation scope, and site-search owner scope all follow the new neighborhood pathname

#### Scenario: Clear pathname-derived Brain scope
- **WHEN** a reader clears focus in place and the address returns to the context graph's own path
- **THEN** navigation and site search derive scope from that graph path, removing the previous note's owner scope where the graph path has none

#### Scenario: Retarget layout persistence without restoring positions
- **WHEN** a reader pins, moves, or clears focus in place while another layout session has stored positions for the destination identity
- **THEN** the layout session key follows the new neighborhood or unfocused graph, live node positions are preserved, and subsequent layout persistence uses the new key

#### Scenario: Reach for the context menu
- **WHEN** a reader opens the context menu on a node and moves the pointer off that node towards the menu
- **THEN** that node stays inspected for as long as the menu names it

#### Scenario: Act on the graph from empty space
- **WHEN** a reader opens the context menu over empty graph space while a neighborhood is focused
- **THEN** the menu offers to clear the focus and to fit the view, without offering actions that need a note

### Requirement: Note-owned focused neighborhood page
Every published note SHALL have a generated focused-neighborhood page at its canonical note path followed by a `graph/` segment. The page MUST render the note's context graph, the full workspace graph in workspace mode or the vault graph in vault mode, with that note persistently focused, its visible neighbors within the selected reach and edges joining successive rings at full emphasis regardless of the reader's Brain lens, unrelated markers as lower-emphasis orientation context, and a camera fit containing the focused note and that neighborhood. The default reach is one link. The page MUST be the destination of the copied neighborhood link, the note page's Graph action when no originating focus applies, and the note's own focused-neighborhood action. It MUST open identically for a first-time visitor and for a reader whose lens dims one of the neighborhood's Brains.

The page is the context graph page itself, generated at the note's path with that note focused; it MUST NOT behave differently from the graph page in any way a reader can notice. Moving focus to another note MUST happen in place, with the camera travelling from the current neighborhood to the new one, and the address MUST be replaced with the new note's neighborhood path. Clearing focus MUST happen in place too, leaving the unfocused context graph with the address replaced by that graph's own path, so a reader who arrived by a shared link always has a route onward. Neither a move nor a clear MAY be a page load. When the page opens already focused, the first frame it paints MUST already frame the focused neighborhood: the whole graph MUST NOT be shown first and then zoomed away from.

A shared neighborhood's exception to type, status, and tag filter visibility MUST follow the current neighborhood through row-driven focus moves. It MUST remain active until the reader explicitly edits a type, status, or tag filter; moving focus MUST NOT count as such an edit. After an explicit filter edit, the normal filters MUST apply without that exception.

In workspace mode the page MUST list the connected domains of the neighborhood: every Brain that owns the focused note or one of its direct neighbors, identified by the Brain mark, accent, and title, with the count of neighborhood notes it owns and an indication when that Brain is dimmed elsewhere by the lens. Activating a listed domain MUST toggle the reader's lens for that Brain without removing any neighborhood node. In vault mode the page MUST omit the domain list.

#### Scenario: Open a note's neighborhood page
- **WHEN** a reader opens `/brains/engineering/notes/principles/graph/` directly with the default one-link reach
- **THEN** the full workspace graph renders with Principles persistently focused, its direct neighbors emphasized, and the camera fitted to that neighborhood

#### Scenario: Keep connected domains local when expanding reach
- **WHEN** a reader increases the focused neighborhood reach beyond one link
- **THEN** the connected-note rows and highlighting expand, but connected-domain membership and counts still include only the focused note and its visible direct neighbors, excluding indirect notes even when their Brain already has a domain chip

#### Scenario: Clear focus on a shared neighborhood
- **WHEN** a reader who followed a shared neighborhood link clears focus from the bar or the context menu
- **THEN** the same page shows the unfocused context graph, its address is that graph's own path with no query string, and no focus remains

#### Scenario: Move focus from a neighborhood page
- **WHEN** a reader on a neighborhood page moves focus to a connected note, from a neighbor row, a search result, a long press, or the context menu
- **THEN** the camera glides from the current neighborhood to the new one without a page load, and the address becomes the new note's neighborhood path

#### Scenario: Walk a shared neighborhood despite stored filters
- **WHEN** a reader opens a shared neighborhood with stored filters that would hide neighborhood notes and moves focus through neighbor rows
- **THEN** the visibility exception follows each newly focused neighborhood, so its notes and eligible rows remain available without resetting the reader's stored filters

#### Scenario: Resume filters after an explicit edit
- **WHEN** that reader explicitly changes a type, status, or tag filter after one or more row moves
- **THEN** the shared-neighborhood visibility exception ends and the current filters determine node and row visibility

#### Scenario: Arrive without seeing the whole graph
- **WHEN** a neighborhood page opens, whether from a shared link or from a note's Graph action
- **THEN** the first painted frame frames the focused note and its visible neighbors within the selected reach, and no zoom away from the whole graph precedes it
