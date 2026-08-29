# Local Live Serving Specification

## Purpose

Provides a production-equivalent local server that continuously reflects changes from a mounted Markdown vault without exposing Astro development tooling or requiring a host Node installation.

## Requirements

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

### Requirement: Vault changes trigger serialized production rebuilds
Serve mode SHALL watch notes, supported attachments, additions, deletions, and renames beneath every configured brain, plus the workspace configuration itself. Watching MUST work for Docker Desktop bind mounts, debounce change bursts, and serialize builds so a change received during a build causes one subsequent build rather than overlapping generation.

#### Scenario: Edit one configured brain
- **WHEN** a note changes in any workspace brain after the server starts
- **THEN** Brain detects the change and rebuilds the complete workspace after the write burst settles

#### Scenario: Change workspace membership
- **WHEN** the workspace configuration adds, removes, or reorganizes a brain
- **THEN** the next successful generation updates the chooser, routes, indexes, and watch set

#### Scenario: Change files during a rebuild
- **WHEN** additional changes occur in one or more brains while generation is running
- **THEN** Brain finishes the active attempt and performs one follow-up rebuild containing the latest workspace state

#### Scenario: Add or remove an attachment
- **WHEN** a supported attachment is added, changed, renamed, or deleted in any configured brain
- **THEN** the next successful workspace generation reflects that attachment change

### Requirement: Successful generations activate atomically
Serve mode SHALL continue serving the last successful generation while another generation is running. A new generation MUST become visible as one complete unit only after generation and indexing succeed, and superseded temporary generations MUST be cleaned without interrupting in-flight requests.

#### Scenario: Read while rebuilding
- **WHEN** an HTTP request arrives during a rebuild
- **THEN** the server responds from the complete last successful generation

#### Scenario: Rebuild fails
- **WHEN** a watched change causes generation or indexing to fail
- **THEN** Brain reports the failure, keeps watching, and continues serving the last successful generation

#### Scenario: Rebuild recovers
- **WHEN** a later change fixes the failure and generation succeeds
- **THEN** Brain atomically activates the recovered generation without restarting the container

### Requirement: Browsers reload only after successful activation
Serve mode SHALL notify connected pages after a new generation is active so they can reload. The reload mechanism MUST NOT modify persisted static output, expose Astro's development toolbar or development modules, or notify browsers for failed generations.

#### Scenario: Successful note update
- **WHEN** a rebuild activates successfully while a generated page is open
- **THEN** the browser reloads and displays content from the new generation

#### Scenario: Invalid note update
- **WHEN** a rebuild fails while a generated page is open
- **THEN** the browser remains on the last successful site without a reload loop

### Requirement: Local serving remains read-only toward workspace inputs
Serve mode MUST NOT create, modify, or delete the workspace configuration or content in any configured brain. It SHALL keep output, caches, and temporary generations outside every input directory. Documentation SHALL provide a container example using read-only workspace inputs, container-owned writable temporary storage, and a port published to the host loopback interface.

#### Scenario: Run against a local workspace
- **WHEN** a user starts the documented container command with read-only workspace inputs
- **THEN** the site is available on localhost, source edits trigger rebuilds, and no generated files appear in any brain directory

#### Scenario: Run against one local brain
- **WHEN** a user starts the documented container command with one read-only Brain source
- **THEN** the site is available on localhost, source edits trigger rebuilds, and no generated files appear in the source directory

### Requirement: Serve shuts down cleanly
Serve mode SHALL handle normal container termination by stopping new watch work, terminating any active generation, closing HTTP and reload connections, and cleaning generator-owned temporary data before exit.

#### Scenario: Stop while idle
- **WHEN** the container receives SIGTERM while serving
- **THEN** it closes the watcher and server and exits promptly with no orphaned process

#### Scenario: Stop during generation
- **WHEN** the container receives SIGTERM during a rebuild
- **THEN** it terminates the build subprocess, preserves the vault, cleans temporary generation data, and exits promptly
