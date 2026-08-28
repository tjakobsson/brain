# Contributing

Brain requires Node.js 22.12 or newer and npm.

1. Run `npm ci`.
2. Make the smallest focused change.
3. Run `npm test`, `npm run test:browser`, and `npx astro build` serially.
4. Run `actionlint .github/workflows/*.yml` when changing workflows.

Use `astro dev --background` for local Astro development. Stop it with `astro dev stop`.

Changes to `action.yml`, `.github/workflows/publish-pages.yml`, generator inputs, defaults, or outputs can affect the public release contract. Explain those changes clearly in the pull request.

See [`RELEASING.md`](RELEASING.md) for candidate and stable-release procedures.

The fixture under `examples/demo-vault/` must remain a plain Markdown vault that opens in Obsidian. Do not add personal vault content.
