# Graph Interaction Stability Specification

## Purpose

Keeps graph nodes under the pointer while hover emphasis reveals a note's immediate neighborhood, including in dense vault graphs.

## Requirements

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
A touch reader SHALL be able to long press a node to activate the same neighborhood emphasis used by pointer hover. Activation MUST suppress navigation for that press, remain active after release, and end when the reader next taps empty graph space or navigates by tapping a node. Movement that becomes a node drag MUST cancel pending long-press activation and preserve existing drag behavior. A camera gesture is not a tap: any touch sequence that involves more than one simultaneous contact point MUST NOT produce a click, navigate, or clear the active neighborhood, at any point during the gesture or when its contact points lift, whatever order they lift in, including both contacts lifting in one event. Suppression MUST include synthetic click handling caused by the final release. Only a touch sequence that begins and ends as a single stationary contact on empty graph space MAY clear it. The global graph and every note-page connection map MUST behave the same way.

#### Scenario: Long press and release a node
- **WHEN** a touch reader holds a node without moving beyond the gesture tolerance and then releases
- **THEN** that node's neighborhood remains emphasized and the browser does not navigate

#### Scenario: Clear persistent inspection
- **WHEN** a touch reader taps empty graph space while a long-press neighborhood is active
- **THEN** normal graph emphasis returns without moving nodes or changing the camera

#### Scenario: Navigate after persistent inspection
- **WHEN** a touch reader taps a node while a long-press neighborhood is active
- **THEN** the browser navigates to the tapped note using the existing touch target behavior

#### Scenario: Learn the touch gestures
- **WHEN** a reader opens graph Help on a touch layout
- **THEN** the guide explains that tapping an eligible note opens it and long-pressing pins it or moves the pin to it, without claiming that tapping a canvas neighbor moves focus

#### Scenario: Drag instead of holding
- **WHEN** touch movement exceeds the node-drag tolerance before long-press activation
- **THEN** pending long-press activation is canceled and the node drag continues without accidental navigation

#### Scenario: Pinch to zoom a pinned neighborhood
- **WHEN** a touch reader pinches to zoom while a long-press neighborhood is active, and lifts the two contact points in either order
- **THEN** the camera scale changes and the same neighborhood stays emphasized, with the focused note still identified in the focused-neighborhood bar and, on the global graph, by its neighborhood pathname

#### Scenario: Start a pinch on a node marker
- **WHEN** a touch reader lands on a marker and then adds a second contact, or lands both contacts together over a marker
- **THEN** the gesture belongs to camera zoom rather than node dragging, graph-space node positions stay unchanged during the pinch, and any pin is preserved

#### Scenario: Change a drag into a pinch
- **WHEN** a reader adds a second contact after moving a node with one finger
- **THEN** the drag ends at its current positions and the pinch changes only the camera; lifting one contact does not restart node dragging, but a fresh single-contact press can start another drag

#### Scenario: Lift both contacts together
- **WHEN** a touch reader releases both contacts in one event after a two-finger camera gesture on a global graph or note-page connection map, over a node or empty space
- **THEN** neither the release nor its synthetic events produce a click, navigate, or clear focus, and any pinned neighborhood remains active

#### Scenario: Two-finger pan a pinned neighborhood
- **WHEN** a touch reader moves two contact points together across empty graph space while a long-press neighborhood is active
- **THEN** the camera pans and the same neighborhood stays emphasized

#### Scenario: Pinch a pinned neighborhood on a note page
- **WHEN** a touch reader pinches to zoom a note-page connection map while a long-press neighborhood is active
- **THEN** that neighborhood stays emphasized, matching the global graph
