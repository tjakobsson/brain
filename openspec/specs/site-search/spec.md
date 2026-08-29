# Site Search Specification

## Purpose

Provides fast, fully client-side discovery across the vault: full-text search over note content and a keyboard-first quick switcher for jumping directly to notes.

## Requirements

### Requirement: Full-text search
The site SHALL provide static client-side full-text search over the active brain by default and SHALL let the reader search all brains in the current combined selection. Results MUST show the note title, owning brain, content snippet, and namespaced link. Equal titles from different brains MUST remain distinct results.

#### Scenario: Search the active brain
- **WHEN** a reader searches from an Engineering page without changing scope
- **THEN** results contain Engineering notes and omit unrelated brains

#### Scenario: Search selected brains
- **WHEN** a reader switches search scope to an Engineering and Research combined selection
- **THEN** results include matching notes from exactly those brains and label each result's owner

#### Scenario: Search finds note by content
- **WHEN** a reader searches for a phrase in a note within the current scope
- **THEN** that note appears with its brain label and a snippet showing the phrase

#### Scenario: Static deployment search works
- **WHEN** a workspace site is deployed to a static host or opened through preview
- **THEN** scoped search works without a backend

### Requirement: Quick switcher
The quick switcher SHALL fuzzy-match note titles and tags within the active brain by default and SHALL offer an explicit workspace scope covering the current combined selection or all configured brains. Every note result MUST identify its owning brain, and confirming a result MUST navigate to its namespaced route.

#### Scenario: Distinguish duplicate titles
- **WHEN** the current switcher scope contains equal note titles from two brains
- **THEN** both results appear with brain labels and each navigates to the correct note

#### Scenario: Keep local navigation concise
- **WHEN** a reader opens the switcher in Engineering without selecting workspace scope
- **THEN** the default results contain Engineering notes and tags only

#### Scenario: Keyboard-first navigation
- **WHEN** a reader opens the switcher, types part of a title, selects a result with arrow keys, and presses Enter
- **THEN** the browser navigates to the selected namespaced note without pointer input

#### Scenario: Tag jump
- **WHEN** a reader types a tag name into the quick switcher
- **THEN** matching tag pages in the current scope appear among the results with brain context

### Requirement: Search availability on every page
Search entry points and the Cmd+K or Ctrl+K shortcut SHALL be available on brain pages, note pages, reports, combined views, and the root brain chooser. Search opened from the chooser MUST use all configured brains because no active brain exists.

#### Scenario: Search from the chooser
- **WHEN** a reader presses the search shortcut on the root chooser
- **THEN** the switcher opens with results from all configured brains and labels their owners

#### Scenario: Shortcut works from any page
- **WHEN** a reader presses the search shortcut on a chooser, note, graph, tag, report, or combined page
- **THEN** the quick switcher opens with the context-appropriate scope
