import { expect, test, type TestInfo } from "@playwright/test";

const highlightedSource = `const vault = {
  format: "plain Markdown",
  published: true,
};

const longArchiveUrl = new URL("https://example.com/archive/portable-notes/with/a/path/long/enough/to/require/horizontal-scrolling/on/a/phone-sized-screen");
console.log(vault, longArchiveUrl);`;

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

  const lines = highlighted.locator("code > .line");
  await expect(lines).toHaveCount(7);
  expect(await lines.nth(4).textContent()).toBe("");
  await expect(highlightedCode).toHaveCSS("counter-reset", "code-line 0");
  const lineCounters = await lines.evaluateAll((elements) =>
    elements.map((line) => ({
      increment: getComputedStyle(line).counterIncrement,
      content: getComputedStyle(line, "::before").content,
    })),
  );
  expect(lineCounters).toEqual(
    Array.from({ length: 7 }, () => ({ increment: "code-line 1", content: "counter(code-line)" })),
  );
  expect(
    await unlabelled.locator("code > .line").first().evaluate((line) => ({
      increment: getComputedStyle(line).counterIncrement,
      content: getComputedStyle(line, "::before").content,
    })),
  ).toEqual({ increment: "none", content: "none" });

  await expect(inlineCode).toHaveCSS("display", "inline");
  await expect(inlineCode).toHaveCSS("border-top-width", "0px");
  await expect(highlighted).toHaveCSS("border-top-width", "0px");
  await expect(highlightedCode).toHaveCSS("border-top-width", "0px");
  await expect(highlightedCode).toHaveCSS("padding-left", "0px");

  await page.emulateMedia({ colorScheme: "dark" });
  await expect(highlighted).toHaveCSS("background-color", "rgb(26, 26, 32)");
  await expect(firstToken).toHaveCSS("color", "rgb(249, 117, 131)");

  await page.emulateMedia({ colorScheme: "light" });
  await expect(highlighted).toHaveCSS("background-color", "rgb(242, 241, 236)");
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

test("copy controls copy exact code with keyboard feedback", async ({ context, page }, testInfo) => {
  const { origin, base } = deployment(testInfo);
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
  await page.goto(`${base}/notes/welcome`);

  const blocks = page.locator("article .code-block");
  const highlighted = blocks.filter({ has: page.locator('pre[data-language="js"]') });
  const plain = blocks.filter({ has: page.locator('pre[data-language="plaintext"]') });
  const highlightedButton = highlighted.locator("button.code-block-copy");

  await expect(blocks).toHaveCount(3);
  await expect(highlightedButton).toHaveAccessibleName("Copy code");
  await highlightedButton.focus();
  await expect(highlightedButton).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(highlightedButton).toBeFocused();
  await expect(highlightedButton).toHaveAccessibleName("Copied");
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(highlightedSource);

  const plainButtons = plain.locator("button.code-block-copy");
  await expect(plainButtons).toHaveCount(2);
  await plainButtons.first().click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(
    "notes -> build -> static site",
  );
  await plainButtons.last().click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(
    "portable-note := markdown + links + attachments",
  );
});

test("syntax highlighting remains with JavaScript disabled", async ({ browser }, testInfo) => {
  const { origin, base } = deployment(testInfo);
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  await page.goto(`${origin}${base}/notes/welcome`);
  const highlighted = page.locator('article pre[data-language="js"]');
  await expect(highlighted).toBeVisible();
  await expect(highlighted).toContainText("const longArchiveUrl");
  expect(await highlighted.locator('span[style*="--shiki-dark"]').count()).toBeGreaterThan(1);
  await expect(page.getByRole("button", { name: "Copy code" })).toHaveCount(0);

  await context.close();
});
