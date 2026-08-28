## 1. Demo coverage

- [x] 1.1 Add supported-language, unlabelled, unsupported-language, inline-code, and long-line examples to an existing `examples/demo-vault/` note; verify the filename remains the unique note title and the content is valid plain Markdown that opens natively in Obsidian.

## 2. Build-time rendering

- [x] 2.1 Configure paired built-in Shiki light and dark themes on the existing Unified Markdown pipeline; verify `npx astro build` emits static `.astro-code` token markup for the supported demo fence without adding a client-side highlighter.
- [x] 2.2 Confirm Astro's unsupported-language behavior and, only if needed, add a focused plaintext fallback before highlighting; verify `npx astro build` succeeds and preserves the unlabelled and unsupported demo blocks as readable code.

## 3. Code presentation

- [x] 3.1 Separate compact inline-code selectors from fenced-block selectors and add block spacing, monospace typography, border, padding, and nested-code resets; verify inline and fenced code no longer share box decoration in the rendered demo note.
- [x] 3.2 Add dual-theme `.astro-code` rules that select all emitted dark token properties under `prefers-color-scheme: dark`; verify token foreground and background computed styles switch between legible light and dark values when the browser preference changes.
- [x] 3.3 Constrain fenced blocks to the note column and add internal horizontal overflow for preserved long lines; verify a phone-sized viewport can scroll the long demo line without increasing the document width or clipping content.

## 4. Automated acceptance

- [x] 4.1 Extend Playwright coverage for supported token markup, plain-code fallbacks, inline/block separation, runtime color-scheme changes, and JavaScript-disabled static highlighting; verify the focused browser tests pass for root, subpath, and custom-domain builds.
- [x] 4.2 Run `npm test`, `npx astro build`, and `npm run test:browser`; verify the full unit suite, demo-vault production build, and browser suite pass without unresolved-link or code-language build failures.
