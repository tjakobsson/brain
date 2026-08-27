## Context

See `proposal.md` for motivation and the three delta specs for observable behavior. The current Astro application already accepts an external vault through `BRAIN_MANUAL_VAULT`, but that environment variable is resolved against the generator checkout, output is fixed to `dist/`, and root-absolute URLs are embedded throughout server-rendered pages and client scripts. Vault scanning currently indexes only Markdown and does not publish vault attachments.

The product must run in three contexts without separate implementations: direct local container use, a standalone GitHub build Action, and a reusable GitHub Pages workflow. The generated site remains static and must stay openable from root domains and GitHub project subpaths. The personal vault must not be deleted until an external consumer copy has been built and verified.

## Goals / Non-Goals

**Goals:**

- Define one generator command and one normalized input model for every execution context.
- Keep the vault read-only and make output promotion safe and deterministic.
- Publish only files reachable from publishable Markdown while retaining Obsidian-compatible attachment lookup.
- Make release source, OCI image, Action, and reusable workflow versions traceable to one immutable image digest.
- Keep the consumer repository limited to vault content and a small workflow invocation.

**Non-Goals:**

- Synchronizing vaults, editing notes in the browser, or writing generated metadata back to Markdown.
- Rendering arbitrary Obsidian plugin data, Canvas files, or transcluded Markdown notes in the first release.
- Continuous watch mode or live reload inside the released container; preview performs a build and serves that result.
- Providing deployment integrations other than GitHub Pages; the static output can still be hosted elsewhere.
- Automatically creating, naming, or changing the visibility of the user's external vault repository.

## Decisions

### Put a command wrapper in front of Astro

A Node command will be the public interface and expose `build` and `preview` subcommands. Both normalize the same inputs: vault path, output path, canonical site origin, URL base path, repeated exclusions, and strict-link mode. Environment variables remain an internal adapter used to pass normalized values into Astro configuration and integrations; consumers do not depend on them.

The command validates real paths and permissions before running Astro, builds into a generator-owned staging directory, runs Pagefind there, and promotes the completed staging directory to the requested output only after all validation and indexing succeeds. Preview calls the same build path and then serves the promoted static directory on a configurable address and port.

This is preferred over exposing `astro build` and environment variables because a command gives the container and Action one stable contract, permits output safety checks, and isolates future Astro changes. A standalone framework-agnostic generator rewrite is rejected because the current Astro implementation already provides the required static rendering.

### Treat deployment paths as first-class build data

Astro receives a normalized `site` origin and `base` path. A shared URL helper joins logical application routes with the base exactly once and is usable by build-time code and browser scripts. Graph data, search data, note metadata, and link indexes store logical routes rather than pre-prefixed strings so rendering owns final URL construction. Astro-managed bundles use its configured base; every manually authored fetch, redirect, navigation target, favicon, Pagefind path, wiki-link, and attachment URL uses the helper.

Tests build the same fixture at an empty base and at `/vault-repo`, then crawl generated HTML and exercise browser features while rejecting requests that escape the configured base. Relative-only URLs were considered, but explicit base-prefixed URLs are less sensitive to nested note routes and match Astro's GitHub Pages guidance.

### Build one vault manifest for notes and referenced files

Vault scanning will produce one manifest from normalized POSIX-style paths. Default traversal excludes hidden path segments, `.obsidian`, `.github`, `Templates`, the selected output, and caller-supplied patterns before notes, links, graph data, search data, or attachments are derived. Symlinks are resolved and rejected when their real target leaves the vault.

Markdown parsing records standard image destinations, standard file-link destinations, and Obsidian embeds. Relative Markdown destinations resolve from the source note's directory. Obsidian attachment targets containing a path resolve from the vault root; filename-only targets resolve only when the non-excluded filename is unique. Existing note-title resolution takes precedence for wiki-links, and Markdown note transclusion remains out of scope.

Only referenced non-Markdown files are copied, preserving their vault-relative structure under `vault-assets/`. URL path segments are encoded at rendering time, while filesystem paths remain native. Missing, ambiguous, or escaping attachments are fatal because otherwise the published site is incomplete; unresolved note links retain warning or strict-error behavior.

Copying the entire vault was rejected because it can publish private files and plugin state. Flattening attachments was rejected because duplicate filenames are common and would make URLs unstable.

### Keep generated output reproducible

The manifest, routes, copied files, and generated indexes are sorted by normalized vault-relative path. Generated files do not contain build timestamps, checkout locations, temporary paths, or random release data. Staging directories and container temporary paths stay outside the promoted output. Reproducibility tests compare file inventories and hashes from two clean builds of the same fixture.

### Use a pinned Wolfi Node image with an explicit license boundary

Implementation starts by adding ADR 0002 for the user-approved exception covering copyleft packages found in the Wolfi Node image's SBOM. The ADR limits the exception to the unmodified, distributed build-tool container and does not relax application dependency policy.

The image uses a pinned Wolfi/Chainguard Node digest selected from the latest stable, security-patched release at implementation time. A multi-stage build installs exactly the lockfile dependencies and copies the generator plus required build tools into a minimal runtime stage. It has a Node entrypoint rather than a shell entrypoint, defaults to a non-root user, writes temporary data only under a designated work mount, and supports arbitrary non-root host UIDs for bind-mount ownership. The vault mount is documented read-only and the output mount must already be writable.

`linux/amd64` and `linux/arm64` variants share one multi-platform manifest. The release workflow publishes the image to GHCR with an SBOM and GitHub build provenance. Alpine and Debian Node images were considered, but Wolfi was selected by the user for its minimal, frequently rebuilt packages and supply-chain metadata. A scratch image was rejected because assembling and maintaining Node's native runtime libraries would add disproportionate release risk.

### Make the build Action a thin composite adapter

The standalone Action is a composite Action for Linux runners. It creates the output and temporary directories, invokes the released image by immutable digest with the runner's non-root UID and GID, maps Action inputs to command arguments, and exposes the normalized output path. This avoids rebuilding the image on every workflow run and avoids write failures caused by the image's default UID on GitHub workspace mounts.

A Docker Action using `image: Dockerfile` was rejected because it duplicates release builds and is slow. A Docker Action using `docker://` was rejected because GitHub controls its mounts while the non-root image cannot reliably prepare caller-owned output directories.

### Pin one image digest into both automation surfaces

`action.yml` and the reusable Pages workflow each reference the same checked-in image digest. A semantic release is two-phase: build and attest a candidate image, record its digest in both automation files, run contract tests against that digest, then create immutable semantic-version tags and update the maintained major reference. The release notes identify the source commit, image digest, SBOM, provenance, and compatibility level.

This avoids a hidden mutable dependency when a consumer pins the Action or reusable workflow by commit. Floating `latest` image tags are published only as convenience aliases and are never used by checked-in automation.

### Let the reusable workflow own Pages plumbing

The `workflow_call` workflow checks out the caller repository, runs GitHub's Pages configuration action, and reads its `origin` and `base_path` outputs. It invokes the pinned generator image with the caller vault mounted read-only, uploads exactly the generated output through the official Pages artifact action, and deploys through the official deployment action and `github-pages` environment.

The workflow uses an Ubuntu runner because the composite build Action and container require Docker. Official third-party Actions are selected at their latest stable releases during implementation and pinned to full commit SHAs. The caller grants `contents: read`, `pages: write`, and `id-token: write`; the workflow does not introduce alternate credentials or branch publication.

The reusable workflow invokes the immutable image directly rather than referencing the repository's Action through a mutable tag. Both remain equivalent because contract tests run local image, Action, and reusable-workflow builds against the same digest and fixture.

### Migrate the personal vault only after parity checks

The generator first becomes fully external-vault capable while the existing `vault/` remains untouched. The personal vault is then copied with attachments and Obsidian metadata into a separate consumer repository, where the minimal Pages workflow is added. Local container output and deployed Pages output are checked for note count, links, graph data, search, and attachment integrity.

Only after the consumer repository has a verified commit does the generator remove the personal content and add a deliberately small `examples/demo-vault` plus focused attachment fixtures. The stress vault remains generated rather than committed. Rollback restores `vault/` from the verified consumer commit and points the generator command back at it; no content transformation is required.

## Risks / Trade-offs

- [A missed root-absolute URL breaks project Pages] -> Build and browser-test every feature under a non-empty base while failing tests on domain-root application requests.
- [Referenced-only copying misses unusual raw HTML or plugin attachment syntax] -> Document supported reference forms, cover them with fixtures, and fail visibly rather than silently copying the whole vault.
- [A private file is accidentally published through a reference] -> Exclude sensitive path classes before resolution, show copied attachments in build output, and preserve explicit consumer exclusions.
- [Wolfi image licenses drift between base updates] -> Pin by digest, retain the SBOM with the release, compare license inventories during updates, and require a new ADR for packages outside ADR 0002's boundary.
- [Non-root bind mounts are unwritable on some hosts] -> Support arbitrary host UID/GID execution, validate mounts before building, and document Docker and Podman commands that pre-create output directories.
- [Action, workflow, and image versions diverge] -> Store one digest in both automation surfaces and block release until parity smoke tests pass.
- [Two-phase releases are operationally heavier] -> Automate digest updates and release checks; accept the extra step to preserve immutable consumer pinning.
- [Moving the vault could lose private content or history] -> Copy first, verify a committed consumer repository, and remove the generator copy only after explicit parity checks.

## Migration Plan

1. Record ADR 0002 and inventory the selected Wolfi image licenses before adding container files.
2. Introduce the generator command, manifest, attachment handling, base-path support, staging output, and root/subpath contract tests while retaining the current vault.
3. Build and test the non-root multi-architecture image locally, then publish a candidate digest with SBOM and provenance.
4. Add the composite build Action and reusable Pages workflow pinned to that candidate digest and verify parity on fixture repositories.
5. Create the external consumer vault repository, copy the personal vault unchanged, add the minimal reusable-workflow caller, and verify local and deployed output.
6. Replace the generator's personal vault with public demo and attachment fixtures only after the consumer commit is confirmed.
7. Tag the first semantic release, update the maintained major reference, and publish migration and rollback documentation.

Rollback keeps the last known generator release and image digest available, re-pins consumer workflows to it, and restores the personal vault from its consumer repository if repository separation must be reversed.

## Open Questions

- The final public repository, image, and Action name can be chosen before the first release without changing the contracts or implementation structure.
