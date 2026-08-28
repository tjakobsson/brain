## Why

Fenced code blocks in published notes currently render as largely unstyled code, making source examples harder to scan and allowing block layout to inherit inline-code treatment. Code examples should be syntax-highlighted and remain legible in both of the site's system-selected color modes.

## What Changes

- Syntax-highlight fenced Markdown code blocks when the fence declares a supported language.
- Provide coordinated light and dark highlighting themes that follow the site's existing `prefers-color-scheme` behavior without client-side JavaScript.
- Give fenced blocks distinct, responsive presentation with readable spacing and horizontal overflow for long lines.
- Keep unlabelled and unsupported-language blocks readable as plain code instead of failing the build.
- Add representative demo-vault content and verification for highlighted and plain fenced blocks.

## Capabilities

### New Capabilities

- `code-block-rendering`: Rendering and color-mode behavior for fenced code blocks in published Markdown notes.

### Modified Capabilities

None.

## Impact

- Astro Markdown/Shiki configuration in `astro.config.ts`.
- Prose and code-block theme rules in `src/styles/global.css`.
- Public fixture coverage in `examples/demo-vault/` and build/browser verification.
- No new runtime dependency or client-side highlighting script is expected; the implementation uses Astro's build-time Shiki support.
