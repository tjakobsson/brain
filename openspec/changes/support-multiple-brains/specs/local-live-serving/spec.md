## MODIFIED Requirements

### Requirement: Serve starts from a complete production generation
The released command and image SHALL provide `brain serve` with either single-brain or workspace input and the same site, base-path, exclusion, strict-link, and validation behavior as `brain build`. Serve mode MUST complete production generation, attachment publication, and search indexing for all configured brains before accepting HTTP requests.

#### Scenario: Start with a valid workspace
- **WHEN** a user runs `brain serve` for a valid workspace
- **THEN** Brain generates the complete multi-brain site and serves it on the configured host and port

#### Scenario: Start with a valid vault
- **WHEN** a user runs `brain serve` for one valid brain
- **THEN** Brain generates the complete single-brain site and serves it on the configured host and port

#### Scenario: Start with an invalid brain
- **WHEN** any configured brain fails initial validation or indexing
- **THEN** Brain exits non-zero without opening the HTTP listener or serving partial output

#### Scenario: Start with an invalid vault
- **WHEN** a single brain fails initial validation or indexing
- **THEN** Brain exits non-zero without opening the HTTP listener or serving partial output

### Requirement: Vault changes trigger serialized production rebuilds
Serve mode SHALL watch notes, supported attachments, additions, deletions, and renames beneath every configured brain, plus the workspace configuration itself. Watching MUST work for Docker Desktop bind mounts, debounce change bursts, and serialize builds so a change received during a build causes one subsequent build rather than overlapping generation.

#### Scenario: Edit one configured brain
- **WHEN** a note changes in any workspace brain after the server starts
- **THEN** Brain detects the change and rebuilds the complete workspace after the write burst settles

#### Scenario: Edit a note through the host filesystem
- **WHEN** a mounted note changes after the server starts
- **THEN** Brain detects the change and starts one production rebuild after the write burst settles

#### Scenario: Change workspace membership
- **WHEN** the workspace configuration adds, removes, or reorganizes a brain
- **THEN** the next successful generation updates the chooser, routes, indexes, and watch set

#### Scenario: Change files during a rebuild
- **WHEN** additional changes occur in one or more brains while generation is running
- **THEN** Brain finishes the active attempt and performs one follow-up rebuild containing the latest workspace state

#### Scenario: Add or remove an attachment
- **WHEN** a supported attachment is added, changed, renamed, or deleted in any configured brain
- **THEN** the next successful workspace generation reflects that attachment change

## REMOVED Requirements

### Requirement: Local serving remains read-only toward the vault
**Reason**: The requirement's mandatory Obsidian scenario conflicts with the Brain-native authoring contract and does not cover multiple input roots.

**Migration**: Use the replacement read-only workspace-input requirement for both single-brain and workspace serving.

## ADDED Requirements

### Requirement: Local serving remains read-only toward workspace inputs
Serve mode MUST NOT create, modify, or delete the workspace configuration or content in any configured brain. It SHALL keep output, caches, and temporary generations outside every input directory. Documentation SHALL provide a container example using read-only workspace inputs, container-owned writable temporary storage, and a port published to the host loopback interface.

#### Scenario: Run against a local workspace
- **WHEN** a user starts the documented container command with read-only workspace inputs
- **THEN** the site is available on localhost, source edits trigger rebuilds, and no generated files appear in any brain directory

#### Scenario: Run against one local brain
- **WHEN** a user starts the documented container command with one read-only Brain source
- **THEN** the site is available on localhost, source edits trigger rebuilds, and no generated files appear in the source directory
