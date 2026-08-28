## Purpose

Renders vault notes into beautiful static pages with resolved wiki-links, Obsidian-flavored markdown extensions, and visible Zettelkasten metadata, so reading the site feels like browsing a living knowledge base.

## ADDED Requirements

### Requirement: Note pages with resolved wiki-links
Every note SHALL be published as its own page. Wiki-links in the body MUST render as internal hyperlinks to the target note's URL, honoring aliases and heading anchors. Links MUST be resolved at build time, not client-side.

#### Scenario: Heading anchor link
- **WHEN** a note contains `[[Graphs of thought#Clustering]]` and the target note has a "Clustering" heading
- **THEN** the published link navigates directly to that heading on the target page

#### Scenario: Static output
- **WHEN** the site is built
- **THEN** all internal links are plain `<a href>` elements in static HTML, functional with JavaScript disabled

### Requirement: Unwritten notes are visible, not fatal
A wiki-link pointing to a note that does not exist SHALL render with visually distinct "unwritten note" styling (Obsidian-style dashed/muted treatment) and MUST produce a build warning naming the source file and unresolved target. Unresolved links MUST NOT fail the build.

#### Scenario: Link to unwritten note
- **WHEN** a published note contains `[[Future idea]]` and no such note exists
- **THEN** the build logs a warning, and the rendered link is styled distinctly so readers see it as a note yet to be written

### Requirement: Zettelkasten metadata display
Each note page SHALL visibly display the note's `type` and `status` (as distinct visual treatments, not just text), its `tags` (linking to tag pages), and its created/updated dates when present.

#### Scenario: Status is glanceable
- **WHEN** a reader opens a `draft` note and an `established` note
- **THEN** the two statuses are distinguishable at a glance (e.g. icon or color), without reading frontmatter text

### Requirement: Obsidian-flavored markdown extensions
The renderer SHALL support Obsidian callouts (`> [!note]`, `> [!warning]`, etc.) rendered as styled admonition blocks, and `==highlighted text==` rendered with highlight styling.

#### Scenario: Callout rendering
- **WHEN** a note contains a `> [!warning]` callout block
- **THEN** it renders as a visually distinct warning admonition, not a plain blockquote

### Requirement: Tag pages
Every tag used in the vault SHALL have its own page listing all notes carrying that tag, linked from each note's tag display.

#### Scenario: Tag page lists notes
- **WHEN** three notes carry the tag `cognition`
- **THEN** the `cognition` tag page lists exactly those three notes, each linking back to the note

### Requirement: Recently changed view
The site SHALL provide a "recently changed" view listing notes ordered by most recent modification, using the frontmatter `updated` date when present and falling back to file history.

#### Scenario: Recent notes surfaced
- **WHEN** a note is modified and the site rebuilt
- **THEN** that note appears at or near the top of the recently changed view
