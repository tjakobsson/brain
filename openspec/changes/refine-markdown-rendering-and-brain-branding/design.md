## Context

See `proposal.md` for motivation. Prose, workspace cards, and navigation share `src/styles/global.css`. Markdown tables currently receive no project styling. Fenced code already uses Shiki's `github-light` and `github-dark` themes, but project CSS wraps it in a bordered elevated panel and gives inline code a border. Callouts render data-attribute markup from `@r4ai/remark-callout`; the current title selector targets a class the plugin does not emit, and the container uses an accent-side border. Workspace cards use a colored top border, compact Brain identity uses a rotated square, and `public/favicon.svg` still contains Astro's mark.

The site is static and follows the operating system color preference. All revised content and code line numbers must remain readable without client-side JavaScript, at narrow viewport widths, and when color is not available as an identity cue. Copying is a progressive enhancement and requires browser scripting.

## Goals / Non-Goals

**Goals:**

- Establish one restrained document style for tables, inline code, fenced code, and callouts in light and dark modes.
- Let readers copy every fenced block and scan recognized code by line number without adding a general-purpose toolbar.
- Use one recognizable, owned Brain mark at favicon, card, and navigation sizes.
- Keep Brain accents useful for identity and selection without using asymmetric accent rules as decoration.
- Make the visual result easy to inspect in the public fixtures and protect its functional properties with browser tests.

**Non-Goals:**

- Change Markdown syntax, callout parsing, syntax-highlighting languages, or workspace configuration.
- Add language labels, multi-action code toolbars, custom theme controls, or client-side generation of code content.
- Redesign graph node shapes, note metadata, general navigation icons, or the overall site typography.
- Add an icon library or other runtime dependency.

## Decisions

### 1. Treat GitHub as the document reference, not a stylesheet dependency

Tables and code will follow the useful parts of GitHub's Markdown presentation: compact spacing, neutral colors, a complete table grid, zebra rows, borderless code fields, and restrained corner radii. Values will map onto existing site color variables plus a small number of prose-specific tokens for table stripes, code backgrounds, and semantic callout backgrounds.

Copying GitHub's full Markdown stylesheet was rejected because it would override unrelated Brain typography and introduce a large external CSS contract. Adding a package was rejected for the same reason. Focused project CSS is smaller and keeps dark-mode colors aligned with the rest of Brain.

Markdown tables will remain semantic `<table>` elements. The table itself will establish contained horizontal overflow at narrow widths, following the existing code-block overflow pattern, so no Markdown transformer or wrapper plugin is needed.

### 2. Keep Shiki token colors and add minimal code utilities

The current `github-light` and `github-dark` Shiki themes remain the source of syntax token colors. Shared CSS will own the block background, padding, radius, and overflow. Shiki-generated span backgrounds will be made transparent so the block has one consistent muted field in either color scheme.

Recognized Shiki output already emits a span for each source line. CSS counters on those static line spans will provide one-based numbers without inserting number text into the code. The numbering selector will exclude `data-language="plaintext"`, which covers both unlabelled and unsupported-language fallbacks. Counter pseudo-elements will not enter text selection or clipboard content. Code and numbers stay inside the same horizontal scrolling field so they cannot widen the page.

A small page script will progressively wrap each fenced block, add one top-right icon button, and copy the nested code element's `textContent` through the Clipboard API. The button will have an accessible name, keyboard behavior from its native element, and a temporary copied or failed state announced without moving focus. Because line numbers are CSS-generated, copied text contains code only. The code remains fully rendered when JavaScript is disabled; only the copy control is absent.

Fenced blocks will have no outline, multi-action toolbar, or shadow. The wrapper will reserve enough top-right space that the copy button never covers code. Inline code will use the same visual family at a smaller scale with a muted background, compact padding, and no border. This preserves static highlighting and fallback behavior while removing the current elevated-card treatment.

Changing highlighters or generating a custom Shiki theme was rejected because the requested token palette already exists. Injecting line-number text into each code line was rejected because selection and copying would then need to strip it. A dependency-backed clipboard component was rejected because one native browser action does not justify another package.

### 3. Use tonal callouts with semantic titles and no accent edge

Callout styles will target the plugin's emitted attributes, including `[data-callout]`, `[data-callout-title]`, and `[data-callout-body]`. The default note treatment will use a neutral tonal background. Warning and error families will use low-contrast amber and red backgrounds with matching title colors. Body text will retain normal prose color and style. Paragraph margins inside the body will be normalized to keep the block compact.

Callouts will have no asymmetric border, outer outline, or shadow. Semantic color is supplementary because the title remains visible text. Decorative icons are excluded from this pass; they add another icon system without improving the requested treatment.

A GitHub alert-style colored left rule was rejected because it reproduces the exact motif this change removes. A conventional bordered card was also rejected because it keeps callouts visually heavier than the prose they support.

### 4. Own one simple Brain SVG mark and reuse its geometry

Create a small inline Astro component for a brain-shaped outline drawn on a square `viewBox`. The path will use `currentColor`, rounded line joins, and enough interior spacing to remain recognizable around 16 to 20 CSS pixels. Instances used beside visible Brain text will be hidden from assistive technology to avoid repeating the label.

The chooser will replace the diamond with a larger instance of this mark. The context switcher and its entries will use the compact instance. Each instance inherits `--brain-accent` where a configured Brain is present. Brain titles or stable IDs remain adjacent in every identity context.

The favicon will reuse the same path geometry in a standalone static SVG with light and dark foreground rules. Sharing geometry rather than importing an Astro component into `public/` keeps favicon delivery static and preserves the existing base-path route contract.

Using an emoji was rejected because its shape and color vary by platform. Adding an icon package was rejected because one owned mark does not justify a dependency. Keeping the rotated square was rejected because it does not communicate Brain product identity.

### 5. Reserve full accent boundaries for selection state

Unselected Brain cards will use the same neutral one-pixel boundary on every side. Their mark carries the configured accent. Checked cards may use a full accent boundary and restrained accent-tinted background so color communicates the active selection rather than acting as a decorative top rule. The native checkbox and visible text continue to expose selection without color.

The existing group hierarchy rail can remain because its neutral line communicates nesting rather than Brain identity. This change removes asymmetric accent edges, not every structural divider.

### 6. Put representative rendering in the public fixtures and test behavior

The demo Brain will contain a linked note or section with a multi-row table and neutral and warning callouts. Existing recognized, unlabelled, and unsupported code examples remain the code fixture. Browser coverage will assert cell boundaries, alternating row backgrounds, contained mobile overflow, callout title/body treatment, absence of accent-edge borders, code backgrounds and borders in both schemes, sequential line numbers only on recognized code, exact clipboard text, keyboard operation, copied feedback, JavaScript-disabled code readability, Brain mark reuse, visible adjacent identity text, and the Brain favicon.

Computed-style and DOM assertions will protect the contract without binding tests to screenshots. During implementation review, desktop and phone screenshots in light and dark modes will provide the visual confirmation that automated checks cannot.

## Risks / Trade-offs

- [CSS-only table overflow can expose browser differences in table layout] -> Test a wide fixture in the supported browser suite and keep the page-width assertion used by code blocks.
- [Overriding Shiki backgrounds can reduce token contrast] -> Check representative syntax tokens against both chosen code backgrounds and retain the existing light and dark browser assertions.
- [Line-number counters can drift from blank or unusually styled source lines] -> Test recognized code containing blank lines and long lines against the emitted Shiki line spans.
- [Clipboard access can fail outside a secure context or after permission denial] -> Keep code readable, report failure on the focused button, and test success through the secure browser-test context.
- [Low-contrast callout backgrounds can become too subtle] -> Test title and body contrast in both color schemes and keep warning text explicit rather than relying on color.
- [A detailed Brain path can blur at favicon size] -> Design the mark from the 16-pixel use case outward, use a simple outline, and inspect browser rasterization at favicon and navigation sizes.
- [Accent-colored marks can be confused with status] -> Keep Brain title or stable ID beside every interface mark and reserve full accent boundaries for checked cards only.

## Migration Plan

No content or configuration migration is required. Add code-block numbering and copy enhancement, add the shared mark and favicon, update component usage and shared styles, add representative fixture content and tests, then verify the static build and browser suite. The change can be rolled back by restoring the prior CSS, page script, marker markup, and favicon without changing generated URLs or source Markdown.
