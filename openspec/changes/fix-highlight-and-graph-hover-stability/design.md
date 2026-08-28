## Context

The highlight remark plugin transforms each Markdown text node with a delimiter regex. Its match body excludes newline characters, even though Markdown keeps a soft line break inside the paragraph's text content. The other custom inline paths use separate parsers and need a focused audit so their line-break rules are intentional rather than incidental.

The graph uses Sigma reducers for hover emphasis and a separate motion controller for initial, resize, filter, and drag settling. Dense graphs spend more time in the initial settle and have tighter pointer targets. Hover handling must therefore avoid geometry-changing reducer output and establish pointer interaction as a reason to stop any in-flight automatic movement before refreshing emphasis.

## Goals / Non-Goals

**Goals:**

- Parse highlight spans across soft line breaks without allowing a match to escape its Markdown text container.
- Keep escaping and delimiter boundaries at least as strict as the current highlight parser.
- Make hover reducers visual-only and freeze automatic graph motion when the reader targets a node.
- Cover the reported source shape and graph interaction with tests that would fail on the regressions.

**Non-Goals:**

- Supporting highlight delimiters across separate Markdown blocks, code, links, images, or other AST containers.
- Redefining wiki-link, attachment, callout, or standard Markdown syntax.
- Removing controlled graph settling, hover neighborhood emphasis, node dragging, or click navigation.
- Changing graph cache keys, persisted layouts, or the generated graph-data format.

## Decisions

### Match multiline highlights within one text node

Allow the highlight body matcher to include newline characters while retaining its existing delimiter restrictions and HTML escaping. The AST text-node boundary already prevents a match from crossing paragraphs, block elements, links, images, or code nodes, so this is narrower and safer than scanning raw Markdown across the whole document.

The tests will include a real multiline text value with surrounding prose, multiple soft line breaks, delimiter edge cases, and HTML-sensitive characters. The inline-transform audit will classify each custom syntax by whether Obsidian permits line breaks inside its delimiters, then add missing tests without broadening unrelated syntax.

Alternative considered: normalize or split text on newlines before applying the existing regex. That cannot produce one continuous highlight when the delimiters enclose more than one source line and risks losing the break at split boundaries.

### Treat node targeting as an interruption of automatic motion

When a pointer enters a global-graph node, cancel active layout and camera animation before applying hover state. Keep the current node coordinates and camera state as the new stable frame. Do not restart canceled motion on pointer leave. Later explicit triggers such as filter, resize, drag release, or Fit view retain their existing behavior.

This connects hover intent to the existing motion cancellation path instead of adding a second pause/resume state machine. The local graph has no automatic settling controller, so it only needs geometry-neutral hover rendering.

Alternative considered: let settling continue and enlarge hover hit targets. Larger targets can reduce missed clicks, but the selected node can still move away and overlap another target. It does not satisfy the stable-position contract.

### Keep reducers geometry-neutral and share hover invariants

Hover reducers may change color, edge visibility or emphasis, labels, and draw order. They must return the original position, size, and hidden state unless those values were already changed by filtering or dragging. Global and local graphs should use the same hover-state rules so a fix cannot leave the compact graph with different pointer behavior.

Regression tests will compare graph-space positions and camera state before and after enter, stationary hover, node-to-node transition, and leave. A browser test will also verify that the node identified on hover is the node selected by a click at the unchanged pointer location. This catches interaction loops that pure reducer tests cannot see.

Alternative considered: suppress renderer refresh on hover. Sigma needs a refresh to show neighborhood emphasis, so removing it would fix movement by breaking the required visual response.

## Risks / Trade-offs

- [A missing closing `==` could make a later delimiter pair look like one long candidate within a paragraph] -> Keep the non-greedy delimiter match, reject embedded delimiter characters as today, and test unmatched and adjacent delimiters.
- [A newline inside raw HTML output could render as collapsed whitespace rather than a visual hard break] -> Preserve the Markdown soft-break semantics and assert text content and one continuous `<mark>` region, not a forced `<br>`.
- [Canceling initial settle on the first hover can leave a large graph less fully relaxed] -> Favor click stability once the reader targets a node; Fit view and the existing explicit motion triggers remain available.
- [Coordinate-only tests could miss a visual jump caused by camera or hover-target churn] -> Assert coordinates, camera state, hover event stability, and click identity in browser coverage.

## Migration Plan

No data or configuration migration is needed. Ship the parser and graph interaction changes with their tests. Rollback consists of reverting the code change; existing vault files, generated routes, and graph session data remain compatible.
