# Site Search Specification

## Purpose

Provides fast, fully client-side discovery across the vault through one keyboard-first quick switcher that fuzzy-matches note titles and tags and jumps directly to notes.

## Requirements

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

### Requirement: Search availability on every page
The navigation pill's Search action and the Cmd+K or Ctrl+K shortcut SHALL open the quick switcher on brain pages, note pages, reports, combined views, and the root brain chooser. Search opened from the chooser MUST use all configured brains because no active brain exists. The generated site MUST NOT expose a dedicated general Search page or a secondary Search menu destination.

#### Scenario: Search from the chooser
- **WHEN** a reader activates the pill's Search action or presses the search shortcut on the root chooser
- **THEN** the switcher opens with results from all configured brains and labels their owners

#### Scenario: Shortcut works from any page
- **WHEN** a reader presses the search shortcut on a chooser, note, graph, tag, report, or combined page
- **THEN** the quick switcher opens with the context-appropriate scope

#### Scenario: Use the only search entry point
- **WHEN** a reader examines the navigation pill and expanded menu
- **THEN** the direct Search action opens the quick switcher and no link to a dedicated Search page is offered
