## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Vault authoring contract

`vault/` is a plain-markdown Zettelkasten vault. AI authors write notes directly as files; the Astro build renders and validates them. There is no in-browser editing — the file system is the editor. The vault must always remain openable as a native Obsidian vault.

### Filenames = titles

- A note's title is its filename without `.md` (e.g. `Graphs of thought.md`).
- Titles must be unique across the whole vault, regardless of subfolder — the build fails on duplicates.
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
created: 2026-08-26             # optional date
updated: 2026-08-27             # optional date
---
```

Status describes maturity, not the note's role:

- `draft`: incomplete thought
- `developing`: useful but still changing
- `established`: clear, self-contained, and well-linked

### Linking

Use Obsidian wiki-links by note **title**, never file paths:

- `[[Note Title]]` — plain link
- `[[Note Title|display text]]` — alias
- `[[Note Title#Heading]]` — heading anchor

Links to notes that don't exist yet are allowed: they render with "unwritten" styling and log a build warning, but don't fail the build. When renaming a note, update every `[[wiki-link]]` that targets it (grep the vault for the old title).

### Verification

After editing vault content, run `npx astro build` — it validates frontmatter, rejects duplicate titles, and warns on unresolved links.

## Dependency policy

- Always look up and pin the latest stable release (including security patches) at install time; never rely on remembered versions.
- Permissive licenses only (MIT, ISC, BSD-2/3-Clause, Apache-2.0, CC0-1.0, 0BSD, Python-2.0, BlueOak-1.0.0). Copyleft (GPL/AGPL/LGPL/MPL/SSPL family) requires explicit user agreement, recorded as an ADR in `docs/adr/` before the dependency is added. Accepted exceptions: ADR 0001 (libvips via sharp, lightningcss — build-time tooling).

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
