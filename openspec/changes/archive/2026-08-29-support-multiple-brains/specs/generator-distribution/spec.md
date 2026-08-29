## MODIFIED Requirements

### Requirement: Container filesystem boundary
The image SHALL treat single-brain inputs, workspace configuration, and every configured brain directory as read-only inputs. It SHALL write generated content only to the configured output mount and container-owned temporary storage. Permission and path failures MUST identify the affected workspace or brain mount without changing source files.

#### Scenario: Build from read-only workspace mounts
- **WHEN** a workspace configuration and all referenced brains are mounted read-only and output is writable
- **THEN** generation succeeds without attempting to write into any input mount

#### Scenario: Build from a read-only vault
- **WHEN** a single brain is mounted read-only and output is writable
- **THEN** generation succeeds without attempting to write into the source

#### Scenario: Reject an unavailable brain mount
- **WHEN** a workspace references a brain path that is absent inside the container
- **THEN** generation exits non-zero and identifies the brain ID and unavailable path

#### Scenario: Reject unwritable output
- **WHEN** the output mount is not writable by the container user
- **THEN** generation exits non-zero with an output-permission diagnostic

### Requirement: GitHub build Action parity
The repository SHALL publish a GitHub Action that accepts either the portable generator's single-brain input or its workspace input, together with output, site, base-path, exclusion, and strict-link settings. Workspace paths MUST resolve within repositories and directories prepared in the caller's job workspace. The Action MUST run the released generator image and return the same content and failure semantics as local image use.

#### Scenario: Build a checked-out collaborative workspace
- **WHEN** a caller checks out several brain repositories beneath its job workspace and invokes the Action with a workspace configuration referencing them
- **THEN** the Action builds one multi-brain static site and exposes its output path

#### Scenario: Build a caller repository
- **WHEN** a workflow checks out a single brain repository and invokes the Action
- **THEN** the Action writes the static site to its configured workspace output and exposes that path

#### Scenario: Reject conflicting Action inputs
- **WHEN** a caller supplies both single-brain and workspace inputs
- **THEN** the Action fails with the same mutually exclusive input diagnostic as the command

#### Scenario: Propagate generator failure
- **WHEN** any configured brain fails validation or generation inside the Action
- **THEN** the Action fails the workflow step and preserves actionable generator diagnostics

### Requirement: Local container preview
The released image SHALL preview either a single mounted brain or a mounted workspace over HTTP on a configurable port. Preview mode MUST use the same generation inputs and validation behavior as production build and SHALL NOT require an in-browser editor or Node installation on the host.

#### Scenario: Preview a mounted workspace
- **WHEN** a reader runs preview with a valid workspace configuration and all referenced brain mounts
- **THEN** the root chooser and generated brain views are available from the host browser

#### Scenario: Preview a mounted vault
- **WHEN** a reader runs preview with one valid mounted brain and a published container port
- **THEN** the generated single-brain site is available from the host browser

#### Scenario: Reject an invalid preview vault
- **WHEN** preview receives a single brain or workspace that fails validation
- **THEN** the container exits non-zero instead of serving stale or partial output
