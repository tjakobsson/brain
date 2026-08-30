import { expect, test } from "@playwright/test";

const workspace = "http://127.0.0.1:4331/workspace-demo";

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-root", "Workspace behavior needs one browser project.");
});

test("desktop chooser follows hierarchy and keeps brain context in navigation", async ({ page }) => {
  await page.goto(`${workspace}/`);

  await expect(page).toHaveTitle("Demo Brain workspace");
  await expect(page.getByRole("heading", { name: "Knowledge" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Product" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Discovery" })).toBeVisible();
  await expect(page.locator(".brain-card")).toHaveCount(3);
  await expect(page.locator(".context-switcher > summary"))
    .toHaveAttribute("title", "Switch brain, current: Workspace");

  await page.getByRole("link", { name: "Open Engineering" }).click();
  await expect(page).toHaveURL(`${workspace}/brains/engineering`);
  await expect(page.locator(".context-switcher > summary"))
    .toHaveAttribute("aria-label", "Switch brain, current: @engineering");
  await expect(page.locator("#global-graph canvas.sigma-nodes")).toBeVisible();

  await page.locator(".nav-menu > summary").click();
  await expect(page.locator(".nav-menu-panel").getByRole("link", { name: "Tags" }))
    .toHaveAttribute("href", "/workspace-demo/brains/engineering/tags");
  await page.locator(".nav-menu > summary").click();

  await page.locator(".context-switcher > summary").click();
  await page.locator(".context-switcher__panel").getByRole("link", { name: "@design" }).click();
  await expect(page).toHaveURL(`${workspace}/brains/design`);
  await expect(page.locator(".context-switcher > summary"))
    .toHaveAttribute("title", "Switch brain, current: @design");
  await page.locator(".context-switcher > summary").click();
  await page.getByRole("link", { name: "Brain chooser" }).click();
  await expect(page).toHaveURL(`${workspace}/`);
});

test("active brain navigation is one ordered, viewport-safe vertical pill", async ({ page }) => {
  await page.goto(`${workspace}/brains/engineering/notes/principles`);

  const header = page.locator(".site-header");
  const context = header.getByRole("button", { name: "Switch brain, current: @engineering" });
  const graph = header.getByRole("link", { name: "Graph" });
  const search = header.getByRole("button", { name: "Search" });
  const more = header.locator(".nav-menu > summary");
  await expect(context).toHaveAttribute("title", "Switch brain, current: @engineering");
  await expect(context).toHaveAttribute("aria-label", "Switch brain, current: @engineering");
  await expect(context).toHaveAttribute("aria-expanded", "false");
  await expect(header).toHaveCSS("border-top-width", "1px");
  await expect(header).toHaveCSS("width", "48px");
  await expect(context).toHaveCSS("border-top-width", "0px");

  const geometry = await header.evaluate((pill) => {
    const controls = [
      pill.querySelector(".context-switcher > summary"),
      pill.querySelector(".graph-trigger"),
      pill.querySelector(".search-trigger"),
      pill.querySelector(".nav-menu > summary"),
    ].map((control) => control!.getBoundingClientRect());
    const bounds = pill.getBoundingClientRect();
    const heading = document.querySelector("main h1")!;
    const headingRange = document.createRange();
    headingRange.selectNodeContents(heading);
    const headingText = headingRange.getBoundingClientRect();
    return {
      ordered: controls.every((control, index) => index === 0 || control.top >= controls[index - 1].bottom),
      aligned: controls.every((control) => control.left >= bounds.left && control.right <= bounds.right),
      inViewport: bounds.left >= 0 && bounds.right <= innerWidth,
      overlapsHeading: !(headingText.right <= bounds.left || headingText.left >= bounds.right || headingText.bottom <= bounds.top || headingText.top >= bounds.bottom),
    };
  });
  expect(geometry).toEqual({ ordered: true, aligned: true, inViewport: true, overlapsHeading: false });

  await context.focus();
  await expect(context).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(graph).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(search).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(more).toBeFocused();

  await context.click();
  await expect(context).toHaveAttribute("aria-expanded", "true");
  const contextPanel = header.locator(".context-switcher__panel");
  await expect(contextPanel.getByRole("link", { name: "Brain chooser" })).toBeVisible();
  await expect(contextPanel.getByRole("link", { name: "@engineering Current" })).toHaveAttribute("aria-current", "page");
  await contextPanel.locator(".context-switcher__label").filter({ hasText: "@design" }).evaluate((label) => {
    label.textContent = `@${"long-brain-id-".repeat(20)}`;
  });
  expect(await contextPanel.evaluate((panel) => {
    const bounds = panel.getBoundingClientRect();
    return bounds.left >= 0 && bounds.right <= innerWidth && bounds.bottom <= innerHeight;
  })).toBe(true);
  await context.click();
  await expect(context).toHaveAttribute("aria-expanded", "false");

  await more.click();
  await expect(header.locator(".nav-menu-panel").getByRole("link", { name: "Search" })).toHaveCount(0);
  await expect(header.locator(".nav-menu-panel").getByRole("link", { name: "Tags" })).toBeVisible();
});

test("Brain identity reuses one mark and reserves accent boundaries for selection", async ({ page }) => {
  await page.goto(`${workspace}/`);

  const cards = page.locator(".brain-card");
  const chooserMarks = cards.locator("[data-brain-mark]");
  await expect(cards).toHaveCount(3);
  await expect(chooserMarks).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "Engineering" })).toBeVisible();
  await expect(cards.filter({ hasText: "@engineering" })).toHaveCount(1);

  const markGeometry = await chooserMarks.first().locator("path").getAttribute("d");
  expect(markGeometry).toBeTruthy();
  for (const mark of await chooserMarks.all()) {
    await expect(mark).toHaveAttribute("aria-hidden", "true");
    await expect(mark).toHaveAttribute("focusable", "false");
    await expect(mark).toHaveCSS("width", "20px");
    await expect(mark.locator("path")).toHaveAttribute("d", markGeometry!);
  }

  const engineering = cards.filter({ hasText: "@engineering" });
  const design = cards.filter({ hasText: "@design" });
  const boundary = async (card: typeof engineering) => card.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      widths: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth],
      colors: [style.borderTopColor, style.borderRightColor, style.borderBottomColor, style.borderLeftColor],
      background: style.backgroundColor,
    };
  });
  const engineeringBefore = await boundary(engineering);
  const designBefore = await boundary(design);
  expect(engineeringBefore.widths).toEqual(["1px", "1px", "1px", "1px"]);
  expect(new Set(engineeringBefore.colors).size).toBe(1);

  const checkbox = page.getByRole("checkbox", { name: "Select Engineering" });
  await checkbox.check();
  await expect(checkbox).toBeChecked();
  const engineeringAfter = await boundary(engineering);
  expect(engineeringAfter.widths).toEqual(["1px", "1px", "1px", "1px"]);
  expect(new Set(engineeringAfter.colors).size).toBe(1);
  expect(engineeringAfter.colors[0]).not.toBe(engineeringBefore.colors[0]);
  expect(engineeringAfter.background).not.toBe(engineeringBefore.background);
  expect(await boundary(design)).toEqual(designBefore);

  await page.getByRole("link", { name: "Open Engineering" }).click();
  const currentMark = page.locator(".context-switcher > summary [data-brain-mark]");
  await expect(page.locator(".context-switcher > summary"))
    .toHaveAttribute("title", "Switch brain, current: @engineering");
  await expect(currentMark).toHaveCSS("width", "16px");
  await expect(currentMark.locator("path")).toHaveAttribute("d", markGeometry!);
  await page.locator(".context-switcher > summary").click();
  for (const id of ["engineering", "design", "research"]) {
    const entry = page.locator(".context-switcher__panel").getByRole("link", { name: `@${id}` });
    await expect(entry).toBeVisible();
    await expect(entry.locator("[data-brain-mark] path")).toHaveAttribute("d", markGeometry!);
  }
  await expect(page.locator(".context-switcher__panel").getByText("Current")).toBeVisible();

  const faviconHref = await page.locator('link[rel="icon"][type="image/svg+xml"]').getAttribute("href");
  expect(faviconHref).toBe("/workspace-demo/favicon.svg");
  const favicon = await page.evaluate(async (href) => {
    const source = await (await fetch(href!)).text();
    const document = new DOMParser().parseFromString(source, "image/svg+xml");
    return {
      source,
      viewBox: document.documentElement.getAttribute("viewBox"),
      path: document.querySelector("path")?.getAttribute("d"),
    };
  }, faviconHref);
  expect(favicon.viewBox).toBe("0 0 24 24");
  expect(favicon.path).toBe(markGeometry);
  expect(favicon.source).toContain("prefers-color-scheme: dark");
  expect(favicon.source).not.toContain("M50.4 78.5");
});

test("combined selection is canonical, shareable, reloadable, and rejects unknown brains", async ({ page }) => {
  await page.goto(`${workspace}/`);
  await page.getByRole("checkbox", { name: "Select Engineering" }).check();
  await page.getByRole("checkbox", { name: "Select Design" }).check();
  await expect(page.getByRole("button", { name: "Open combined graph" })).toBeEnabled();
  await page.getByRole("button", { name: "Open combined graph" }).click();

  await expect(page).toHaveURL(`${workspace}/graph?brains=engineering,design`);
  await expect(page.locator("[data-combined-context]")).toHaveText("Combined: Engineering + Design");
  await expect(page.locator(".context-switcher > summary"))
    .toHaveAttribute("aria-label", "Switch brain, current: Combined");
  await page.reload();
  await expect(page).toHaveURL(`${workspace}/graph?brains=engineering,design`);
  await expect(page.locator("#global-graph canvas.sigma-nodes")).toBeVisible();

  await page.goto(`${workspace}/graph?brains=design,engineering,design`);
  await expect(page).toHaveURL(`${workspace}/graph?brains=engineering,design`);

  await page.goto(`${workspace}/graph?brains=engineering,unknown`);
  await expect(page.getByRole("alert")).toContainText("Unknown brain: @unknown");
  await expect(page.locator("[data-combined-graph]")).toBeHidden();
  await page.getByRole("link", { name: "Return to the brain chooser" }).click();
  await expect(page).toHaveURL(`${workspace}/`);
});

test("mobile chooser and combined selection remain usable without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${workspace}/`);

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const launcher = page.getByRole("button", { name: "Navigation" });
  await expect(launcher).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".mobile-nav-actions")).toHaveJSProperty("inert", true);
  await expect(page.locator(".context-switcher")).toHaveCSS("opacity", "0");
  await expect(page.locator(".nav-menu")).toBeHidden();
  await launcher.click();
  await expect(launcher).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".context-switcher > summary")).toBeVisible();
  await expect(page.getByRole("link", { name: "Graph" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Search" })).toBeVisible();
  await expect(page.locator(".mobile-direct-action")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(launcher).toBeFocused();
  await page.getByRole("checkbox", { name: "Select Engineering" }).check();
  await page.getByRole("checkbox", { name: "Select Research" }).check();
  const action = page.locator(".brain-selection__action");
  await expect(action).toBeVisible();
  await action.getByRole("button", { name: "Open combined graph" }).click();

  await expect(page).toHaveURL(`${workspace}/graph?brains=engineering,research`);
  await expect(page.locator("[data-combined-context]")).toContainText("Engineering + Research");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const combinedLauncher = page.getByRole("button", { name: "Navigation" });
  await combinedLauncher.click();
  await expect(page.getByRole("link", { name: "Graph" }))
    .toHaveAttribute("href", `${workspace}/graph?brains=engineering%2Cresearch`);
  await expect(page.getByRole("button", { name: "Search" })).toBeVisible();
  await expect(page.locator(".mobile-direct-action")).toHaveCount(0);
});

test("active-brain mobile launcher has direct actions and predictable disclosure focus", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(`${workspace}/brains/engineering/notes/principles`);

  const header = page.locator(".site-header");
  const launcher = page.getByRole("button", { name: "Navigation" });
  const context = header.locator(".context-switcher > summary");
  await expect(launcher).toHaveAttribute("aria-expanded", "false");
  await expect(header.locator(".graph-trigger")).toHaveCSS("opacity", "0");
  await expect(header.locator(".search-trigger")).toHaveCSS("opacity", "0");
  expect(await header.evaluate((pill) => {
    const bounds = pill.getBoundingClientRect();
    return bounds.left >= 0 && bounds.right <= innerWidth && document.documentElement.scrollWidth <= innerWidth;
  })).toBe(true);
  await expect(header).toHaveCSS("width", "48px");
  await expect(context).toHaveAttribute("title", "Switch brain, current: @engineering");

  await launcher.focus();
  await page.keyboard.press("Enter");
  await expect(launcher).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Tab");
  await expect(context).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(header.getByRole("link", { name: "Graph" })).toBeFocused();
  await page.keyboard.press("Tab");
  const search = header.getByRole("button", { name: "Search" });
  await expect(search).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(header.getByRole("link", { name: "Tags" })).toBeFocused();
  await expect(header.getByRole("link", { name: "Tags" }))
    .toHaveAttribute("href", "/workspace-demo/brains/engineering/tags");
  await expect(header.getByRole("link", { name: "Recent" })).toBeVisible();
  await expect(header.getByRole("link", { name: "Orphans" })).toBeVisible();
  await expect(header.locator(".nav-menu")).toBeHidden();

  await context.click();
  const contextPanel = header.locator(".context-switcher__panel");
  expect(await contextPanel.evaluate((panel) => {
    const bounds = panel.getBoundingClientRect();
    return bounds.left >= 0 && bounds.right <= innerWidth && bounds.bottom <= innerHeight;
  })).toBe(true);
  await contextPanel.getByRole("link", { name: /@design/ }).click({ trial: true });
  await context.click();

  await search.click();
  await expect(launcher).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByLabel("Search notes and tags")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(launcher).toBeFocused();

  await launcher.click();
  await page.locator("main").click({ position: { x: 12, y: 200 } });
  await expect(launcher).toHaveAttribute("aria-expanded", "false");
  await expect(launcher).toBeFocused();
});

test("mobile launcher is bounded in short viewports and disables motion when requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 240 });
  await page.goto(`${workspace}/brains/engineering/notes/principles`);

  const launcher = page.getByRole("button", { name: "Navigation" });
  const actions = page.locator(".mobile-nav-actions");
  const collapsed = await page.locator(".site-header").boundingBox();
  await launcher.click();
  await expect(actions).toHaveCSS("overflow-y", "auto");
  await expect(actions).toHaveCSS("transition-duration", "0s");
  await expect(actions.locator(":scope > *").first()).toHaveCSS("transition-duration", "0s");
  const geometry = await page.locator(".site-header").evaluate((header) => {
    const launcherBounds = header.querySelector(".mobile-nav-launcher")!.getBoundingClientRect();
    const actionsBounds = header.querySelector(".mobile-nav-actions")!.getBoundingClientRect();
    const headerBounds = header.getBoundingClientRect();
    return {
      growsDown: actionsBounds.top >= launcherBounds.bottom,
      inViewport: headerBounds.top >= 0 && headerBounds.bottom <= innerHeight,
      scrollHeight: (header.querySelector(".mobile-nav-actions") as HTMLElement).scrollHeight,
      clientHeight: (header.querySelector(".mobile-nav-actions") as HTMLElement).clientHeight,
    };
  });
  expect(geometry.growsDown).toBe(true);
  expect(geometry.inViewport).toBe(true);
  expect(geometry.scrollHeight).toBeGreaterThan(geometry.clientHeight);
  expect((await page.locator(".site-header").boundingBox())!.y).toBe(collapsed!.y);
});

test("foreign links and backlinks expose owner text, shape markers, accents, and keyboard links", async ({ page }) => {
  await page.goto(`${workspace}/brains/engineering/notes/principles`);

  const alias = page.getByRole("link", { name: /the design principles.*@design/ });
  const heading = page.locator("article .wiki-link--foreign", { hasText: "Evidence" });
  await expect(alias).toHaveAttribute("href", "/workspace-demo/brains/design/notes/principles");
  await expect(alias.locator(".brain-badge")).toContainText("↗ @design");
  await expect(alias).toHaveCSS("text-decoration-style", "dashed");
  expect(await alias.evaluate((link) => getComputedStyle(link).getPropertyValue("--brain-accent").trim()))
    .toBe("#b56cff");
  await expect(heading).toHaveAttribute("href", "/workspace-demo/brains/research/notes/evidence#confidence");

  await alias.focus();
  await expect(alias).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(`${workspace}/brains/design/notes/principles`);
  const backlink = page.locator(".mentions .mention--foreign", { hasText: "@engineering" });
  await expect(backlink).toBeVisible();
  await expect(backlink.locator(".brain-badge")).toContainText("↗ @engineering");

  await page.goto(`${workspace}/brains/engineering/notes/delivery-loops`);
  const missing = page.locator(".wiki-link--unwritten", { hasText: "@design" });
  await expect(missing).toContainText("↗ @design");
  await expect(missing).toHaveAttribute("data-brain-id", "design");

  await page.goto(`${workspace}/brains/design/notes/interaction-model`);
  const unknown = page.locator(".wiki-link--unknown-brain");
  await expect(unknown).toContainText("? @missing-brain");
  await expect(unknown).toHaveAttribute("title", "Unknown brain: missing-brain");
});

test("foreign wiki links remain static with JavaScript disabled", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${workspace}/brains/engineering/notes/principles`);

  const link = page.getByRole("link", { name: /the design principles.*@design/ });
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(`${workspace}/brains/design/notes/principles`);
  await context.close();
});

test("graph payload and scoped views keep ownership boundaries and canonical brain filters", async ({ page }) => {
  await page.goto(`${workspace}/brains/engineering`);
  const payload = await page.evaluate(async () => {
    const response = await fetch("/workspace-demo/graph-data.json");
    return response.json();
  });
  const principles = payload.nodes.filter((node: { title: string }) => node.title === "Principles");
  expect(principles.map((node: { id: string }) => node.id).sort()).toEqual([
    "design/principles",
    "engineering/principles",
  ]);
  expect(principles.map((node: { route: string }) => node.route).sort()).toEqual([
    "/brains/design/notes/principles",
    "/brains/engineering/notes/principles",
  ]);
  expect(payload.edges.some((edge: { crossBrain: boolean }) => edge.crossBrain)).toBe(true);
  expect(payload.nodes.every((node: { x: number; y: number }) => Number.isFinite(node.x) && Number.isFinite(node.y))).toBe(true);

  const graph = page.locator("#global-graph");
  await expect(graph).toHaveAttribute("data-visible-nodes", "2");
  await expect(graph).toHaveAttribute("data-visible-brain-ids", "engineering");
  await expect(graph).toHaveAttribute("data-foreign-nodes", "0");
  await expect(graph).toHaveAttribute("data-cross-edges", "0");
  await expect(graph).toHaveAttribute("data-related-brains-visible", "false");

  const relatedBrains = page.locator("#graph-related-toggle");
  await expect(relatedBrains).toHaveAttribute("aria-pressed", "false");
  await page.waitForFunction(() =>
    sessionStorage.getItem(`graph-related-brains:${location.pathname}`) === "false"
  );
  await relatedBrains.click();
  await page.reload();
  await expect(relatedBrains).toHaveAttribute("aria-pressed", "true");
  await expect(graph).toHaveAttribute("data-visible-nodes", "4");
  await expect(graph).toHaveAttribute("data-visible-brain-ids", "engineering,design,research");
  await expect(graph).toHaveAttribute("data-foreign-nodes", "2");
  await expect(graph).toHaveAttribute("data-cross-edges", "4");
  await expect(graph).toHaveAttribute("data-related-brains-visible", "true");
  await expect(graph).toHaveAttribute("data-rendered-foreign-labels", "2");
  await page.waitForFunction(() =>
    Object.keys(sessionStorage).some((key) =>
      key.startsWith("graph-motion:") && key.includes(":brain:engineering:true:")
    )
  );
  await page.reload();
  await expect(relatedBrains).toHaveAttribute("aria-pressed", "true");
  await expect(relatedBrains).toHaveText("Hide related brains");
  await expect(graph).toHaveAttribute("data-foreign-nodes", "2");
  await expect(graph).toHaveAttribute("data-related-brains-visible", "true");

  await page.getByRole("button", { name: "Filters" }).click();
  await expect(page.locator("[data-brain-key=engineering]")).toContainText("@engineering: Engineering");
  await expect(page.locator("[data-brain-key=design]")).toContainText("foreign ↗");
  await expect(page.locator("[data-graph-legend] .cross-edge-key")).toHaveCSS("border-top-width", "1px");
  await page.locator("#graph-search").fill("Principles");
  const matches = page.locator("#graph-search-results button");
  await expect(matches).toHaveCount(2);
  await expect(matches.filter({ hasText: "@engineering" })).toHaveCount(1);
  await expect(matches.filter({ hasText: "@design" })).toHaveCount(1);

  await page.evaluate(() => {
    document.querySelector<HTMLButtonElement>("#graph-related-toggle")!.click();
    document.querySelector<HTMLButtonElement>("#graph-search-results button")!.click();
  });
  await page.waitForFunction(() =>
    sessionStorage.getItem(`graph-related-brains:${location.pathname}`) === "false"
  );
  await expect(graph).not.toHaveAttribute("data-filter-settle-pending");
  await page.waitForTimeout(300);
  await expect(graph).not.toHaveAttribute("data-filter-settle-pending");
  expect(await page.evaluate(() =>
    Object.keys(sessionStorage).filter((key) =>
      /graph-(motion|view):/.test(key) && key.includes(":brain:engineering:false:")
    ).length
  )).toBe(0);
  await page.reload();
  await expect(relatedBrains).toHaveAttribute("aria-pressed", "false");
  await expect(graph).toHaveAttribute("data-foreign-nodes", "0");

  await page.goto(`${workspace}/graph?brains=engineering,design,research`);
  await expect(graph).toHaveAttribute("data-visible-nodes", "5");
  const filterToggle = page.locator("#graph-filter-toggle");
  if (await filterToggle.getAttribute("aria-expanded") === "false") await filterToggle.click();
  await page.getByRole("checkbox", { name: "@research" }).uncheck();
  await expect(page).toHaveURL(`${workspace}/graph?brains=engineering,design`);
  await expect(graph).toHaveAttribute("data-visible-brain-ids", "engineering,design");
  await expect(graph).toHaveAttribute("data-visible-nodes", "4");
  await expect(page.locator("[data-combined-context]")).toHaveText("Combined: Engineering + Design");
});

test("graph ownership legend remains non-color-readable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${workspace}/brains/engineering`);
  const graph = page.locator("#global-graph");
  const relatedBrains = page.locator("#graph-related-toggle");
  const controls = page.locator(".graph-controls");
  const actions = controls.getByRole("button");
  await expect(actions).toHaveCount(4);
  await expect(controls.getByRole("button", { name: "Filters" })).toBeVisible();
  await expect(controls.getByRole("button", { name: "Fit view" })).toBeVisible();
  await expect(controls.getByRole("button", { name: "Related brains" })).toBeVisible();
  await expect(controls.getByRole("button", { name: "Legend" })).toBeVisible();
  const initialGeometry = await page.evaluate(() => {
    const controls = document.querySelector(".graph-controls")!.getBoundingClientRect();
    const navigation = document.querySelector(".site-header")!.getBoundingClientRect();
    const actions = [...document.querySelectorAll<HTMLElement>(".graph-controls button")]
      .map((button) => button.getBoundingClientRect());
    return {
      actions: actions.map(({ x, y, width, height }) => ({ x, y, width, height })),
      oneRow: actions.every((action) => Math.abs(action.top - actions[0].top) < 1),
      alignedWithNavigation: Math.abs(controls.top - navigation.top) < 1,
      sameHeightAsNavigation: Math.abs(controls.height - navigation.height) < 1,
      controlsLeftInset: controls.left,
      navigationRightInset: innerWidth - navigation.right,
      inViewport: controls.left >= 0 && controls.right <= innerWidth,
      overlapsNavigation: !(controls.right <= navigation.left || controls.left >= navigation.right || controls.bottom <= navigation.top || controls.top >= navigation.bottom),
      noOverflow: document.documentElement.scrollWidth <= innerWidth,
    };
  });
  expect(initialGeometry.actions.every(({ width, height }) => width >= 44 && height >= 44)).toBe(true);
  expect(initialGeometry).toMatchObject({ oneRow: true, alignedWithNavigation: true, sameHeightAsNavigation: true, inViewport: true, overlapsNavigation: false, noOverflow: true });
  expect(Math.abs(initialGeometry.controlsLeftInset - initialGeometry.navigationRightInset)).toBeLessThan(1);
  await expect(graph).toHaveAttribute("data-foreign-nodes", "0");
  await relatedBrains.click();
  await expect(graph).toHaveAttribute("data-foreign-nodes", "2");
  await expect(relatedBrains).toHaveText("Hide related brains");
  await expect(relatedBrains).toHaveAttribute("aria-pressed", "true");
  expect(await actions.evaluateAll((buttons) => buttons.map((button) => {
    const { x, y, width, height } = button.getBoundingClientRect();
    return { x, y, width, height };
  }))).toEqual(initialGeometry.actions);
  await relatedBrains.click();
  await expect(graph).toHaveAttribute("data-foreign-nodes", "0");

  const filterToggle = controls.getByRole("button", { name: "Filters" });
  const sidebar = page.locator("#graph-sidebar");
  await filterToggle.click();
  await expect(filterToggle).toHaveAttribute("aria-expanded", "true");
  await expect(sidebar).toHaveJSProperty("inert", false);
  const legendTrigger = controls.getByRole("button", { name: "Legend" });
  await legendTrigger.click();
  await expect(filterToggle).toHaveAttribute("aria-expanded", "false");
  await expect(sidebar).toHaveJSProperty("inert", true);
  await expect(legendTrigger).toHaveAttribute("aria-expanded", "true");
  const conciseLegend = page.getByRole("region", { name: "Graph legend" });
  await expect(conciseLegend).toContainText("Draft, developing, established");
  await expect(conciseLegend).toContainText("Larger nodes have more connections");
  await expect(conciseLegend).toContainText("@design: Design (related)");
  await expect(conciseLegend).toContainText("Muted line links different brains");
  await page.keyboard.press("Escape");
  await expect(conciseLegend).toBeHidden();
  await expect(legendTrigger).toBeFocused();
  await legendTrigger.click();
  await page.mouse.click(380, 820);
  await expect(conciseLegend).toBeHidden();
  await expect(legendTrigger).toBeFocused();

  await page.goto(`${workspace}/graph?brains=engineering,design`);
  await page.getByRole("button", { name: "Filters" }).click();

  const legend = page.locator("[data-graph-legend]");
  await expect(legend).toBeVisible();
  await expect(legend).toContainText("@engineering: Engineering");
  await expect(legend).toContainText("@design: Design");
  await expect(legend).toContainText("○ draft");
  await expect(legend).toContainText("◆ established");
  await expect(legend).toContainText("thick line: cross-brain link");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("coarse-pointer tablet keeps graph controls clear of mobile navigation", async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 701, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${workspace}/brains/engineering`);

  const geometry = await page.evaluate(() => {
    const controls = document.querySelector(".graph-controls")!.getBoundingClientRect();
    const navigation = document.querySelector(".site-header")!.getBoundingClientRect();
    const actions = [...document.querySelectorAll<HTMLElement>(".graph-controls button")]
      .map((button) => button.getBoundingClientRect());
    return {
      compact: actions.every(({ width, height }) => width === 44 && height === 44),
      overlapsNavigation: !(
        controls.right <= navigation.left ||
        controls.left >= navigation.right ||
        controls.bottom <= navigation.top ||
        controls.top >= navigation.bottom
      ),
    };
  });
  expect(geometry).toEqual({ compact: true, overlapsNavigation: false });
  await context.close();
});

test("dense related notes use collision-selected labels in phone fits", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const foreignNodes = Array.from({ length: 24 }, (_, index) => ({
    id: `design/related-${index}`,
    brainId: "design",
    title: `Related design note with a long title ${index + 1}`,
    route: `/brains/design/notes/related-${index}`,
    type: "literature",
    status: index % 3 === 0 ? "established" : "developing",
    tags: [],
    degree: 1,
    x: Math.cos(index * Math.PI / 12) * 2,
    y: Math.sin(index * Math.PI / 12) * 2,
  }));
  await page.route("**/graph-data.json", (route) => route.fulfill({
    json: {
      mode: "workspace",
      brains: [
        { id: "engineering", title: "Engineering", accent: "#3366cc" },
        { id: "design", title: "Design", accent: "#b56cff" },
      ],
      nodes: [
        {
          id: "engineering/principles",
          brainId: "engineering",
          title: "Engineering principles",
          route: "/brains/engineering/notes/principles",
          type: "permanent",
          status: "established",
          tags: [],
          degree: 24,
          x: 0,
          y: 0,
        },
        ...foreignNodes,
      ],
      edges: foreignNodes.map((node) => ({
        source: "engineering/principles",
        target: node.id,
        sourceBrainId: "engineering",
        targetBrainId: "design",
        crossBrain: true,
      })),
    },
  }));
  await page.goto(`${workspace}/brains/engineering`);
  const graph = page.locator("#global-graph");
  await page.getByRole("button", { name: "Related brains" }).click();
  await expect(graph).toHaveAttribute("data-foreign-nodes", "24");
  await page.waitForFunction(() => {
    const host = document.querySelector<HTMLElement>("#global-graph")!;
    return Number(host.dataset.renderedForeignLabels) > 0;
  });
  const automaticLabels = Number(await graph.getAttribute("data-rendered-foreign-labels"));
  expect(automaticLabels).toBeGreaterThan(0);
  expect(automaticLabels).toBeLessThan(24);

  await page.getByRole("button", { name: "Fit view" }).click();
  await page.waitForTimeout(450);
  const manualLabels = Number(await graph.getAttribute("data-rendered-foreign-labels"));
  expect(manualLabels).toBeGreaterThan(0);
  expect(manualLabels).toBeLessThan(24);

  const bounds = await graph.boundingBox();
  expect(bounds).not.toBeNull();
  const centerX = bounds!.x + bounds!.width / 2;
  const centerY = bounds!.y + bounds!.height / 2;
  let hovered = false;
  for (let y = centerY - 120; y <= centerY + 120 && !hovered; y += 8) {
    for (let x = centerX - 120; x <= centerX + 120; x += 8) {
      await page.mouse.move(x, y);
      if ((await graph.evaluate((host) => host.style.cursor)) === "pointer") {
        hovered = true;
        break;
      }
    }
  }
  expect(hovered).toBe(true);
  await expect.poll(async () => Number(await graph.getAttribute("data-rendered-foreign-labels")))
    .toBeLessThan(24);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("quick switcher defaults to active, selected, and all-brain scopes", async ({ page }) => {
  await page.goto(`${workspace}/brains/engineering/notes/principles`);
  await page.getByRole("button", { name: "Search" }).click();
  const activeScope = page.getByLabel("Quick switcher scope");
  const activeSearch = page.getByLabel("Search notes and tags");
  await expect(activeScope).toHaveValue("active");
  await expect(activeSearch).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(activeScope).toBeFocused();
  await page.keyboard.press("a");
  await expect(activeScope).toHaveValue("all");
  await page.keyboard.press("Tab");
  await expect(activeSearch).toBeFocused();
  await activeSearch.fill("Principles");
  await expect(page.locator("#switcher-results li", { hasText: "@design" })).toBeVisible();
  await activeScope.selectOption("active");
  await expect(page.locator("#switcher-results li")).toHaveCount(1);
  await expect(page.locator("#switcher-results li")).toContainText("@engineering");
  await activeSearch.fill("decisions");
  await expect(page.locator("#switcher-results li", { hasText: "#decisions" })).toContainText("tag · @engineering");
  await page.keyboard.press("Escape");

  await page.goto(`${workspace}/graph?brains=engineering,design`);
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByLabel("Quick switcher scope")).toHaveValue("selected");
  await page.getByLabel("Search notes and tags").fill("Principles");
  await expect(page.locator("#switcher-results li")).toHaveCount(2);
  await page.keyboard.press("Escape");

  await page.goto(`${workspace}/`);
  await page.keyboard.press("Control+k");
  await expect(page.getByLabel("Quick switcher scope")).toHaveValue("all");
  await page.getByLabel("Search notes and tags").fill("Principles");
  const design = page.locator("#switcher-results li", { hasText: "@design" });
  await expect(design).toContainText("Principles");
  await page.getByLabel("Search notes and tags").fill("Interaction model");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(`${workspace}/brains/design/notes/interaction-model`);
});

test("dedicated Search routes are absent", async ({ request }) => {
  expect((await request.get(`${workspace}/search`)).status()).toBe(404);
  expect((await request.get(`${workspace}/brains/engineering/search`)).status()).toBe(404);
  expect((await request.get(`${workspace}/pagefind/`)).status()).toBe(404);
  expect((await request.get(`${workspace}/search-index.json`)).status()).toBe(200);
});

test("contextual reports retain brain scope and foreign relationships", async ({ page }) => {

  await page.goto(`${workspace}/brains/research/orphans`);
  await expect(page.getByText("No orphans. Every note is connected.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Evidence" })).toHaveCount(0);

  await page.goto(`${workspace}/brains/engineering/tags/decisions`);
  await expect(page.getByRole("link", { name: "Principles" }))
    .toHaveAttribute("href", "/workspace-demo/brains/engineering/notes/principles");
  await page.goto(`${workspace}/brains/design/tags/decisions`);
  await expect(page.getByRole("link", { name: "Principles" }))
    .toHaveAttribute("href", "/workspace-demo/brains/design/notes/principles");

  await page.goto(`${workspace}/brains/design/recent`);
  await expect(page.locator(".recent-list li")).toHaveCount(2);
  await expect(page.getByRole("link", { name: "Interaction model" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Delivery loops" })).toHaveCount(0);

  await page.goto(`${workspace}/brains/engineering/notes/principles`);
  const nearby = page.getByRole("navigation", { name: "Notes in the connection map" });
  await expect(nearby).toContainText("Principles↗ @design");
  await expect(nearby).toContainText("Evidence↗ @research");
  await expect(nearby).not.toContainText("Interaction model");
});
