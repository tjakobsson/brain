# GitHub Pages Publication Specification

## Purpose

Defines a reusable GitHub workflow that turns a vault-only caller repository into a correctly addressed GitHub Pages deployment using the released generator.

## Requirements

### Requirement: Reusable vault publication workflow
The generator repository SHALL expose a versioned reusable workflow that checks out the caller repository, builds its configured vault with the same immutable generator image used by the released build Action, uploads the generated static output as a Pages artifact, and deploys that artifact.

#### Scenario: Publish a vault-only repository
- **WHEN** a caller grants the documented permissions and invokes the reusable workflow with its vault path
- **THEN** the workflow deploys the generated second-brain site without requiring Astro source or Node dependencies in the caller repository

#### Scenario: Stop after build failure
- **WHEN** the generator build fails validation or generation
- **THEN** no Pages deployment is attempted

### Requirement: Automatic GitHub Pages addressing
The reusable workflow SHALL obtain the caller's Pages origin and base path from GitHub Pages configuration and pass both values to the generator. It MUST support project Pages, user or organization root Pages, and configured custom domains without caller-authored URL rewriting.

#### Scenario: Deploy project Pages
- **WHEN** the caller's Pages URL is `https://user.github.io/vault-repo/`
- **THEN** the generated site uses origin `https://user.github.io` and base path `/vault-repo`

#### Scenario: Deploy a custom domain
- **WHEN** the caller's Pages configuration uses a custom domain with no base path
- **THEN** the generated site uses that origin and an empty base path

### Requirement: Official Pages artifact and deployment flow
The reusable workflow SHALL use GitHub's official Pages configuration, artifact upload, and deployment actions. It MUST declare or document the minimum `contents: read`, `pages: write`, and `id-token: write` permissions and MUST deploy through the protected `github-pages` environment.

#### Scenario: Invoke with required permissions
- **WHEN** the caller grants the documented permissions
- **THEN** the workflow uploads one valid Pages artifact and reports the deployed page URL through the GitHub environment

#### Scenario: Invoke without deployment permission
- **WHEN** the caller omits required Pages or identity-token permission
- **THEN** the workflow fails with GitHub's permission diagnostic rather than attempting an alternate publication mechanism

### Requirement: Explicit publication inputs
The reusable workflow SHALL accept a vault path and optional exclusion and strict-link settings while selecting a documented default output path. Generator implementation details and container mounts MUST remain internal to the called workflow.

#### Scenario: Use defaults
- **WHEN** a caller invokes the workflow with only a vault path
- **THEN** the workflow generates and deploys the vault using default exclusions, warning-level unresolved links, and an internal output path

#### Scenario: Request strict publication
- **WHEN** a caller enables strict link validation
- **THEN** unresolved note links prevent the Pages artifact from being uploaded

### Requirement: Version-pinned consumer contract
Documentation SHALL show consumers how to pin the reusable workflow to an immutable commit for maximum integrity and to a maintained major release reference for automatic compatible updates. A breaking workflow or generator-input change MUST require a new major release.

#### Scenario: Follow compatible updates
- **WHEN** a consumer references the maintained major release and a backward-compatible release is published
- **THEN** subsequent workflow runs use the compatible release without changing the consumer vault repository

#### Scenario: Preserve an immutable deployment toolchain
- **WHEN** a consumer references a full commit SHA
- **THEN** the selected workflow and generator image digest remain unchanged until the consumer updates that SHA
