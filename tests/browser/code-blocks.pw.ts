import { expect, test, type TestInfo } from "@playwright/test";

function deployment(testInfo: TestInfo) {
  const url = new URL(String(testInfo.project.use.baseURL));
  return { origin: url.origin, base: url.pathname.replace(/\/$/u, "") };
}

test("code blocks render statically with responsive light and dark styles", async ({ page }, testInfo) => {
  const { base } = deployment(testInfo);
  await page.goto(`${base}/notes/welcome`);

  const highlighted = page.locator('article pre[data-language="js"]');
  const highlightedCode = highlighted.locator("code");
  const firstToken = highlighted.locator('span[style*="--shiki-dark"]').first();
  const inlineCode = page.getByText("const portable = true", { exact: true });
  const unlabelled = page.locator("article pre", { hasText: "notes -> build -> static site" });
  const unsupported = page.locator("article pre", {
    hasText: "portable-note := markdown + links + attachments",
  });

  await expect(highlighted).toBeVisible();
  expect(await highlighted.locator('span[style*="--shiki-dark"]').count()).toBeGreaterThan(1);
  await expect(unlabelled).toHaveAttribute("data-language", "plaintext");
  await expect(unsupported).toHaveAttribute("data-language", "plaintext");
  await expect(unlabelled).toBeVisible();
  await expect(unsupported).toBeVisible();

  await expect(inlineCode).toHaveCSS("display", "inline");
  await expect(inlineCode).toHaveCSS("border-top-width", "1px");
  await expect(highlighted).toHaveCSS("border-top-width", "1px");
  await expect(highlightedCode).toHaveCSS("border-top-width", "0px");
  await expect(highlightedCode).toHaveCSS("padding-left", "0px");

  await page.emulateMedia({ colorScheme: "dark" });
  await expect(highlighted).toHaveCSS("background-color", "rgb(36, 41, 46)");
  await expect(firstToken).toHaveCSS("color", "rgb(249, 117, 131)");

  await page.emulateMedia({ colorScheme: "light" });
  await expect(highlighted).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(firstToken).toHaveCSS("color", "rgb(215, 58, 73)");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(highlighted).toHaveCSS("overflow-x", "auto");
  const overflow = await highlighted.evaluate((block) => {
    block.scrollLeft = block.scrollWidth;
    return {
      blockScrolls: block.scrollWidth > block.clientWidth && block.scrollLeft > 0,
      pageFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    };
  });
  expect(overflow).toEqual({ blockScrolls: true, pageFits: true });
});

test("syntax highlighting remains with JavaScript disabled", async ({ browser }, testInfo) => {
  const { origin, base } = deployment(testInfo);
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  await page.goto(`${origin}${base}/notes/welcome`);
  const highlighted = page.locator('article pre[data-language="js"]');
  await expect(highlighted).toBeVisible();
  expect(await highlighted.locator('span[style*="--shiki-dark"]').count()).toBeGreaterThan(1);

  await context.close();
});
