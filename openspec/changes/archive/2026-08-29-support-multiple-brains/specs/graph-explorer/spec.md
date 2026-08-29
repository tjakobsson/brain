## MODIFIED Requirements

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

### Requirement: Meaningful visual encoding
Graph nodes and edges SHALL visibly encode brain membership and cross-brain relationships without relying on color alone. A per-brain graph MUST distinguish foreign boundary nodes from local nodes while retaining discernible type, status, and connectivity encoding. A combined graph MUST assign each brain a consistent accent and provide a legend mapping accents and non-color markers to brain identity.

In a per-brain graph, foreign boundary nodes and cross-brain edges MUST use a neutral, lower-emphasis treatment than local content while retaining an explicit `@brain` label and foreign marker. Combined graphs SHALL continue to render every selected brain at full emphasis.

#### Scenario: Recognize a foreign node
- **WHEN** a reader views a per-brain graph containing a linked note from another brain
- **THEN** the foreign note has the target brain's label or marker and a muted treatment visually subordinate to local notes

#### Scenario: Recognize brains in a combined graph
- **WHEN** a reader views notes from several selected brains
- **THEN** the graph and legend identify each node's owning brain without requiring hover or color perception

#### Scenario: Hubs stand out
- **WHEN** a note has many more links than the median visible note
- **THEN** its node is visibly larger than low-connectivity notes

#### Scenario: Established notes are distinguishable
- **WHEN** a reader views a per-brain or combined graph
- **THEN** established notes remain visually distinguishable from draft notes without hovering

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

#### Scenario: Combine metadata filters
- **WHEN** a reader filters selected brains to permanent established notes
- **THEN** only notes matching both metadata filters remain visible

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

### Requirement: Local graph on note pages
Every note page SHALL include a local graph showing the note and its local and cross-brain neighborhood. Foreign notes and cross-brain edges MUST use the same brain-aware visual language as the global graphs and support navigation to namespaced note pages.

#### Scenario: Local graph crosses a brain boundary
- **WHEN** a note links to two local notes and one foreign note
- **THEN** its local graph shows all three connections and visibly identifies the foreign brain

#### Scenario: Local graph shows neighborhood
- **WHEN** a reader opens a note linked to three other notes
- **THEN** the local graph shows those connected notes and clicking one navigates to its namespaced page
