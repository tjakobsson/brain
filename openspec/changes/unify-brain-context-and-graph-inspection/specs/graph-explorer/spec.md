## MODIFIED Requirements

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
