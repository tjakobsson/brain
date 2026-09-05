## MODIFIED Requirements

### Requirement: Touch long press keeps a neighborhood available for inspection
A touch reader SHALL be able to long press a node to activate the same neighborhood emphasis used by pointer hover. Activation MUST suppress navigation for that press, remain active after release, and end when the reader next taps empty graph space or navigates by tapping a node. Movement that becomes a node drag MUST cancel pending long-press activation and preserve existing drag behavior. A camera gesture is not a tap: any touch sequence that involves more than one simultaneous contact point MUST NOT clear the active neighborhood, at any point during the gesture or when its contact points lift, whatever order they lift in. Only a touch sequence that begins and ends as a single stationary contact on empty graph space MAY clear it. The global graph and every note-page connection map MUST behave the same way.

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

#### Scenario: Pinch to zoom a pinned neighborhood
- **WHEN** a touch reader pinches to zoom while a long-press neighborhood is active, and lifts the two contact points in either order
- **THEN** the camera scale changes and the same neighborhood stays emphasized, with the focused note still identified in the focused-neighborhood bar and in any in-session focus URL state

#### Scenario: Two-finger pan a pinned neighborhood
- **WHEN** a touch reader moves two contact points together across empty graph space while a long-press neighborhood is active
- **THEN** the camera pans and the same neighborhood stays emphasized

#### Scenario: Pinch a pinned neighborhood on a note page
- **WHEN** a touch reader pinches to zoom a note-page connection map while a long-press neighborhood is active
- **THEN** that neighborhood stays emphasized, matching the global graph
