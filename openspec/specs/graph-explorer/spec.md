# Graph Explorer Specification

## Purpose

Provides the centerpiece visual exploration of the vault: an interactive global graph of every note and connection, plus a local neighborhood graph on each note page — filterable, searchable, and stable across visits.

## Requirements

### Requirement: Global graph page
Each brain SHALL have an interactive graph containing its notes plus directly connected foreign notes as boundary nodes. The site SHALL also provide a combined graph containing all notes and resolved links from the reader-selected brains. Both graph modes MUST support pan, zoom, hover, and click-to-navigate and remain smooth at a combined total of at least 2,000 notes.

#### Scenario: Explore one brain's boundary
- **WHEN** an Engineering note links to Design while Engineering is active
- **THEN** Engineering's graph shows the Design note as a foreign boundary node without adding unrelated Design notes

#### Scenario: Explore selected brains
- **WHEN** a reader opens a combined Engineering and Design graph
- **THEN** the graph contains all notes from both brains and all resolved links between included notes

#### Scenario: Navigate from graph
- **WHEN** a reader clicks a local or foreign node
- **THEN** the browser navigates to that note's namespaced page

#### Scenario: Smooth at scale
- **WHEN** selected brains contain a combined total of 2,000 notes
- **THEN** panning and zooming the graph stays fluid on a typical laptop

### Requirement: Stable precomputed layout
Node positions in the global graph SHALL be computed at build time using a force-directed layout that reveals cluster structure, and MUST be identical on every page load until the vault changes and is rebuilt.

#### Scenario: Spatial memory works
- **WHEN** a reader visits the graph page on two separate occasions without a rebuild
- **THEN** every node appears in the same position both times

### Requirement: Meaningful visual encoding
Graph nodes and edges SHALL visibly encode brain membership and cross-brain relationships without relying on color alone. A per-brain graph MUST distinguish foreign boundary nodes from local nodes while retaining discernible type, status, and connectivity encoding. A combined graph MUST assign each brain a consistent accent and provide a legend mapping accents and non-color markers to brain identity.

In a per-brain graph, foreign boundary nodes and cross-brain edges MUST use a neutral, lower-emphasis treatment than local content while retaining a visible non-color foreign marker. Every foreign label that is rendered MUST include an explicit `@brain` identity. Combined graphs SHALL continue to render every selected brain at full emphasis.

#### Scenario: Recognize a foreign node
- **WHEN** a reader views a per-brain graph containing a linked note from another brain
- **THEN** the foreign note has a non-color foreign marker, any rendered label identifies the target brain, and its muted treatment remains visually subordinate to local notes

#### Scenario: Recognize brains in a combined graph
- **WHEN** a reader views notes from several selected brains
- **THEN** the graph and legend identify each node's owning brain without requiring hover or color perception

#### Scenario: Hubs stand out
- **WHEN** a note has many more links than the median visible note
- **THEN** its node is visibly larger than low-connectivity notes

#### Scenario: Established notes are distinguishable
- **WHEN** a reader views a per-brain or combined graph
- **THEN** established notes remain visually distinguishable from draft notes without hovering

### Requirement: Compact mobile graph controls
The global graph SHALL present Filters, Fit view, Related brains when available, and Legend as distinct icon actions within one compact horizontal pill on every viewport. The pill MUST remain within the graph viewport, stay clear of primary navigation, preserve touch targets of at least 44 by 44 CSS pixels, expose an accessible name and state for every action, and provide pointer users with a tooltip for each icon-only action.

#### Scenario: Use graph controls on desktop
- **WHEN** a reader opens a global graph in a desktop viewport
- **THEN** all applicable icon actions appear in one compact horizontal pill rather than separate text buttons

#### Scenario: Use graph controls on a phone
- **WHEN** a reader opens a per-brain graph with related brains available on a narrow viewport
- **THEN** all four icon actions fit in one horizontal pill without clipping, horizontal overflow, or overlap with primary navigation

#### Scenario: Toggle related brains
- **WHEN** a reader activates the Related brains icon action
- **THEN** its pressed state changes without changing the action's width or displacing the other controls

#### Scenario: Identify icon actions
- **WHEN** assistive technology or a desktop pointer user examines the graph control pill
- **THEN** Filters, Fit view, Related brains, and Legend expose distinct accessible names, pointer users can discover their labels, and decorative icons are not announced separately

### Requirement: Readable related-brain graph
A per-brain graph on a narrow viewport SHALL preserve a readable node composition when related brains are shown. Labels MUST be selected so visible text remains individually legible rather than forcing every related note label into the fitted view, while foreign nodes remain identifiable through their non-color marker and rendered foreign labels retain `@brain` identity.

#### Scenario: Show many related notes on a phone
- **WHEN** a reader enables related brains and the boundary contains more labels than can fit legibly in the viewport
- **THEN** the graph renders a collision-managed subset of labels and retains a readable node cluster instead of collapsing into overlapping text

#### Scenario: Fit a related-brain graph
- **WHEN** automatic or reader-triggered fitting runs after related brains become visible
- **THEN** the fit accounts for the labels selected at the fitted state without zooming out to accommodate labels that are not rendered

### Requirement: Progressive mobile graph labels
Global and note-page local graphs on narrow viewports SHALL keep their fitted overview labels selectively rendered to preserve legibility. After a reader zooms in enough to create meaningful separation between nodes, the graph MUST render the title of every eligible visible node rather than leaving visible nodes unlabelled because of overview density selection or narrow-view title-width limits. A note-page local graph MUST determine detailed zoom relative to its own fitted overview so the behavior remains consistent across neighborhood topology and connection-map dimensions. Zooming back to the fitted overview MUST restore selective label rendering.

#### Scenario: Inspect nodes by zooming on a phone
- **WHEN** a reader zooms substantially into a global graph or substantially closer than a note-page local graph's fitted overview on a narrow viewport
- **THEN** every eligible node visible in the zoomed viewport renders its title, including titles omitted from the fitted overview

#### Scenario: Inspect different note neighborhoods
- **WHEN** readers zoom equally far from the fitted overview in local graphs with different neighborhood sizes or fitted camera scales
- **THEN** both local graphs reveal eligible visible titles without requiring either graph to cross one absolute camera ratio

#### Scenario: Preserve the fitted overview
- **WHEN** a narrow graph is initially fitted or the reader returns it to the fitted overview
- **THEN** labels remain selectively rendered so dense graphs do not collapse into overlapping text

#### Scenario: Return from detailed zoom
- **WHEN** a reader zooms back out after inspecting titles on a narrow graph
- **THEN** the graph resumes selective label rendering without changing node visibility or position

### Requirement: Concise contextual graph legends
The global graph and every rendered note-page connection map SHALL provide a Legend information action that opens a concise, accessible popover without permanently covering the graph. The legend MUST explain status markers and connectivity size, and MUST add brain ownership, related-note, or cross-brain edge explanations when those encodings can appear in that graph. Every open legend popover MUST remain fully contained within the visual viewport on supported desktop, narrow, and coarse-pointer layouts, including when the global Filters panel is closed.

#### Scenario: Explain a global graph
- **WHEN** a reader opens Legend on a global graph with the Filters panel closed
- **THEN** the popover briefly explains every applicable encoding and all of its edges remain inside the viewport

#### Scenario: Explain a connection map
- **WHEN** a reader opens Legend on a note-page connection map
- **THEN** the popover briefly explains status markers, node size, and related-note and cross-brain encodings that can appear in that map

#### Scenario: Operate a legend accessibly
- **WHEN** a keyboard, touch, or assistive-technology user opens and closes Legend
- **THEN** the trigger exposes its open state, the popover content is perceivable, and focus remains predictable

### Requirement: Graph filtering
Graph controls SHALL filter visible nodes by note type, status, and tag when those dimensions apply to the current view. On a full workspace graph, one Brain control SHALL appear as the rightmost segment of the left graph-control pill and govern the canonical selected Brain set. Shared navigation and the graph Filters panel MUST NOT duplicate Brain selection. Removing a Brain from a combined view MUST remove its nodes and edges and update the shareable selected-Brain URL; foreign boundary nodes in a per-Brain graph MUST remain governed by their connection to the active Brain.

A per-brain graph SHALL hide foreign boundary nodes by default and provide an explicit toggle that shows or hides all directly related foreign notes and their cross-brain edges without affecting local nodes.

#### Scenario: Show related brains
- **WHEN** a reader enables related brains from a per-brain graph
- **THEN** directly connected foreign notes and cross-brain edges appear with muted foreign styling while unrelated foreign notes remain hidden

#### Scenario: Return to local focus
- **WHEN** a reader disables related brains
- **THEN** every foreign node and cross-brain edge is hidden while the active brain's local graph remains visible

#### Scenario: Remove a brain from a combined graph
- **WHEN** a reader deselects Research through the Brain context control
- **THEN** Research nodes and incident edges disappear and the URL records the remaining selection

#### Scenario: Locate Brain selection
- **WHEN** a reader opens a full workspace graph
- **THEN** the Brain selector is the rightmost segment of the left graph-control pill and no Brain selector appears in shared navigation

#### Scenario: Filter by type
- **WHEN** a reader deselects `fleeting` in the type filter
- **THEN** all visible fleeting notes and their incident edges disappear

#### Scenario: Combine filters
- **WHEN** a reader filters to type `permanent` and status `established`
- **THEN** only permanent established notes remain visible in the current brain selection

### Requirement: Graph search
Graph search SHALL match note titles within the graph's current brain selection, show the owning brain for every match, and keep equal titles from different brains as distinct results. Selecting a match MUST establish the corresponding namespaced node as the graph's persistent focus, update the shareable focused-graph URL, and fit its visible neighborhood without changing graph-space node positions.

#### Scenario: Search duplicate titles
- **WHEN** two selected brains contain `Principles` and a reader searches for that title
- **THEN** both results appear with different brain labels and either result focuses the correct node

#### Scenario: Search focuses node
- **WHEN** a reader selects a graph search result
- **THEN** the matching node and its direct neighborhood become persistently focused, the camera fits that neighborhood, and the URL identifies the focused composite node

### Requirement: Hover neighborhood highlight
Inspecting a node in either graph SHALL retain full emphasis for that node, its directly connected neighbors, their titles, and edges incident to the inspected node. Unrelated node markers and edges MUST remain visible with a substantially lower-emphasis treatment, while unrelated titles MUST be hidden for the duration of inspection. Every title in the inspected neighborhood MUST remain rendered while eligible for the viewport, including when normal density selection would omit it.

#### Scenario: Hover reveals connections
- **WHEN** a reader hovers a node
- **THEN** the node, its incident edges, its direct neighbors, and their titles stay prominent while unrelated markers and edges recede and unrelated titles disappear

#### Scenario: Inspect a dense graph
- **WHEN** a reader inspects a node whose neighborhood overlaps many unrelated labelled notes
- **THEN** only titles belonging to the inspected node and its direct neighbors remain, without changing node positions or the camera

#### Scenario: End inspection
- **WHEN** pointer or persistent touch inspection ends
- **THEN** normal label selection and visual emphasis return without changing graph geometry

### Requirement: Local graph on note pages
Every note page SHALL include a local graph showing the note and its local and cross-brain neighborhood. Foreign notes and cross-brain edges MUST use the same brain-aware visual language as the global graphs and support navigation to namespaced note pages.

#### Scenario: Local graph crosses a brain boundary
- **WHEN** a note links to two local notes and one foreign note
- **THEN** its local graph shows all three connections and visibly identifies the foreign brain

#### Scenario: Local graph shows neighborhood
- **WHEN** a reader opens a note linked to three other notes
- **THEN** the local graph shows those connected notes and clicking one navigates to its namespaced page

### Requirement: Reader-controlled graph fitting
The global graph and each note page's local graph SHALL provide a visible Fit view control. Activating Fit view MUST place the complete rendered bounds of every included node marker and every label rendered at the fitted camera state inside the usable graph viewport with visible padding, provided each individual rendered item can fit within that viewport.

#### Scenario: Fit the global graph
- **WHEN** a reader activates Fit view on the global graph after loading, filtering, zooming, or panning
- **THEN** all visible node markers and their rendered labels fit inside the usable graph viewport without clipping

#### Scenario: Fit a local connection map
- **WHEN** a reader activates Fit view on a note page's connection map after zooming or panning
- **THEN** every node marker and rendered label in that local graph fits inside the usable graph viewport without clipping

#### Scenario: Fit long and highly connected notes
- **WHEN** the included graph contains a long rendered note title or a node marker enlarged by high connectivity
- **THEN** Fit view accounts for that rendered extent rather than fitting only the node's center point

#### Scenario: Fit only included nodes
- **WHEN** global graph filters hide one or more nodes
- **THEN** Fit view excludes the hidden nodes and their labels when calculating the fitted camera state

### Requirement: Shareable focused graph neighborhoods
The global graph SHALL let a reader persist the neighborhood currently inspected by pointer, touch, or graph search. A focused neighborhood MUST retain full emphasis for the focused note, its directly connected visible neighbors, their titles, and edges incident to the focused note while preserving unrelated markers as lower-emphasis orientation context. The focused note MUST have a persistent non-color-only indicator distinct from transient hover. The canonical graph URL MUST identify the focused composite note together with the current Brain selection, and opening that URL MUST restore the selection, focused neighborhood, and a camera fit containing the focused note and its visible direct neighbors. Focus links MUST NOT encode transient filters, dragged positions, or raw camera coordinates.

On a fine-pointer desktop graph, invoking the context menu over an eligible node marker or rendered title SHALL offer actions to pin or move focus, copy the focused-neighborhood link, and open the note. The native context menu MUST remain available over empty graph space. Touch long press and keyboard-accessible graph search MUST reach the same focused state. A reader MUST be able to copy and clear focus without relying on another right-click.

Secondary-button and context-menu gestures MUST NOT begin or continue node dragging. While a neighborhood is focused, pointer movement over other nodes MUST NOT replace the focused emphasis, reveal another neighborhood, or move graph nodes. Lower-emphasis unrelated nodes MUST NOT navigate on left-click, while context-menu Move focus here and Open note remain available. Fit view MUST fit the focused note and its visible direct neighbors while focus exists and fit all visible nodes after focus is cleared.

#### Scenario: Pin a hovered neighborhood
- **WHEN** a desktop reader opens the context menu over a hovered note marker or rendered title and chooses Pin neighborhood
- **THEN** that note remains visibly focused after the pointer leaves and the graph URL records its composite identity

#### Scenario: Copy a neighborhood link
- **WHEN** a reader copies the link for a focused Engineering note in an Engineering and Design combined graph
- **THEN** the copied URL records both selected Brains and the focused Engineering note without recording camera or layout coordinates

#### Scenario: Open a shared doorway
- **WHEN** another reader opens a valid focused-neighborhood URL
- **THEN** the graph restores the selected Brains, makes the focused note visible, emphasizes its direct neighborhood, and fits that neighborhood within the usable viewport

#### Scenario: Reveal a focused cross-Brain boundary
- **WHEN** a focused note in a per-Brain graph has a directly connected foreign note while general Related Brains visibility is off
- **THEN** the focused neighborhood reveals that direct foreign note and edge without revealing unrelated foreign boundary notes

#### Scenario: Preserve native empty-stage behavior
- **WHEN** a desktop reader opens the context menu over graph space that does not target a marker or rendered title
- **THEN** Brain does not suppress the browser's native context menu or change graph focus

#### Scenario: Keep context-menu gestures out of drag state
- **WHEN** a desktop reader opens a node context menu and moves the pointer before or after pinning
- **THEN** no node follows the pointer and graph-space positions remain unchanged

#### Scenario: Lock a focused neighborhood
- **WHEN** a reader moves the pointer over another node while one neighborhood is focused
- **THEN** the focused note, its direct neighbors, their titles, and incident edges remain the only emphasized neighborhood until the reader clears focus

#### Scenario: Ignore left-clicks on unrelated context
- **WHEN** a reader left-clicks a lower-emphasis unrelated node while one neighborhood is focused
- **THEN** the graph remains on the current focused URL and the unrelated note does not open, while its context menu can still move focus or open the note explicitly

#### Scenario: Fit the active neighborhood
- **WHEN** a reader activates Fit view while one neighborhood is focused
- **THEN** the camera fits the focused note and its visible direct neighbors rather than every lower-emphasis orientation marker

#### Scenario: Clear an invalidated focus
- **WHEN** the reader changes Brain selection or an explicit filter so the focused note is no longer included
- **THEN** Brain clears the focus indicator and removes the focused-note state from the canonical URL

#### Scenario: Ignore recipient filter history
- **WHEN** a reader opens a focused-neighborhood URL but stored local filter state would hide the focused note
- **THEN** the shared focus takes precedence on initial restoration so the subject and its neighborhood remain visible

#### Scenario: Operate focus without a fine pointer
- **WHEN** a touch reader long-presses a note or a keyboard reader selects a graph-search result
- **THEN** Brain establishes the same persistent focused state and exposes accessible actions to copy or clear it
