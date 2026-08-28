# Graph Explorer Specification

## Purpose

Provides the centerpiece visual exploration of the vault: an interactive global graph of every note and connection, plus a local neighborhood graph on each note page — filterable, searchable, and stable across visits.

## Requirements

### Requirement: Global graph page
The site SHALL provide a graph page rendering every note and resolved link in the vault as an interactive graph with pan, zoom, hover, and click-to-navigate interactions. The graph MUST remain smooth at the vault's full size (target: at least 2,000 notes without interaction jank).

#### Scenario: Navigate from graph
- **WHEN** a reader clicks a node in the global graph
- **THEN** the browser navigates to that note's page

#### Scenario: Smooth at scale
- **WHEN** the vault contains 2,000 notes
- **THEN** panning and zooming the global graph stays fluid (no visible stutter on a typical laptop)

### Requirement: Stable precomputed layout
Node positions in the global graph SHALL be computed at build time using a force-directed layout that reveals cluster structure, and MUST be identical on every page load until the vault changes and is rebuilt.

#### Scenario: Spatial memory works
- **WHEN** a reader visits the graph page on two separate occasions without a rebuild
- **THEN** every node appears in the same position both times

### Requirement: Meaningful visual encoding
Graph nodes SHALL visually encode note metadata: color distinguishing note `type`, size reflecting connectivity (link degree), and a distinguishable treatment for `status`.

#### Scenario: Hubs stand out
- **WHEN** a note has many more links than the median note
- **THEN** its node is visibly larger than low-connectivity notes

#### Scenario: Established notes are distinguishable
- **WHEN** a reader views the graph
- **THEN** `established` notes are visually distinguishable from `draft` notes without hovering

### Requirement: Graph filtering
The graph page SHALL provide controls to filter visible nodes by note type, status, and tag. Filtered-out nodes and their edges MUST be hidden from the rendered graph (not merely dimmed).

#### Scenario: Filter by type
- **WHEN** a reader deselects `fleeting` in the type filter
- **THEN** all fleeting notes and their edges disappear from the graph

#### Scenario: Combine filters
- **WHEN** a reader filters to type `permanent` and status `established`
- **THEN** only permanent established notes remain visible

### Requirement: Graph search
The graph page SHALL provide a search field over note titles. Matching nodes MUST be highlighted (non-matches visually de-emphasized), and selecting a match MUST move the camera to focus that node.

#### Scenario: Search focuses node
- **WHEN** a reader searches for a note title and selects it from the matches
- **THEN** the camera animates to center on that node and the node is highlighted

### Requirement: Hover neighborhood highlight
Hovering a node in either graph SHALL highlight that node and its directly connected neighbors while de-emphasizing all other nodes, and MUST display the hovered note's title.

#### Scenario: Hover reveals connections
- **WHEN** a reader hovers a node
- **THEN** the node, its edges, and its direct neighbors stay prominent while the rest of the graph recedes

### Requirement: Local graph on note pages
Every note page SHALL include a compact local graph showing the note and its neighborhood (linked notes at minimum, optionally their connections), with hover and click-to-navigate support.

#### Scenario: Local graph shows neighborhood
- **WHEN** a reader opens a note that links to three other notes
- **THEN** the note page's local graph shows the note connected to those three notes, and clicking one navigates to it
