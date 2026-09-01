## MODIFIED Requirements

### Requirement: Viewport-aware composition
The graph SHALL adapt its visible composition to the current graph viewport while preserving recognizable cluster relationships. Resize observations and responsive-policy changes belonging to the same viewport change MUST be coalesced into one final update. When that update triggers animated settling, nodes and camera framing SHALL move as one continuous transition and MUST NOT start a distinct follow-up node or camera transition after settling completes.

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

#### Scenario: Browser zoom crosses a responsive breakpoint
- **WHEN** browser zoom changes the effective viewport and its graph label policy in one operation
- **THEN** the graph applies the final dimensions and label policy through one coordinated update rather than competing resize and breakpoint settles

#### Scenario: Hover after responsive settling
- **WHEN** the coordinated responsive update has completed and the reader inspects a node
- **THEN** inspection does not initiate, repeat, or resume graph settling
