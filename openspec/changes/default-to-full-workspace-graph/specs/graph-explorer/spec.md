## ADDED Requirements

### Requirement: Note-owned focused neighborhood page
Every published note SHALL have a generated focused-neighborhood page at its canonical note path followed by a `graph/` segment. The page MUST render the note's context graph, the full workspace graph in workspace mode or the vault graph in vault mode, with that note persistently focused, its direct neighbors and incident edges at full emphasis regardless of the reader's Brain lens, unrelated markers as lower-emphasis orientation context, and a camera fit containing the focused note and its direct neighbors. The page MUST be the destination of the copied neighborhood link, the note page's Graph action when no originating focus applies, and the note's own focused-neighborhood action. It MUST open identically for a first-time visitor and for a reader whose lens dims one of the neighborhood's Brains.

In workspace mode the page MUST list the connected domains of the neighborhood: every Brain that owns the focused note or one of its direct neighbors, identified by the Brain mark, accent, and title, with the count of neighborhood notes it owns and an indication when that Brain is dimmed elsewhere by the lens. Activating a listed domain MUST toggle the reader's lens for that Brain without removing any neighborhood node. In vault mode the page MUST omit the domain list.

#### Scenario: Open a note's neighborhood page
- **WHEN** a reader opens `/brains/engineering/notes/principles/graph/` directly
- **THEN** the full workspace graph renders with Principles persistently focused, its direct neighbors emphasized, and the camera fitted to that neighborhood

#### Scenario: See connected domains
- **WHEN** a focused Engineering note has two Design neighbors and one Research neighbor
- **THEN** the page lists Engineering, Design, and Research with their marks, accents, and counts

#### Scenario: Open while a domain is dimmed
- **WHEN** a reader whose lens dims Research opens a neighborhood page containing Research neighbors
- **THEN** the Research neighbors render at full emphasis, the Research domain entry indicates it is dimmed elsewhere, and unrelated Research notes stay dimmed

#### Scenario: Toggle a domain from the list
- **WHEN** a reader activates the Research entry in the domain list
- **THEN** the lens for Research toggles, the neighborhood keeps every node, and the graph URL is unchanged

#### Scenario: Open a vault-mode neighborhood page
- **WHEN** a single-vault site reader opens `/notes/principles/graph/`
- **THEN** the vault graph renders with Principles focused and no domain list is shown

#### Scenario: Open an isolated note's neighborhood
- **WHEN** a note has no links in or out
- **THEN** its neighborhood page renders the context graph with only that note focused and lists only its owning domain

## MODIFIED Requirements

### Requirement: Global graph page
The workspace root SHALL provide one interactive graph containing every note and every resolved link from all configured Brains. Each Brain SHALL also have an interactive graph containing its notes plus directly connected foreign notes as boundary nodes. Both graph modes MUST support pan, zoom, hover, and click-to-navigate and remain smooth at a workspace total of at least 2,000 notes.

#### Scenario: Explore the full workspace
- **WHEN** a reader opens the workspace root
- **THEN** the graph contains all notes from every configured Brain and all resolved links between them

#### Scenario: Explore selected brains
- **WHEN** a reader dims every Brain except Engineering and Design through the lens
- **THEN** Engineering and Design remain at full emphasis with all their links while the other Brains recede in place and stay rendered

#### Scenario: Explore one brain's boundary
- **WHEN** an Engineering note links to Design while Engineering is active
- **THEN** Engineering's graph shows the Design note as a foreign boundary node without adding unrelated Design notes

#### Scenario: Navigate from graph
- **WHEN** a reader clicks a local or foreign node
- **THEN** the browser navigates to that note's namespaced page

#### Scenario: Smooth at scale
- **WHEN** configured Brains contain a workspace total of 2,000 notes
- **THEN** panning and zooming the full workspace graph stays fluid on a typical laptop

### Requirement: Meaningful visual encoding
Graph nodes and edges SHALL visibly encode brain membership and cross-brain relationships without relying on color alone. A per-brain graph MUST distinguish foreign boundary nodes from local nodes while retaining discernible type, status, and connectivity encoding. The full workspace graph MUST assign each brain a consistent accent and provide a legend mapping accents and non-color markers to brain identity.

In a per-brain graph, foreign boundary nodes and cross-brain edges MUST use a neutral, lower-emphasis treatment than local content while retaining a visible non-color foreign marker. Every foreign label that is rendered MUST include an explicit `@brain` identity. The full workspace graph SHALL render every Brain at full emphasis unless the reader's lens dims it, and a dimmed Brain MUST remain distinguishable from a hidden filter result because its nodes stay rendered in place.

#### Scenario: Recognize a foreign node
- **WHEN** a reader views a per-brain graph containing a linked note from another brain
- **THEN** the foreign note has a non-color foreign marker, any rendered label identifies the target brain, and its muted treatment remains visually subordinate to local notes

#### Scenario: Recognize brains in a combined graph
- **WHEN** a reader views notes from several Brains on the full workspace graph
- **THEN** the graph and legend identify each node's owning brain without requiring hover or color perception

#### Scenario: Hubs stand out
- **WHEN** a note has many more links than the median visible note
- **THEN** its node is visibly larger than low-connectivity notes

#### Scenario: Established notes are distinguishable
- **WHEN** a reader views a per-brain or full workspace graph
- **THEN** established notes remain visually distinguishable from draft notes without hovering

### Requirement: Graph filtering
Graph controls SHALL filter visible nodes by note type, status, and tag when those dimensions apply to the current view. On the full workspace graph and on a per-Brain graph, one Brain control SHALL appear as the rightmost segment of the left graph-control pill and govern the personal Brain lens. Shared navigation and the graph Filters panel MUST NOT duplicate Brain controls. Dimming a Brain through the lens MUST NOT remove nodes or edges and MUST NOT change the URL; type, status, and tag filters continue to remove non-matching nodes and their incident edges. Foreign boundary nodes in a per-Brain graph MUST remain governed by their connection to the active Brain.

A per-brain graph SHALL hide foreign boundary nodes by default and provide an explicit toggle that shows or hides all directly related foreign notes and their cross-brain edges without affecting local nodes.

#### Scenario: Show related brains
- **WHEN** a reader enables related brains from a per-brain graph
- **THEN** directly connected foreign notes and cross-brain edges appear with muted foreign styling while unrelated foreign notes remain hidden

#### Scenario: Return to local focus
- **WHEN** a reader disables related brains
- **THEN** every foreign node and cross-brain edge is hidden while the active brain's local graph remains visible

#### Scenario: Remove a brain from a combined graph
- **WHEN** a reader unchecks Research through the Brain control on the full workspace graph
- **THEN** Research nodes and incident edges recede in place, remain rendered, and the URL does not change

#### Scenario: Locate Brain selection
- **WHEN** a reader opens the full workspace graph or a per-Brain graph
- **THEN** the Brain control is the rightmost segment of the left graph-control pill and no Brain control appears in shared navigation

#### Scenario: Filter by type
- **WHEN** a reader deselects `fleeting` in the type filter
- **THEN** all visible fleeting notes and their incident edges disappear

#### Scenario: Combine filters
- **WHEN** a reader filters to type `permanent` and status `established`
- **THEN** only permanent established notes remain visible in the current graph

### Requirement: Graph search
Graph search SHALL match note titles within the graph's current scope, every configured Brain on the full workspace graph including dimmed Brains, and the active Brain plus its visible related notes on a per-Brain graph. It MUST show the owning brain for every match and keep equal titles from different brains as distinct results. Selecting a match MUST establish the corresponding namespaced node as the graph's persistent focus, reflect that focus in the current graph page's URL as in-session state, and fit its visible neighborhood without changing graph-space node positions.

#### Scenario: Search duplicate titles
- **WHEN** two Brains contain `Principles` and a reader searches for that title on the full workspace graph
- **THEN** both results appear with different brain labels and either result focuses the correct node

#### Scenario: Search a dimmed brain
- **WHEN** a reader whose lens dims Research searches for a Research note title
- **THEN** the Research note appears as a result and selecting it focuses that note at full emphasis

#### Scenario: Search focuses node
- **WHEN** a reader selects a graph search result
- **THEN** the matching node and its direct neighborhood become persistently focused, the camera fits that neighborhood, and the current graph page's URL identifies the focused node

### Requirement: Shareable focused graph neighborhoods
The global graph SHALL let a reader persist the neighborhood currently inspected by pointer, touch, or graph search. A focused neighborhood MUST retain full emphasis for the focused note, its directly connected visible neighbors, their titles, and edges incident to the focused note while preserving unrelated markers as lower-emphasis orientation context, and MUST outrank the reader's Brain lens inside that neighborhood. The focused note MUST have a persistent non-color-only indicator distinct from transient hover. The shareable identity of a focused neighborhood MUST be the focused note's neighborhood page path; the copied neighborhood link MUST be that path with no query string or fragment. While a reader pins focus on a graph page, that page's URL MAY reflect the focus as in-session query state, and opening such a URL with the query removed MUST still open the same graph page unfocused. Focus links MUST NOT encode transient filters, lens state, dragged positions, or raw camera coordinates.

On a fine-pointer desktop graph, invoking the context menu over an eligible node marker or rendered title SHALL offer actions to pin or move focus, copy the focused-neighborhood link, and open the note. The native context menu MUST remain available over empty graph space. Touch long press and keyboard-accessible graph search MUST reach the same focused state. A reader MUST be able to copy and clear focus without relying on another right-click.

Secondary-button and context-menu gestures MUST NOT begin or continue node dragging. While a neighborhood is focused, pointer movement over other nodes MUST NOT replace the focused emphasis, reveal another neighborhood, or move graph nodes. Lower-emphasis unrelated nodes MUST NOT navigate on left-click, while context-menu Move focus here and Open note remain available. Fit view MUST fit the focused note and its visible direct neighbors while focus exists and fit all visible nodes after focus is cleared.

#### Scenario: Pin a hovered neighborhood
- **WHEN** a desktop reader opens the context menu over a hovered note marker or rendered title and chooses Pin neighborhood
- **THEN** that note remains visibly focused after the pointer leaves and the graph page's URL reflects the focus as in-session state

#### Scenario: Copy a neighborhood link
- **WHEN** a reader copies the link for a focused Engineering note on the full workspace graph
- **THEN** the copied URL is that note's neighborhood page path under the site origin and base path, with no query string, fragment, lens, camera, or layout data

#### Scenario: Open a shared doorway
- **WHEN** another reader opens a copied neighborhood link with no prior state for the site
- **THEN** the neighborhood page opens with every configured Brain present, the focused note visible, its direct neighborhood emphasized, and the neighborhood fitted within the usable viewport

#### Scenario: Lose in-session focus state
- **WHEN** a graph page URL carrying in-session focus is reopened without its query string
- **THEN** the same graph page opens unfocused and no recovery card is shown

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
- **WHEN** the reader applies a type, status, or tag filter that excludes the focused note
- **THEN** Brain clears the focus indicator and removes the in-session focus state from the graph page's URL

#### Scenario: Keep focus through the lens
- **WHEN** the reader dims the focused note's Brain through the lens
- **THEN** the focused neighborhood stays at full emphasis and focus is not cleared

#### Scenario: Ignore recipient filter history
- **WHEN** a reader opens a neighborhood page but stored local filter or lens state would hide or dim the focused note
- **THEN** the focused neighborhood takes precedence on initial restoration so the subject and its neighborhood remain visible at full emphasis

#### Scenario: Operate focus without a fine pointer
- **WHEN** a touch reader long-presses a note or a keyboard reader selects a graph-search result
- **THEN** Brain establishes the same persistent focused state and exposes accessible actions to copy or clear it

### Requirement: Focused graph round-trip navigation
When a reader opens a note from a persistently focused graph, the note destination MAY carry the originating focused note as in-session return context. The originating focus MAY be the opened note or another note in the same visible focused neighborhood. The note's Graph action MUST open the originating note's neighborhood page when that context is present and valid, and otherwise MUST open the opened note's own neighborhood page. Losing the return context MUST degrade to the opened note's own neighborhood page rather than to a selection step or recovery card. A direct note visit without return context MUST NOT infer a different pinned note.

#### Scenario: Return after opening the focused note
- **WHEN** a reader opens the focused note from a pinned neighborhood and then activates Graph on the note page
- **THEN** Brain opens that note's neighborhood page with the same note and neighborhood focused

#### Scenario: Return after opening a focused neighbor
- **WHEN** a reader opens a neighboring note from a graph pinned on another note and then activates Graph on the note page
- **THEN** Brain opens the originally pinned note's neighborhood page rather than the opened neighbor's

#### Scenario: Open a focused-context note link without prior state
- **WHEN** a first-time visitor opens a note URL carrying valid return context and activates Graph
- **THEN** Brain opens the originating note's neighborhood page through a pathname-only link without requiring any prior selection or history

#### Scenario: Open a direct note without return focus
- **WHEN** a reader opens a namespaced note URL with no return context
- **THEN** the note's Graph action opens that note's own neighborhood page

#### Scenario: Lose return context through a proxy
- **WHEN** a note URL carrying return context is reopened with its query string removed
- **THEN** the note opens normally and its Graph action opens the note's own neighborhood page

#### Scenario: Ignore invalid return focus
- **WHEN** a note URL carries return context naming an unknown note
- **THEN** Brain ignores it and the Graph action opens the opened note's own neighborhood page
