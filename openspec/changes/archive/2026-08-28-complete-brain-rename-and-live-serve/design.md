## Context

See `proposal.md` for motivation and the two delta specs for observable behavior. The public repository and OCI package already use `brain`, while package metadata, CLI help, private environment adapters, automation plumbing, and internal namespaces retain the former name. The generator currently runs Astro and Pagefind synchronously, promotes one output directory, and uses a small custom HTTP server for one-shot preview. It has no watcher, active-generation abstraction, browser reload channel, or coordinated signal handling.

The generated site must remain a deterministic static artifact. The vault is untrusted, read-only input; output, caches, and live generations must remain outside it. Docker Desktop bind mounts require polling for dependable cross-platform change detection. The released image runs as a non-root user and must continue to support both amd64 and arm64.

## Goals / Non-Goals

**Goals:**

- Complete the pre-v1 rename without carrying obsolete aliases into the stable contract.
- Reuse exactly one production generation pipeline for build, preview, serve, image, and Action execution.
- Keep serving a complete site during rebuilds and recover automatically after authoring errors.
- Provide dependable watched operation for a host vault mounted into Docker Desktop.
- Keep the served experience clean: generated production assets plus a minimal reload connection, not Astro development output.

**Non-Goals:**

- Editing, creating, or renaming notes through the browser.
- Incremental page compilation; each accepted change performs a complete production build and Pagefind pass.
- Preserving `brain-manual`, `BRAIN_MANUAL_*`, or the old deterministic graph seed as compatibility surfaces.
- Changing GitHub Pages publication, static output semantics, or the read-only vault model.
- Renaming the developer's local checkout directory or rewriting completed historical OpenSpec records.

## Decisions

### Replace active former-name identifiers directly

Rename package metadata and the binary to `brain`; rename private environment keys to `BRAIN_*`; update source image tags, diagnostics, Action plumbing, CI temporary paths, content-loader and integration names, test fixtures, and deterministic seed namespaces. Add a focused audit test that permits former-name text only in an explicit historical OpenSpec allowlist.

No command, environment-variable, or package alias will be retained. This is preferable to compatibility shims because no stable release exists, aliases would permanently expand the contract, and the current image and Action locations already use the final name.

### Keep preview one-shot and add serve for live authoring

`brain preview` remains build-once then serve. `brain serve` uses the same normalized inputs but watches the vault after initial generation. Keeping two commands makes fixed-output smoke tests and debugging reproducible while giving authoring mode explicit recovery and reload semantics. Reinterpreting `preview` as a watcher was rejected because it would silently change process lifetime and test behavior established by the completed distribution change.

### Refactor generation into an asynchronous shared pipeline

Replace synchronous child execution with awaited child processes that can be terminated. Separate "generate completely into this destination" from final activation:

- `build` generates into staging and atomically promotes to the requested output as today.
- `preview` calls `build` once and serves the promoted output.
- `serve` generates immutable directories beneath its configured writable output/work area and gives the static server an active-root provider.

Serve starts the watcher and waits for it to be ready before the initial build. Changes observed during a build set a dirty flag; the coordinator runs at most one build at a time and immediately schedules one follow-up build after a settled burst. The HTTP listener opens only after the first generation succeeds.

Immutable generation roots avoid the rename gap that would occur if requests addressed a directory while it was being replaced. Activation is one in-memory root swap after Astro, attachment copying, Pagefind, and deterministic normalization all succeed. Each request retains the selected generation until its response completes; retired generations are deleted when no request references them.

### Use a polling watcher selected under the dependency policy

At implementation time, inspect the latest stable release and license of a mature watcher such as Chokidar, pin it exactly, and proceed only if its package and transitive runtime dependencies use permitted licenses. Configure polling and settled-write handling explicitly rather than relying on host filesystem events. Ignore generator output/work paths and excluded vault paths so generated state cannot trigger rebuild loops.

A hand-written recursive timer was rejected because correctly detecting additions, removals, renames, symlinks, and transient writes across platforms would recreate mature watcher behavior. Raw recursive `fs.watch` was rejected because Docker Desktop event delivery is the compatibility requirement.

### Extend the static server with active roots and SSE reload

The existing framework-independent HTTP server will resolve each request against the current immutable root. In serve mode it exposes a reserved, base-aware server-sent events endpoint and injects a small reload client into HTML responses in memory. Generated files on disk remain unchanged and hash-equivalent to `brain build`. Successful activation emits one reload event; failed attempts emit none. Preview uses the same server without injection or the reload endpoint.

SSE was chosen over WebSockets because communication is one-way, browser-native, and requires no protocol dependency. Polling from every browser was rejected because it adds recurring requests and cannot distinguish failed from successful generations cleanly.

### Coordinate process lifetime in the generator

The top-level command owns an abort signal shared by watcher, build coordinator, child processes, HTTP server, and SSE clients. SIGINT and SIGTERM stop new rebuild scheduling, terminate the active child, close network listeners and clients, await active requests, and remove owned generation directories. Documentation uses `docker run --init` as additional PID 1 protection.

The image will expose port 4321 for discoverability but will not force a network binding. The documented command binds Brain to `0.0.0.0` inside the container, publishes it as `127.0.0.1:4321` on the host, mounts the vault read-only, and uses writable `/work` and `/tmp` temporary filesystems. No host output directory is required for live serving.

### Verify production parity and container behavior before updating the candidate

Tests compare a serve generation with a normal build, exercise note and attachment add/change/delete, burst coalescing, edits during generation, failed-build retention, recovery, base-aware reload, and termination during idle and active builds. A Linux container smoke test edits a host bind-mounted fixture and verifies the served site changes without vault writes. Existing image architecture, Action parity, reproducibility, and release checks remain required before recording a new candidate digest.

## Risks / Trade-offs

- [Complete production rebuilds may be slow for large vaults] -> Debounce bursts, serialize attempts, retain the working site, and measure against the existing 2,000-note stress fixture before considering incremental generation.
- [Polling consumes CPU and filesystem I/O] -> Use a moderate configurable-in-code interval, settled-write detection, ignored paths, and no overlapping scans; validate idle behavior in a container.
- [An HTML reload injection could diverge from deployed output] -> Inject only at response time in serve mode and verify persisted output hashes against `build`.
- [Deleting a retired generation could break a response] -> Reference-count roots per request and clean only after the final request releases that root.
- [Termination during Astro or Pagefind could leave descendants] -> Spawn controllable process groups where supported, propagate abort and signals, use `--init` in Docker documentation, and test SIGTERM during each stage.
- [The generic package name `brain` may not be publishable on npm] -> Treat OCI and GitHub Action distribution as authoritative; npm publication remains out of scope and can adopt a scoped package in a separate change if needed.
- [Renaming the graph seed changes initial coordinates] -> Accept the one-time pre-v1 layout change and keep deterministic tests pinned to the new Brain namespace.

## Migration Plan

1. Rename active identifiers and update tests/docs together, preserving only explicitly historical records.
2. Add and verify the asynchronous shared generation primitive without changing build or preview output.
3. Add generation-aware static serving, polling watch coordination, reload, and shutdown behavior.
4. Verify source and local container live serving, deterministic production parity, multi-architecture image behavior, and existing Action/Pages contracts.
5. Build and attest a new `ghcr.io/tjakobsson/brain` candidate, record its immutable digest in automation and release metadata, and rerun release checks.

Rollback before v1 reverts the change and restores the prior candidate digest. Once a stable release includes `brain serve`, rollback uses the prior immutable Brain release rather than restoring former-name aliases.
