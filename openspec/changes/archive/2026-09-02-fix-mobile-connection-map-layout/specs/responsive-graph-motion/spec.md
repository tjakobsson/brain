## MODIFIED Requirements

### Requirement: Viewport-aware composition
The global graph and each note-page connection map SHALL adapt their visible composition to the current graph viewport while preserving recognizable cluster relationships. A connection map MUST compose its displayed neighborhood for its own viewport rather than relying only on inherited full-graph coordinates and camera fitting. When a viewport change triggers animated settling, nodes and camera framing SHALL move as one continuous transition and MUST NOT start a distinct follow-up camera transition after node settling completes.

#### Scenario: Phone orientation changes
- **WHEN** a reader rotates a phone between portrait and landscape while viewing a global graph or connection map
- **THEN** the graph animates to use the new width and height and refits the visible nodes within the viewport as one continuous transition

#### Scenario: Graph container resizes
- **WHEN** a global graph or connection-map container changes dimensions without a page reload
- **THEN** the graph debounces repeated resize events and performs one coordinated responsive refit and settle for the final dimensions without subsequent camera movement

#### Scenario: Desktop filter panel changes graph width
- **WHEN** a reader opens or closes the filter panel and the global graph viewport width changes
- **THEN** the graph performs one coordinated transition into the fitted composition for the new width

#### Scenario: Mobile filter panel overlays the graph
- **WHEN** a reader opens or closes an overlay filter panel without changing the global graph viewport dimensions
- **THEN** the panel transition does not initiate graph settling or camera movement

#### Scenario: Clustered local neighborhood opens on a phone
- **WHEN** a connection map's notes have inherited full-graph positions that overlap or align too closely for its narrow viewport
- **THEN** the map settles the neighborhood into a readable viewport-aware composition and fits that composition within the map
