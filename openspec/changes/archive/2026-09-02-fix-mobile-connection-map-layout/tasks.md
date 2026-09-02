## 1. Motion Integration

- [x] 1.1 Integrate local connection maps with the shared responsive motion controller, pin the current note during settling, and verify focused unit tests cover the local layout request and completion behavior.
- [x] 1.2 Preserve local fitted-ratio label bookkeeping across automatic settling and manual Fit view, and verify the local label reveal tests pass.

## 2. Responsive Resizing

- [x] 2.1 Observe each local graph container, debounce material dimension changes through the shared resize-settling path, and verify resize unit tests cover one settle for the final dimensions.
- [x] 2.2 Clean up local observers and motion resources when the renderer is destroyed, and verify repeated mount/teardown tests or assertions leave no active callbacks.

## 3. Regression Coverage

- [x] 3.1 Add a narrow-phone browser fixture with clustered inherited node positions and verify the initial connection map produces readable screen-space node separation while remaining fitted.
- [x] 3.2 Extend the browser regression to resize or rotate the local graph viewport and verify it recomposes and refits without a follow-up camera transition.
- [x] 3.3 Run `npm test` and the relevant Playwright browser suite, and verify all OpenSpec contracts and responsive graph tests pass.
