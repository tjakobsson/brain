## Why

The repository and published image are named Brain, but the CLI, package metadata, container examples, environment adapters, and internal identifiers still expose the former Brain Manual name. Local container users also need a production-like way to watch an Obsidian vault and see successful note changes without running Astro's development server or restarting the container.

## What Changes

- **BREAKING**: Rename the public package, executable, usage text, source image examples, and active implementation identifiers from `brain-manual` to `brain` before the first stable release.
- Add a `brain serve` command that performs complete production builds, watches a mounted vault, and activates successful rebuilds without exposing Astro development behavior.
- Keep `brain preview` as the one-shot build-and-serve command for fixed production snapshots and smoke tests.
- Serve the last successful generation while a rebuild is running or fails, and reload connected browsers only after a complete replacement is ready.
- Document a single `docker run` workflow that mounts a local vault read-only, publishes only a loopback port, and keeps generated state in container-owned temporary storage.
- Add container, command, watcher, serving, reload, failure-recovery, and naming-contract coverage.

## Capabilities

### New Capabilities

- `brain-product-interface`: The pre-v1 public and active internal naming contract for the Brain package, CLI, image examples, automation, and diagnostics.
- `local-live-serving`: Production-equivalent watched generation and local HTTP serving for a mounted vault, including atomic activation, failure recovery, browser reload, and container operation.

### Modified Capabilities

None. The relevant distribution specifications have not yet been archived into the main specification set; this change adds focused contracts without rewriting completed historical change artifacts.

## Impact

- Affects package metadata, command parsing, generator environment adapters, container configuration, Action plumbing, CI paths, README examples, integration identifiers, deterministic graph seeding, and associated tests.
- Extends the generator orchestration and static server with asynchronous builds, vault watching, active-generation switching, browser reload, and signal handling.
- May add one permissively licensed file-watching dependency after checking and pinning its latest stable release at implementation time.
- Does not add in-browser editing, mutate the mounted vault, or change static output and GitHub Pages deployment semantics.
