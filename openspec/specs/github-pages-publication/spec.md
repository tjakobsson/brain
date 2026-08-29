# GitHub Pages Publication Specification

## Purpose

Defines a reusable GitHub workflow that turns a vault-only caller repository into a correctly addressed GitHub Pages deployment using the released generator.

## Requirements

### Requirement: Reusable vault publication workflow
The generator repository SHALL expose a versioned reusable workflow that checks out the caller repository, builds either its configured single brain or a workspace whose referenced brain directories are present in that repository, uploads the generated static output as a Pages artifact, and deploys that artifact. The workflow MUST use the same immutable generator image as the released build Action.

#### Scenario: Publish a single-brain repository
- **WHEN** a caller invokes the workflow with its brain path
- **THEN** the workflow deploys the generated site without requiring Astro source or Node dependencies in the caller repository

#### Scenario: Publish an in-repository workspace
- **WHEN** a caller invokes the workflow with a workspace configuration whose brain directories exist in the caller repository
- **THEN** the workflow deploys one multi-brain site containing the root chooser and configured brains

#### Scenario: Stop after build failure
- **WHEN** a single brain or workspace fails validation or generation
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
The reusable workflow SHALL accept exactly one of a single-brain path or workspace configuration path, plus optional exclusion and strict-link settings, while selecting a documented default output path. All workspace sources MUST be available in the caller repository checkout; publishing brains from separate repositories SHALL require a caller-authored workflow using the build Action after preparing those checkouts.

#### Scenario: Use defaults
- **WHEN** a caller invokes the workflow with only a single-brain path
- **THEN** the workflow uses default exclusions, warning-level unresolved links, and its internal output path

#### Scenario: Publish a workspace configuration
- **WHEN** a caller supplies a workspace path and no single-brain path
- **THEN** the workflow validates and publishes every brain declared by that workspace

#### Scenario: Reject an external workspace source
- **WHEN** a reusable-workflow workspace references a brain outside the caller checkout
- **THEN** the workflow fails with guidance to prepare multiple checkouts and use the build Action

#### Scenario: Request strict publication
- **WHEN** a caller enables strict link validation for a single brain or workspace
- **THEN** unresolved local or cross-brain links prevent the Pages artifact from being uploaded

### Requirement: Version-pinned consumer contract
Documentation SHALL show consumers how to pin the reusable workflow to an immutable commit for maximum integrity and to a maintained major release reference for automatic compatible updates. A breaking workflow or generator-input change MUST require a new major release.

#### Scenario: Follow compatible updates
- **WHEN** a consumer references the maintained major release and a backward-compatible release is published
- **THEN** subsequent workflow runs use the compatible release without changing the consumer vault repository

#### Scenario: Preserve an immutable deployment toolchain
- **WHEN** a consumer references a full commit SHA
- **THEN** the selected workflow and generator image digest remain unchanged until the consumer updates that SHA
