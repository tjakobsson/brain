## Purpose

Defines a portable build contract that converts an external Obsidian-compatible vault and its referenced attachments into a complete static second-brain site at any deployment base path.

## ADDED Requirements

### Requirement: Explicit build inputs and output
The generator SHALL accept an external vault directory, a distinct output directory, an optional canonical site URL, and an optional URL base path. It MUST fail with a non-zero status and an actionable message when the vault is unreadable, contains no publishable notes, or the output path is the vault itself or one of its ancestors.

#### Scenario: Build an external vault
- **WHEN** a reader invokes the generator with a readable vault and writable output directory
- **THEN** the generator writes a complete static site to the output directory without modifying the vault

#### Scenario: Reject an unsafe output path
- **WHEN** the requested output directory could overwrite the vault or its parent
- **THEN** the generator exits non-zero before deleting or replacing any content

### Requirement: Vault discovery and default exclusions
The generator SHALL discover Markdown notes recursively while excluding hidden directories, `.obsidian`, `.github`, `Templates`, generator output, and configurable exclusion patterns. Files excluded from publication MUST NOT appear in pages, search data, graph data, or copied assets.

#### Scenario: Build a repository-root vault
- **WHEN** a consumer points the generator at a repository root containing notes, `.obsidian`, and `.github`
- **THEN** notes are published while Obsidian metadata and workflow files are excluded

#### Scenario: Apply consumer exclusions
- **WHEN** the consumer supplies additional exclusion patterns
- **THEN** matching notes and attachments are absent from all generated site data and output

### Requirement: Base-path-correct static site
The generator SHALL prefix every internal page URL, navigation target, redirect, client-side data request, search asset, graph asset, favicon, wiki-link, and copied attachment with the configured base path. An empty base path MUST remain valid for root domains and custom domains.

#### Scenario: Generate for project Pages
- **WHEN** the site is built with base path `/vault-repo`
- **THEN** all site features load and navigate under `/vault-repo/` without requesting application resources from the domain root

#### Scenario: Generate for a root domain
- **WHEN** the site is built with an empty base path
- **THEN** all site features use root-relative URLs without an extra path segment

### Requirement: Referenced attachment publication
The generator SHALL publish files referenced by Markdown images, Markdown links, and Obsidian attachment embeds such as `![[image.png]]`. It MUST preserve vault-relative attachment paths in a dedicated generated asset namespace and MUST NOT copy unreferenced vault files.

#### Scenario: Publish referenced media
- **WHEN** a note references an image and a PDF inside the vault
- **THEN** both files are copied to the static output and their rendered URLs include the configured base path

#### Scenario: Keep unreferenced files private
- **WHEN** the vault contains a file that no published note references
- **THEN** that file is not copied to the generated site

#### Scenario: Reject attachment escape
- **WHEN** a note references a path outside the configured vault
- **THEN** the build exits non-zero without copying the external file

### Requirement: Deterministic attachment resolution
The generator SHALL resolve an attachment by an exact vault-relative path first and by a unique filename only when no exact path is supplied. Missing or ambiguous attachment references MUST fail the build with the source note and reference in the diagnostic.

#### Scenario: Resolve a unique Obsidian embed
- **WHEN** `![[diagram.png]]` identifies exactly one non-excluded file in the vault
- **THEN** the generator publishes and links that file

#### Scenario: Reject an ambiguous filename
- **WHEN** an attachment embed names a filename that exists in multiple vault folders without a distinguishing path
- **THEN** the build exits non-zero and lists the conflicting files

### Requirement: Vault validation modes
The generator SHALL preserve the existing note-title, frontmatter, and wiki-link validation contract. Duplicate titles and invalid frontmatter MUST fail every build; unresolved note links SHALL remain warnings by default and MUST fail when strict link validation is enabled.

#### Scenario: Build with an unresolved note link
- **WHEN** the vault contains an unresolved wiki-link and strict link validation is disabled
- **THEN** the generator completes, renders the link as unwritten, and reports a warning

#### Scenario: Enforce strict links
- **WHEN** the same vault is built with strict link validation enabled
- **THEN** the generator exits non-zero with all unresolved note-link diagnostics

### Requirement: Reproducible site content
The generator SHALL produce equivalent site files for the same generator version, vault content, and build inputs without embedding build timestamps or machine-specific paths.

#### Scenario: Repeat a build
- **WHEN** the same vault and configuration are built twice with the same generator version
- **THEN** corresponding generated site files have identical content
