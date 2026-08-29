import { expect, test, type TestInfo } from "@playwright/test";

function deployment(testInfo: TestInfo) {
  const url = new URL(String(testInfo.project.use.baseURL));
  return { base: url.pathname.replace(/\/$/u, "") };
}

test("Markdown tables use a legible grid with contained overflow", async ({ page }, testInfo) => {
  const { base } = deployment(testInfo);
  await page.goto(`${base}/notes/portable-notes`);

  const table = page.locator("article table");
  const headerCell = table.locator("thead th").first();
  const rows = table.locator("tbody > tr");
  const bodyCell = rows.first().locator("td").first();

  await expect(table).toBeVisible();
  await expect(rows).toHaveCount(4);
  for (const cell of [headerCell, bodyCell]) {
    await expect(cell).toHaveCSS("border-top-width", "1px");
    await expect(cell).toHaveCSS("border-right-width", "1px");
    await expect(cell).toHaveCSS("border-bottom-width", "1px");
    await expect(cell).toHaveCSS("border-left-width", "1px");
  }

  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    const presentation = await table.evaluate((element) => {
      const header = element.querySelector("th");
      const bodyRows = [...element.querySelectorAll("tbody > tr")];
      if (!header || bodyRows.length < 2) throw new Error("Expected table fixture rows");
      const headerStyle = getComputedStyle(header);
      const firstRowStyle = getComputedStyle(bodyRows[0]);
      const secondRowStyle = getComputedStyle(bodyRows[1]);
      return {
        text: headerStyle.color,
        headerBackground: headerStyle.backgroundColor,
        border: headerStyle.borderTopColor,
        firstRowBackground: firstRowStyle.backgroundColor,
        secondRowBackground: secondRowStyle.backgroundColor,
      };
    });

    expect(presentation.text).not.toBe(presentation.headerBackground);
    expect(presentation.border).not.toBe(presentation.headerBackground);
    expect(presentation.firstRowBackground).not.toBe(presentation.secondRowBackground);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(table).toHaveCSS("overflow-x", "auto");
  const overflow = await table.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
    return {
      tableScrolls: element.scrollWidth > element.clientWidth && element.scrollLeft > 0,
      pageFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    };
  });
  expect(overflow).toEqual({ tableScrolls: true, pageFits: true });
});

test("Brain callouts use compact semantic fields without decorative edges", async ({ page }, testInfo) => {
  const { base } = deployment(testInfo);
  await page.goto(`${base}/notes/portable-notes`);

  const note = page.locator('article [data-callout][data-callout-type="note"]');
  const warning = page.locator('article [data-callout][data-callout-type="warning"]');
  const noteTitle = note.locator("[data-callout-title]");
  const noteBody = note.locator("[data-callout-body]");
  const warningTitle = warning.locator("[data-callout-title]");

  await expect(noteTitle).toHaveText("Plain text remains primary");
  await expect(noteBody).toContainText("Tables and callouts add structure");
  await expect(warningTitle).toHaveText("Keep links title-based");

  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    const presentation = await page.locator("article").evaluate((article) => {
      const note = article.querySelector<HTMLElement>('[data-callout-type="note"]');
      const warning = article.querySelector<HTMLElement>('[data-callout-type="warning"]');
      const noteTitle = note?.querySelector<HTMLElement>("[data-callout-title]");
      const noteBody = note?.querySelector<HTMLElement>("[data-callout-body]");
      if (!note || !warning || !noteTitle || !noteBody) throw new Error("Expected callout fixture");

      const noteStyle = getComputedStyle(note);
      const warningStyle = getComputedStyle(warning);
      const titleStyle = getComputedStyle(noteTitle);
      const bodyStyle = getComputedStyle(noteBody);
      return {
        noteBackground: noteStyle.backgroundColor,
        warningBackground: warningStyle.backgroundColor,
        borderWidths: [
          noteStyle.borderTopWidth,
          noteStyle.borderRightWidth,
          noteStyle.borderBottomWidth,
          noteStyle.borderLeftWidth,
        ],
        outline: noteStyle.outlineStyle,
        shadow: noteStyle.boxShadow,
        titleWeight: Number(titleStyle.fontWeight),
        bodyWeight: Number(bodyStyle.fontWeight),
        bodyStyle: bodyStyle.fontStyle,
      };
    });

    expect(presentation.noteBackground).not.toBe(presentation.warningBackground);
    expect(presentation.borderWidths).toEqual(["0px", "0px", "0px", "0px"]);
    expect(presentation.outline).toBe("none");
    expect(presentation.shadow).toBe("none");
    expect(presentation.titleWeight).toBeGreaterThan(presentation.bodyWeight);
    expect(presentation.bodyStyle).toBe("normal");
  }
});
