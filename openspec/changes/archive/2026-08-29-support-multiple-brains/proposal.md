## Why

Brain can currently publish only one Markdown vault, so independently owned or domain-specific knowledge bases cannot be browsed together or link to one another. Supporting a configured workspace of brains allows readers to enter one domain at a time or explore their combined knowledge graph without merging the source directories.

## What Changes

- Add a workspace input that registers multiple brains with stable IDs, display metadata, optional hierarchy, and independent Markdown directories.
- Add a root brain chooser, namespaced brain routes, per-brain navigation, and a combined "big brain" view over reader-selected brains.
- Add Brain-native cross-brain links using `[[@brain-id/Note Title]]`, including aliases and heading anchors, with explicit brain badges and accessible visual distinction.
- Compute cross-brain links, backlinks, search entries, graph edges, attachment output, and validation from a workspace-wide index while retaining each brain as an ownership and title-uniqueness boundary.
- Extend build, preview, serve, container, Action, and Pages inputs to accept a workspace while retaining the existing single-vault input as shorthand for one brain.
- **BREAKING**: Remove native Obsidian compatibility from the authoring contract. Brain continues to use plain Markdown and wiki-style links, but its link grammar and workspace behavior are defined by Brain rather than Obsidian.
- **BREAKING**: Multi-brain note URLs include a stable brain ID, and the multi-brain root route becomes a brain chooser rather than a graph.

## Capabilities

### New Capabilities
- `brain-workspaces`: Defines configured brains, stable identities, optional hierarchy, reader selection, and the combined workspace view.

### Modified Capabilities
- `vault-conventions`: Replaces the Obsidian-compatible vault contract with Brain Markdown, per-brain title identity, and namespaced cross-brain link syntax.
- `portable-site-generation`: Adds workspace input, multi-root safety and discovery, namespaced assets, and deterministic multi-brain output.
- `note-publishing`: Publishes namespaced note pages and visibly identifies cross-brain links.
- `link-intelligence`: Resolves and reports local and cross-brain connections in one workspace index.
- `graph-explorer`: Adds per-brain and combined graphs with brain-aware filtering and visual encoding.
- `site-search`: Scopes search to the active brain by default and supports explicit workspace-wide discovery.
- `generator-distribution`: Exposes workspace generation through the container and GitHub Action interfaces.
- `github-pages-publication`: Allows the reusable workflow to publish a configured multi-brain workspace.
- `local-live-serving`: Watches every configured brain and rebuilds the workspace atomically.

## Impact

The change affects generator arguments and validation, internal settings, content loading, note identity and routes, Markdown link parsing and rendering, attachments, graph and search datasets, backlinks and reports, navigation, live file watching, container mounts, GitHub automation, documentation, fixtures, and tests. It introduces a public workspace configuration format but does not require a server, browser editing, runtime federation, authentication, or source-directory merging. No new runtime dependency is expected.
