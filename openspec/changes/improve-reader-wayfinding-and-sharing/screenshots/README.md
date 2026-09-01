# Wayfinding and sharing screenshot gallery

These screenshots cover the user-visible states changed by `improve-reader-wayfinding-and-sharing`. They were captured from the generated browser fixtures with `capture.mjs`.

## Brain chooser

### Single-Brain entry is primary

The initial desktop chooser keeps Enter Brain prominent and combination controls secondary. No combined action competes with the cards before selection.

![Desktop Brain chooser](01-brain-chooser-desktop.png)

### Combined selection appears after intent

The phone chooser shows selected cards and the fixed combined-graph action after two Brains are selected.

![Phone Brain chooser with two selected Brains](02-brain-chooser-phone-selected.png)

## Navigation, provenance, and browsing scope

### Visible Home and focused graph access

An isolated note keeps Home at the top left and a focused-graph action beside its title. The expanded navigation contains contextual destinations without duplicate Brains or About actions.

![Desktop isolated note with Home and focused graph access](03-note-home-focused-graph-desktop.png)

### Chooser-only About disclosure

About remains available on the Brain chooser and its package-derived `Brain v1.4.0` provenance stays contained in a 390 by 500 viewport.

![Short phone chooser About disclosure](04-chooser-about-short-phone.png)

### Note ownership remains separate from selected browsing scope

The note remains owned by `@engineering`, while the quick switcher shows the retained selected scope `@engineering, @design` and limits results accordingly.

![Combined browsing scope retained on an owned note](05-combined-note-context.png)

## Shareable graph focus

### Persistent focused neighborhood

The focused subject uses a non-color marker, keeps its direct neighborhood visible, and exposes Copy link, Open note, and Clear actions.

![Focused graph neighborhood in light mode](06-graph-focus-light.png)

### Marker and title context menu

Right-clicking a graph target opens the bounded menu with Move focus here, Copy neighborhood link, and Open note.

![Graph focus context menu](07-graph-focus-context-menu.png)

### Dark appearance

Focus markers, direct-neighborhood emphasis, and accessible actions remain visible in dark mode.

![Focused graph neighborhood in dark mode](08-graph-focus-dark.png)

### Phone restoration

The same canonical focus URL restores and fits the neighborhood on a phone without carrying desktop camera state.

![Focused graph neighborhood restored on phone](09-graph-focus-phone.png)

## Legend containment

The global legend remains inside the viewport with Filters closed at desktop, phone, and coarse-pointer tablet sizes.

![Contained desktop global legend](10-global-legend-desktop.png)

![Contained phone global legend](11-global-legend-phone.png)

![Contained coarse-pointer tablet global legend](12-global-legend-coarse-tablet.png)

## External links

Authored external HTTP links have persistent solid underlines, box-arrow icons, and accessible external-site naming without forcing a new tab.

![External-link treatment on desktop](13-external-links-desktop.png)

Long external links wrap without horizontal overflow on phone.

![External-link treatment on phone](14-external-links-phone.png)

## Missing-page recovery

### Scoped deterministic recommendation

A missing workspace note retains the valid selected-Brain scope, links back to the selected graph, and shows a deterministic note recommendation with owner and tags.

![Scoped workspace 404 recovery](15-scoped-404-workspace.png)

### Progressive Search

The 404 Search action opens the quick switcher on phone. Root recovery and recommendation remain visible behind the dialog.

![404 Search quick switcher on phone](16-404-search-phone.png)

### Invalid combined selection

Unknown Brain selections use the shared recovery presentation and link safely back to the chooser.

![Invalid combined selection recovery](17-invalid-combined-selection.png)

## Highlight rendering

Brain `==highlight==` syntax renders in linked-mention excerpts after wiki-link display text is resolved.

![Highlighted linked-mention excerpt](linked-mention-highlight.png)

Inline potential-link treatment remains nested inside the authored highlight.

![Highlighted inline potential link](potential-link-highlight.png)

## Behavior verified without screenshots

Some requirements are route, server, metadata, or accessibility contracts rather than distinct visual states. Automated coverage verifies:

- canonical `brains` and `focus` query handling, including duplicate and invalid parameters;
- scope retention through graph nodes, wiki-links, mentions, nearby links, local maps, and quick-switcher results;
- clipboard URL contents and omission of camera, filter, and dragged-position state;
- touch long press, keyboard graph search, focused hover locking, right-click position stability, and native empty-stage context menus;
- generated `<meta name="generator">` values;
- external-origin classification, same-tab behavior, accessible names, and contrast;
- deterministic 404 recommendations, no-JavaScript root recovery, HTTP 404 status, `HEAD`, root/subpath serving, and missing-resource behavior.

## Refreshing the gallery

Start `scripts/serve-browser-fixture.mjs`, then run:

```sh
node openspec/changes/improve-reader-wayfinding-and-sharing/screenshots/capture.mjs
```
