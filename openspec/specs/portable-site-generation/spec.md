# Portable Site Generation Specification

## Purpose

Defines a portable build contract that converts an external Brain Markdown directory and its referenced attachments into a complete static second-brain site at any deployment base path.

## Requirements

### Requirement: Explicit build inputs and output
The generator SHALL accept either one external brain directory or a workspace configuration that references multiple brain directories, plus a distinct output directory, optional canonical site URL, and optional URL base path. Single-brain and workspace inputs MUST be mutually exclusive. It MUST fail with a non-zero status and an actionable message when an input is unreadable, contains no publishable notes, or the output path is an input directory or one of its ancestors.

#### Scenario: Build one brain
- **WHEN** a reader invokes the generator with a readable brain directory and writable output directory
- **THEN** the generator writes a complete single-brain static site without modifying the source

#### Scenario: Build a workspace
- **WHEN** a reader invokes the generator with a valid workspace whose brain directories are readable
- **THEN** the generator writes one complete multi-brain static site without modifying the workspace or brain sources

#### Scenario: Reject conflicting input modes
- **WHEN** a reader supplies both a single-brain input and a workspace input
- **THEN** the generator exits non-zero with usage guidance identifying the mutually exclusive options

#### Scenario: Reject an unsafe output path
- **WHEN** the requested output directory could overwrite a configured brain, workspace configuration, or an ancestor of either
- **THEN** the generator exits non-zero before deleting or replacing content

### Requirement: Vault discovery and default exclusions
The generator SHALL discover Markdown notes recursively within every configured brain while excluding hidden directories, `.github`, `Templates`, generator output, and configurable exclusion patterns. Files excluded from publication MUST NOT appear in pages, search data, graph data, or copied assets. Legacy application metadata MAY be excluded by default for migration convenience but SHALL NOT define the content contract.

#### Scenario: Build a repository-root brain
- **WHEN** a consumer points the generator at a repository containing notes, hidden metadata, and `.github`
- **THEN** notes are published while default-excluded metadata and workflow files are omitted

#### Scenario: Apply workspace exclusions
- **WHEN** a workspace supplies global exclusions and one brain supplies additional exclusions
- **THEN** both exclusion sets apply to that brain while only global exclusions apply to the other brains

#### Scenario: Apply consumer exclusions
- **WHEN** the consumer supplies additional exclusion patterns for a single brain
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
The generator SHALL publish files referenced by Markdown images, Markdown links, and Brain attachment embeds. It MUST preserve paths relative to the owning brain in a brain-namespaced generated asset route and MUST NOT copy unreferenced source files.

#### Scenario: Publish equal attachment paths from two brains
- **WHEN** two brains each reference `media/diagram.svg`
- **THEN** both files publish at distinct brain-namespaced URLs without collision

#### Scenario: Publish referenced media
- **WHEN** a note references an image and a PDF inside its owning brain
- **THEN** both files are copied to that brain's generated asset namespace and their URLs include the configured base path

#### Scenario: Keep unreferenced files private
- **WHEN** a configured brain contains a file that no published note references
- **THEN** that file is not copied to generated output

#### Scenario: Reject attachment escape
- **WHEN** a note references a path outside its owning brain directory
- **THEN** the build exits non-zero without copying the external file

### Requirement: Brain attachment resolution
The generator SHALL resolve an attachment only within the source note's owning brain, using an exact brain-relative path first and a unique filename only when no exact path is supplied. Missing or ambiguous references MUST fail the build with the brain ID, source note, and reference in the diagnostic.

#### Scenario: Isolate attachment resolution by brain
- **WHEN** two brains contain `diagram.png` and a note in one brain embeds `diagram.png`
- **THEN** Brain resolves the file from the source note's brain without treating the other brain's file as ambiguous

#### Scenario: Resolve a unique Brain attachment embed
- **WHEN** a Brain attachment embed identifies exactly one non-excluded file in its owning brain
- **THEN** the generator publishes and links that file

#### Scenario: Reject an ambiguous filename
- **WHEN** an attachment filename exists in multiple folders of the source note's brain without a distinguishing path
- **THEN** the build exits non-zero and lists the conflicting files

### Requirement: Vault validation modes
The generator SHALL validate brain IDs, per-brain note-title uniqueness, frontmatter, local links, and cross-brain links. Duplicate titles within one brain and invalid frontmatter MUST fail every build; unresolved note links and unknown cross-brain targets SHALL remain warnings by default and MUST fail when strict link validation is enabled.

#### Scenario: Warn for a missing foreign note
- **WHEN** an Engineering note links to `[[@design/Future idea]]` and Design has no such note
- **THEN** the default build completes, renders an unwritten foreign link, and reports both the source and target brain

#### Scenario: Reject an unknown brain in strict mode
- **WHEN** a note targets an undeclared brain and strict link validation is enabled
- **THEN** generation exits non-zero with the source note and unknown brain ID

#### Scenario: Build with an unresolved note link
- **WHEN** a local or cross-brain link is unresolved and strict link validation is disabled
- **THEN** the generator completes, renders the link as unwritten, and reports a warning with its brain context

#### Scenario: Enforce strict links
- **WHEN** the same workspace is built with strict link validation enabled
- **THEN** the generator exits non-zero with all unresolved local and cross-brain diagnostics

### Requirement: Reproducible site content
The generator SHALL produce equivalent site files for the same generator version, vault content, and build inputs without embedding build timestamps or machine-specific paths.

#### Scenario: Repeat a build
- **WHEN** the same vault and configuration are built twice with the same generator version
- **THEN** corresponding generated site files have identical content
