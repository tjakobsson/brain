# Site Search Specification

## Purpose

Provides fast, fully client-side discovery across the vault: full-text search over note content and a keyboard-first quick switcher for jumping directly to notes.

## Requirements

### Requirement: Full-text search
The site SHALL provide full-text search over all note titles and body content. The search index MUST be generated at build time and served as static assets — search MUST work with no server-side component. Results MUST show the note title with a content snippet and link to the note.

#### Scenario: Search finds note by content
- **WHEN** a reader searches for a phrase that appears in a note's body
- **THEN** that note appears in results with a snippet showing the phrase in context

#### Scenario: Static deployment search works
- **WHEN** the site is deployed to a plain static host (or opened via `astro preview`)
- **THEN** search functions fully without any backend

### Requirement: Quick switcher
The site SHALL provide a keyboard-driven quick switcher (opened with Cmd+K / Ctrl+K) that fuzzy-matches note titles and tags as the user types, is fully navigable by keyboard, and navigates to the selected note on confirm.

#### Scenario: Keyboard-first navigation
- **WHEN** a reader presses Cmd+K, types part of a note title, arrows to a result, and presses Enter
- **THEN** the browser navigates to that note without the reader touching the mouse

#### Scenario: Tag jump
- **WHEN** a reader types a tag name into the quick switcher
- **THEN** the matching tag page appears among the results

### Requirement: Search availability on every page
Search entry points (a visible search affordance and the Cmd+K shortcut) SHALL be available on every page of the site.

#### Scenario: Shortcut works from any page
- **WHEN** a reader is on a note page, the graph page, or a tag page and presses Cmd+K
- **THEN** the quick switcher opens in each case
