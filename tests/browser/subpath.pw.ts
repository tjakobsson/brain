import { expect, test, type TestInfo } from "@playwright/test";

function deployment(testInfo: TestInfo) {
  const url = new URL(String(testInfo.project.use.baseURL));
  return { origin: url.origin, base: url.pathname.replace(/\/$/u, "") };
}

test("all site features stay within the deployment base", async ({ page }, testInfo) => {
  const { origin, base } = deployment(testInfo);
  const escapedRequests: string[] = [];
  const requestedPaths = new Set<string>();
  const pageErrors: string[] = [];

  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== origin) return;
    requestedPaths.add(url.pathname);
    if (url.pathname !== base && !url.pathname.startsWith(`${base}/`)) {
      escapedRequests.push(`${request.method()} ${url.pathname}`);
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(`${base}/`);
  await expect(page).toHaveTitle("Graph");
  await expect(page.locator("#global-graph canvas.sigma-nodes")).toBeVisible();
  await expect(page.locator("#graph-count")).toContainText("2 of 2 notes");

  const filterToggle = page.getByRole("button", { name: "Filters" });
  await expect(filterToggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#graph-sidebar")).toBeHidden();
  await filterToggle.click();
  await expect(page.locator("#graph-sidebar")).toBeVisible();
  await page.waitForTimeout(1_200);
  await page.getByRole("button", { name: "Fit view" }).click();
  await page.waitForTimeout(500);
  const positionsBeforeZoom = await page.evaluate(() => {
    const key = Object.keys(sessionStorage).find((item) => item.startsWith("graph-motion:"));
    return key ? JSON.parse(sessionStorage.getItem(key)!).positions : null;
  });
  expect(positionsBeforeZoom).not.toBeNull();

  const graphCanvas = page.locator("#global-graph canvas.sigma-mouse");
  await graphCanvas.hover();
  await page.mouse.wheel(0, -300);
  await page.waitForTimeout(900);
  const savedGraphSession = await page.evaluate(() =>
    Object.fromEntries(
      Object.entries(sessionStorage).filter(([key]) => key.startsWith("graph-")),
    ),
  );
  expect(Object.keys(savedGraphSession)).toEqual(
    expect.arrayContaining([expect.stringMatching(/^graph-motion:/), expect.stringMatching(/^graph-view:/)]),
  );
  expect(
    JSON.parse(Object.entries(savedGraphSession).find(([key]) => key.startsWith("graph-motion:"))![1])
      .positions,
  ).toEqual(positionsBeforeZoom);
  await page.reload();
  await expect(page.locator("#global-graph canvas.sigma-nodes")).toBeVisible();
  await expect(page.getByRole("button", { name: "Close filters" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await page.waitForTimeout(900);
  expect(
    await page.evaluate(() =>
      Object.fromEntries(
        Object.entries(sessionStorage).filter(([key]) => key.startsWith("graph-")),
      ),
    ),
  ).toEqual(savedGraphSession);
  await page.locator("#graph-tag-filter").selectOption("pkm");
  await expect(page.locator("#graph-count")).toContainText("1 of 2 notes");
  await page.waitForTimeout(800);
  await page.reload();
  await expect(page.locator("#graph-tag-filter")).toHaveValue("pkm");
  await expect(page.locator("#graph-count")).toContainText("1 of 2 notes");
  await page.locator("#graph-tag-filter").selectOption("");
  await expect(page.locator("#graph-count")).toContainText("2 of 2 notes");

  await page.locator("#graph-search").fill("Portable notes");
  await expect(page.locator("#graph-search-results button")).toHaveText("Portable notes");
  await page.locator("#graph-search-results button").click();

  const faviconHref = await page.locator('link[rel="icon"]').getAttribute("href");
  expect(faviconHref).toBe(`${base}/favicon.svg`);
  await page.evaluate(async () => {
    const href = document.querySelector<HTMLLinkElement>('link[rel="icon"]')!.href;
    const response = await fetch(href);
    if (!response.ok) throw new Error(`favicon: HTTP ${response.status}`);
  });

  const indexResponse = page.waitForResponse((response) =>
    response.url().endsWith(`${base}/search-index.json`),
  );
  await page.getByRole("button", { name: /Search/ }).click();
  await indexResponse;
  await page.keyboard.press("Escape");
  await expect(page.locator("#quick-switcher")).toBeHidden();
  await expect(page.locator("#graph-sidebar")).toBeVisible();
  await page.getByRole("button", { name: /Search/ }).click();
  await page.setViewportSize({ width: 900, height: 240 });
  const switcherInput = page.locator(".switcher input");
  for (let i = 0; i < 4; i += 1) await switcherInput.press("ArrowDown");
  const activeOptionId = await switcherInput.getAttribute("aria-activedescendant");
  expect(activeOptionId).toBeTruthy();
  expect(
    await page.locator(`#${activeOptionId}`).evaluate((option) => {
      const optionRect = option.getBoundingClientRect();
      const listRect = option.parentElement!.getBoundingClientRect();
      return optionRect.top >= listRect.top - 1 && optionRect.bottom <= listRect.bottom + 1;
    }),
  ).toBe(true);
  await page.setViewportSize({ width: 1280, height: 720 });
  await switcherInput.fill("Welcome");
  const attachmentResponse = page.waitForResponse((response) =>
    response.url().endsWith(`${base}/vault-assets/media/diagram.svg`),
  );
  await page.getByRole("option", { name: /^Welcome/ }).click();
  await expect(page).toHaveURL(new RegExp(`${base}/notes/welcome/?$`));
  await expect(page.locator(".local-graph canvas.sigma-nodes")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Connection map" })).toBeVisible();
  await expect(page.locator("article .local-graph-panel")).toHaveCount(0);
  await expect(page.locator(".local-graph-panel")).toContainText(
    "Notes up to two links away from this note.",
  );
  await expect(page.getByRole("navigation", { name: "Notes in the connection map" })).toContainText(
    "Portable notes",
  );
  await expect(page.locator("main")).toHaveCSS("max-width", "864px");
  await expect(page.locator(".local-graph")).toHaveCSS("height", "420px");

  const noteHeader = page.locator(".site-header[data-scroll-compact]");
  await page.evaluate(() => window.scrollTo(0, 400));
  await expect(noteHeader).toHaveClass(/is-compact/);
  await expect(noteHeader.locator(".site-nav")).toBeHidden();
  await expect(noteHeader.locator(".mobile-nav summary")).toBeVisible();
  await expect(noteHeader).toHaveCSS("flex-direction", "column");
  await expect(noteHeader).toHaveCSS("width", "48px");
  await expect(noteHeader.locator(".search-label")).toBeHidden();
  await expect(noteHeader.locator(".search-icon")).toBeVisible();
  const compactMenu = noteHeader.locator(".mobile-nav summary");
  await compactMenu.click();
  await page.setViewportSize({ width: 900, height: 200 });
  const compactMenuPanel = noteHeader.locator(".mobile-nav-panel");
  await expect(compactMenuPanel).toHaveCSS("overflow-y", "auto");
  expect(
    await compactMenuPanel.evaluate((panel) => panel.getBoundingClientRect().bottom <= innerHeight),
  ).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(noteHeader).toHaveClass(/is-compact/);
  await compactMenu.click();
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(noteHeader).not.toHaveClass(/is-compact/);
  await expect(noteHeader.locator(".search-trigger")).toBeFocused();
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo(0, 400);
  });
  await expect(noteHeader).toHaveClass(/is-compact/);
  const compactSearch = noteHeader.locator(".search-trigger");
  await compactSearch.click();
  await expect(page.locator("#quick-switcher")).toBeVisible();
  await expect(page.locator("#quick-switcher input")).toBeFocused();
  await expect(page.locator(".site-header-slot")).toHaveJSProperty("inert", true);
  await expect(page.locator("main")).toHaveJSProperty("inert", true);
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  await page.keyboard.press("Tab");
  await expect(page.locator("#quick-switcher input")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(compactSearch).toBeFocused();
  await expect(page.locator(".site-header-slot")).toHaveJSProperty("inert", false);
  await expect(page.locator("main")).toHaveJSProperty("inert", false);
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo(0, 180);
  });
  await expect(noteHeader).not.toHaveClass(/is-compact/);

  await attachmentResponse;
  await expect(page.locator("article img")).toHaveAttribute(
    "src",
    `${base}/vault-assets/media/diagram.svg`,
  );
  await page.getByRole("link", { name: "downloadable reference file" }).evaluate(async (link) => {
    const response = await fetch((link as HTMLAnchorElement).href);
    if (!response.ok) throw new Error(`attachment: HTTP ${response.status}`);
  });

  await page.locator(".site-nav").getByRole("link", { name: "Search" }).click();
  const searchInput = page.locator(".pagefind-ui__search-input");
  await expect(searchInput).toBeVisible();
  await searchInput.fill("public vault demonstrates");
  const resultLink = page.locator(".pagefind-ui__result-link").first();
  await expect(resultLink).toBeVisible();
  await expect(resultLink).toHaveAttribute("href", new RegExp(`^${base}/notes/`));
  await resultLink.click();
  await expect(page).toHaveURL(new RegExp(`${base}/notes/welcome/?$`));

  await page.locator(".site-nav").getByRole("link", { name: "Tags" }).click();
  await expect(page).toHaveURL(new RegExp(`${base}/tags/?$`));
  await page.getByRole("link", { name: "#demo" }).click();
  await expect(page).toHaveURL(new RegExp(`${base}/tags/demo/?$`));

  await page.goto(`${base}/graph`);
  await expect(page).toHaveURL(`${origin}${base}/`);
  await expect(page.getByRole("button", { name: "Close filters" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );

  expect([...requestedPaths]).toEqual(
    expect.arrayContaining([
      `${base}/graph-data.json`,
      `${base}/search-index.json`,
      `${base}/pagefind/pagefind-ui.css`,
      `${base}/pagefind/pagefind-ui.js`,
      `${base}/favicon.svg`,
      `${base}/vault-assets/media/diagram.svg`,
      `${base}/vault-assets/media/reference.txt`,
    ]),
  );
  expect(escapedRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("mobile navigation stays within the deployment base", async ({ page }, testInfo) => {
  const { base } = deployment(testInfo);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/`);
  const graphHeader = page.locator(".site-header");
  await expect(page.locator(".site-header-slot")).toHaveCSS("position", "fixed");
  await expect(graphHeader).toHaveCSS("flex-direction", "column");
  await expect(graphHeader).toHaveCSS("width", "48px");
  await expect(graphHeader.locator(".search-icon")).toBeVisible();
  const filterToggle = page.getByRole("button", { name: "Filters" });
  await expect(filterToggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#graph-sidebar")).toHaveJSProperty("inert", true);
  await filterToggle.click();
  await expect(page.getByRole("button", { name: "Close filters" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(page.locator("#graph-sidebar")).toHaveJSProperty("inert", false);
  await page.reload();
  await expect(page.getByRole("button", { name: "Close filters" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Filters" })).toBeFocused();
  await page.goto(`${base}/notes/welcome`);
  const localGraphCanvas = page.locator(".local-graph canvas.sigma-mouse");
  await expect(localGraphCanvas).toBeVisible();
  await localGraphCanvas.scrollIntoViewIfNeeded();
  expect(
    await localGraphCanvas.evaluate((canvas) => {
      const bounds = canvas.getBoundingClientRect();
      return document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2) === canvas;
    }),
  ).toBe(true);
  const localGraph = page.locator(".local-graph");
  await localGraphCanvas.hover();
  const beforeZoom = await localGraph.screenshot();
  const scrollBeforeZoom = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, -300);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => scrollY)).toBe(scrollBeforeZoom);
  expect((await localGraph.screenshot()).equals(beforeZoom)).toBe(false);

  const bounds = (await localGraph.boundingBox())!;
  const beforePan = await localGraph.screenshot();
  await page.mouse.move(bounds.x + bounds.width - 24, bounds.y + bounds.height - 24);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width - 64, bounds.y + bounds.height - 24, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(100);
  expect((await localGraph.screenshot()).equals(beforePan)).toBe(false);
  const noteHeader = page.locator(".site-header[data-scroll-compact]");
  await expect(page.locator(".site-header-slot")).toHaveCSS("position", "fixed");
  await expect(page.locator(".site-header-slot")).toHaveCSS("height", "0px");
  await expect(noteHeader).toHaveCSS("flex-direction", "column");
  await expect(noteHeader).toHaveCSS("width", "48px");
  await expect(noteHeader.locator(".search-label")).toBeHidden();
  await expect(noteHeader.locator(".search-icon")).toBeVisible();
  const controlPositions = await noteHeader.evaluate((header) => {
    const menu = header.querySelector("summary")!.getBoundingClientRect();
    const search = header.querySelector(".search-trigger")!.getBoundingClientRect();
    const rail = header.getBoundingClientRect();
    return {
      vertical: search.top >= menu.bottom,
      rightMargin: window.innerWidth - rail.right,
    };
  });
  expect(controlPositions.vertical).toBe(true);
  expect(controlPositions.rightMargin).toBeGreaterThanOrEqual(7);
  expect(controlPositions.rightMargin).toBeLessThanOrEqual(9);
  await noteHeader.locator(".mobile-nav summary").click();
  await page.locator(".mobile-nav-panel").getByRole("link", { name: "Recent" }).click();
  await expect(page).toHaveURL(new RegExp(`${base}/recent/?$`));
  await expect(page.locator(".site-header")).toHaveCSS("flex-direction", "column");
  await expect(page.getByRole("heading", { name: "Recently changed" })).toHaveCSS(
    "padding-right",
    "48px",
  );
});

test("touch layouts keep the local graph interactive", async ({ browser }, testInfo) => {
  const { origin, base } = deployment(testInfo);
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 900, height: 600 } });
  const page = await context.newPage();
  await page.goto(`${origin}${base}/notes/welcome`);
  const localGraphCanvas = page.locator(".local-graph canvas.sigma-mouse");
  await expect(localGraphCanvas).toBeVisible();
  await localGraphCanvas.scrollIntoViewIfNeeded();
  expect(
    await localGraphCanvas.evaluate((canvas) => {
      const bounds = canvas.getBoundingClientRect();
      return document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2) === canvas;
    }),
  ).toBe(true);
  await expect(page.locator(".site-header-slot")).toHaveCSS("position", "fixed");
  await expect(page.locator(".site-header[data-scroll-compact]")).toHaveCSS(
    "flex-direction",
    "column",
  );
  await page.goto(`${origin}${base}/tags`);
  await expect(page.locator(".site-header")).toHaveCSS("flex-direction", "column");
  await expect(page.getByRole("heading", { name: "Tags" })).toHaveCSS("padding-right", "48px");
  await context.close();
});
