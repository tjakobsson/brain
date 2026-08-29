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
  await expect(page.locator(".context-switcher > summary")).toContainText("Workspace");

  await page.getByRole("link", { name: "Open Engineering" }).click();
  await expect(page).toHaveURL(`${workspace}/brains/engineering`);
  await expect(page.locator(".context-switcher > summary")).toContainText("@engineering");
  await expect(page.locator("#global-graph canvas.sigma-nodes")).toBeVisible();

  await page.locator(".nav-menu > summary").click();
  await expect(page.locator(".nav-menu-panel").getByRole("link", { name: "Tags" }))
    .toHaveAttribute("href", "/workspace-demo/brains/engineering/tags");
  await page.locator(".nav-menu > summary").click();

  await page.locator(".context-switcher > summary").click();
  await page.locator(".context-switcher__panel").getByRole("link", { name: "@design" }).click();
  await expect(page).toHaveURL(`${workspace}/brains/design`);
  await expect(page.locator(".context-switcher > summary")).toContainText("@design");
  await page.locator(".context-switcher > summary").click();
  await page.getByRole("link", { name: "Brain chooser" }).click();
  await expect(page).toHaveURL(`${workspace}/`);
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
  await expect(page.locator(".context-switcher > summary")).toContainText("@engineering");
  await expect(currentMark).toHaveCSS("width", "16px");
  await expect(currentMark.locator("path")).toHaveAttribute("d", markGeometry!);
  await page.locator(".context-switcher > summary").click();
  for (const id of ["engineering", "design", "research"]) {
    const entry = page.locator(".context-switcher__panel").getByRole("link", { name: `@${id}` });
    await expect(entry).toBeVisible();
    await expect(entry.locator("[data-brain-mark] path")).toHaveAttribute("d", markGeometry!);
  }

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
  await expect(page.locator(".context-switcher > summary")).toContainText("Combined");
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
  await expect(page.locator(".context-switcher > summary")).toBeVisible();
  await page.getByRole("checkbox", { name: "Select Engineering" }).check();
  await page.getByRole("checkbox", { name: "Select Research" }).check();
  const action = page.locator(".brain-selection__action");
  await expect(action).toBeVisible();
  await action.getByRole("button", { name: "Open combined graph" }).click();

  await expect(page).toHaveURL(`${workspace}/graph?brains=engineering,research`);
  await expect(page.locator("[data-combined-context]")).toContainText("Engineering + Research");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
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
  await expect(page.locator(".cross-edge-key")).toHaveCSS("border-top-width", "1px");
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
  await expect(graph).toHaveAttribute("data-foreign-nodes", "0");
  await relatedBrains.click();
  await expect(graph).toHaveAttribute("data-foreign-nodes", "2");
  await expect(relatedBrains).toHaveText("Hide related brains");
  await relatedBrains.click();
  await expect(graph).toHaveAttribute("data-foreign-nodes", "0");

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

test("quick switcher defaults to active, selected, and all-brain scopes", async ({ page }) => {
  await page.goto(`${workspace}/brains/engineering/notes/principles`);
  await page.keyboard.press("Control+k");
  await expect(page.getByLabel("Quick switcher scope")).toHaveValue("active");
  await page.getByLabel("Search notes and tags").fill("Principles");
  await expect(page.locator("#switcher-results li")).toHaveCount(1);
  await expect(page.locator("#switcher-results li")).toContainText("@engineering");
  await page.keyboard.press("Escape");

  await page.goto(`${workspace}/graph?brains=engineering,design`);
  await page.keyboard.press("Control+k");
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
  await design.click();
  await expect(page).toHaveURL(`${workspace}/brains/design/notes/principles`);
});

test("Pagefind and contextual reports retain brain scope and foreign relationships", async ({ page }) => {
  await page.goto(`${workspace}/brains/engineering/search`);
  await expect(page.getByLabel("Search scope")).toHaveValue("active");
  await page.locator(".pagefind-ui__search-input").fill("Principles");
  await expect(page.locator(".pagefind-ui__result-link")).toHaveCount(1);
  await expect(page.locator(".pagefind-ui__result-link")).toContainText("@engineering");
  await page.getByLabel("Search scope").selectOption("all");
  await expect(page.locator(".pagefind-ui__result-link").filter({ hasText: /^Principles/ })).toHaveCount(2);
  await expect(page.getByRole("link", { name: "Principles · @design", exact: true }))
    .toHaveAttribute("href", /\/workspace-demo\/brains\/design\/notes\/principles\/?$/);

  await page.goto(`${workspace}/search?brains=engineering,design`);
  await expect(page.getByLabel("Search scope")).toHaveValue("selected");
  const graph = page.getByRole("link", { name: "Graph", exact: true });
  await expect(graph).toHaveAttribute(
    "href",
    /\/workspace-demo\/graph\?brains=engineering%2Cdesign$/,
  );
  await page.locator(".pagefind-ui__search-input").fill("Principles");
  await expect(page.locator(".pagefind-ui__result-link").filter({ hasText: /^Principles/ })).toHaveCount(2);
  await graph.click();
  await expect(page).toHaveURL(`${workspace}/graph?brains=engineering,design`);
  await expect(page.locator("[data-combined-context]")).toHaveText("Combined: Engineering + Design");

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
