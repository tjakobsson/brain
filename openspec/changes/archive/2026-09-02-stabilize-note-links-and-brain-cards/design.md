## Context

See `proposal.md` for motivation and the delta specs for required behavior. `NotePage.astro` currently renders the conditional local graph before the independently conditional `NoteMentions` component. The component labels deterministic plain-text title matches as Unlinked mentions, but matching phrases in source prose have no visual signal that explains why the source note appears there. Wiki-links are parsed by `src/lib/wiki-links.ts` for both the build-time index and the remark renderer; its regular expression explicitly excludes newlines from targets and aliases, even though a soft Markdown line break remains inside a paragraph text node. Brain chooser cards are equal-height grid items with a flex-column interior, but the identity row has no reserved wrapped height, so an `@brain` identifier wrapping beside the mark shifts subsequent content relative to neighboring cards.

The implementation must preserve plain Markdown input, scanner and renderer agreement, raw source offsets used for backlink context, semantic link resolution, visible Brain identity, and responsive mobile behavior. No new dependency is warranted.

## Goals / Non-Goals

**Goals:**

- Keep mention and graph omission rules unchanged while making their rendered order explicit.
- Rename Unlinked mentions to Potential links and distinguish each qualifying plain-text title match from both ordinary prose and authored links.
- Parse source-wrapped wiki-links once through the shared syntax model so indexing, resolution, rendering, and mention suppression agree.
- Normalize soft wrapping inside link fields without leaking source formatting into routes, anchors, aliases, or accessible names.
- Align chooser-card identity, content, and action landmarks for the reported desktop wrapping case while retaining complete identifiers.
- Put representative screenshots in the change catalog immediately after the first visual pass.

**Non-Goals:**

- Support wiki-links across blank lines, Markdown block boundaries, hard breaks, structural delimiters, code, or embedded attachments.
- Change wiki-link target rules, case matching, routes, backlink semantics, or foreign-link styling.
- Redesign Brain cards, chooser hierarchy, mobile card stacking, or selection behavior.
- Turn Potential links into navigation or automatically modify authored Markdown.
- Use screenshots as the sole regression test.

## Decisions

### 1. Reorder existing conditional page regions without coupling them

`NoteMentions` will move ahead of the local graph section in the note-page composition. The component continues to decide independently whether linked and unlinked sections exist, and the graph keeps its existing `nearbyNotes` condition. This makes source order, visual order, and assistive-technology reading order agree without introducing a wrapper or shared visibility state.

CSS reordering was rejected because it would leave document and keyboard order inconsistent with the presentation. Combining mentions and graph rendering into one component was rejected because the sections have separate data and behavior.

### 2. Extend the shared wiki-link parser with explicit soft-break normalization

The shared parser will accept candidate link fields containing Markdown soft source breaks but reject candidates that cross a block boundary. Accepted line breaks and adjacent horizontal whitespace will normalize to one ordinary space in `target`, `anchor`, and `alias`; `raw`, `index`, and `length` continue to describe the original source. Structural syntax such as `[[`, `]]`, `#`, `|`, the `@brain/` namespace marker, and attachment exclusion remains unchanged.

The remark transform already operates within Markdown text nodes, which naturally scopes rendered candidates to inline paragraph content. The build-time scanner must apply the same soft-break boundary rules before recording a link so the index cannot create a backlink that the renderer leaves as text. Focused parser tests will cover wrapped local, foreign, heading, alias, and unwritten targets plus blank-line and block-boundary rejection. Remark and workspace-index tests will prove rendering and indexing stay in sync.

Replacing every newline before parsing was rejected because it could create links across blocks and invalidate source offsets. Maintaining separate scanner and renderer regexes was rejected because it would reintroduce syntax drift. Adding a Markdown parsing dependency was rejected because the existing pipeline and focused candidate validation are sufficient.

### 3. Reserve a stable desktop identity region and retain natural card stretching

Chooser markup will continue to expose the full stable ID as text next to the Brain mark. The card interior will reserve a consistent desktop identity region that accommodates the representative wrapped identifier, allow safe wrapping for long unbroken IDs, and keep the title/body/action layout stable. Grid items continue to stretch to the row height, and the Enter action remains pinned to the card end. Narrow layouts may use their existing natural flow where cards are vertically independent.

Truncation, ellipsis, reduced font size, and hiding the stable ID were rejected because they weaken visible identity. Assigning fixed card heights was rejected because descriptions and localized text must remain able to grow.

### 4. Make screenshots an early review checkpoint

The public workspace fixture will include a valid long Brain ID that reproduces the desktop wrap, and demo note content will exercise wrapped wiki-links and a page containing both mentions and a Connection map. Before further visual refinement, implementation will run the background Astro server, capture a desktop chooser and note page at a fixed review viewport, visually inspect them, and add both images to the change catalog with viewport and state labels. Final verification will recapture only if later edits alter these surfaces.

The screenshot checkpoint complements DOM, geometry, parser, and browser assertions. Baseline and corrected captures are stored with the change so they remain available during pull-request review. Screenshot-only acceptance was rejected because image comparison cannot reliably prove link destinations, source order, or responsive geometry.

### 5. Render Potential links from indexed source-target pairs

`NoteMentions` will label existing unlinked-title results as Potential links. The remark rendering path will use the index's `unlinkedMentions` map as the source of truth for which source-target pairs qualify, then mark matching whole-title occurrences only in transformable text nodes. This keeps the established case-insensitive, same-Brain, minimum-title, and already-linked suppression rules in the scanner while Markdown structure keeps code and authored links out of the inline transform.

Each occurrence will remain plain, non-clickable text inside a semantic-neutral span. It will retain the surrounding prose color, use a subtle dotted underline and help cursor, and reveal a neutral explanatory badge on hover or keyboard focus. The badge and accessible label will name the potential target and state that the author did not create a link. The renderer will prefer the longest title when eligible titles overlap so output remains deterministic.

Re-running an independent mention detector in the browser was rejected because it could drift from the build index and would hide the meaning when JavaScript is unavailable. Turning matches into anchors was rejected because the author did not deliberately create a link.

## Risks / Trade-offs

- [Permissive multiline matching creates links across Markdown blocks] -> Validate every candidate's intervening breaks as soft paragraph breaks and include rejected blank-line and block-start fixtures.
- [Whitespace normalization changes a legitimate title] -> Normalize only whitespace introduced around accepted soft breaks; retain existing trimming and ordinary same-line characters.
- [Scanner and remark output diverge] -> Keep one parser and exercise the same wrapped fixture through parser, index, and rendering tests.
- [Reserved identity space looks excessive for short IDs] -> Limit the reservation to the desktop card layout and inspect mixed short and wrapped IDs in the early catalog screenshot.
- [A fixed fixture accidentally tests one font or viewport only] -> Pair screenshots with geometry assertions at desktop and narrow widths, including aligned card landmarks and no horizontal page overflow.
- [Potential-link styling implies author intent or clickability] -> Keep the text non-interactive and prose-colored, use a subdued dotted underline and help cursor rather than wiki-link styling, and expose an explanatory badge and accessible label.
- [Overlapping note titles produce unstable nested matches] -> Sort eligible titles longest-first and consume each source range once.

## Migration Plan

No content, route, configuration, or data migration is required. Add failing fixtures and focused assertions, extend parsing and page/card presentation, capture and publish the early review screenshots, then complete unit, browser, build, and OpenSpec verification. Rollback restores the parser rule, component order, and chooser styles; Markdown and workspace configuration remain compatible.
