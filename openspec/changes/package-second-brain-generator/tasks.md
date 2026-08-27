## 1. Build contract and licensing boundary

- [x] 1.1 Inspect the latest stable Wolfi/Chainguard Node image metadata and SBOM, write ADR 0002 with the approved build-tool-only copyleft exception and exact observed license families, and verify the ADR exists before any container definition is added.
- [x] 1.2 Add normalized generator input parsing for `build` and `preview` commands covering vault, output, site, base, repeated exclusions, strict links, host, and port; verify unit tests cover defaults, malformed URLs and bases, repeated options, and actionable usage errors.
- [x] 1.3 Add real-path and permission safety validation that keeps the vault read-only and rejects empty vaults, unsafe output ancestry, and unwritable output; verify tests prove rejected builds do not modify fixture vaults or existing output.

## 2. Base-path-aware site generation

- [x] 2.1 Introduce one shared logical-route and base-joining contract, migrate note, tag, search, graph, navigation, redirect, favicon, and wiki-link URLs to it, and verify unit tests prevent missing or doubled base prefixes.
- [x] 2.2 Feed normalized site, base, vault, output-staging, exclusions, and strict-link values into Astro configuration and integrations through private internal settings; verify clean root and `/vault-repo` fixture builds both succeed.
- [x] 2.3 Migrate browser-side graph, quick-switcher, search, Pagefind, and navigation requests away from domain-root assumptions; verify production browser tests at `/vault-repo` exercise every feature and fail on application requests outside that base.

## 3. Vault manifest and attachments

- [x] 3.1 Replace separate Markdown traversal assumptions with one sorted vault manifest that applies default and caller exclusions before deriving site data; verify fixtures exclude hidden paths, `.obsidian`, `.github`, `Templates`, output directories, custom patterns, and escaping symlinks.
- [x] 3.2 Parse standard Markdown images, standard file links, and Obsidian attachment embeds from publishable notes; verify tests cover relative paths, vault-root paths, spaces, Unicode names, aliases, anchors, and note links that must not be treated as attachments.
- [x] 3.3 Resolve exact attachment paths before unique filename matches and reject missing, ambiguous, excluded, or outside-vault targets; verify diagnostics identify the source note, raw reference, and conflicting paths where applicable.
- [x] 3.4 Render attachment references and copy only referenced non-Markdown files under `vault-assets/` while preserving vault-relative structure; verify root and subpath builds load images and linked files and omit an unreferenced sentinel file.
- [x] 3.5 Add strict unresolved-note-link handling without changing default unwritten-link behavior; verify default builds warn and complete while strict builds report all unresolved links and exit non-zero.

## 4. Safe build and preview pipeline

- [x] 4.1 Implement staging, Astro generation, attachment copying, Pagefind indexing, and final output promotion behind the generator command; verify a forced late-stage failure leaves previous output intact and no staging path leaks into generated files.
- [x] 4.2 Make inventories and generated content reproducible by sorting manifest-derived data and omitting machine and time metadata; verify two clean builds of the same fixture have identical file lists and hashes.
- [x] 4.3 Implement preview as build-then-serve over configurable host and port using the same validation path; verify a browser can load the site and graph from preview and an invalid vault is never served.
- [x] 4.4 Replace direct environment-variable and repository-relative preview documentation with command-level integration tests; verify local external-vault build and preview commands work without modifying the generator checkout's content.

## 5. Wolfi OCI image

- [x] 5.1 Pin the latest stable security-patched Wolfi Node base by digest, add a lockfile-reproducible multi-stage image with the Node generator entrypoint, and verify its resulting SBOM stays within ADR 0001, ADR 0002, and the permissive dependency policy.
- [x] 5.2 Configure the image for non-root and arbitrary host UID/GID execution with dedicated work, read-only vault, output, and temporary mounts; verify builds succeed with a read-only vault and fail clearly for an unwritable output without changing vault hashes.
- [x] 5.3 Build `linux/amd64` and `linux/arm64` variants and run build, preview, and network-disabled smoke tests against the demo fixture; verify both architectures expose the same command help and generated file hashes.

## 6. Release and build Action

- [ ] 6.1 Add a candidate image workflow that publishes to GHCR with semantic metadata, SBOM, and verifiable GitHub provenance using the latest stable official Actions pinned to full commit SHAs; verify workflow linting and a non-publishing pull-request build complete.
- [x] 6.2 Add a Linux composite `action.yml` that prepares caller-owned directories and invokes a checked-in image digest as the runner's non-root UID/GID; verify all generator inputs, failure diagnostics, and the normalized output-path result match direct image use.
- [x] 6.3 Add parity fixtures that build through the command, released image, and composite Action and compare output inventories and hashes; verify CI blocks digest updates when any surface diverges.
- [x] 6.4 Automate the two-phase release check that records one candidate digest in both automation surfaces before semantic tagging; verify a dry run reports source commit, image digest, SBOM, provenance, and required major-version changes without publishing a release.

## 7. Reusable GitHub Pages publication

- [x] 7.1 Add a `workflow_call` Pages workflow that checks out the caller, obtains `origin` and `base_path` from Pages configuration, runs the pinned image, uploads one official Pages artifact, and deploys through the `github-pages` environment; verify workflow syntax and permission declarations with pinned official Action SHAs.
- [ ] 7.2 Add workflow inputs for vault path, exclusions, and strict links while keeping output and mount details internal; verify fixture invocations cover defaults, custom exclusions, strict-link failure, and prevention of deployment after build failure.
- [x] 7.3 Exercise generated artifacts with project Pages, root Pages, and custom-domain addressing; verify browser tests load notes, attachments, graph data, search, Pagefind, and navigation without base-path escapes.
- [x] 7.4 Document minimal consumer workflows pinned by maintained major version and immutable commit SHA, required permissions, Pages source setup, and compatibility rules; verify the documented YAML parses and matches reusable-workflow inputs.

## 8. Repository separation and documentation

- [x] 8.1 Replace the starter README with generator documentation for local Docker and Podman builds, preview, mounts and UID handling, supported attachment forms, exclusions, validation, custom domains, Action use, Pages use, and rollback; verify every documented local command against the demo fixture.
- [x] 8.2 Create a small public `examples/demo-vault` and focused attachment fixtures without moving the personal vault yet; verify the complete unit, build, root/subpath browser, stress-vault, and reproducibility suites pass against public fixtures.
- [x] 8.3 After explicit approval to create or select the external consumer repository, copy the personal vault unchanged with attachments and Obsidian metadata, add only its caller workflow, and verify a committed consumer build matches the current site's note count, links, graph, search, and attachment inventory.
- [x] 8.4 After the consumer commit and Pages deployment are explicitly confirmed, remove the personal vault from the generator repository and switch defaults and tests to the demo fixture; verify `npx astro build`, the container smoke suite, and repository secret scanning find no dependency on or copy of personal content.
- [ ] 8.5 Run `npm test`, root and subpath production builds, the generated 2,000-note build, container architecture tests, Action parity tests, workflow validation, license audit, and `openspec validate "package-second-brain-generator" --strict`; verify all local acceptance checks pass before requesting separate approval to tag or publish the first release.
