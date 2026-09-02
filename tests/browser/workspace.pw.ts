import { expect, test, type Locator, type Page } from "@playwright/test";
import fs from "node:fs";

const packageMetadata = JSON.parse(
  fs.readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as { version: string };

const workspace = "http://127.0.0.1:4331/workspace-demo";

async function renderedLabelTarget(page: Page, graph: Locator, excludeNode?: string | null) {
  const label = await graph.locator("canvas.sigma-labels").evaluate((canvas) => {
    const element = canvas as HTMLCanvasElement;
    const context = element.getContext("2d")!;
    const pixels = context.getImageData(0, 0, element.width, element.height).data;
    const bands: { top: number; bottom: number; left: number; right: number }[] = [];
    let band: (typeof bands)[number] | null = null;
    for (let y = 0; y < element.height; y += 1) {
      let left = element.width;
      let right = -1;
      for (let x = 0; x < element.width; x += 1) {
        if (pixels[(y * element.width + x) * 4 + 3] === 0) continue;
        left = Math.min(left, x);
        right = x;
      }
      if (right < 0) {
        if (band) bands.push(band);
        band = null;
      } else if (band) {
        band.bottom = y;
        band.left = Math.min(band.left, left);
        band.right = Math.max(band.right, right);
      } else {
        band = { top: y, bottom: y, left, right };
      }
    }
    if (band) bands.push(band);
    const longest = bands.sort((a, b) => b.right - b.left - (a.right - a.left))[0];
    if (!longest) throw new Error("No rendered graph title found");
    const bounds = element.getBoundingClientRect();
    return {
      left: bounds.left + (longest.left / element.width) * bounds.width,
      right: bounds.left + (longest.right / element.width) * bounds.width,
      y: bounds.top + ((longest.top + longest.bottom) / 2 / element.height) * bounds.height,
    };
  });
  for (let x = label.left; x <= label.right; x += 2) {
    await page.mouse.move(x, label.y);
    const canvasTarget = await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y) instanceof HTMLCanvasElement,
      { x, y: label.y },
    );
    if (
      canvasTarget &&
      (await graph.evaluate((host) => host.style.cursor)) === "pointer" &&
      await graph.getAttribute("data-transient-inspection") !== excludeNode
    ) {
      return { x, y: label.y };
    }
  }
  const target = await graph.evaluate((host, excluded) => {
    const bounds = host.getBoundingClientRect();
    for (let y = 60; y < bounds.height; y += 3) {
      for (let x = 2; x < bounds.width; x += 3) {
        host.dispatchEvent(new PointerEvent("pointermove", {
          bubbles: true,
          clientX: bounds.left + x,
          clientY: bounds.top + y,
          pointerType: "mouse",
        }));
        if (host.dataset.transientInspection && host.dataset.transientInspection !== excluded) {
          return { x: bounds.left + x, y: bounds.top + y };
        }
      }
    }
    return null;
  }, excludeNode ?? null);
  if (target) return target;
  throw new Error("No interactive graph title target found");
}

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-root", "Workspace behavior needs one browser project.");
});

test("desktop chooser follows hierarchy and keeps brain context in graph controls", async ({ page }) => {
  await page.goto(`${workspace}/`);

  await expect(page).toHaveTitle("Demo Brain workspace");
  await expect(page.getByRole("heading", { name: "Knowledge" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Product" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Discovery" })).toBeVisible();
  await expect(page.locator(".brain-card")).toHaveCount(4);
  await expect(page.locator(".site-header .context-switcher")).toHaveCount(0);
  await expect(page.locator(".context-switcher")).toHaveCount(0);

  await page.getByRole("link", { name: "Enter Engineering" }).click();
  await expect(page).toHaveURL(`${workspace}/brains/engineering`);
  await expect(page.locator(".context-switcher > summary"))
    .toHaveAttribute("aria-label", "Brain context: Engineering");
  await expect(page.locator(".graph-controls > .context-switcher")).toHaveCount(1);
  await expect(page.locator(".site-header .context-switcher")).toHaveCount(0);
  await expect(page.locator("#global-graph canvas.sigma-nodes")).toBeVisible();

  await page.getByRole("button", { name: "Navigation" }).click();
  await expect(page.locator(".site-header").getByRole("link", { name: "Graph" }))
    .toHaveAttribute("href", "/workspace-demo/brains/engineering");
  await expect(page.locator(".nav-actions").getByRole("link", { name: "Tags" }))
    .toHaveAttribute("href", "/workspace-demo/brains/engineering/tags");
  await page.locator(".context-switcher > summary").click();
  const contextPanel = page.locator(".context-switcher__panel");
  await expect(contextPanel.getByRole("checkbox", { name: "@engineering" })).toBeChecked();
  await contextPanel.getByRole("checkbox", { name: "@engineering" }).uncheck();
  await contextPanel.getByRole("checkbox", { name: "@design" }).check();
  await contextPanel.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(`${workspace}/brains/design`);
  await expect(page.locator(".context-switcher > summary"))
    .toHaveAttribute("title", "Brain context: Design");
  await page.locator(".context-switcher > summary").click();
  await page.locator(".context-switcher__panel").getByRole("checkbox", { name: "@design" }).uncheck();
  await page.locator(".context-switcher__panel").getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(`${workspace}/`);
});

test("workspace navigation is standalone, ordered, and viewport-safe", async ({ page }) => {
  await page.goto(`${workspace}/brains/engineering/notes/principles`);

  const header = page.locator(".site-header");
  const launcher = header.getByRole("button", { name: "Navigation" });
  const search = header.locator(".search-trigger");
  const reports = header.locator(".nav-direct-action").all();
  await expect(launcher).toHaveAttribute("aria-expanded", "false");
  await expect(header.locator(".nav-actions")).toHaveJSProperty("inert", true);
  await launcher.click();
  await expect(header).toHaveCSS("border-top-width", "0px");
  await expect(header).toHaveCSS("width", "48px");
  await expect(header.locator(".context-switcher")).toHaveCount(0);
  await expect(header.locator(".nav-menu-pill")).toHaveCSS("border-top-width", "1px");
  await expect((await reports).at(-1)!).toHaveCSS("transform", "none");

  const geometry = await header.evaluate((pill) => {
    const controls = [
      pill.querySelector(".search-trigger"),
      ...pill.querySelectorAll(".nav-direct-action"),
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

  await launcher.focus();
  await page.keyboard.press("Tab");
  await expect(search).toBeFocused();
  await page.keyboard.press("Tab");
  await expect((await reports)[0]).toBeFocused();

  await expect(header.locator(".nav-menu")).toHaveCount(0);
  await expect(header.locator(".nav-actions > .nav-action").evaluateAll((controls) =>
    controls.filter((control) => !(control as HTMLElement).hidden).map((control) => control.getAttribute("aria-label"))
  )).resolves.toEqual(["Search", "Tags", "Recent", "Orphans"]);
  for (const control of [launcher, search, ...(await reports)]) {
    await expect(control).toHaveAttribute("title", await control.getAttribute("aria-label") ?? "");
  }

  await search.click();
  await expect(launcher).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByLabel("Search notes and tags")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(launcher).toBeFocused();
});

test("Home stays visible while About and generator provenance remain on the chooser", async ({ page }) => {
  await page.goto(`${workspace}/brains/engineering/notes/principles`);
  await expect(page.locator('meta[name="generator"]')).toHaveAttribute(
    "content",
    `Brain v${packageMetadata.version}`,
  );
  const home = page.getByRole("link", { name: "Home" });
  const noteGraph = page.locator(".page-note-nav").getByRole("link", { name: "Graph" });
  await expect(home).toHaveAttribute("href", "/workspace-demo/");
  await expect(noteGraph).toHaveAttribute("href", "/workspace-demo/brains/engineering");
  expect(await home.evaluate((link) => {
    const homeBounds = link.getBoundingClientRect();
    const noteNavigationBounds = document.querySelector(".page-note-nav")!.getBoundingClientRect();
    const navigationBounds = document.querySelector(".site-header")!.getBoundingClientRect();
    return {
      homeWidth: homeBounds.width,
      homeHeight: homeBounds.height,
      noteNavigationWidth: noteNavigationBounds.width,
      navigationWidth: navigationBounds.width,
      navigationTop: navigationBounds.top,
      homeTop: homeBounds.top,
      leftInset: homeBounds.left,
      rightInset: innerWidth - navigationBounds.right,
    };
  })).toEqual({
    homeWidth: 44,
    homeHeight: 44,
    noteNavigationWidth: 96,
    navigationWidth: 48,
    navigationTop: 12,
    homeTop: 16,
    leftInset: 16,
    rightInset: 12,
  });
  await page.getByRole("button", { name: "Navigation" }).click();
  await expect(page.locator(".site-header").getByRole("link", { name: "Graph" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Brains" })).toHaveCount(0);
  await expect(page.locator(".site-header").getByRole("button", { name: "About" })).toHaveCount(0);
  await home.click();
  await expect(page).toHaveURL(`${workspace}/`);
  await expect(page.getByRole("link", { name: "Home" })).toHaveCount(0);
  const about = page.getByRole("button", { name: "About" });
  await about.click();
  await expect(about).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByLabel("About Brain")).toContainText(`Brain v${packageMetadata.version}`);
  await expect(page.getByLabel("About Brain").locator(".about-version")).toHaveCSS("user-select", "text");
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("About Brain")).toBeHidden();
  await expect(about).toBeFocused();

  await page.goto(`${workspace}/brains/engineering`);
  const graphHome = page.locator(".graph-controls").getByRole("link", { name: "Home" });
  await expect(graphHome).toHaveAttribute("href", "/workspace-demo/");
  await expect(graphHome.locator("xpath=following-sibling::*[1]"))
    .toHaveAttribute("aria-label", "Filters");
});

test("combined note browsing retains scope across unpinned and focused Graph actions", async ({ page }) => {
  await page.goto(`${workspace}/brains/engineering/notes/principles?brains=engineering,design`);
  await expect(page.locator("article")).toHaveAttribute("data-brain-id", "engineering");

  for (const href of await page.locator("a[data-note-route]").evaluateAll((anchors) =>
    anchors.map((anchor) => (anchor as HTMLAnchorElement).href)
  )) {
    expect(new URL(href).searchParams.get("brains")).toBe("engineering,design");
  }

  await expect(page.locator(".page-note-nav").getByRole("link", { name: "Graph" })).toHaveAttribute(
    "href",
    "/workspace-demo/graph?brains=engineering,design",
  );
  await expect(page.getByRole("link", { name: "Open full graph" })).toHaveAttribute(
    "href",
    "/workspace-demo/graph?brains=engineering,design&focus=engineering%2Fprinciples",
  );
  await expect(page.locator(".note-focus-action")).toHaveAttribute(
    "href",
    "/workspace-demo/graph?brains=engineering,design&focus=engineering%2Fprinciples",
  );
  await page.getByRole("button", { name: "Navigation" }).click();
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByLabel("Quick switcher scope")).toHaveValue("selected");
  await page.getByLabel("Search notes and tags").fill("Principles");
  await page.locator("#switcher-results li", { hasText: "@design" }).click();
  await expect(page).toHaveURL(
    `${workspace}/brains/design/notes/principles?brains=engineering,design`,
  );
  await expect(page.locator("article")).toHaveAttribute("data-brain-id", "design");
  await expect(page.locator(".page-note-nav").getByRole("link", { name: "Graph" })).toHaveAttribute(
    "href",
    "/workspace-demo/graph?brains=engineering,design",
  );
});

test("fresh visitors can return from shared notes to the originating focused graph", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${workspace}/graph?brains=engineering,design`);
  await page.getByRole("button", { name: "Filters" }).click();
  await page.locator("#graph-search").fill("Principles");
  await page.locator("#graph-search-results button", { hasText: "@engineering" }).click();

  const openFocusedNote = page.locator("[data-graph-focus-open]");
  await expect(openFocusedNote).toHaveAttribute(
    "href",
    "/workspace-demo/brains/engineering/notes/principles?brains=engineering,design&focus=engineering%2Fprinciples",
  );
  await openFocusedNote.click();
  await expect(page.locator("article")).toHaveAttribute("data-brain-id", "engineering");
  const graphAction = page.locator(".page-note-nav").getByRole("link", { name: "Graph" });
  await expect(graphAction).toHaveAttribute(
    "href",
    "/workspace-demo/graph?brains=engineering,design&focus=engineering%2Fprinciples",
  );
  await graphAction.click();
  await expect(page.locator("#global-graph")).toHaveAttribute(
    "data-focused-node",
    "engineering/principles",
  );

  await page.goto(
    `${workspace}/brains/design/notes/principles?brains=engineering,design&focus=engineering%2Fprinciples`,
  );
  await expect(page.locator("article")).toHaveAttribute("data-brain-id", "design");
  await expect(graphAction).toHaveAttribute(
    "href",
    "/workspace-demo/graph?brains=engineering,design&focus=engineering%2Fprinciples",
  );
  await graphAction.click();
  await expect(page.locator("#global-graph")).toHaveAttribute(
    "data-focused-node",
    "engineering/principles",
  );

  await page.goto(
    `${workspace}/brains/design/notes/principles?brains=engineering,design&focus=research%2Fevidence`,
  );
  await expect(graphAction).toHaveAttribute(
    "href",
    "/workspace-demo/graph?brains=engineering,design",
  );
  await context.close();
});

test("an isolated note keeps a visible focused-neighborhood action", async ({ page }) => {
  await page.goto(`${workspace}/brains/research-archive-and-synthesis-source-trails/notes/archive-boundaries`);
  await expect(page.locator(".local-graph-panel")).toHaveCount(0);
  const action = page.locator(".note-focus-action");
  await expect(action).toBeVisible();
  await expect(action).toHaveAttribute(
    "href",
    "/workspace-demo/brains/research-archive-and-synthesis-source-trails?focus=research-archive-and-synthesis-source-trails%2Farchive-boundaries",
  );
});

test("every note-navigation surface traverses without losing combined scope", async ({ page }) => {
  const scope = "brains=engineering,design";
  const expectRetainedScope = async () => {
    await expect.poll(() => new URL(page.url()).searchParams.get("brains")).toBe("engineering,design");
  };

  await page.goto(`${workspace}/graph?${scope}`);
  const globalGraph = page.locator("#global-graph");
  await expect(globalGraph.locator("canvas.sigma-labels")).toBeVisible();
  await page.waitForTimeout(500);
  let target = await renderedLabelTarget(page, globalGraph);
  await page.mouse.click(target.x, target.y);
  await expect.poll(() => new URL(page.url()).pathname).toContain("/notes/");
  await expectRetainedScope();
  await page.locator(".page-note-nav").getByRole("link", { name: "Graph" }).click();
  await expect(page).toHaveURL(`${workspace}/graph?${scope}`);
  await expect(page.locator("#global-graph")).not.toHaveAttribute("data-focused-inspection");

  const note = `${workspace}/brains/engineering/notes/principles?${scope}`;
  for (const selector of ["article a.wiki-link", ".mentions a", ".local-graph-links a"]) {
    await page.goto(note);
    const startingPath = new URL(page.url()).pathname;
    const link = page.locator(selector).first();
    await expect(link).toBeVisible();
    await link.click();
    await expect.poll(() => new URL(page.url()).pathname).not.toBe(startingPath);
    await expectRetainedScope();
  }

  await page.goto(note);
  const localGraph = page.locator(".local-graph");
  await expect(localGraph.locator("canvas.sigma-labels")).toBeVisible();
  await localGraph.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  target = await renderedLabelTarget(page, localGraph, await localGraph.getAttribute("data-slug"));
  await page.mouse.click(target.x, target.y);
  await expect.poll(() => new URL(page.url()).pathname).not.toBe(new URL(note).pathname);
  await expectRetainedScope();
});

test("standalone navigation clears a wrapped long note title", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    `${workspace}/brains/research-archive-and-synthesis-source-trails/notes/synthesis-trails`,
  );
  const heading = page.locator("main h1");
  await heading.evaluate((element) => {
    element.textContent = "Synthesis trails preserve context across responsive graph inspection";
  });

  const titleGeometry = await heading.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const textRects = [...range.getClientRects()];
    const controls = [
      document.querySelector(".page-note-nav")!.getBoundingClientRect(),
      document.querySelector(".nav-menu-pill")!.getBoundingClientRect(),
    ];
    return {
      lines: textRects.length,
      overlaps: textRects.some((text) => controls.some((control) => !(
        text.right <= control.left || text.left >= control.right ||
        text.bottom <= control.top || text.top >= control.bottom
      ))),
    };
  });
  expect(titleGeometry.overlaps).toBe(false);
  expect(titleGeometry.lines).toBeGreaterThan(1);
});

test("Brain identity reuses one mark and reserves accent boundaries for selection", async ({ page }) => {
  await page.goto(`${workspace}/`);

  const cards = page.locator(".brain-card");
  const chooserMarks = cards.locator("[data-brain-mark]");
  await expect(cards).toHaveCount(4);
  await expect(chooserMarks).toHaveCount(4);
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

  const checkbox = page.getByRole("checkbox", { name: "Combine Engineering" });
  await checkbox.check();
  await expect(checkbox).toBeChecked();
  const engineeringAfter = await boundary(engineering);
  expect(engineeringAfter.widths).toEqual(["1px", "1px", "1px", "1px"]);
  expect(new Set(engineeringAfter.colors).size).toBe(1);
  expect(engineeringAfter.colors[0]).not.toBe(engineeringBefore.colors[0]);
  expect(engineeringAfter.background).not.toBe(engineeringBefore.background);
  expect(await boundary(design)).toEqual(designBefore);

  await page.getByRole("link", { name: "Enter Engineering" }).click();
  const currentMark = page.locator(".graph-controls > .context-switcher > summary [data-brain-mark]");
  await expect(page.locator(".context-switcher > summary"))
    .toHaveAttribute("title", "Brain context: Engineering");
  await expect(currentMark).toHaveCSS("width", "16px");
  await expect(currentMark.locator("path")).toHaveAttribute("d", markGeometry!);
  await page.locator(".context-switcher > summary").click();
  for (const id of ["engineering", "design", "research", "research-archive-and-synthesis-source-trails"]) {
    const entry = page.locator(`.context-switcher__panel label:has(input[value="${id}"])`);
    await expect(entry).toBeVisible();
    await expect(entry.locator("[data-brain-mark] path")).toHaveAttribute("d", markGeometry!);
  }
  await expect(page.locator('.context-switcher__panel input[value="engineering"]')).toBeChecked();
  await expect(page.locator(".site-header .context-switcher")).toHaveCount(0);

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

test("chooser cards align wrapped identities on desktop and retain natural phone flow", async ({ page }) => {
  const longId = "research-archive-and-synthesis-source-trails";
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.goto(`${workspace}/`);

  const shortCard = page.locator('.brain-card:has(input[value="research"])');
  const longCard = page.locator(`.brain-card:has(input[value="${longId}"])`);
  const geometry = async () => Promise.all([shortCard, longCard].map((card) => card.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const rect = (selector: string) => {
      const target = element.querySelector(selector)!;
      const targetBounds = target.getBoundingClientRect();
      return { top: targetBounds.top, bottom: targetBounds.bottom, height: targetBounds.height };
    };
    return {
      card: { top: bounds.top, right: bounds.right, bottom: bounds.bottom },
      identity: rect(".brain-card__identity"),
      title: rect("h3"),
      description: rect("p"),
      action: rect(":scope > a"),
    };
  })));
  const [shortDesktop, longDesktop] = await geometry();
  expect(longDesktop.card.top).toBe(shortDesktop.card.top);
  expect(longDesktop.card.bottom).toBe(shortDesktop.card.bottom);
  expect(longDesktop.identity).toEqual(shortDesktop.identity);
  expect(longDesktop.title.top).toBe(shortDesktop.title.top);
  expect(longDesktop.description.top).toBe(shortDesktop.description.top);
  expect(longDesktop.action).toEqual(shortDesktop.action);
  await expect(longCard.locator(".brain-card__identity > span")).toHaveText(`@${longId}`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  const [shortPhone, longPhone] = await geometry();
  expect(longPhone.identity.height).toBeGreaterThan(shortPhone.identity.height);
  expect(longPhone.card.right).toBeLessThanOrEqual(390);
  await expect(longCard.locator(".brain-card__identity > span")).toHaveText(`@${longId}`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("note metadata identifies owning brains and wraps long IDs", async ({ page }) => {
  for (const fixture of [
    { route: "/brains/engineering/notes/principles", id: "engineering", title: "Engineering" },
    {
      route: "/brains/research-archive-and-synthesis-source-trails/notes/synthesis-trails",
      id: "research-archive-and-synthesis-source-trails",
      title: "Research Archive",
    },
  ]) {
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.goto(`${workspace}${fixture.route}`);
      const metadata = page.locator(".note-meta");
      const brain = metadata.locator(".note-brain");
      await expect(brain).toHaveAttribute("aria-label", `Brain: ${fixture.title} (@${fixture.id})`);
      await expect(brain.locator("[data-brain-mark]")).toBeVisible();
      await expect(brain.locator(".note-brain__id")).toHaveText(`@${fixture.id}`);
      await expect(metadata.locator(".chip")).toBeVisible();
      await expect(metadata.locator(".status")).toBeVisible();
      expect(await brain.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.left >= 0 && bounds.right <= innerWidth && document.documentElement.scrollWidth <= innerWidth;
      })).toBe(true);
      await expect(page.locator(".site-header .context-switcher")).toHaveCount(0);
    }
  }
});

test("combined selection is canonical, shareable, reloadable, and rejects unknown brains", async ({ page }) => {
  await page.goto(`${workspace}/`);
  await expect(page.locator(".brain-selection__action")).toBeHidden();
  await page.getByRole("checkbox", { name: "Combine Engineering" }).check();
  await expect(page.locator(".brain-selection__action")).toContainText("Choose another Brain");
  await expect(page.getByRole("link", { name: "Enter Engineering" })).toBeVisible();
  await page.getByRole("checkbox", { name: "Combine Design" }).check();
  await expect(page.getByRole("button", { name: "Open combined graph" })).toBeEnabled();
  await page.getByRole("button", { name: "Open combined graph" }).click();

  await expect(page).toHaveURL(`${workspace}/graph?brains=engineering,design`);
  await expect(page.locator(".context-switcher > summary"))
    .toHaveAttribute("aria-label", "Brain context: 2 brains combined");
  await expect(page.locator(".context-switcher__satellite")).toBeVisible();
  await expect(page.locator(".combined-context, .graph-brain-filters")).toHaveCount(0);
  await expect(page.locator("#graph-sidebar input[name='brain-context']")).toHaveCount(0);
  await expect(page.locator(".site-header .context-switcher")).toHaveCount(0);
  await expect(page.locator(".graph-controls > :last-child")).toHaveClass(/context-switcher/);
  await page.reload();
  await expect(page).toHaveURL(`${workspace}/graph?brains=engineering,design`);
  await expect(page.locator("#global-graph canvas.sigma-nodes")).toBeVisible();

  await page.locator(".context-switcher > summary").click();
  const panel = page.locator(".context-switcher__panel");
  await expect(panel.getByRole("checkbox", { name: "@engineering" })).toBeChecked();
  await expect(panel.getByRole("checkbox", { name: "@design" })).toBeChecked();
  await panel.getByRole("checkbox", { name: "@design" }).uncheck();
  await panel.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(`${workspace}/brains/engineering`);
  await page.locator(".context-switcher > summary").click();
  await page.locator(".context-switcher__panel").getByRole("checkbox", { name: "@engineering" }).uncheck();
  await page.locator(".context-switcher__panel").getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(`${workspace}/`);

  await page.goto(`${workspace}/graph?brains=design,engineering,design`);
  await expect(page).toHaveURL(`${workspace}/graph?brains=engineering,design`);

  await page.goto(`${workspace}/graph?brains=engineering,unknown`);
  await expect(page.getByRole("alert")).toContainText("Unknown Brain: @unknown");
  await expect(page.locator("[data-combined-graph]")).toBeHidden();
  await page.getByRole("link", { name: "Return to the Brain chooser" }).click();
  await expect(page).toHaveURL(`${workspace}/`);

  await page.goto(`${workspace}/graph?brains=engineering,design&brains=unknown`);
  await expect(page.getByRole("alert")).toContainText("must contain one brains parameter");
  await expect(page.locator("[data-combined-graph]")).toBeHidden();
});

test("mobile chooser and combined selection remain usable without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${workspace}/`);

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const launcher = page.getByRole("button", { name: "Navigation" });
  await expect(launcher).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".nav-actions")).toHaveJSProperty("inert", true);
  await expect(page.locator(".context-switcher")).toHaveCount(0);
  await launcher.click();
  await expect(launcher).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("link", { name: "Graph" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Search" })).toBeVisible();
  await expect(page.getByRole("button", { name: "About" })).toBeVisible();
  await expect(page.locator(".nav-direct-action")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(launcher).toBeFocused();
  await page.getByRole("checkbox", { name: "Combine Engineering" }).check();
  await page.getByRole("checkbox", { name: "Combine Research", exact: true }).check();
  const action = page.locator(".brain-selection__action");
  await expect(action).toBeVisible();
  await action.getByRole("button", { name: "Open combined graph" }).click();

  await expect(page).toHaveURL(`${workspace}/graph?brains=engineering,research`);
  await expect(page.locator(".context-switcher > summary"))
    .toHaveAttribute("aria-label", "Brain context: 2 brains combined");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const combinedLauncher = page.getByRole("button", { name: "Navigation" });
  await combinedLauncher.click();
  await expect(page.locator(".graph-trigger"))
    .toHaveAttribute("href", "/workspace-demo/graph?brains=engineering,research");
  await expect(page.locator(".graph-trigger")).toBeHidden();
  await expect(page.getByRole("button", { name: "Search" })).toBeVisible();
  await expect(page.locator(".nav-direct-action")).toHaveCount(0);
  await page.locator(".context-switcher > summary").click();
  const mobilePanel = page.locator(".context-switcher__panel");
  await expect(mobilePanel.getByRole("checkbox", { name: "@engineering" })).toBeChecked();
  await expect(mobilePanel.getByRole("checkbox", { name: "@research", exact: true })).toBeChecked();
  await mobilePanel.getByRole("checkbox", { name: "@engineering" }).uncheck();
  await mobilePanel.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(`${workspace}/brains/research`);
  await page.locator(".context-switcher > summary").click();
  await page.locator(".context-switcher__panel").getByRole("checkbox", { name: "@research", exact: true }).uncheck();
  await page.locator(".context-switcher__panel").getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(`${workspace}/`);
});

test("persistent context and graph controls stay contained across supported widths", async ({ page }) => {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(`${workspace}/graph?brains=engineering,design`);
    const geometry = await page.evaluate(() => {
      const navigation = document.querySelector(".site-header")!.getBoundingClientRect();
      const controls = document.querySelector(".graph-controls")!.getBoundingClientRect();
      return {
        navigationContained: navigation.left >= 0 && navigation.right <= innerWidth,
        controlsContained: controls.left >= 0 && controls.right <= innerWidth,
        overlap: !(
          controls.right <= navigation.left ||
          controls.left >= navigation.right ||
          controls.bottom <= navigation.top ||
          controls.top >= navigation.bottom
        ),
        noOverflow: document.documentElement.scrollWidth <= innerWidth,
      };
    });
    expect(geometry).toEqual({
      navigationContained: true,
      controlsContained: true,
      overlap: false,
      noOverflow: true,
    });

    await page.getByRole("button", { name: "Legend" }).click();
    expect(await page.getByRole("region", { name: "Graph legend" }).evaluate((panel) => {
      const bounds = panel.getBoundingClientRect();
      return bounds.left >= 0 && bounds.top >= 0 && bounds.right <= innerWidth && bounds.bottom <= innerHeight;
    })).toBe(true);

    await page.locator(".context-switcher > summary").click();
    expect(await page.locator(".context-switcher__panel").evaluate((panel) => {
      const bounds = panel.getBoundingClientRect();
      return bounds.left >= 0 && bounds.right <= innerWidth && bounds.bottom <= innerHeight;
    })).toBe(true);
  }

  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(`${workspace}/brains/engineering`);
  const activeBrainGeometry = await page.evaluate(() => {
    const navigation = document.querySelector(".site-header")!.getBoundingClientRect();
    const controls = document.querySelector(".graph-controls")!.getBoundingClientRect();
    const children = [...document.querySelectorAll(".graph-controls > *")]
      .map((control) => control.getBoundingClientRect())
      .filter((control) => control.width > 0);
    return {
      childrenContained: children.every((control) =>
        control.left >= controls.left && control.right <= controls.right
      ),
      overlap: !(controls.right <= navigation.left || controls.left >= navigation.right),
      noOverflow: document.documentElement.scrollWidth <= innerWidth,
    };
  });
  expect(activeBrainGeometry).toEqual({ childrenContained: true, overlap: false, noOverflow: true });
});

test("active-brain mobile launcher has direct actions and predictable disclosure focus", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(`${workspace}/brains/engineering/notes/principles`);

  const header = page.locator(".site-header");
  const launcher = page.getByRole("button", { name: "Navigation" });
  await expect(launcher).toHaveAttribute("aria-expanded", "false");
  await expect(header.locator(".graph-trigger")).toHaveCount(0);
  const noteNavigation = page.locator(".page-note-nav");
  await expect(noteNavigation.getByRole("link", { name: "Graph" })).toBeVisible();
  for (const action of await noteNavigation.getByRole("link").all()) {
    await expect(action).toHaveAttribute("title", await action.getAttribute("aria-label") ?? "");
    await expect(action).toHaveCSS("width", "44px");
    await expect(action).toHaveCSS("height", "44px");
  }
  expect(await noteNavigation.evaluate((pill) => {
    const bounds = pill.getBoundingClientRect();
    const heading = document.querySelector("main h1")!.getBoundingClientRect();
    const menu = document.querySelector(".site-header")!.getBoundingClientRect();
    const overlaps = (other: DOMRect) => !(
      bounds.right <= other.left || bounds.left >= other.right ||
      bounds.bottom <= other.top || bounds.top >= other.bottom
    );
    return {
      inViewport: bounds.left >= 0 && bounds.right <= innerWidth,
      overlapsHeading: overlaps(heading),
      overlapsMenu: overlaps(menu),
    };
  })).toEqual({ inViewport: true, overlapsHeading: false, overlapsMenu: false });
  await expect(header.locator(".search-trigger")).toHaveCSS("opacity", "0");
  expect(await header.evaluate((pill) => {
    const bounds = pill.getBoundingClientRect();
    return bounds.left >= 0 && bounds.right <= innerWidth && document.documentElement.scrollWidth <= innerWidth;
  })).toBe(true);
  await expect(header).toHaveCSS("width", "48px");
  await expect(header.locator(".context-switcher")).toHaveCount(0);

  await launcher.focus();
  await expect(launcher).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(launcher).toHaveAttribute("aria-expanded", "true");
  expect(await header.evaluate((pill) => {
    const launcherBounds = pill.querySelector(".nav-launcher")!.getBoundingClientRect();
    const actionsBounds = pill.querySelector(".nav-actions")!.getBoundingClientRect();
    return {
      width: actionsBounds.width,
      aligned: Math.abs(
        (actionsBounds.left + actionsBounds.right) / 2 -
        (launcherBounds.left + launcherBounds.right) / 2,
      ) < 1,
    };
  })).toEqual({ width: 40, aligned: true });
  await page.keyboard.press("Tab");
  const search = header.getByRole("button", { name: "Search" });
  await expect(search).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(header.getByRole("link", { name: "Tags" })).toBeFocused();
  await expect(header.getByRole("link", { name: "Tags" }))
    .toHaveAttribute("href", "/workspace-demo/brains/engineering/tags");
  await expect(header.getByRole("link", { name: "Recent" })).toBeVisible();
  await expect(header.getByRole("link", { name: "Orphans" })).toBeVisible();
  await expect(header.locator(".nav-menu")).toHaveCount(0);

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

test("launcher is bounded in short viewports and disables motion when requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 240 });
  await page.goto(`${workspace}/brains/engineering/notes/principles`);

  const launcher = page.getByRole("button", { name: "Navigation" });
  const actions = page.locator(".nav-actions");
  const collapsed = await page.locator(".site-header").boundingBox();
  await launcher.click();
  await expect(actions).toHaveCSS("overflow-y", "auto");
  await expect(actions).toHaveCSS("transition-duration", "0s");
  await expect(actions.locator(":scope > *").first()).toHaveCSS("transition-duration", "0s");
  const geometry = await page.locator(".site-header").evaluate((header) => {
    const launcherBounds = header.querySelector(".nav-launcher")!.getBoundingClientRect();
    const actions = header.querySelector(".nav-actions")!;
    const actionsBounds = actions.getBoundingClientRect();
    const firstActionBounds = actions.firstElementChild!.getBoundingClientRect();
    const headerBounds = header.getBoundingClientRect();
    return {
      growsDown: firstActionBounds.top >= launcherBounds.bottom,
      inViewport: headerBounds.top >= 0 && headerBounds.bottom <= innerHeight,
      scrollHeight: (header.querySelector(".nav-actions") as HTMLElement).scrollHeight,
      clientHeight: (header.querySelector(".nav-actions") as HTMLElement).clientHeight,
    };
  });
  expect(geometry.growsDown).toBe(true);
  expect(geometry.inViewport).toBe(true);
  expect(geometry.scrollHeight).toBeGreaterThanOrEqual(geometry.clientHeight);
  expect((await page.locator(".site-header").boundingBox())!.y).toBe(collapsed!.y);
  await expect(page.locator(".site-header").getByRole("button", { name: "About" })).toHaveCount(0);
});

test("foreign links and backlinks expose owner text, shape markers, accents, and keyboard links", async ({ page }) => {
  await page.goto(`${workspace}/brains/engineering/notes/principles`);

  const alias = page.getByRole("link", { name: /the design principles.*@design/ });
  const heading = page.locator("article .wiki-link--foreign", { hasText: "Evidence" });
  await expect(alias).toHaveAttribute("href", "/workspace-demo/brains/design/notes/principles");
  await expect(alias.locator(".brain-badge")).toContainText("↗ @design");
  await expect(alias).toHaveCSS("text-decoration-style", "dashed");
  expect(await alias.locator("xpath=..").evaluate((element) => element.tagName)).toBe("MARK");
  await expect(alias.locator("xpath=../..")).not.toContainText("==");
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

test("mention sections precede the connection map and empty regions stay omitted", async ({ page }) => {
  await page.goto(`${workspace}/brains/design/notes/principles`);
  await expect(page.getByRole("heading", { name: "Linked mentions", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Potential links", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Connection map" })).toBeVisible();
  const highlightedMention = page.locator(".mention--foreign .context mark", {
    hasText: "the design principles",
  });
  await expect(highlightedMention).toHaveCount(1);
  await expect(highlightedMention.locator("xpath=..")).not.toContainText("==");
  expect(await page.locator("main > .mentions, main > .local-graph-panel").evaluateAll((regions) =>
    regions.map((region) => region.querySelector("h2")?.textContent?.trim())
  )).toEqual(["Linked mentions", "Potential links", "Connection map"]);

  await page.goto(`${workspace}/brains/research-archive-and-synthesis-source-trails/notes/synthesis-trails`);
  await expect(page.locator(".mentions")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Connection map" })).toBeVisible();

  await page.goto(`${workspace}/brains/research-archive-and-synthesis-source-trails/notes/archive-boundaries`);
  await expect(page.locator(".mentions")).toHaveCount(0);
  await expect(page.locator(".local-graph-panel")).toHaveCount(0);
});

test("potential links are static, subtle, and non-clickable", async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto(`${workspace}/brains/design/notes/interaction-model`);

  const potential = page.locator("article .potential-link", { hasText: "principles" });
  await expect(potential).toHaveCount(1);
  const explanation = "Potential link to Principles. This is plain text, not an authored link.";
  await expect(potential).toHaveAttribute("aria-label", explanation);
  await expect(potential).toHaveAttribute("data-potential-link-label", explanation);
  await expect(potential).toHaveAttribute("tabindex", "0");
  await expect(potential).toHaveCSS("text-decoration-style", "dotted");
  await expect(potential).toHaveCSS("cursor", "help");
  expect(await potential.evaluate((element) => element.tagName)).toBe("SPAN");
  expect(await potential.locator("xpath=..").evaluate((element) => element.tagName)).toBe("MARK");
  await expect(potential.locator("a")).toHaveCount(0);
  expect(await potential.evaluate((element) =>
    getComputedStyle(element).color === getComputedStyle(element.parentElement!).color
  )).toBe(true);
  expect(await potential.evaluate((element) => getComputedStyle(element, "::after").opacity)).toBe("0");
  expect(await potential.evaluate((element) => {
    const tooltip = getComputedStyle(element, "::after");
    return [tooltip.position, tooltip.left, tooltip.right, tooltip.bottom];
  })).toEqual(["fixed", "16px", "16px", "16px"]);
  await potential.hover();
  await expect.poll(() => potential.evaluate((element) => getComputedStyle(element, "::after").opacity)).toBe("1");
  await potential.focus();
  await expect(potential).toBeFocused();
  await expect.poll(() => potential.evaluate((element) => getComputedStyle(element, "::after").opacity)).toBe("1");

  await page.setViewportSize({ width: 800, height: 900 });
  await page.reload();
  const tabletPotential = page.locator("article .potential-link", { hasText: "principles" });
  expect(await tabletPotential.evaluate((element) => {
    const tooltip = getComputedStyle(element, "::after");
    return [tooltip.position, tooltip.left, tooltip.right, tooltip.bottom];
  })).toEqual(["fixed", "16px", "16px", "16px"]);

  await page.goto(`${workspace}/brains/design/notes/principles`);
  const section = page.getByRole("heading", { name: "Potential links", exact: true }).locator("..");
  await expect(section.getByRole("link", { name: "Interaction model" })).toBeVisible();
  await context.close();
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
  )).toBeGreaterThan(0);
  await page.reload();
  await expect(relatedBrains).toHaveAttribute("aria-pressed", "false");
  await expect(graph).toHaveAttribute("data-focused-node", "engineering/principles");
  await expect(graph).toHaveAttribute("data-foreign-nodes", "2");

  await page.goto(`${workspace}/graph?brains=engineering,design,research`);
  await expect(graph).toHaveAttribute("data-visible-nodes", "5");
  const filterToggle = page.locator("#graph-filter-toggle");
  if (await filterToggle.getAttribute("aria-expanded") === "false") await filterToggle.click();
  await page.locator(".context-switcher > summary").click();
  const contextPanel = page.locator(".context-switcher__panel");
  await contextPanel.getByRole("checkbox", { name: "@research", exact: true }).uncheck();
  await expect(contextPanel.getByRole("checkbox", { name: "@research", exact: true })).not.toBeChecked();
  await contextPanel.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(`${workspace}/graph?brains=engineering,design`);
  await expect(graph).toHaveAttribute("data-visible-brain-ids", "engineering,design");
  await expect(graph).toHaveAttribute("data-visible-nodes", "4");
  await expect(page.locator(".context-switcher > summary"))
    .toHaveAttribute("aria-label", "Brain context: 2 brains combined");
  await expect(page.locator(".combined-context, .graph-brain-filters")).toHaveCount(0);
  await page.getByRole("button", { name: "Navigation" }).click();
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByLabel("Quick switcher scope")).toHaveValue("selected");
  await page.getByLabel("Search notes and tags").fill("Evidence");
  await expect(page.getByText("No matches.")).toBeVisible();
});

test("graph search restores focused neighborhoods and explicit exclusion clears them", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText(value: string) {
          (window as unknown as { copiedCombinedFocus?: string }).copiedCombinedFocus = value;
          return Promise.resolve();
        },
      },
    });
  });
  await page.goto(`${workspace}/graph?brains=engineering,design`);
  const graph = page.locator("#global-graph");
  await expect(graph.locator("canvas.sigma-nodes")).toBeVisible();
  await page.getByRole("button", { name: "Filters" }).click();
  await page.locator("#graph-search").fill("Principles");
  const result = page.locator("#graph-search-results button", { hasText: "@engineering" });
  await result.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(
    `${workspace}/graph?brains=engineering,design&focus=engineering%2Fprinciples`,
  );
  await expect(graph).toHaveAttribute("data-focused-node", "engineering/principles");
  await expect(page.locator("[data-graph-focus-status]")).toContainText("Principles");
  await page.locator("[data-graph-focus-copy]").click();
  const copied = await page.evaluate(() =>
    (window as unknown as { copiedCombinedFocus?: string }).copiedCombinedFocus
  );
  expect(new URL(copied!).searchParams.get("brains")).toBe("engineering,design");
  expect(new URL(copied!).searchParams.get("focus")).toBe("engineering/principles");
  const recipient = await page.context().newPage();
  await recipient.setViewportSize({ width: 390, height: 844 });
  await recipient.goto(copied!);
  const recipientGraph = recipient.locator("#global-graph");
  await expect(recipientGraph).toHaveAttribute("data-focused-node", "engineering/principles");
  await expect(recipientGraph).toHaveAttribute("data-visible-brain-ids", "engineering,design");
  await expect.poll(async () => Number(await recipientGraph.getAttribute("data-fit-requests")))
    .toBeGreaterThan(0);
  await expect.poll(async () => Number(await recipientGraph.getAttribute("data-motion-completions")))
    .toBeGreaterThan(0);
  const labelBounds = await recipientGraph.locator("canvas.sigma-labels").evaluate((canvas) => {
    const element = canvas as HTMLCanvasElement;
    const pixels = element.getContext("2d")!.getImageData(0, 0, element.width, element.height).data;
    let left = element.width;
    let top = element.height;
    let right = -1;
    let bottom = -1;
    for (let y = 0; y < element.height; y += 1) {
      for (let x = 0; x < element.width; x += 1) {
        if (pixels[(y * element.width + x) * 4 + 3] === 0) continue;
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
    return { left, top, right, bottom, width: element.width, height: element.height };
  });
  expect(labelBounds.left).toBeGreaterThanOrEqual(0);
  expect(labelBounds.top).toBeGreaterThanOrEqual(0);
  expect(labelBounds.right).toBeLessThan(labelBounds.width);
  expect(labelBounds.bottom).toBeLessThan(labelBounds.height);
  await recipient.close();
  await page.reload();
  await expect(graph).toHaveAttribute("data-focused-node", "engineering/principles");

  const payload = await page.evaluate(async () => (await fetch("/workspace-demo/graph-data.json")).json());
  const focusedType = payload.nodes.find(
    (node: { compositeId: string }) => node.compositeId === "engineering/principles",
  ).type;
  const filters = page.getByRole("button", { name: /Filters|Close filters/ });
  if (await filters.getAttribute("aria-expanded") === "false") await filters.click();
  await page.locator(`[data-filter="type"][value="${focusedType}"]`).uncheck();
  await expect(graph).not.toHaveAttribute("data-focused-node");
  await expect(page).toHaveURL(`${workspace}/graph?brains=engineering,design`);

  await page.goto(`${workspace}/brains/engineering?focus=design%2Fprinciples`);
  await expect(page.locator("#graph-related-toggle")).toHaveAttribute("aria-pressed", "false");
  await expect(graph).toHaveAttribute("data-focused-node", "design/principles");
  await expect(graph).toHaveAttribute("data-foreign-nodes", /[1-9]\d*/u);
});

test("graph ownership legend remains non-color-readable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${workspace}/brains/engineering`);
  const graph = page.locator("#global-graph");
  const relatedBrains = page.locator("#graph-related-toggle");
  const controls = page.locator(".graph-controls");
  const filterToggle = controls.getByRole("button", { name: "Filters" });
  const actions = controls.getByRole("button");
  await expect(actions).toHaveCount(5);
  await expect(controls.getByRole("button", { name: "Filters" })).toBeVisible();
  await expect(controls.getByRole("button", { name: "Fit view" })).toBeVisible();
  await expect(controls.getByRole("button", { name: "Show related brains" })).toBeVisible();
  await expect(controls.getByRole("button", { name: "Legend" })).toBeVisible();
  await expect(controls.getByRole("button", { name: "Brain context: Engineering" })).toBeVisible();
  const initialGeometry = await page.evaluate(() => {
    const controls = document.querySelector(".graph-controls")!.getBoundingClientRect();
    const navigation = document.querySelector(".site-header")!.getBoundingClientRect();
    const actions = [...document.querySelectorAll<HTMLElement>(
      ".graph-controls > button, .graph-controls > .graph-legend-disclosure > button, .graph-controls > .context-switcher > summary",
    )]
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
  for (const action of await actions.all()) {
    await expect(action).toHaveAttribute("title", await action.getAttribute("aria-label") ?? "");
  }
  await page.getByRole("button", { name: "Navigation" }).click();
  await filterToggle.click();
  await expect(page.getByRole("button", { name: "Navigation" })).toHaveAttribute("aria-expanded", "false");
  await expect(filterToggle).toBeFocused();
  await filterToggle.click();
  await expect(graph).toHaveAttribute("data-foreign-nodes", "0");
  await relatedBrains.click();
  await expect(graph).toHaveAttribute("data-foreign-nodes", "2");
  await expect(relatedBrains).toHaveText("Hide related brains");
  await expect(relatedBrains).toHaveAttribute("aria-label", "Hide related brains");
  await expect(relatedBrains).toHaveAttribute("title", "Hide related brains");
  await expect(relatedBrains).toHaveAttribute("aria-pressed", "true");
  expect(await actions.evaluateAll((buttons) => buttons.map((button) => {
    const { x, y, width, height } = button.getBoundingClientRect();
    return { x, y, width, height };
  }))).toEqual(initialGeometry.actions);
  await relatedBrains.click();
  await expect(graph).toHaveAttribute("data-foreign-nodes", "0");

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
  const legendOverflow = await conciseLegend.evaluate((panel) => {
    const brainList = panel.querySelector(".graph-legend-brains")!;
    const identity = brainList.querySelector("li")!;
    for (let index = 0; index < 30; index += 1) brainList.append(identity.cloneNode(true));
    const bounds = panel.getBoundingClientRect();
    return {
      bottom: bounds.bottom,
      viewportHeight: innerHeight,
      scrolls: panel.scrollHeight > panel.clientHeight,
      overflowY: getComputedStyle(panel).overflowY,
    };
  });
  expect(legendOverflow.scrolls).toBe(true);
  expect(legendOverflow.overflowY).toBe("auto");
  expect(legendOverflow.bottom).toBeLessThanOrEqual(legendOverflow.viewportHeight);
  await page.keyboard.press("Escape");
  await expect(conciseLegend).toBeHidden();
  await expect(legendTrigger).toBeFocused();
  await legendTrigger.click();
  await filterToggle.click();
  await expect(conciseLegend).toBeHidden();
  await expect(filterToggle).toBeFocused();
  await filterToggle.click();
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
    const actions = [...document.querySelectorAll<HTMLElement>(
      ".graph-controls > button, .graph-controls > .graph-legend-disclosure > button, .graph-controls > .context-switcher > summary",
    )]
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
  await page.getByRole("button", { name: "Legend" }).click();
  expect(await page.getByRole("region", { name: "Graph legend" }).evaluate((panel) => {
    const bounds = panel.getBoundingClientRect();
    return bounds.left >= 0 && bounds.top >= 0 && bounds.right <= innerWidth && bounds.bottom <= innerHeight;
  })).toBe(true);
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
  await page.getByRole("button", { name: "Show related brains" }).click();
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

  await page.setViewportSize({ width: 700, height: 844 });
  await page.waitForTimeout(1_000);
  await page.evaluate(() => {
    for (const key of Object.keys(sessionStorage)) {
      if (/^graph-(motion|view):/.test(key)) sessionStorage.removeItem(key);
    }
  });
  await page.setViewportSize({ width: 701, height: 844 });
  await page.waitForFunction(() =>
    Object.keys(sessionStorage).some((key) => key.startsWith("graph-motion:"))
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("quick switcher defaults to active, selected, and all-brain scopes", async ({ page }) => {
  await page.goto(`${workspace}/brains/engineering/notes/principles`);
  await page.getByRole("button", { name: "Navigation" }).click();
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
  await page.getByRole("button", { name: "Navigation" }).click();
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

test("workspace 404 recovery honors valid query scope before namespaced paths", async ({ page }) => {
  const response = await page.goto(
    `${workspace}/brains/research/notes/missing?brains=engineering,design`,
  );
  expect(response?.status()).toBe(404);
  await expect(page).toHaveURL(
    `${workspace}/brains/research/notes/missing?brains=engineering,design`,
  );
  await expect(page.getByRole("link", { name: "Return to the selected graph" })).toHaveAttribute(
    "href",
    "/workspace-demo/graph?brains=engineering,design",
  );
  const owner = page.locator("[data-recommendation-owner]");
  await expect(owner).toContainText(/@(engineering|design)/u);
  const initial = await page.locator("[data-recommendation-title]").textContent();
  await page.reload();
  await expect(page.locator("[data-recommendation-title]")).toHaveText(initial ?? "");
  const recommendedHref = await page.locator("[data-recommendation-link]").getAttribute("href");
  expect(new URL(recommendedHref!, workspace).searchParams.get("brains")).toBe("engineering,design");
  await page.locator("[data-recommendation-link]").click();
  expect(new URL(page.url()).searchParams.get("brains")).toBe("engineering,design");

  await page.goto(`${workspace}/brains/unknown/notes/missing?brains=unknown`);
  await expect(page.getByRole("link", { name: "Return to the Brain chooser" })).toHaveAttribute(
    "href",
    "/workspace-demo/",
  );
  await expect(page.locator("[data-recommendation-owner]")).not.toContainText("@unknown");
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
