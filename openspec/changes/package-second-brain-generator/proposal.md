## Why

The application and the author's private vault currently live in one repository, which couples content ownership to the site's implementation and makes the generator difficult to reuse. Packaging the renderer as a stable build tool will let any compatible Obsidian vault produce the same static second-brain site locally or through GitHub Pages without copying the Astro project into the vault repository.

## What Changes

- **BREAKING** Replace repository-relative vault and output assumptions with a public build interface that accepts vault, output, site URL, and base path inputs.
- Make generated routes, assets, wiki-links, graph data, search, and navigation work at both domain roots and subpaths such as GitHub project Pages.
- Publish referenced Markdown and Obsidian-style attachments while excluding hidden metadata, workflow files, templates, and unreferenced files by default.
- Package the generator as a versioned, non-root, multi-architecture OCI image built on Wolfi and published to GHCR.
- Record the user-approved build-tool exception for copyleft packages present in the Wolfi Node image before adding that image.
- Expose the released image through a versioned GitHub build Action with the same inputs and output contract as local container use.
- Provide a reusable GitHub Pages workflow that builds a caller repository's vault, uploads the static artifact, and deploys it with GitHub's official Pages actions.
- Replace the personal vault in the generator repository with a small public demo fixture after its content has been copied to and verified in a separate consumer repository.
- Document local generation, local preview, consumer-repository setup, custom domains, version pinning, attachment behavior, and migration.

## Capabilities

### New Capabilities

- `portable-site-generation`: Build a complete static second-brain site from an external vault with explicit output, URL, base-path, exclusion, validation, and attachment behavior.
- `generator-distribution`: Run the same versioned generator contract through a published Wolfi OCI image or GitHub build Action.
- `github-pages-publication`: Deploy a vault-only consumer repository through a reusable, base-path-aware GitHub Pages workflow.

### Modified Capabilities

None.

## Impact

- Build configuration, route construction, client-side fetches, search indexing, vault scanning, attachment resolution, and preview commands.
- Repository layout, documentation, demo and stress fixtures, release automation, and compatibility tests.
- New public contracts: generator command inputs, container mounts and exit behavior, Action inputs/outputs, and reusable workflow inputs.
- GHCR and GitHub Pages become supported distribution and deployment systems.
- The Wolfi Node base introduces user-approved copyleft build-tool packages and therefore requires a new ADR before container implementation.
