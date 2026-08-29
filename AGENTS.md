## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

Run the required test suites after all final edits, including OpenSpec sync or archive operations. `npm test` validates active main specs as part of the product documentation contract.

## Demo Brain contract

`examples/demo-vault/` is a public Brain Markdown Zettelkasten fixture. Personal Brain directories live in external consumer repositories and must not be copied into this generator checkout. Changes to fixture notes are made directly as files. The fixture must remain readable as plain Markdown and follow the Brain Markdown contract below. `.obsidian` is excluded by default as migration metadata; it does not define compatibility.

### Filenames = titles

- A note's title is its filename without `.md` (e.g. `Graphs of thought.md`).
- Titles must be unique across the whole fixture, regardless of subfolder; the build fails on duplicates.
- Folders are free-form organization only; they never affect URLs or link resolution.
- Don't repeat the title as an `# H1` in the body — the site renders the title itself.

### Frontmatter

All fields optional; the schema applies defaults. Invalid values fail the build.

```yaml
---
title: Optional override        # default: filename
type: permanent                 # fleeting | literature | permanent (default: permanent)
status: draft                   # draft | developing | established (default: draft)
tags: [pkm, web]                # default: []
created: 2026-08-26T09:15:00Z   # optional date or ISO timestamp
updated: 2026-08-27T16:40:00Z   # optional date or ISO timestamp
---
```

Status describes maturity, not the note's role:

- `draft`: incomplete thought
- `developing`: useful but still changing
- `established`: clear, self-contained, and well-linked

### Linking

Use Brain wiki-links by note **title**, never file paths:

- `[[Note Title]]` - plain link
- `[[Note Title|display text]]` - alias
- `[[Note Title#Heading]]` - heading anchor

Links to notes that don't exist yet are allowed: they render with "unwritten" styling and log a build warning, but don't fail the build. When renaming a fixture note, update every `[[wiki-link]]` in `examples/demo-vault/` that targets it.

### Verification

After editing demo content, run `npx astro build`. It validates frontmatter, rejects duplicate titles, and warns on unresolved links.

## Dependency policy

- Always look up and pin the latest stable release (including security patches) at install time; never rely on remembered versions.
- Permissive licenses only (MIT, ISC, BSD-2/3-Clause, Apache-2.0, CC0-1.0, 0BSD, Python-2.0, BlueOak-1.0.0). Copyleft (GPL/AGPL/LGPL/MPL/SSPL family) requires explicit user agreement, recorded as an ADR in `docs/adr/` before the dependency is added. Accepted exceptions: ADR 0001 (libvips via sharp, lightningcss, build-time tooling).

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
