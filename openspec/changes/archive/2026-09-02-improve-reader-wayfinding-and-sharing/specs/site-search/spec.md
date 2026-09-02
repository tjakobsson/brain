## MODIFIED Requirements

### Requirement: Quick switcher
The quick switcher SHALL fuzzy-match note titles and tags within the active brain by default and SHALL offer an explicit workspace scope covering the current combined selection or all configured brains. When a valid selected-Brain browsing scope is retained on a note page, that selected scope MUST remain available and become the context-appropriate default rather than collapsing to the note owner's Brain. Every note result MUST identify its owning brain, and confirming a note result MUST navigate to its namespaced route while retaining the valid selected-Brain browsing scope. Equal titles from different Brains MUST remain distinct.

#### Scenario: Distinguish duplicate titles
- **WHEN** the current switcher scope contains equal note titles from two brains
- **THEN** both results appear with brain labels and each navigates to the correct note

#### Scenario: Keep local navigation concise
- **WHEN** a reader opens the switcher in Engineering without retained selected-Brain context
- **THEN** the default results contain Engineering notes and tags only

#### Scenario: Search from a combined-context note
- **WHEN** a reader opens the switcher from an Engineering note reached through an Engineering and Design combined graph
- **THEN** the switcher defaults to the retained Engineering and Design scope and identifies both Brains in matching results

#### Scenario: Preserve scope after a jump
- **WHEN** a reader confirms a Design note result while browsing Engineering and Design
- **THEN** the browser opens the Design note's namespaced route and retains the Engineering and Design browsing scope

#### Scenario: Keyboard-first navigation
- **WHEN** a reader opens the switcher, types part of a title, selects a result with arrow keys, and presses Enter
- **THEN** the browser navigates to the selected namespaced note with the context-appropriate scope and without pointer input

#### Scenario: Tag jump
- **WHEN** a reader types a tag name into the quick switcher
- **THEN** matching tag pages in the current supported scope appear among the results with brain context
