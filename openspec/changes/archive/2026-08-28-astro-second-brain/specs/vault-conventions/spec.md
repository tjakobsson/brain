## Purpose

Defines the authoring contract for markdown notes in the vault so the AI author (and any human) produces consistent, machine-validatable content that stays fully compatible with Obsidian.

## ADDED Requirements

### Requirement: Plain markdown vault
The vault SHALL be a directory of plain `.md` files at `vault/` in the repository root, readable by any markdown tool. The vault MUST remain openable as a native Obsidian vault with working links, using no proprietary formats or build-time-only syntax that breaks plain-text readability.

#### Scenario: Open vault in Obsidian
- **WHEN** the `vault/` directory is opened as an Obsidian vault
- **THEN** all notes are readable and all `[[wiki-links]]` resolve natively within Obsidian

#### Scenario: Folder organization is free-form
- **WHEN** a note is placed in any subfolder of `vault/` (or at the root)
- **THEN** it is published on the site and its location does not affect link resolution

### Requirement: Title-slug note identity
A note's canonical identity SHALL be its filename without the `.md` extension (its title). Note titles MUST be unique across the entire vault regardless of subfolder. The site URL for a note SHALL be derived from a URL-friendly slug of its title.

#### Scenario: Duplicate titles rejected
- **WHEN** two notes share the same filename in different subfolders
- **THEN** the build fails with an error naming both conflicting files

#### Scenario: Readable URLs
- **WHEN** a note titled `Graphs of thought.md` is published
- **THEN** it is served at a URL derived from that title (e.g. `/notes/graphs-of-thought`)

### Requirement: Validated frontmatter
Each note SHALL carry YAML frontmatter validated against a schema at build time. The schema MUST support: `title` (optional, defaults to filename), `type` (enum: `fleeting`, `literature`, `permanent`; defaults to `permanent`), `status` (enum: `draft`, `developing`, `established`; defaults to `draft`), `tags` (list of strings, defaults to empty), `created` (date, optional), `updated` (date, optional). Invalid frontmatter MUST fail the build with a message identifying the file and the offending field.

#### Scenario: Invalid enum value fails the build
- **WHEN** a note has `type: permenant` (misspelled)
- **THEN** the build fails and reports the file path and the invalid `type` value

#### Scenario: Minimal frontmatter gets defaults
- **WHEN** a note's frontmatter contains no `type`, `status`, or `tags`
- **THEN** it builds successfully with defaults `permanent`, `draft`, and `[]`

### Requirement: Wiki-link authoring syntax
Notes SHALL link to each other with Obsidian-style wiki-links: `[[Note Title]]`, `[[Note Title|display text]]` for aliases, and `[[Note Title#Heading]]` for heading anchors. Link targets MUST match note titles (not file paths), so links survive a note moving between subfolders.

#### Scenario: Alias link authored
- **WHEN** a note contains `[[Zettelkasten method|the ZK method]]`
- **THEN** the published page shows a link reading "the ZK method" pointing to the note titled "Zettelkasten method"

#### Scenario: Note moves folders, links survive
- **WHEN** a note is moved from `vault/sources/` to `vault/` root without renaming
- **THEN** all existing wiki-links to it still resolve after rebuild
