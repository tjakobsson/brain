## MODIFIED Requirements

### Requirement: Reusable vault publication workflow
The generator repository SHALL expose a versioned reusable workflow that checks out the caller repository, builds either its configured single brain or a workspace whose referenced brain directories are present in that repository, uploads the generated static output as a Pages artifact, and deploys that artifact. The workflow MUST use the same immutable generator image as the released build Action.

#### Scenario: Publish a single-brain repository
- **WHEN** a caller invokes the workflow with its brain path
- **THEN** the workflow deploys the generated site without requiring Astro source or Node dependencies in the caller repository

#### Scenario: Publish a vault-only repository
- **WHEN** a caller invokes the reusable workflow with a single Brain source path
- **THEN** the workflow builds and deploys that source without requiring generator code in the caller repository

#### Scenario: Publish an in-repository workspace
- **WHEN** a caller invokes the workflow with a workspace configuration whose brain directories exist in the caller repository
- **THEN** the workflow deploys one multi-brain site containing the root chooser and configured brains

#### Scenario: Stop after workspace failure
- **WHEN** any configured brain fails validation or generation
- **THEN** no Pages deployment is attempted

#### Scenario: Stop after build failure
- **WHEN** a single brain or workspace fails validation or generation
- **THEN** no Pages deployment is attempted

### Requirement: Explicit publication inputs
The reusable workflow SHALL accept exactly one of a single-brain path or workspace configuration path, plus optional exclusion and strict-link settings, while selecting a documented default output path. All workspace sources MUST be available in the caller repository checkout; publishing brains from separate repositories SHALL require a caller-authored workflow using the build Action after preparing those checkouts.

#### Scenario: Use single-brain defaults
- **WHEN** a caller invokes the workflow with only a brain path
- **THEN** the workflow generates and deploys that brain with default exclusions and warning-level unresolved links

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
