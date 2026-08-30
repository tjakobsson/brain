## 1. Relative Zoom Policy

- [x] 1.1 Add a local-graph detailed-zoom policy based on the current ratio relative to a positive fitted ratio, while retaining the global absolute policy; verify unit tests cover multiple fitted scales, the 75 percent boundary, zoom-out transitions, and unavailable or invalid baselines.

## 2. Local Renderer Integration

- [x] 2.1 Record each local renderer's ratio after initial fit and completed animated Fit view, recompute forced labels only at state transitions, and verify focused tests cover fit reset and listener cleanup.
- [x] 2.2 Report each local graph's displayed-label count from render events and remove the observer on teardown; verify the note-page graph host updates after rendering without changing graph interaction behavior.

## 3. Browser Regression

- [x] 3.1 Extend narrow-viewport browser coverage with a local neighborhood whose fitted ratio exposes the absolute-threshold bug; verify relative zoom displays every eligible visible title and Fit view restores a selective overview.
- [x] 3.2 Preserve existing local graph scrolling, pan, tap navigation, bounds, and screenshot assertions, and verify `npm run test:browser` passes.

## 4. Final Verification

- [x] 4.1 Run `npm test` and `npm run build`, and verify all product-contract and production-build checks pass.
