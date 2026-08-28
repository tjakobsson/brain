## Purpose

Keeps graph nodes under the pointer while hover emphasis reveals a note's immediate neighborhood, including in dense vault graphs.

## ADDED Requirements

### Requirement: Hover preserves graph geometry
Starting, changing, or ending a node hover in the global or local graph SHALL change visual emphasis only. Hover events MUST NOT initiate layout settling, alter graph-space node coordinates, or alter the camera state.

#### Scenario: Pointer enters a settled node
- **WHEN** the pointer enters a node while no independently triggered layout or camera animation is active
- **THEN** every node remains at the same screen position while the hovered neighborhood is emphasized

#### Scenario: Pointer leaves a settled node
- **WHEN** the pointer leaves a hovered node while no independently triggered layout or camera animation is active
- **THEN** the normal visual treatment returns without moving nodes or changing the camera

#### Scenario: Pointer moves between nearby nodes
- **WHEN** the pointer moves directly from one node to another in a dense graph
- **THEN** emphasis transfers to the new node without a layout refit or camera jump

### Requirement: Hovered nodes remain clickable
Hover rendering SHALL keep the intended node's pointer target stable long enough for a click at the same pointer location to select that node. Re-rendering hover emphasis MUST NOT create an enter-and-leave cycle that displaces or repeatedly changes the hovered target while the pointer is stationary.

#### Scenario: Click after hover
- **WHEN** a reader places the pointer over a node and clicks without moving the pointer
- **THEN** the click selects the same node whose title and neighborhood were shown on hover

#### Scenario: Stationary pointer on a dense graph
- **WHEN** the pointer remains stationary over a node while hover emphasis is rendered
- **THEN** the graph keeps that node hovered without oscillating between hovered and unhovered states
