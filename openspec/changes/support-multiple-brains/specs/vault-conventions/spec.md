## REMOVED Requirements

### Requirement: Plain markdown vault
**Reason**: The requirement makes native Obsidian compatibility mandatory, which conflicts with Brain's new namespaced link grammar and independent multi-brain sources.

**Migration**: Continue using plain Markdown under the replacement Plain Markdown brain sources requirement; native Obsidian link resolution is no longer guaranteed.

## MODIFIED Requirements

### Requirement: Title-slug note identity
A note's identity within its brain SHALL be its filename without the `.md` extension. Titles MUST be unique case-insensitively within one brain but MAY repeat across different brains. A multi-brain note's canonical identity and URL SHALL combine the stable brain ID with a URL-friendly slug of its title.

#### Scenario: Reject a duplicate within one brain
- **WHEN** two notes in the same brain share a filename in different subfolders
- **THEN** the build fails with an error naming both conflicting files

#### Scenario: Duplicate titles rejected
- **WHEN** two notes within one brain share the same filename in different subfolders
- **THEN** the build fails with an error naming both conflicting files

#### Scenario: Permit the same title across brains
- **WHEN** Engineering and Design each contain `Principles.md`
- **THEN** both notes publish successfully at distinct brain-namespaced URLs

#### Scenario: Keep identity stable across folders
- **WHEN** a note moves between folders within its brain without being renamed
- **THEN** its identity, inbound links, and generated URL remain unchanged

#### Scenario: Readable URLs
- **WHEN** a note titled `Graphs of thought.md` is published in the Engineering brain
- **THEN** it is served at a URL containing the Engineering brain ID and a slug derived from the title

### Requirement: Wiki-link authoring syntax
Brain SHALL resolve `[[Note Title]]`, `[[Note Title|display text]]`, and `[[Note Title#Heading]]` within the source note's brain. Brain SHALL resolve `[[@brain-id/Note Title]]`, `[[@brain-id/Note Title|display text]]`, and `[[@brain-id/Note Title#Heading]]` against the named brain. Targets MUST use note titles rather than source paths, and `@brain-id/` SHALL be reserved as the cross-brain namespace marker.

#### Scenario: Resolve a local link
- **WHEN** an Engineering note contains `[[Deployment model]]`
- **THEN** the link targets the note named `Deployment model` in Engineering

#### Scenario: Resolve a cross-brain alias
- **WHEN** an Engineering note contains `[[@design/Interaction model|the interaction rationale]]`
- **THEN** the link targets `Interaction model` in Design and displays `the interaction rationale`

#### Scenario: Resolve a cross-brain heading
- **WHEN** a note contains `[[@research/Cognitive load#Measurements]]`
- **THEN** the published link targets the `Measurements` heading in Research's `Cognitive load` note

#### Scenario: Alias link authored
- **WHEN** a note contains `[[Zettelkasten method|the ZK method]]`
- **THEN** the published page shows a local link reading `the ZK method` and pointing to the note titled `Zettelkasten method` in the same brain

#### Scenario: Note moves folders, links survive
- **WHEN** a note moves between folders within its brain without being renamed
- **THEN** local and cross-brain links targeting its title still resolve after rebuild

## ADDED Requirements

### Requirement: Plain Markdown brain sources
Each brain source SHALL be a directory of plain `.md` files readable by general Markdown tools. Brain-specific frontmatter and link syntax MUST remain legible as plain text, but native compatibility with Obsidian or any other knowledge-management application is NOT required.

#### Scenario: Read source without Brain
- **WHEN** a brain directory is opened in a text editor or general Markdown reader
- **THEN** its note prose and link targets remain readable without generated files or proprietary binary data

#### Scenario: Folder organization is free-form
- **WHEN** a note is placed in any subfolder of its brain directory or at its root
- **THEN** it is published and its location does not affect note identity or link resolution
