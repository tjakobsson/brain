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
On narrow viewports, the global graph SHALL present Filters, Fit view, Related brains when available, and Legend as distinct icon actions within one horizontal pill. The pill MUST remain within the viewport, stay clear of the collapsed mobile navigation launcher, preserve touch targets of at least 44 by 44 CSS pixels, and expose an accessible name and state for every action.

#### Scenario: Use graph controls on a phone
- **WHEN** a reader opens a per-brain graph with related brains available on a narrow viewport
- **THEN** all four icon actions fit in one horizontal pill without clipping, horizontal overflow, or overlap with the collapsed navigation launcher

#### Scenario: Toggle related brains
- **WHEN** a reader activates the Related brains icon action
- **THEN** its pressed state changes without changing the action's width or displacing the other controls

#### Scenario: Identify icon actions
- **WHEN** assistive technology examines the graph control pill
- **THEN** Filters, Fit view, Related brains, and Legend expose distinct accessible names and their decorative icons are not announced separately

### Requirement: Readable related-brain graph
A per-brain graph on a narrow viewport SHALL preserve a readable node composition when related brains are shown. Labels MUST be selected so visible text remains individually legible rather than forcing every related note label into the fitted view, while foreign nodes remain identifiable through their non-color marker and rendered foreign labels retain `@brain` identity.

#### Scenario: Show many related notes on a phone
- **WHEN** a reader enables related brains and the boundary contains more labels than can fit legibly in the viewport
- **THEN** the graph renders a collision-managed subset of labels and retains a readable node cluster instead of collapsing into overlapping text

#### Scenario: Fit a related-brain graph
- **WHEN** automatic or reader-triggered fitting runs after related brains become visible
- **THEN** the fit accounts for the labels selected at the fitted state without zooming out to accommodate labels that are not rendered

### Requirement: Progressive mobile graph labels
Global and note-page local graphs on narrow viewports SHALL keep their fitted overview labels selectively rendered to preserve legibility. After a reader zooms in enough to create meaningful separation between nodes, the graph MUST render the title of every eligible visible node rather than leaving visible nodes unlabelled because of overview density selection or narrow-view title-width limits. Zooming back to the fitted overview MUST restore selective label rendering.

#### Scenario: Inspect nodes by zooming on a phone
- **WHEN** a reader zooms substantially into a global or local graph on a narrow viewport
- **THEN** every eligible node visible in the zoomed viewport renders its title, including titles omitted from the fitted overview

#### Scenario: Preserve the fitted overview
- **WHEN** a narrow graph is initially fitted or the reader returns it to the fitted overview
- **THEN** labels remain selectively rendered so dense graphs do not collapse into overlapping text

#### Scenario: Return from detailed zoom
- **WHEN** a reader zooms back out after inspecting titles on a narrow graph
- **THEN** the graph resumes selective label rendering without changing node visibility or position

### Requirement: Concise contextual graph legends
The global graph and every rendered note-page connection map SHALL provide a Legend information action that opens a concise, accessible popover without permanently covering the graph. The legend MUST explain status markers and connectivity size, and MUST add brain ownership, related-note, or cross-brain edge explanations when those encodings can appear in that graph.

#### Scenario: Explain a global graph
- **WHEN** a reader opens Legend on a global graph
- **THEN** the popover briefly explains status markers, node size, and every brain-aware encoding applicable to the current graph mode

#### Scenario: Explain a connection map
- **WHEN** a reader opens Legend on a note-page connection map
- **THEN** the popover briefly explains status markers, node size, and related-note and cross-brain encodings that can appear in that map

#### Scenario: Operate a legend accessibly
- **WHEN** a keyboard, touch, or assistive-technology user opens and closes Legend
- **THEN** the trigger exposes its open state, the popover content is perceivable, and focus remains predictable

### Requirement: Graph filtering
Graph controls SHALL filter visible nodes by brain, note type, status, and tag when those dimensions apply to the current view. Removing a brain from a combined view MUST remove its nodes and edges and update the shareable selected-brain URL; foreign boundary nodes in a per-brain graph MUST remain governed by their connection to the active brain.

A per-brain graph SHALL hide foreign boundary nodes by default and provide an explicit toggle that shows or hides all directly related foreign notes and their cross-brain edges without affecting local nodes.

#### Scenario: Show related brains
- **WHEN** a reader enables related brains from a per-brain graph
- **THEN** directly connected foreign notes and cross-brain edges appear with muted foreign styling while unrelated foreign notes remain hidden

#### Scenario: Return to local focus
- **WHEN** a reader disables related brains
- **THEN** every foreign node and cross-brain edge is hidden while the active brain's local graph remains visible

#### Scenario: Remove a brain from a combined graph
- **WHEN** a reader deselects Research
- **THEN** Research nodes and incident edges disappear and the URL records the remaining selection

#### Scenario: Filter by type
- **WHEN** a reader deselects `fleeting` in the type filter
- **THEN** all visible fleeting notes and their incident edges disappear

#### Scenario: Combine filters
- **WHEN** a reader filters to type `permanent` and status `established`
- **THEN** only permanent established notes remain visible in the current brain selection

### Requirement: Graph search
Graph search SHALL match note titles within the graph's current brain selection, show the owning brain for every match, and keep equal titles from different brains as distinct results. Selecting a match MUST focus the corresponding namespaced node.

#### Scenario: Search duplicate titles
- **WHEN** two selected brains contain `Principles` and a reader searches for that title
- **THEN** both results appear with different brain labels and either result focuses the correct node

#### Scenario: Search focuses node
- **WHEN** a reader selects a graph search result
- **THEN** the camera animates to center on the corresponding composite node and highlights it

### Requirement: Hover neighborhood highlight
Hovering a node in either graph SHALL highlight that node and its directly connected neighbors while de-emphasizing all other nodes, and MUST display the hovered note's title.

#### Scenario: Hover reveals connections
- **WHEN** a reader hovers a node
- **THEN** the node, its edges, and its direct neighbors stay prominent while the rest of the graph recedes

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
