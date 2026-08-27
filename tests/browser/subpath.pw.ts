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

  const filterToggle = page.getByRole("button", { name: "Close filters" });
  await expect(filterToggle).toHaveAttribute("aria-expanded", "true");
  await filterToggle.click();
  await expect(page.locator("#graph-sidebar")).toBeHidden();
  await expect(page.getByRole("button", { name: "Filters" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await page.getByRole("button", { name: "Filters" }).click();
  await expect(page.locator("#graph-sidebar")).toBeVisible();
  await page.getByRole("button", { name: "Fit view" }).click();

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
  await page.locator(".switcher input").fill("Welcome");
  const attachmentResponse = page.waitForResponse((response) =>
    response.url().endsWith(`${base}/vault-assets/media/diagram.svg`),
  );
  await page.getByRole("option", { name: /^Welcome/ }).click();
  await expect(page).toHaveURL(new RegExp(`${base}/notes/welcome/?$`));
  await expect(page.locator(".local-graph canvas.sigma-nodes")).toBeVisible();
  await expect(page.locator("main")).toHaveCSS("max-width", "864px");
  await expect(page.locator(".local-graph")).toHaveCSS("height", "420px");

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
  await page.setViewportSize({ width: 900, height: 844 });
  await page.goto(`${base}/`);
  await page.locator("#graph-search").focus();
  await page.setViewportSize({ width: 390, height: 844 });
  const filterToggle = page.getByRole("button", { name: "Filters" });
  await expect(filterToggle).toBeFocused();
  await expect(filterToggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#graph-sidebar")).toHaveJSProperty("inert", true);
  await filterToggle.click();
  await expect(page.getByRole("button", { name: "Close filters" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(page.locator("#graph-sidebar")).toHaveJSProperty("inert", false);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Filters" })).toBeFocused();
  await page.locator(".mobile-nav summary").click();
  await page.locator(".mobile-nav-panel").getByRole("link", { name: "Recent" }).click();
  await expect(page).toHaveURL(new RegExp(`${base}/recent/?$`));
});
