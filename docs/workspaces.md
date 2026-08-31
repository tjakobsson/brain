# Brain workspaces

A workspace publishes several independent Brain Markdown directories as one static site. The generator reads a versioned JSON manifest at build time. It does not merge source directories, discover repositories, fetch remote content, or write to an input.

Use `--workspace` for this mode. It is mutually exclusive with the existing `--vault` option.

## Workspace v1 schema

The public fixture uses `examples/demo-workspace/workspace.json`. A complete v1 manifest has this shape:

```json
{
  "version": 1,
  "title": "Product knowledge",
  "description": "Shared product and company notes",
  "exclusions": ["**/private/**"],
  "groups": [
    {
      "id": "company",
      "title": "Company"
    },
    {
      "id": "product",
      "title": "Product",
      "parent": "company"
    }
  ],
  "brains": [
    {
      "id": "design",
      "title": "Design",
      "path": "./brains/design",
      "group": "product",
      "description": "Interaction and visual design",
      "accent": "#b56cff",
      "exclusions": ["private/**"]
    }
  ]
}
```

Workspace fields:

| Field | Required | Meaning |
| --- | --- | --- |
| `version` | yes | Schema version. Version 1 requires the value `1`. |
| `title` | yes | Display title for the workspace. |
| `description` | no | Short reader-facing description of the workspace. |
| `exclusions` | no | Brain-relative glob patterns applied to every registered brain. Defaults to `[]`. |
| `groups` | no | Ordered presentation groups. Defaults to `[]`. |
| `brains` | yes | Ordered, non-empty list of registered brains. |

Group fields:

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Stable lower-case kebab-case group ID, unique among groups. |
| `title` | yes | Reader-facing group title. |
| `parent` | no | ID of another declared group. |

Brain fields:

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Stable lower-case kebab-case brain ID, unique among brains. |
| `title` | yes | Reader-facing brain title. |
| `path` | yes | Readable Brain Markdown directory, resolved relative to the manifest. |
| `group` | no | ID of a declared presentation group. |
| `description` | no | Short text shown by workspace navigation. |
| `accent` | no | Six-digit hexadecimal color, such as `#b56cff`. Brain assigns a deterministic color from its built-in accessible palette when omitted. |
| `exclusions` | no | Additional brain-relative glob patterns for this brain. Defaults to `[]`. |

Unknown fields are rejected. Brain paths must resolve to distinct readable directories. Duplicate IDs, duplicate real paths, missing group references, missing parent groups, hierarchy cycles, invalid accents, and unsupported manifest versions stop generation before output changes.

Groups organize the chooser only. They never become part of a note ID, link target, or URL. A brain ID is the durable identity. Keep it unchanged when renaming a brain, changing its description or accent, or moving it between groups. Those presentation edits then leave cross-brain links and note URLs unchanged.

## Brain Markdown

Each registered brain follows the Brain Markdown contract:

- A note is a plain `.md` file. Its filename without `.md` is its title.
- Titles are unique case-insensitively inside one brain. Different brains may use the same title.
- Folders organize files but do not affect note identity or link resolution.
- Optional YAML frontmatter supplies `title`, `type`, `status`, `tags`, `created`, and `updated` metadata.
- Brain callouts use `> [!note]` or another supported callout type. Highlights use `==text==`.
- Brain attachment embeds use `![[media/diagram.svg|preview]]`.

`.obsidian` is excluded by default as migration metadata. Its contents do not define Brain Markdown behavior or compatibility.

## Links between brains

An unqualified wiki-link resolves only inside the source note's brain:

```md
[[Local Note]]
[[Local Note|display text]]
[[Local Note#Heading]]
[[Local Note#Heading|display text]]
```

Prefix the title with `@brain-id/` to select another declared brain:

```md
[[@design/Interaction model]]
[[@design/Interaction model|the design model]]
[[@research/Cognitive load#Measurements]]
[[@research/Cognitive load#Measurements|the measurements]]
```

The leading `@brain-id/` form is reserved for cross-brain links. An `@` elsewhere in a title remains ordinary title text. Unknown brain IDs and missing notes are separate diagnostics. Both warn in normal mode and fail with `--strict-links`.

Backlinks include resolved links from every configured brain and identify the source brain. Orphan reports also count inbound cross-brain links. Unlinked mention detection stays within one brain because titles are not globally unique. Attachments resolve only inside the source note's brain.

## Public content boundary

Treat every registered directory as public input. Brain publishes every included note and every included attachment referenced by a published note. It does not provide private-note filtering, authentication, or runtime access control.

Global exclusions and per-brain exclusions remove matching notes and files before pages, search data, graph data, or attachments are generated. Unreferenced files are not copied. No other repository or sibling directory is included unless the manifest registers it, and readers cannot attach another brain from the browser.

## Routes and reader scope

Workspace mode uses stable brain IDs in routes:

| Route | Scope |
| --- | --- |
| `/` | Workspace chooser |
| `/brains/<brain-id>` | One brain's graph |
| `/brains/<brain-id>/notes/<slug>` | One note |
| `/brains/<brain-id>/tags` | One brain's tags |
| `/brains/<brain-id>/tags/<tag>` | One brain and tag |
| `/brains/<brain-id>/recent` | One brain's recent notes |
| `/brains/<brain-id>/orphans` | One brain's orphans |
| `/graph?brains=<id,id>` | Reader-selected combined graph |

Generated attachment URLs are also namespaced by the owning brain, so equal attachment paths in different brains cannot collide.

Combined selections contain exactly the requested declared brains. Brain removes duplicates and writes IDs in manifest registry order to produce one canonical, shareable URL. An unknown ID produces an error instead of silently changing scope.

The navigation pill's quick switcher searches note titles and tags. It defaults to the active brain, uses the current selection on a combined page, and offers an explicit all-brains scope. Search opened from the root chooser uses all brains because no brain is active.

A per-brain graph contains all local notes plus directly connected foreign notes as boundary nodes. It does not add unrelated notes from foreign brains. A combined graph contains notes owned by the selected brains and resolved edges whose endpoints remain in that selection. Graph search identifies each result's owning brain, including when two brains use the same title.

## Build from source

Build the public workspace fixture:

```sh
node scripts/generator.mjs build \
  --workspace examples/demo-workspace/workspace.json \
  --output .generated/workspace-site \
  --site https://example.com \
  --base /notes
```

`preview` and `serve` accept the same workspace input:

```sh
node scripts/generator.mjs preview \
  --workspace examples/demo-workspace/workspace.json \
  --output .generated/workspace-preview \
  --base /notes \
  --port 4322
```

```sh
node scripts/generator.mjs serve \
  --workspace examples/demo-workspace/workspace.json \
  --output .generated/workspace-live \
  --port 4321
```

## Container mounts

The workspace manifest and every source it references must exist at the paths seen inside the container. Mount all inputs read-only. Mount output and generator work directories separately as writable storage.

After building the checkout with `docker build --tag brain:source .`, run the public fixture. Mount the manifest and each registered brain read-only at the paths declared by the manifest:

```sh
mkdir -p .generated/docker-output .generated/docker-work
docker run --rm \
  --read-only \
  --network none \
  --user "$(id -u):$(id -g)" \
  --mount "type=bind,src=$PWD/examples/demo-workspace/workspace.json,dst=/workspace/workspace.json,readonly" \
  --mount "type=bind,src=$PWD/examples/demo-workspace/brains/engineering,dst=/workspace/brains/engineering,readonly" \
  --mount "type=bind,src=$PWD/examples/demo-workspace/brains/design,dst=/workspace/brains/design,readonly" \
  --mount "type=bind,src=$PWD/examples/demo-workspace/brains/research,dst=/workspace/brains/research,readonly" \
  --mount "type=bind,src=$PWD/examples/demo-workspace/brains/research-archive-and-synthesis-source-trails,dst=/workspace/brains/research-archive-and-synthesis-source-trails,readonly" \
  --mount "type=bind,src=$PWD/.generated/docker-output,dst=/output" \
  --mount "type=bind,src=$PWD/.generated/docker-work,dst=/work" \
  --tmpfs /tmp:rw,mode=1777 \
  brain:source build \
  --workspace /workspace/workspace.json \
  --output /output/site
```

Preview uses the same read-only fixture mount:

```sh
docker run --rm \
  --read-only \
  --user "$(id -u):$(id -g)" \
  --publish 127.0.0.1:4322:4322 \
  --mount "type=bind,src=$PWD/examples/demo-workspace/workspace.json,dst=/workspace/workspace.json,readonly" \
  --mount "type=bind,src=$PWD/examples/demo-workspace/brains/engineering,dst=/workspace/brains/engineering,readonly" \
  --mount "type=bind,src=$PWD/examples/demo-workspace/brains/design,dst=/workspace/brains/design,readonly" \
  --mount "type=bind,src=$PWD/examples/demo-workspace/brains/research,dst=/workspace/brains/research,readonly" \
  --mount "type=bind,src=$PWD/examples/demo-workspace/brains/research-archive-and-synthesis-source-trails,dst=/workspace/brains/research-archive-and-synthesis-source-trails,readonly" \
  --mount "type=bind,src=$PWD/.generated/docker-output,dst=/output" \
  --mount "type=bind,src=$PWD/.generated/docker-work,dst=/work" \
  --tmpfs /tmp:rw,mode=1777 \
  brain:source preview \
  --workspace /workspace/workspace.json \
  --output /output/preview \
  --host 0.0.0.0 \
  --port 4322
```

For sources from separate directories or repositories, mount the manifest and each brain independently at the exact destinations implied by the manifest's relative `path` values. A missing mount fails with the affected brain ID and path. Brain never rewrites host paths into the manifest.

## GitHub Action checkouts

The build Action does not check out source repositories. The caller prepares every repository beneath `${{ github.workspace }}` and passes the manifest through the `workspace` input. For example, a caller-owned `workspace.json` can reference `./brains/engineering` and `./brains/design`:

```yaml
steps:
  - name: Check out publication configuration
    uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1

  - name: Check out Engineering brain
    uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
    with:
      repository: example/engineering-brain
      path: brains/engineering

  - name: Check out Design brain
    uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
    with:
      repository: example/design-brain
      path: brains/design

  - id: site
    uses: tjakobsson/brain@v1
    with:
      workspace: workspace.json
      output: dist
      strict-links: true
```

Supply exactly one of `vault` or `workspace`. If both are empty, the Action retains its single-brain `vault` directory default. Workspace paths may point only to repositories and directories prepared in the caller's job workspace. The complete caller-owned example is [`build-action-workspace-major.yml`](examples/build-action-workspace-major.yml).

## GitHub Pages limitation

The reusable Pages workflow runs its own job and checks out only the caller repository. It can publish a workspace when the manifest and every referenced brain directory are inside that checkout:

```yaml
jobs:
  pages:
    uses: tjakobsson/brain/.github/workflows/publish-pages.yml@v1
    with:
      workspace: examples/demo-workspace/workspace.json
```

It rejects lexical paths and symlinks that resolve outside the caller checkout. It cannot use source directories from separate repository checkouts because callers cannot add checkout steps to a reusable workflow job. For a multi-repository workspace, write a normal caller job, perform each checkout explicitly, run the build Action, then upload and deploy the returned output with the official Pages actions. See [`pages-reusable-major.yml`](examples/pages-reusable-major.yml) for one Brain and [`pages-workspace-major.yml`](examples/pages-workspace-major.yml) for an in-repository workspace.

## Migrate from one Brain directory

No migration is required to keep a current single-brain site. Continue using `--vault <path>`. That mode preserves `/`, `/notes/<slug>`, and the existing unnamespaced report routes.

Move to workspace mode deliberately:

1. Create a v1 manifest that registers the existing Brain directory.
2. Choose a brain ID that can remain stable for the lifetime of published links.
3. Build with `--workspace` and update external links for `/brains/<brain-id>/...` routes.
4. Add more brains and explicit `[[@brain-id/Note Title]]` links when needed.

The `--vault` and `--workspace` options cannot be combined. To roll back a workspace deployment, build the original source with `--vault` or select the previous generator release.
