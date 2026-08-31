## ADDED Requirements

### Requirement: Neighborhood inspection establishes clear visual priority
Inspecting a node in a global or local graph SHALL retain full visual emphasis for the selected node, its immediate neighbors, their labels, and edges incident to the selected node. Nodes outside that neighborhood, their labels, and edges outside that neighborhood MUST remain visible but use a substantially lower-emphasis treatment in both supported color schemes. Changing emphasis MUST NOT alter graph-space node coordinates or camera state.

#### Scenario: Inspect a neighborhood in a light color scheme
- **WHEN** a reader inspects a node while the light color scheme is active
- **THEN** the selected neighborhood remains fully legible while unrelated nodes, labels, and edges visibly recede without disappearing

#### Scenario: Inspect a neighborhood in a dark color scheme
- **WHEN** a reader inspects a node while the dark color scheme is active
- **THEN** the selected neighborhood remains fully legible while unrelated nodes, labels, and edges visibly recede without disappearing

#### Scenario: End pointer inspection
- **WHEN** a pointer leaves the inspected node
- **THEN** normal emphasis returns without moving any node or changing the camera

### Requirement: Touch long press keeps a neighborhood available for inspection
A touch reader SHALL be able to long press a node to activate the same neighborhood emphasis used by pointer hover. Activation MUST suppress navigation for that press, remain active after release, and end when the reader next taps empty graph space or navigates by tapping a node. Movement that becomes a node drag MUST cancel pending long-press activation and preserve existing drag behavior.

#### Scenario: Long press and release a node
- **WHEN** a touch reader holds a node without moving beyond the gesture tolerance and then releases
- **THEN** that node's neighborhood remains emphasized and the browser does not navigate

#### Scenario: Clear persistent inspection
- **WHEN** a touch reader taps empty graph space while a long-press neighborhood is active
- **THEN** normal graph emphasis returns without moving nodes or changing the camera

#### Scenario: Navigate after persistent inspection
- **WHEN** a touch reader taps a node while a long-press neighborhood is active
- **THEN** the browser navigates to the tapped note using the existing touch target behavior

#### Scenario: Drag instead of holding
- **WHEN** touch movement exceeds the node-drag tolerance before long-press activation
- **THEN** pending long-press activation is canceled and the node drag continues without accidental navigation
