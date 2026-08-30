## MODIFIED Requirements

### Requirement: Progressive mobile graph labels
Global and note-page local graphs on narrow viewports SHALL keep their fitted overview labels selectively rendered to preserve legibility. After a reader zooms in enough to create meaningful separation between nodes, the graph MUST render the title of every eligible visible node rather than leaving visible nodes unlabelled because of overview density selection or narrow-view title-width limits. A note-page local graph MUST determine detailed zoom relative to its own fitted overview so the behavior remains consistent across neighborhood topology and connection-map dimensions. Zooming back to the fitted overview MUST restore selective label rendering.

#### Scenario: Inspect nodes by zooming on a phone
- **WHEN** a reader zooms substantially into a global graph or substantially closer than a note-page local graph's fitted overview on a narrow viewport
- **THEN** every eligible node visible in the zoomed viewport renders its title, including titles omitted from the fitted overview

#### Scenario: Inspect different note neighborhoods
- **WHEN** readers zoom equally far from the fitted overview in local graphs with different neighborhood sizes or fitted camera scales
- **THEN** both local graphs reveal eligible visible titles without requiring either graph to cross one absolute camera ratio

#### Scenario: Preserve the fitted overview
- **WHEN** a narrow graph is initially fitted or the reader returns it to the fitted overview
- **THEN** labels remain selectively rendered so dense graphs do not collapse into overlapping text

#### Scenario: Return from detailed zoom
- **WHEN** a reader zooms back out after inspecting titles on a narrow graph
- **THEN** the graph resumes selective label rendering without changing node visibility or position
