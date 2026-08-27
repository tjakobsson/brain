## Purpose

Provides a production-equivalent local server that continuously reflects changes from a mounted Markdown vault without exposing Astro development tooling or requiring a host Node installation.

## ADDED Requirements

### Requirement: Serve starts from a complete production generation
The released command and image SHALL provide `brain serve` with the same vault, site, base-path, exclusion, and strict-link inputs and validation behavior as `brain build`. Serve mode MUST complete Astro production generation, attachment publication, and Pagefind indexing before accepting HTTP requests.

#### Scenario: Start with a valid vault
- **WHEN** a user runs `brain serve` for a valid mounted vault
- **THEN** Brain generates the complete site and serves it on the configured host and port

#### Scenario: Start with an invalid vault
- **WHEN** initial generation fails validation or indexing
- **THEN** Brain exits non-zero without opening the HTTP listener or serving partial output

### Requirement: Vault changes trigger serialized production rebuilds
Serve mode SHALL watch notes, supported attachments, additions, deletions, and renames beneath the vault. Watching MUST work for Docker Desktop bind mounts, MUST debounce change bursts, and MUST serialize builds so that a change received during a build causes one subsequent build rather than overlapping generation.

#### Scenario: Edit a note through the host filesystem
- **WHEN** a mounted note changes after the server starts
- **THEN** Brain detects the change and starts one production rebuild after the write burst settles

#### Scenario: Change files during a rebuild
- **WHEN** one or more additional vault changes occur while generation is running
- **THEN** Brain finishes the active attempt and performs one follow-up rebuild containing the latest vault state

#### Scenario: Add or remove an attachment
- **WHEN** a supported attachment is added, changed, renamed, or deleted
- **THEN** the next successful generation reflects that attachment change

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

### Requirement: Local serving remains read-only toward the vault
Serve mode MUST NOT create, modify, or delete content in the mounted vault and SHALL keep generated output, caches, and temporary generations outside it. Documentation SHALL provide one `docker run` command using a read-only vault mount, container-owned writable temporary storage, and a port published to the host loopback interface.

#### Scenario: Run against a local Obsidian vault
- **WHEN** a user executes the documented container command from a vault directory
- **THEN** the site is available on localhost, host-side note edits trigger rebuilds, and no generated files appear in the vault

### Requirement: Serve shuts down cleanly
Serve mode SHALL handle normal container termination by stopping new watch work, terminating any active generation, closing HTTP and reload connections, and cleaning generator-owned temporary data before exit.

#### Scenario: Stop while idle
- **WHEN** the container receives SIGTERM while serving
- **THEN** it closes the watcher and server and exits promptly with no orphaned process

#### Scenario: Stop during generation
- **WHEN** the container receives SIGTERM during a rebuild
- **THEN** it terminates the build subprocess, preserves the vault, cleans temporary generation data, and exits promptly
