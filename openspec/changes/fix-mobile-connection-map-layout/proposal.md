## Why

Note-page connection maps inherit coordinates from the full graph and only adjust the camera, causing clustered nodes and labels to collapse into an unreadable row on narrow mobile viewports. The main graph already adapts its composition to the available dimensions, so local maps should provide the same responsive readability.

## What Changes

- Make each note-page connection map settle its local neighborhood into a viewport-aware composition before fitting the camera.
- Recompute and refit the local composition when its container dimensions materially change, including phone orientation changes.
- Preserve the current note as the spatial anchor and retain existing local label reveal, navigation, dragging, and Fit view behavior.
- Add regression coverage using clustered inherited coordinates on a narrow viewport, including a resize case.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `responsive-graph-motion`: Extend viewport-aware composition and resize behavior to note-page connection maps.

## Impact

- Affects local graph mounting and motion coordination in `src/lib/graph-view.ts` and shared graph motion helpers.
- Adds unit and browser coverage for responsive local graph composition.
- Does not change content formats, routes, public APIs, or dependencies.
