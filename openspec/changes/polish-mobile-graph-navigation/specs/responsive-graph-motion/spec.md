## MODIFIED Requirements

### Requirement: Controlled initial settling
The global graph SHALL begin from its deterministic build-time layout and animate its nodes and camera framing into a settled composition as one continuous transition. It MUST NOT start a distinct follow-up camera transition after the initial node settling completes. Motion MUST stop automatically after convergence or a bounded time limit.

#### Scenario: Graph settles after loading
- **WHEN** a reader opens the graph without a stored composition and with motion enabled
- **THEN** nodes and camera framing transition smoothly into the fitted settled composition and stop without a subsequent camera movement

#### Scenario: Settling remains bounded
- **WHEN** the graph cannot reach the movement threshold promptly
- **THEN** the system stops settling within 2.5 seconds

### Requirement: Viewport-aware composition
The graph SHALL adapt its visible composition to the current graph viewport while preserving recognizable cluster relationships. When a viewport change triggers animated settling, nodes and camera framing SHALL move as one continuous transition and MUST NOT start a distinct follow-up camera transition after node settling completes.

#### Scenario: Phone orientation changes
- **WHEN** a reader rotates a phone between portrait and landscape
- **THEN** the graph animates to use the new width and height and refits the visible nodes within the viewport as one continuous transition

#### Scenario: Graph container resizes
- **WHEN** the graph container dimensions change without a page reload
- **THEN** the graph debounces repeated resize events and performs one coordinated responsive refit and settle for the final dimensions without subsequent camera movement

#### Scenario: Desktop filter panel changes graph width
- **WHEN** a reader opens or closes the filter panel and the graph viewport width changes
- **THEN** the graph performs one coordinated transition into the fitted composition for the new width

#### Scenario: Mobile filter panel overlays the graph
- **WHEN** a reader opens or closes an overlay filter panel without changing the graph viewport dimensions
- **THEN** the panel transition does not initiate graph settling or camera movement
