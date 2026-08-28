## Purpose

Computes the vault's connection structure at build time — backlinks with context, unlinked mentions, orphans, and the graph dataset — so connections between notes become first-class, visible, and actionable.

## ADDED Requirements

### Requirement: Linked mentions (backlinks)
Every note page SHALL include a "Linked mentions" section listing all notes that link to it. Each entry MUST include the surrounding sentence or line of context in which the link appears, not just the linking note's title. Notes with no inbound links MUST NOT render an empty section.

#### Scenario: Backlink with context
- **WHEN** note A contains the sentence "This builds on [[Note B]] in practice" and a reader opens note B
- **THEN** note B's Linked mentions section shows note A with the sentence "This builds on Note B in practice" as context

#### Scenario: No inbound links
- **WHEN** a note has no inbound links
- **THEN** no empty "Linked mentions" section is rendered on its page

### Requirement: Unlinked mentions
Every note page SHALL surface "Unlinked mentions": notes whose body text contains this note's title as plain text without a wiki-link to it. Unlinked mentions MUST be computed at build time and shown separately from linked mentions.

#### Scenario: Plain-text mention detected
- **WHEN** note A's prose mentions "the Zettelkasten method" and a note titled "Zettelkasten method" exists, but A never links to it
- **THEN** "Zettelkasten method" shows note A under Unlinked mentions

#### Scenario: Linked notes are not double-reported
- **WHEN** note A both links to and mentions note B by title
- **THEN** note A appears under note B's Linked mentions only, not under Unlinked mentions

### Requirement: Orphan report
The site SHALL provide an orphans report page listing all notes with zero inbound links, to support Zettelkasten vault hygiene.

#### Scenario: Orphan identified
- **WHEN** a note exists that no other note links to
- **THEN** it appears on the orphans report page

### Requirement: Build-time graph dataset
The build SHALL emit a graph dataset (served as static JSON) containing one node per note — with its title, URL, type, status, tags, and link degree — and one edge per resolved wiki-link. Edges MUST only be created for links that resolve to an existing note; unresolved links MUST NOT appear as edges or phantom nodes.

#### Scenario: Dataset reflects vault
- **WHEN** the vault contains notes A and B with A linking to B
- **THEN** the graph dataset contains nodes for A and B with correct metadata, and one edge from A to B

#### Scenario: Unresolved links excluded
- **WHEN** note A links to a nonexistent note "Future idea"
- **THEN** the graph dataset contains no node and no edge for "Future idea"
