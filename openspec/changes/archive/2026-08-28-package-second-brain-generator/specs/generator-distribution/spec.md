## Purpose

Defines secure, versioned distribution interfaces that run the same second-brain generator locally as an OCI image and in automation as a GitHub build Action.

## ADDED Requirements

### Requirement: Versioned multi-architecture generator image
Each generator release SHALL publish a public OCI image for `linux/amd64` and `linux/arm64` with immutable semantic-version and digest references. The image MUST run as a non-root user and MUST contain everything required to build a vault without downloading build dependencies at runtime.

#### Scenario: Generate locally on a supported architecture
- **WHEN** a reader runs a released image with readable vault and writable output mounts
- **THEN** the image builds the site through the portable generation contract on either supported architecture

#### Scenario: Run without build-time network access
- **WHEN** the released image starts with network access disabled
- **THEN** a local vault build succeeds without fetching packages or generator assets

### Requirement: Container filesystem boundary
The image SHALL treat the vault mount as read-only input and SHALL write generated content only to the configured output mount and container-owned temporary storage. Permission failures MUST identify the affected mount without changing vault files.

#### Scenario: Build from a read-only vault
- **WHEN** the vault is mounted read-only and the output is writable
- **THEN** generation succeeds without attempting to write into the vault

#### Scenario: Reject unwritable output
- **WHEN** the output mount is not writable by the container user
- **THEN** generation exits non-zero with an output-permission diagnostic

### Requirement: GitHub build Action parity
The repository SHALL publish a GitHub Action that accepts the portable generator's vault, output, site, base-path, exclusion, and strict-link inputs. The Action MUST run the released generator image and MUST return the same generated content and failure semantics as local image use.

#### Scenario: Build a caller repository
- **WHEN** a workflow checks out a vault repository and invokes the Action
- **THEN** the Action writes the static site to its configured workspace output and exposes that output path

#### Scenario: Propagate generator failure
- **WHEN** vault validation or generation fails inside the Action
- **THEN** the Action fails the workflow step and preserves the actionable generator diagnostics

### Requirement: Local container preview
The released image SHALL provide a preview command that builds a mounted vault and serves the generated site over HTTP on a configurable port. Preview mode MUST use the same generation inputs and validation behavior as a production build and SHALL NOT require an in-browser editor or a Node installation on the host.

#### Scenario: Preview a mounted vault
- **WHEN** a reader runs preview mode with a vault mount and published container port
- **THEN** the generated site is available from the host browser at the configured port

#### Scenario: Reject an invalid preview vault
- **WHEN** preview mode receives a vault that fails build validation
- **THEN** the container exits non-zero instead of serving stale or partial output

### Requirement: Release integrity and provenance
Each released image SHALL publish a software bill of materials and verifiable build provenance. The Action at a released Git reference MUST select the corresponding image by immutable digest rather than an unpinned floating tag.

#### Scenario: Inspect a released image
- **WHEN** a consumer resolves a semantic generator release
- **THEN** the release identifies its immutable image digest, software bill of materials, and provenance

#### Scenario: Use a pinned Action release
- **WHEN** a workflow invokes a fixed Action release or commit
- **THEN** it runs the image digest associated with that source revision

### Requirement: Approved Wolfi licensing boundary
The Wolfi Node base and any copyleft packages in its software bill of materials MUST NOT be added until an ADR records the user's approval limiting the exception to the distributed build-tool container. Generator application dependencies outside that documented exception MUST continue to satisfy the repository dependency policy.

#### Scenario: Introduce the container base
- **WHEN** implementation adds the Wolfi-based image
- **THEN** the approving ADR already exists and identifies the base, observed copyleft license families, distribution boundary, and rationale

#### Scenario: Add an unrelated dependency
- **WHEN** implementation requires a dependency not covered by the container ADR
- **THEN** the normal dependency-license policy applies without inheriting the Wolfi exception
