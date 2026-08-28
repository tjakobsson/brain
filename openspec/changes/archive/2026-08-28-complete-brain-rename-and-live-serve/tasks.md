## 1. Complete the Brain rename

- [x] 1.1 Rename package metadata and the executable to `brain`, update locked metadata and command usage, and verify parser/help tests cover `brain build`, `brain preview`, and `brain serve` with no legacy alias.
- [x] 1.2 Rename private runtime environment keys, work paths, content-loader and integration identifiers, diagnostics, temporary test names, and the graph seed namespace; verify internal settings, vault loading, generation safety, and deterministic graph tests pass under only the new names.
- [x] 1.3 Rename active Action variables, shell-script identifiers, workflow temporary paths, source image tags, README prose, and OpenSpec project context; verify source, image, Action, and documented workflow contracts contain no active former-name reference.
- [x] 1.4 Add a tracked naming audit with an explicit historical-record allowlist and verify it fails when `brain-manual`, `BRAIN_MANUAL`, or the former display name is introduced into an active file.

## 2. Prepare asynchronous production generation

- [x] 2.1 Query the registry for the latest stable release and complete runtime license tree of the selected polling watcher, add and exactly pin it only if all licenses satisfy policy, and verify locked installation plus the repository license audit pass.
- [x] 2.2 Replace synchronous Astro and Pagefind execution with an awaited, abortable child-process runner while preserving inherited output and actionable exit errors; verify tests cover success, non-zero exit, and termination during each stage.
- [x] 2.3 Separate complete generation into a caller-selected immutable destination from standalone output promotion, and verify existing build atomicity, deterministic hashes, forced late failure, attachment copying, and Pagefind normalization remain unchanged.
- [x] 2.4 Keep one-shot preview on the shared asynchronous build path and verify its existing production page, graph, base-path, and invalid-vault tests still pass without reload behavior.

## 3. Add generation-aware serving

- [x] 3.1 Extend the static server to resolve requests against a retained active generation and release retired generations only after in-flight requests complete; verify concurrent activation tests never return partial content or fail a request using the prior root.
- [x] 3.2 Add a base-aware SSE endpoint and in-memory HTML reload injection for live mode only; verify successful activation reloads connected browsers, failed builds do not reload, preview has no reload client, and persisted output hashes equal a normal build.
- [x] 3.3 Implement a polling vault watcher and serialized coordinator with settled-write debounce and a dirty follow-up flag; verify note and attachment add/change/delete/rename, burst coalescing, and edits during a build produce the required rebuild sequence.
- [x] 3.4 Add `brain serve` orchestration that starts watching before its initial generation, listens only after initial success, atomically activates later successes, and retains the last success after errors; verify startup rejection, failure recovery, site/base/exclusion/strict-link inputs, and continued HTTP availability.
- [x] 3.5 Coordinate SIGINT and SIGTERM across the watcher, active child process, HTTP listener, SSE clients, requests, and temporary generations; verify process-level tests terminate promptly without orphaned children or vault changes while idle and during generation.

## 4. Deliver the local container workflow

- [x] 4.1 Update the image configuration for Brain environment names, writable live-generation locations, and port 4321 discoverability while retaining the non-root user; verify the image starts `brain serve` with read-only root filesystem, read-only vault, and writable `/work` and `/tmp` temporary filesystems.
- [x] 4.2 Document one-command Docker live serving with a read-only current-vault mount, loopback-only published port, container-owned temporary storage, `--init`, and no host Node requirement; verify the README command works verbatim against the demo vault and contains no Astro dev instructions.
- [x] 4.3 Add a Linux container smoke test that edits a host bind-mounted note and attachment, observes production content and search update without restart, recovers from an invalid edit, and verifies the vault inventory and bytes remain generator-unchanged.

## 5. Acceptance and candidate update

- [x] 5.1 Run the full unit and browser suites serially, root and subpath production builds, one-shot preview tests, and strict OpenSpec validation; verify all checks pass with no staging or live-generation residue.
- [x] 5.2 Run the generated 2,000-note vault through live serving, measure successful rebuild and idle polling behavior, and verify requests continue succeeding throughout the rebuild without overlapping generation.
- [x] 5.3 Build and test linux/amd64 and linux/arm64 images, then run source-command, image, composite-Action, reusable-workflow, and deterministic-output parity checks; verify unchanged static output contracts across every supported surface.
- [x] 5.4 Build and attest a new `ghcr.io/tjakobsson/brain` candidate, record its immutable digest in Action, workflow, and release metadata, and verify SBOM, provenance, license, and release dry-run checks without creating stable tags or a GitHub Release.
- [x] 5.5 Run the final former-name audit and `openspec validate "complete-brain-rename-and-live-serve" --strict`; verify only allowlisted historical records remain and every acceptance task is complete.
