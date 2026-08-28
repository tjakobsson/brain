## Context

See `proposal.md` for motivation and `specs/code-block-rendering/spec.md` for behavior. Notes are rendered from an external or demo Markdown vault through Astro content collections and a configured Unified processor. The current global stylesheet follows `prefers-color-scheme`, defaults to dark colors, and applies one generic `article code` rule to both inline and fenced code.

Astro 7 already provides build-time Shiki highlighting and can emit one default theme plus CSS custom properties for a second theme. The existing Markdown processor and remark plugins must remain in place because they implement attachments, wiki-links, highlights, and callouts.

## Goals / Non-Goals

**Goals:**

- Add highlighting without changing the Markdown authoring contract beyond standard fenced-language identifiers.
- Keep all highlighting work at build time and preserve static output.
- Align code themes with the site's existing operating-system color preference.
- Separate inline-code styling from fenced-block layout and make long lines usable on narrow screens.
- Exercise the behavior through the public demo vault and production rendering path.

**Non-Goals:**

- Add a manual light/dark theme switcher or persisted theme preference.
- Add copy buttons, filenames, line numbers, line highlighting, or interactive code playgrounds.
- Guarantee highlighting for every arbitrary language identifier.
- Replace Unified or migrate the existing remark plugins.
- Add syntax highlighting to code constructed directly in Astro components.

## Decisions

### Use Astro's Shiki configuration with paired built-in themes

Configure the existing Markdown pipeline with paired light and dark built-in Shiki themes, using a restrained pair such as `github-light` and `github-dark`. Astro will transform supported language fences during the build and emit `.astro-code` markup with theme values; no browser highlighter or runtime dependency is needed.

The stylesheet will treat the light values as the default Shiki output and select the emitted dark custom properties inside the same `prefers-color-scheme: dark` query used by the site. Token foreground, background, and any emitted font treatment will switch together. This is preferred over hand-maintained token classes because Shiki owns language grammar and theme completeness, and over Prism because Prism would require another package and stylesheet.

### Preserve the configured Unified processor

Add syntax configuration at Astro's Markdown configuration level rather than replacing `unified(...)`. Astro's processor-independent highlighting stage is the smallest change and keeps the current remark plugin ordering and behavior intact. Migrating to the default Satteri processor is out of scope because the custom plugins are Unified plugins and the migration would introduce unrelated compatibility work.

### Let unknown languages degrade to plain code before highlighting

The rendering path will normalize fences that Shiki cannot load to plaintext while leaving supported language identifiers available to Shiki. Unlabelled fences already have plaintext semantics and follow the same presentation. This preserves author content and build reliability rather than maintaining an application-specific allowlist that would drift from Shiki's supported grammars.

If Astro 7's configured processor already performs the nonfatal fallback, verification will lock in that behavior without adding a plugin. If it reports unsupported languages as fatal, a focused processor-stage fallback will handle only missing grammars; it will not suppress malformed Markdown or unrelated build errors.

### Scope inline and block styles separately

Restrict compact border, background, radius, and padding rules to inline code that is not inside `pre`. Style `.astro-code` and plain fenced `pre` elements as blocks with a consistent monospace stack, readable line height, border, radius, padding, and `overflow-x: auto`. Reset nested `code` decoration inside `pre` so the existing inline rule cannot create a second border or background.

Blocks remain within the article width and scroll their own long lines instead of wrapping source or widening the document. This retains source formatting while making the block usable on mobile.

### Verify through the native demo vault

Add supported, unlabelled, unsupported-language, inline, and long-line examples to an existing demo note so the public fixture stays a valid plain-Markdown Obsidian vault without adding a documentation-only route. Extend browser coverage to inspect generated token markup, computed light/dark colors, inline/block separation, and narrow-viewport overflow. The normal Astro build verifies that all fallback examples compile through the production content loader.

## Risks / Trade-offs

- [A Shiki theme background can conflict with the site's surrounding palette] -> Choose a conservative built-in light/dark pair and retain the site's border and radius around the generated block.
- [Generic `article code` rules can override generated token styles] -> Narrow inline selectors and explicitly reset only nested block-code box decoration.
- [Unknown-language handling can vary across Astro or Shiki releases] -> Include an unsupported identifier in the demo fixture and production build acceptance test.
- [Using `!important` for generated dark token values increases CSS specificity] -> Limit it to `.astro-code` and descendants in the dark media query, matching Astro and Shiki's documented dual-theme integration.
- [Large language grammars can increase build work] -> Rely on Shiki's on-demand language loading and avoid preloading a custom all-language bundle.

## Migration Plan

No vault-content or persisted-data migration is required. Existing language-labelled fences gain highlighting, while plain fences retain their content with improved block styling. Deploy the Astro configuration, CSS, fixture, and tests together; rollback restores the previous Markdown configuration and code selectors without changing authored notes.
