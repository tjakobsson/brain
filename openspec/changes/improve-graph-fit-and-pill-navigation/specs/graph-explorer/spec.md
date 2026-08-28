## ADDED Requirements

### Requirement: Reader-controlled graph fitting
The global graph and each note page's local graph SHALL provide a visible Fit view control. Activating Fit view MUST place the complete rendered bounds of every included node marker and every label rendered at the fitted camera state inside the usable graph viewport with visible padding, provided each individual rendered item can fit within that viewport.

#### Scenario: Fit the global graph
- **WHEN** a reader activates Fit view on the global graph after loading, filtering, zooming, or panning
- **THEN** all visible node markers and their rendered labels fit inside the usable graph viewport without clipping

#### Scenario: Fit a local connection map
- **WHEN** a reader activates Fit view on a note page's connection map after zooming or panning
- **THEN** every node marker and rendered label in that local graph fits inside the usable graph viewport without clipping

#### Scenario: Fit long and highly connected notes
- **WHEN** the included graph contains a long rendered note title or a node marker enlarged by high connectivity
- **THEN** Fit view accounts for that rendered extent rather than fitting only the node's center point

#### Scenario: Fit only included nodes
- **WHEN** global graph filters hide one or more nodes
- **THEN** Fit view excludes the hidden nodes and their labels when calculating the fitted camera state
