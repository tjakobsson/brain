# Brain

Brain turns Brain Markdown directories and workspaces into static, searchable second-brain sites. The same generator runs from source, as a non-root OCI image, or through a composite GitHub Action that can feed a GitHub Pages workflow.

![Brain showing linked notes on desktop and mobile](docs/brain-showcase.svg)

## Get started

- [Run a Brain locally with Docker](#start-with-docker)
- [Publish a Brain with GitHub Pages](#publish-with-github-pages)
- [Prepare Brain Markdown](#brain-markdown-format)
- [Combine several brains in a workspace](docs/workspaces.md)
- [Build Brain from source](#source-build)

## Start with Docker

You only need [Docker Desktop](https://www.docker.com/products/docker-desktop/), or Docker Engine on Linux, and a Brain Markdown directory. You do not need Node.js or a copy of this repository. Brain mounts the source read-only, so it does not change your notes.

1. Install and start Docker.
2. Open a terminal in your Brain directory.
3. Run this command:

   ```sh
   docker run --rm --init --read-only --publish 127.0.0.1:4321:4321 --mount "type=bind,src=$PWD,dst=/vault,readonly" --tmpfs /work:rw,mode=1777 --tmpfs /tmp:rw,mode=1777 ghcr.io/tjakobsson/brain:v1 serve --vault /vault --output /work/site --host 0.0.0.0 --port 4321
   ```

4. Open [http://127.0.0.1:4321/](http://127.0.0.1:4321/) in a browser.

Keep the terminal open while using Brain. Source changes rebuild the site and reload the browser after a successful build. Press `Ctrl+C` to stop it.

The `v1` image tracks maintained v1 releases. Pin an exact version or digest when the deployment must not move.

## Publish with GitHub Pages

GitHub Actions can rebuild and publish the site whenever you push changes to your Brain directory. Only use this with content intended for public reading. Brain publishes every included note and referenced attachment.

1. Create a GitHub repository for your Brain directory and push the files to its `main` branch.
2. Open the repository's **Settings > Pages** and set **Source** to **GitHub Actions**.
3. Add [`pages-major.yml`](docs/examples/pages-major.yml) as `.github/workflows/pages.yml`.
4. Add [`validate-pr.yml`](docs/examples/validate-pr.yml) as `.github/workflows/validate.yml`.
5. Commit and push the workflows. Follow the **Publish second brain** run in the repository's **Actions** tab; its deploy job links to the published site.

The Pages workflow deploys only after changes reach `main`. The validation workflow builds pull requests with strict link checking, grants only `contents: read`, and uploads the generated site as a seven-day workflow artifact. In the repository's branch ruleset, require **Validate second brain / Build site** before merging to prevent invalid Brain content from reaching `main`.

For an immutable toolchain, replace `tjakobsson/brain@v1` in both workflows with a reviewed full Brain commit SHA.

## Brain Markdown format

Note filenames are titles and must be unique inside one Brain directory. Do not repeat the title as an H1. Optional frontmatter controls note type, maturity, tags, and dates or ISO timestamps:

```yaml
---
type: permanent
status: established
tags: [pkm, web]
created: 2026-08-26T09:15:00Z
updated: 2026-08-27T16:40:00Z
---
```

Brain wiki-links use titles, not paths: `[[Portable notes]]`, `[[Portable notes|an alias]]`, or `[[Portable notes#Heading]]`. Unresolved note links produce warnings unless strict validation is enabled. Callouts, highlights, and attachment embeds are Brain Markdown features defined by this project.

Brain Markdown remains readable as plain text in general Markdown tools. Native compatibility with a specific knowledge-management application is not part of the contract. `.obsidian` is excluded by default as migration metadata.

To publish several independent directories together, use a [Brain workspace](docs/workspaces.md). Workspace links can target another registered brain with `[[@brain-id/Note Title]]`.

## Source Build

Node.js 22.12 or newer is required:

```sh
npm ci
node scripts/generator.mjs build \
  --vault examples/demo-vault \
  --output .generated/source-site \
  --site https://example.com \
  --base /notes \
  --strict-links
```

Preview performs a fresh production build, then serves it without live reload or browser editing:

```sh
node scripts/generator.mjs preview \
  --vault examples/demo-vault \
  --output .generated/source-preview \
  --base /notes \
  --port 4322
```

Open `http://localhost:4322/notes/`.

For live authoring, `serve` watches the Brain directory and runs the same complete production build after changes. It keeps the last successful site available if a note is temporarily invalid and reloads the browser only after a successful replacement:

```sh
node scripts/generator.mjs serve \
  --vault examples/demo-vault \
  --output .generated/source-live \
  --port 4321
```

Workspace commands use the public fixture manifest:

```sh
node scripts/generator.mjs build \
  --workspace examples/demo-workspace/workspace.json \
  --output .generated/workspace-site
```

See [Brain workspaces](docs/workspaces.md) for the complete v1 schema, source and container commands, routes, scope rules, and publication constraints.

## Build the Docker image locally

To run the exact code in this checkout instead of the published `v1` image, build the multi-stage image:

```sh
docker build --tag brain:source .
```

Use `brain:source` in place of `ghcr.io/tjakobsson/brain:v1` in the quick-start command above.

For a workspace build or preview, mount the manifest and every referenced Brain directory read-only. The [workspace container examples](docs/workspaces.md#container-mounts) run against `examples/demo-workspace/workspace.json`.

For a one-shot static build, prepare caller-owned output directories:

```sh
mkdir -p .generated/docker-output .generated/docker-work
```

Generate the demo site without runtime network access:

```sh
docker run --rm \
  --read-only \
  --network none \
  --user "$(id -u):$(id -g)" \
  --mount "type=bind,src=$PWD/examples/demo-vault,dst=/vault,readonly" \
  --mount "type=bind,src=$PWD/.generated/docker-output,dst=/output" \
  --mount "type=bind,src=$PWD/.generated/docker-work,dst=/work" \
  --tmpfs /tmp:rw,mode=1777 \
  brain:source build \
  --vault /vault \
  --output /output/site \
  --site https://example.com \
  --base /notes \
  --strict-links
```

The output is `.generated/docker-output/site`. Mount a writable output parent and select a child such as `/output/site`; atomic replacement needs permission to rename within the parent.

Container preview uses the same inputs and validation:

```sh
docker run --rm \
  --read-only \
  --user "$(id -u):$(id -g)" \
  --publish 127.0.0.1:4322:4322 \
  --mount "type=bind,src=$PWD/examples/demo-vault,dst=/vault,readonly" \
  --mount "type=bind,src=$PWD/.generated/docker-output,dst=/output" \
  --mount "type=bind,src=$PWD/.generated/docker-work,dst=/work" \
  --tmpfs /tmp:rw,mode=1777 \
  brain:source preview \
  --vault /vault \
  --output /output/preview \
  --base /notes \
  --host 0.0.0.0 \
  --port 4322
```

Open `http://127.0.0.1:4322/notes/`.

## Podman

Build and run the same Dockerfile. On Linux, `--userns=keep-id` maps generated files to the caller:

```sh
podman build --tag brain:source .
mkdir -p .generated/podman-output .generated/podman-work
podman run --rm \
  --read-only \
  --network none \
  --userns=keep-id \
  --user "$(id -u):$(id -g)" \
  --mount "type=bind,src=$PWD/examples/demo-vault,dst=/vault,readonly" \
  --mount "type=bind,src=$PWD/.generated/podman-output,dst=/output" \
  --mount "type=bind,src=$PWD/.generated/podman-work,dst=/work" \
  --tmpfs /tmp:rw,mode=1777 \
  brain:source build \
  --vault /vault \
  --output /output/site \
  --site https://example.com \
  --base /notes \
  --strict-links
```

Podman on macOS or Windows first requires a running Podman machine and shared access to the checkout directory.

## Generator Inputs

| Option | Default | Meaning |
| --- | --- | --- |
| `--vault <path>` | `./examples/demo-vault` | One readable Brain directory |
| `--workspace <path>` | unset | Workspace v1 JSON manifest; mutually exclusive with `--vault` |
| `--output <path>` | `./dist` | Static output directory |
| `--site <origin>` | unset | Canonical HTTP(S) origin without a path |
| `--base <path>` | `/` | Root or project deployment path |
| `--exclude <glob>` | none | Additional Brain exclusion; repeatable |
| `--strict-links` | off | Fail on unresolved wiki-links |
| `--host <host>` | `localhost` | Preview or live-server bind host |
| `--port <port>` | `4321` | Preview or live-server port |

Hidden path segments, `.obsidian`, `.github`, and `Templates` are excluded by default. `.obsidian` is treated only as migration metadata. An excluded referenced attachment is an error. An excluded linked note becomes an unresolved-link warning or, with `--strict-links`, an error.

The generator rejects invalid URLs, unsafe output locations, unreadable or empty Brain directories, duplicate titles within one brain, invalid frontmatter, missing or ambiguous attachments, and unwritable output parents. Output promotion is atomic, so a failed build preserves the previous site.

## Attachments

The generator publishes only referenced files while preserving their Brain-relative paths. Supported references are:

```md
![Markdown image](media/diagram.svg)
[Download](media/reference.txt)
![[media/diagram.svg|Brain image alias]]
```

Paths may be relative to the note or Brain root. A unique filename can resolve without a directory; ambiguous filenames fail. Missing, excluded, escaping-symlink, and outside-source targets fail the build. Raw HTML references, plugin-specific embeds, and Markdown transclusion are not attachment inputs. Workspace attachments never resolve across brain boundaries.

## Deployment Addressing

For project Pages, pass the origin separately from the repository base:

```sh
node scripts/generator.mjs build \
  --vault examples/demo-vault \
  --output .generated/project-pages \
  --site https://user.github.io \
  --base /vault-repo
```

For root Pages or a custom domain, use `/`:

```sh
node scripts/generator.mjs build \
  --vault examples/demo-vault \
  --output .generated/custom-domain \
  --site https://notes.example.com \
  --base /
```

The Pages examples derive both values from GitHub Pages configuration, including custom domains.

## GitHub Action

The Linux composite Action creates caller-owned directories, runs the immutable release image as the runner UID/GID, and returns `output-path`. `exclusions` is newline-delimited. Supply either `vault` for one Brain directory or `workspace` for a manifest, never both.

Use `tjakobsson/brain@v1` for maintained v1 updates or replace `v1` with a reviewed full commit SHA for an immutable toolchain. See [`docs/examples/build-action-major.yml`](docs/examples/build-action-major.yml) for one Brain and [`build-action-workspace-major.yml`](docs/examples/build-action-workspace-major.yml) for caller-prepared multi-repository checkouts.

For pull requests, copy [`validate-pr.yml`](docs/examples/validate-pr.yml) to `.github/workflows/validate.yml`. It runs the Action with `strict-links: true`, uses no deployment permissions, and uploads the generated site for inspection. Keep Pages deployment in a separate workflow triggered by pushes to `main`, then make **Validate second brain / Build site** a required check in the branch ruleset.

For a workspace spanning repositories, the caller must check out every repository before invoking the Action. See [GitHub Action checkouts](docs/workspaces.md#github-action-checkouts).

## GitHub Pages

In the Brain repository, select **Settings > Pages > Build and deployment > Source > GitHub Actions**. The workflow grants only `contents: read`, `pages: write`, and `id-token: write`. It checks out the source, builds with `tjakobsson/brain`, uploads one official Pages artifact, and deploys through the `github-pages` environment.

Use `tjakobsson/brain@v1` in the build step for maintained v1 updates or replace `v1` with a reviewed full commit SHA for immutable deployment. See [`docs/examples/pages-major.yml`](docs/examples/pages-major.yml).

The reusable Pages workflow supports a workspace only when its manifest and every Brain directory are inside the caller repository checkout. Multi-repository publication requires a caller-authored job with explicit checkouts and the build Action. See [the Pages limitation](docs/workspaces.md#github-pages-limitation).

Removing or renaming an input, changing a default or output, or changing supported behavior requires a new major release. Backward-compatible fixes update the maintained major reference. A full SHA never moves.

## Rollback

For a failed local generation, fix the input and rerun; atomic promotion leaves the prior output untouched. For automation regressions, pin the prior Action commit SHA and its associated image digest. Release notes identify the source commit, OCI digest, SBOM, provenance, and compatibility level. Repository migration rollback restores the Brain source from its verified consumer repository before changing publication workflows.

## Verification

```sh
npm test
npm run test:browser
npx astro build
actionlint .github/workflows/*.yml
```

Generate the deterministic 2,000-note stress vault with `npm run vault:generate`.

## License

Brain is available under the [MIT License](LICENSE). Third-party notices are listed in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
