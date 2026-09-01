## MODIFIED Requirements

### Requirement: Hover preserves graph geometry
Starting, changing, or ending a node hover in the global or local graph SHALL change visual emphasis only. Hover events MUST NOT initiate layout settling, alter graph-space node coordinates, or alter the camera state. Responsive work triggered before hover MUST settle into one stable frame and MUST NOT be restarted by moving between a node marker and its rendered title.

#### Scenario: Pointer enters a settled node
- **WHEN** the pointer enters a node while no independently triggered layout or camera animation is active
- **THEN** every node remains at the same screen position while the hovered neighborhood is emphasized

#### Scenario: Pointer leaves a settled node
- **WHEN** the pointer leaves a hovered node and its title while no independently triggered layout or camera animation is active
- **THEN** the normal visual treatment returns without moving nodes or changing the camera

#### Scenario: Pointer moves between nearby nodes
- **WHEN** the pointer moves directly from one node to another in a dense graph
- **THEN** emphasis transfers to the new node without a layout refit or camera jump

#### Scenario: Pointer crosses an inspected title
- **WHEN** the pointer moves from a node marker across that node's rendered title
- **THEN** the same neighborhood remains inspected without moving nodes or changing the camera

#### Scenario: Hover after browser zoom
- **WHEN** a reader changes browser zoom and then hovers the settled large graph
- **THEN** hover changes emphasis without starting or resuming responsive graph motion

### Requirement: Hovered nodes remain clickable
Hover rendering SHALL keep the intended node marker and rendered title as stable pointer targets long enough for inspection and selection. Re-rendering hover emphasis MUST NOT create an enter-and-leave cycle that displaces or repeatedly changes the hovered target while the pointer is stationary or moving across that target's title. The global and local graphs MUST preserve this behavior at supported browser zoom levels and fractional display scales.

#### Scenario: Click after hover
- **WHEN** a reader places the pointer over a node and clicks without moving the pointer
- **THEN** the click selects the same node whose title and neighborhood were shown on hover

#### Scenario: Stationary pointer on a dense graph
- **WHEN** the pointer remains stationary over a node while hover emphasis is rendered
- **THEN** the graph keeps that node hovered without oscillating between hovered and unhovered states

#### Scenario: Read a long title
- **WHEN** a reader moves the pointer from an inspected node along its long rendered title
- **THEN** the title and neighborhood remain emphasized for the entire rendered title target

#### Scenario: Inspect the large graph at increased browser zoom
- **WHEN** a reader increases browser zoom in Microsoft Edge or an equivalent Chromium browser and points at a settled global-graph node or title
- **THEN** the intended target remains stable without repeated hover transitions or visible jumps
