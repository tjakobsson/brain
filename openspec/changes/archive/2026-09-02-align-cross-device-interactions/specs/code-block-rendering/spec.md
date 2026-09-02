## ADDED Requirements

### Requirement: Stable fenced-code typography on narrow WebKit layouts
Fenced-code text SHALL retain the site's intended code-block font size on narrow WebKit layouts and MUST NOT be enlarged by automatic browser text adjustment. Preventing automatic adjustment MUST preserve reader-controlled page zoom, horizontal code scrolling, compact copy-control placement, line-number alignment, and the intended typography in other supported browsers.

#### Scenario: Read a wide code block in mobile WebKit
- **WHEN** a narrow WebKit viewport displays a fenced block whose code is wider than the note column
- **THEN** the code text remains at the intended fenced-block size while the complete line remains horizontally accessible

#### Scenario: Zoom the page
- **WHEN** a reader uses browser or operating-system zoom after automatic fenced-code adjustment has been constrained
- **THEN** the reader can still enlarge the page and code through that user-controlled zoom

#### Scenario: Preserve compact copy-control geometry
- **WHEN** stable typography is applied to a fenced block with a copy control
- **THEN** the first line, trailing scroll clearance, line-number gutter, and copy control retain their contracted layout
