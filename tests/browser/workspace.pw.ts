import { expect, test, type Locator, type Page } from "@playwright/test";
import fs from "node:fs";

const packageMetadata = JSON.parse(
  fs.readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as { version: string };

const workspace = "http://127.0.0.1:4331/workspace-demo";
const manifest = JSON.parse(
  fs.readFileSync(new URL("../../examples/demo-workspace/workspace.json", import.meta.url), "utf8"),
) as {
  groups: { id: string; title: string; parent?: string }[];
  brains: { id: string; title: string; group?: string; description?: string }[];
};
/** Brain IDs in declared hierarchy order: groups in manifest order, then ungrouped. */
const hierarchyOrder = [
  ...manifest.groups.flatMap((group) =>
    manifest.brains.filter((brain) => brain.group === group.id).map((brain) => brain.id)
  ),
  ...manifest.brains.filter((brain) => !brain.group).map((brain) => brain.id),
];
const allBrainIds = manifest.brains.map((brain) => brain.id).join(",");

async function graphPayload(page: Page) {
  return page.evaluate(async () =>
    (await fetch("/workspace-demo/graph-data.json")).json() as Promise<{
      nodes: { id: string; brainId: string; title: string; type: string; compositeId: string; route: string; x: number; y: number }[];
      edges: { crossBrain: boolean }[];
    }>
  );
}

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
      await graph.getAttribute("data-pointer-node") !== excludeNode
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
        if (host.dataset.pointerNode && host.dataset.pointerNode !== excluded) {
          return { x: bounds.left + x, y: bounds.top + y };
        }
      }
    }
    return null;
  }, excludeNode ?? null);
  if (target) return target;
  throw new Error("No interactive graph title target found");
}

/**
 * A screen point whose pointer hit is the given node. The host resolves
 * pointer targets from rendered marker and title geometry, so sweeping the
 * canvas with pointer moves and reading the transient inspection hook finds
 * the node without exposing renderer internals.
 */
async function pointerTargetFor(graph: Locator, node: string) {
  const target = await graph.evaluate((host, wanted) => {
    const bounds = host.getBoundingClientRect();
    const probe = (x: number, y: number) => {
      host.dispatchEvent(new PointerEvent("pointermove", {
        bubbles: true,
        clientX: bounds.left + x,
        clientY: bounds.top + y,
        pointerType: "mouse",
      }));
      return (
        host.dataset.pointerNode === wanted &&
        document.elementFromPoint(bounds.left + x, bounds.top + y) instanceof HTMLCanvasElement
      );
    };
    for (let y = 2; y < bounds.height; y += 3) {
      for (let x = 2; x < bounds.width; x += 3) {
        if (probe(x, y)) return { x: bounds.left + x, y: bounds.top + y };
      }
    }
    return null;
  }, node);
  if (!target) throw new Error(`No pointer target found for ${node}`);
  return target;
}

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-root", "Workspace behavior needs one browser project.");
});

test("workspace root is the full graph and its Brain control follows the declared hierarchy", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${workspace}/`);

  await expect(page).toHaveTitle("Demo Brain workspace");
  const graph = page.locator("#global-graph");
  const payload = await graphPayload(page);
  await expect(graph).toHaveAttribute("data-graph-mode", "all");
  await expect(graph).toHaveAttribute("data-visible-nodes", String(payload.nodes.length));
  await expect(graph).toHaveAttribute("data-visible-brain-ids", allBrainIds);
  await expect(graph).toHaveAttribute("data-lens", "");
  await expect(graph).toHaveAttribute("data-dimmed-nodes", "0");
  await expect(graph.locator("canvas.sigma-nodes")).toBeVisible();
  await expect(page.locator(".brain-card, .brain-selection, .context-switcher, [data-combined-graph]")).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.locator(".site-header .brain-lens")).toHaveCount(0);
  await expect(page.locator(".graph-controls").getByRole("link", { name: "Home" })).toHaveCount(0);
  await expect(page.locator(".graph-controls > :last-child")).toHaveClass(/brain-lens/);

  const lens = page.locator(".graph-controls > .brain-lens");
  const summary = lens.locator("summary");
  await expect(summary).toHaveAttribute("aria-label", "Brains");
  await expect(summary).toHaveAttribute("aria-expanded", "false");
  await summary.click();
  await expect(summary).toHaveAttribute("aria-expanded", "true");
  const panel = page.getByRole("group", { name: "Brain lens" });
  expect(await panel.locator("h3").allTextContents()).toEqual(manifest.groups.map((group) => group.title));
  expect(await panel.locator('input[name="brain-lens"]').evaluateAll((inputs) =>
    inputs.map((input) => (input as HTMLInputElement).value)
  )).toEqual(hierarchyOrder);
  for (const brain of manifest.brains) {
    const row = panel.locator(`[data-lens-brain="${brain.id}"]`);
    await expect(row.getByRole("checkbox", { name: `${brain.title} @${brain.id}`, exact: true })).toBeChecked();
    await expect(row.getByRole("link", { name: `Enter ${brain.title}` }))
      .toHaveAttribute("href", `/workspace-demo/brains/${brain.id}`);
    await expect(row.locator("[data-brain-mark]")).toHaveCount(1);
    if (brain.description) await expect(row).toContainText(brain.description);
  }
  await expect(panel.getByRole("button", { name: "Show all" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(summary).toHaveAttribute("aria-expanded", "false");
  await expect(summary).toBeFocused();
  await summary.click();
  await panel.getByRole("link", { name: "Enter Engineering" }).click();
  await expect(page).toHaveURL(`${workspace}/brains/engineering`);
  await expect(page.locator(".graph-controls > :last-child")).toHaveClass(/brain-lens/);
  await expect(page.locator(".graph-controls").getByRole("button", { name: "Brains", exact: true })).toBeVisible();
  await expect(page.locator(".site-header .brain-lens")).toHaveCount(0);
  await expect(graph.locator("canvas.sigma-nodes")).toBeVisible();

  await page.getByRole("button", { name: "Navigation" }).click();
  await expect(page.locator(".site-header").getByRole("link", { name: "Graph" }))
    .toHaveAttribute("href", "/workspace-demo/brains/engineering");
  await expect(page.locator(".nav-actions").getByRole("link", { name: "Tags" }))
    .toHaveAttribute("href", "/workspace-demo/brains/engineering/tags");
  await context.close();
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
  await expect(header.locator(".brain-lens")).toHaveCount(0);
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

test("Home stays visible while About and generator provenance remain on the root graph", async ({ page }) => {
  await page.goto(`${workspace}/brains/engineering/notes/principles`);
  await expect(page.locator('meta[name="generator"]')).toHaveAttribute(
    "content",
    `Brain v${packageMetadata.version}`,
  );
  const home = page.getByRole("link", { name: "Home" });
  const noteGraph = page.locator(".page-note-nav").getByRole("link", { name: "Graph" });
  await expect(home).toHaveAttribute("href", "/workspace-demo/");
  await expect(noteGraph).toHaveAttribute("href", "/workspace-demo/brains/engineering/notes/principles/graph");
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
  await expect(page.locator("#global-graph canvas.sigma-nodes")).toBeVisible();
  const about = page.getByRole("button", { name: "About" });
  const aboutGeometry = await about.evaluate((button) => {
    const bounds = button.getBoundingClientRect();
    const controls = document.querySelector(".graph-controls")!.getBoundingClientRect();
    return {
      inViewport: bounds.left >= 0 && bounds.right <= innerWidth && bounds.bottom <= innerHeight,
      clearOfControls: bounds.top >= controls.bottom || bounds.bottom <= controls.top ||
        bounds.left >= controls.right || bounds.right <= controls.left,
    };
  });
  expect(aboutGeometry).toEqual({ inViewport: true, clearOfControls: true });
  await about.click();
  await expect(about).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByLabel("About Brain")).toContainText(`Brain v${packageMetadata.version}`);
  await expect(page.getByLabel("About Brain")).toContainText("Demo Brain workspace");
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

test("note Graph actions target the note's own neighborhood page", async ({ page }) => {
  await page.goto(`${workspace}/brains/engineering/notes/principles`);
  await expect(page.locator("article")).toHaveAttribute("data-brain-id", "engineering");
  const neighborhood = "/workspace-demo/brains/engineering/notes/principles/graph";

  const graphAction = page.locator(".page-note-nav").getByRole("link", { name: "Graph" });
  await expect(graphAction).toHaveAttribute("href", neighborhood);
  await expect(page.getByRole("link", { name: "Open full graph" })).toHaveAttribute("href", neighborhood);
  await expect(page.locator(".note-focus-action")).toHaveAttribute("href", neighborhood);
  for (const href of await page
    .locator("[data-scoped-graph-route], [data-focused-graph-route]")
    .evaluateAll((anchors) => anchors.map((anchor) => (anchor as HTMLAnchorElement).href))) {
    const url = new URL(href);
    expect(url.search).toBe("");
    expect(url.hash).toBe("");
  }
  for (const href of await page
    .locator("a[data-note-route]")
    .evaluateAll((anchors) => anchors.map((anchor) => (anchor as HTMLAnchorElement).href))) {
    expect(new URL(href).search).toBe("");
  }

  await graphAction.click();
  await expect(page).toHaveURL(`${new URL(workspace).origin}${neighborhood}`);
  await expect(page).toHaveTitle("Principles neighborhood");
  await expect(page.locator("#global-graph")).toHaveAttribute("data-focused-node", "engineering/principles");
  await expect(page.locator("[data-graph-focus-status]")).toContainText("Principles");
});

test("fresh visitors open shared neighborhoods and return to them from notes", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const neighborhood = `${workspace}/brains/engineering/notes/principles/graph`;
  await page.goto(neighborhood);
  const graph = page.locator("#global-graph");
  await expect(graph).toHaveAttribute("data-focused-node", "engineering/principles");
  for (const brainId of ["engineering", "design", "research", "research-archive-and-synthesis-source-trails"]) {
    await expect(graph).toHaveAttribute("data-visible-brain-ids", new RegExp(`(^|,)${brainId}(,|$)`, "u"));
  }
  await expect(page.locator("[data-graph-focus-status]")).toBeVisible();
  await expect(page.locator("[data-graph-focus-status]")).toContainText("Principles");
  // A note's path is the graph page with that note focused, so focus clears
  // in place here exactly as it does anywhere else.
  await expect(page.locator("[data-graph-focus-clear]")).toHaveText("Clear focus");
  await expect.poll(async () => Number(await graph.getAttribute("data-fit-requests"))).toBeGreaterThan(0);
  await expect(page).toHaveURL(neighborhood);

  const openFocusedNote = page.locator("[data-graph-focus-open]");
  await expect(openFocusedNote).toHaveAttribute(
    "href",
    "/workspace-demo/brains/engineering/notes/principles?focus=engineering%2Fprinciples",
  );
  await openFocusedNote.click();
  await expect(page.locator("article")).toHaveAttribute("data-brain-id", "engineering");
  const graphAction = page.locator(".page-note-nav").getByRole("link", { name: "Graph" });
  await expect(graphAction).toHaveAttribute("href", "/workspace-demo/brains/engineering/notes/principles/graph");
  await graphAction.click();
  await expect(page).toHaveURL(neighborhood);
  await expect(graph).toHaveAttribute("data-focused-node", "engineering/principles");

  await page.getByRole("button", { name: "Navigation" }).click();
  // Exact: the neighborhood page also lists a "Research" domain chip.
  await page.getByRole("button", { name: "Search", exact: true }).click();
  // The neighborhood page lives under Engineering, so widen to reach Design.
  await expect(page.getByLabel("Quick switcher scope")).toHaveValue("active");
  await page.getByLabel("Quick switcher scope").selectOption("all");
  await page.getByLabel("Search notes and tags").fill("Principles");
  await page.locator("#switcher-results li", { hasText: "@design" }).click();
  await expect(page).toHaveURL(
    `${workspace}/brains/design/notes/principles?focus=engineering%2Fprinciples`,
  );
  await expect(page.locator("article")).toHaveAttribute("data-brain-id", "design");
  await expect(graphAction).toHaveAttribute("href", "/workspace-demo/brains/engineering/notes/principles/graph");
  await graphAction.click();
  await expect(page).toHaveURL(neighborhood);
  await expect(graph).toHaveAttribute("data-focused-node", "engineering/principles");

  await page.goto(`${workspace}/brains/engineering?focus=engineering%2Fprinciples`);
  await expect(graph).toHaveAttribute("data-focused-node", "engineering/principles");
  await page.getByRole("button", { name: "Navigation" }).click();
  await page.locator(".site-header").getByRole("button", { name: "Search" }).click();
  await page.getByLabel("Search notes and tags").fill("Delivery loops");
  await page.locator("#switcher-results li", { hasText: "Delivery loops" }).click();
  await expect(page).toHaveURL(
    `${workspace}/brains/engineering/notes/delivery-loops?focus=engineering%2Fprinciples`,
  );
  await expect(graphAction).toHaveAttribute("href", "/workspace-demo/brains/engineering/notes/principles/graph");

  await page.goto(`${workspace}/brains/engineering/notes/delivery-loops`);
  await expect(graphAction).toHaveAttribute("href", "/workspace-demo/brains/engineering/notes/delivery-loops/graph");

  await page.goto(`${workspace}/brains/design/notes/principles?focus=research%2Fmissing-note`);
  await expect(graphAction).toHaveAttribute("href", "/workspace-demo/brains/design/notes/principles/graph");
  await expect(page).toHaveURL(`${workspace}/brains/design/notes/principles`);
  await context.close();
});

test("an isolated note keeps a visible focused-neighborhood action", async ({ page }) => {
  await page.goto(`${workspace}/brains/research-archive-and-synthesis-source-trails/notes/archive-boundaries`);
  await expect(page.locator(".local-graph-panel")).toHaveCount(0);
  const action = page.locator(".note-focus-action");
  await expect(action).toBeVisible();
  await expect(action).toHaveAttribute(
    "href",
    "/workspace-demo/brains/research-archive-and-synthesis-source-trails/notes/archive-boundaries/graph",
  );
  await action.click();
  await expect(page.locator("#global-graph")).toHaveAttribute(
    "data-focused-node",
    "research-archive-and-synthesis-source-trails/archive-boundaries",
  );
});

test("every note-navigation surface carries in-session return focus", async ({ page }) => {
  const focus = "engineering/principles";
  const expectRetainedFocus = async () => {
    await expect.poll(() => new URL(page.url()).searchParams.get("focus")).toBe(focus);
  };
  const neighborhood = `${workspace}/brains/engineering/notes/principles/graph`;

  await page.goto(neighborhood);
  const globalGraph = page.locator("#global-graph");
  await expect(globalGraph).toHaveAttribute("data-focused-node", focus);
  await expect(globalGraph.locator("canvas.sigma-labels")).toBeVisible();
  await expect.poll(async () => Number(await globalGraph.getAttribute("data-motion-completions")))
    .toBeGreaterThan(0);
  await page.waitForTimeout(500);
  let target = await renderedLabelTarget(page, globalGraph);
  await page.mouse.click(target.x, target.y);
  await expect.poll(() => new URL(page.url()).pathname).toMatch(/\/notes\/[^/]+$/u);
  await expectRetainedFocus();
  await page.locator(".page-note-nav").getByRole("link", { name: "Graph" }).click();
  await expect(page).toHaveURL(neighborhood);
  await expect(globalGraph).toHaveAttribute("data-focused-node", focus);

  const note = `${workspace}/brains/engineering/notes/principles?focus=engineering%2Fprinciples`;
  for (const selector of ["article a.wiki-link", ".mentions a", ".local-graph-links a"]) {
    await page.goto(note);
    const startingPath = new URL(page.url()).pathname;
    const link = page.locator(selector).first();
    await expect(link).toBeVisible();
    await link.click();
    await expect.poll(() => new URL(page.url()).pathname).not.toBe(startingPath);
    await expectRetainedFocus();
  }

  await page.goto(note);
  const localGraph = page.locator(".local-graph");
  await expect(localGraph.locator("canvas.sigma-labels")).toBeVisible();
  await localGraph.scrollIntoViewIfNeeded();
  // Measure the labels only once the connection map has settled: a fit still
  // in flight moves them between finding a target and clicking it.
  await expect.poll(async () => Number(await localGraph.getAttribute("data-fit-completions")))
    .toBeGreaterThan(0);
  await page.waitForTimeout(500);
  const slug = await localGraph.getAttribute("data-slug");
  target = await renderedLabelTarget(page, localGraph, slug);
  // The target is found with synthetic pointer events; confirm the real
  // pointer lands on the same node before clicking, because whatever the
  // pointer is over is also what forces its title into the rendered set.
  await page.mouse.move(target.x, target.y);
  await expect
    .poll(async () => await localGraph.getAttribute("data-pointer-node"))
    .not.toBe(slug);
  await page.mouse.click(target.x, target.y);
  await expect.poll(() => new URL(page.url()).pathname).not.toBe(new URL(note).pathname);
  await expectRetainedFocus();

  const invalidFocusNote = `${workspace}/brains/engineering/notes/principles?focus=research%2Fmissing-note`;
  await page.goto(invalidFocusNote);
  await expect(page.locator(".page-note-nav").getByRole("link", { name: "Graph" })).toHaveAttribute(
    "href",
    "/workspace-demo/brains/engineering/notes/principles/graph",
  );
  await expect(localGraph.locator("canvas.sigma-labels")).toBeVisible();
  await localGraph.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const ownSlug = await localGraph.getAttribute("data-slug");
  // A connection map keeps settling, so a target found and then waited on can
  // have moved out from under the pointer. Re-derive it and click at once.
  const startingNotePath = new URL(note).pathname;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    target = await renderedLabelTarget(page, localGraph, ownSlug);
    await page.mouse.move(target.x, target.y);
    if (await localGraph.getAttribute("data-pointer-node") === ownSlug) continue;
    await page.mouse.click(target.x, target.y);
    await page.waitForTimeout(400);
    if (new URL(page.url()).pathname !== startingNotePath) break;
  }
  await expect.poll(() => new URL(page.url()).pathname).not.toBe(new URL(invalidFocusNote).pathname);
  expect(new URL(page.url()).searchParams.has("focus")).toBe(false);
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

test("Brain identity reuses one mark across the lens control and favicon", async ({ page }) => {
  await page.goto(`${workspace}/`);

  const lens = page.locator(".graph-controls > .brain-lens");
  const currentMark = lens.locator("summary [data-brain-mark]");
  await expect(currentMark).toHaveCSS("width", "16px");
  const markGeometry = await currentMark.locator("path").getAttribute("d");
  expect(markGeometry).toBeTruthy();

  await lens.locator("summary").click();
  const panel = page.getByRole("group", { name: "Brain lens" });
  const panelMarks = panel.locator("[data-brain-mark]");
  await expect(panelMarks).toHaveCount(4);
  for (const mark of await panelMarks.all()) {
    await expect(mark).toHaveAttribute("aria-hidden", "true");
    await expect(mark).toHaveAttribute("focusable", "false");
    await expect(mark).toHaveCSS("width", "16px");
    await expect(mark.locator("path")).toHaveAttribute("d", markGeometry!);
  }
  const design = panel.locator('[data-lens-brain="design"]');
  expect(await design.evaluate((row) => getComputedStyle(row).getPropertyValue("--brain-accent").trim()))
    .toBe("#b56cff");
  await expect(design.locator(".brain-lens__title")).toHaveText("Design");
  await expect(design.locator(".brain-lens__id")).toHaveText("@design");
  const markColor = (id: string) => panel
    .locator(`[data-lens-brain="${id}"] [data-brain-mark]`)
    .evaluate((mark) => getComputedStyle(mark).color);
  expect(await markColor("design")).not.toBe(await markColor("engineering"));
  await expect(page.locator(".site-header .brain-lens")).toHaveCount(0);

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

test("lens panel keeps long identities contained on desktop and phone", async ({ page }) => {
  const longId = "research-archive-and-synthesis-source-trails";
  for (const viewport of [{ width: 1280, height: 1100 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto(`${workspace}/`);
    await page.locator(".graph-controls > .brain-lens > summary").click();
    const panel = page.getByRole("group", { name: "Brain lens" });
    const row = panel.locator(`[data-lens-brain="${longId}"]`);
    await expect(row.locator(".brain-lens__id")).toHaveText(`@${longId}`);
    expect(await row.evaluate((element) => {
      const panel = element.closest(".brain-lens__panel")!.getBoundingClientRect();
      const bounds = element.getBoundingClientRect();
      const enter = element.querySelector(".brain-lens__enter")!.getBoundingClientRect();
      const toggle = element.querySelector(".brain-lens__toggle")!.getBoundingClientRect();
      return {
        rowInPanel: bounds.left >= panel.left && bounds.right <= panel.right,
        panelInViewport: panel.left >= 0 && panel.right <= innerWidth && panel.bottom <= innerHeight,
        enterInRow: enter.right <= bounds.right + 0.5 && enter.left >= toggle.right,
        noOverflow: document.documentElement.scrollWidth <= innerWidth,
      };
    })).toEqual({ rowInPanel: true, panelInViewport: true, enterInRow: true, noOverflow: true });
  }
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
      await expect(page.locator(".site-header .brain-lens")).toHaveCount(0);
    }
  }
});

test("old combined-view links land on the full workspace graph", async ({ page }) => {
  for (const legacy of [
    "/graph?brains=engineering,design",
    "/graph?brains=design,engineering,design",
    "/graph?brains=engineering,unknown",
    "/graph?brains=engineering,design&brains=unknown",
    "/graph",
  ]) {
    await page.goto(`${workspace}${legacy}`);
    await expect(page).toHaveURL(`${workspace}/`);
    await expect(page.locator("#global-graph")).toHaveAttribute("data-graph-mode", "all");
    await expect(page.locator("#global-graph")).toHaveAttribute("data-visible-brain-ids", allBrainIds);
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.locator("[data-combined-graph]")).toHaveCount(0);
  }
});

test("the Brain lens dims in place, resets, refuses to dim everything, and stays out of the URL", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${workspace}/`);
  const graph = page.locator("#global-graph");
  await expect(graph.locator("canvas.sigma-nodes")).toBeVisible();
  const payload = await graphPayload(page);
  const total = String(payload.nodes.length);
  const researchNotes = payload.nodes.filter((node) => node.brainId === "research").length;
  expect(researchNotes).toBeGreaterThan(0);
  await expect(graph).toHaveAttribute("data-visible-nodes", total);
  await expect.poll(async () => Number(await graph.getAttribute("data-motion-completions"))).toBeGreaterThan(0);
  const settleRequests = await graph.getAttribute("data-settle-requests");
  const motionCompletions = await graph.getAttribute("data-motion-completions");
  // The host records a checksum of graph-space positions on the next render
  // once armed. Every lens change re-renders, so arming before a change and
  // reading after it shows whether dimming moved anything.
  const armGeometry = () => graph.evaluate((host) => {
    host.dataset.geometryCheckPending = "";
  });
  const readGeometry = async () => {
    await expect(graph).not.toHaveAttribute("data-geometry-check-pending");
    return graph.getAttribute("data-graph-geometry");
  };

  const lens = page.locator(".graph-controls > .brain-lens");
  const summary = lens.locator("summary");
  await summary.click();
  const panel = page.getByRole("group", { name: "Brain lens" });
  const research = panel.getByRole("checkbox", { name: "Research @research", exact: true });
  await armGeometry();
  await research.uncheck();
  const dimmedGeometry = await readGeometry();
  expect(dimmedGeometry?.startsWith(`${total}:`)).toBe(true);
  await expect(graph).toHaveAttribute("data-lens", "research");
  await expect(graph).toHaveAttribute("data-dimmed-nodes", String(researchNotes));
  await expect(graph).toHaveAttribute("data-visible-nodes", total);
  await expect(graph).toHaveAttribute("data-visible-brain-ids", allBrainIds);
  await expect(summary).toHaveAttribute("aria-label", "Brains: 1 dimmed");
  await expect(summary).toHaveAttribute("title", "Brains: 1 dimmed");
  await expect(lens).toHaveAttribute("data-dimmed", "");
  await expect(page).toHaveURL(`${workspace}/`);
  expect(await graph.getAttribute("data-settle-requests")).toBe(settleRequests);

  await armGeometry();
  await panel.getByRole("button", { name: "Show all" }).click();
  await expect(graph).toHaveAttribute("data-lens", "");
  expect(await readGeometry()).toBe(dimmedGeometry);
  await expect(graph).toHaveAttribute("data-dimmed-nodes", "0");
  await expect(research).toBeChecked();
  await expect(summary).toHaveAttribute("aria-label", "Brains");
  await expect(lens).not.toHaveAttribute("data-dimmed");

  const boxes = panel.locator('input[name="brain-lens"]');
  await expect(boxes).toHaveCount(4);
  for (const id of ["engineering", "design", "research-archive-and-synthesis-source-trails"]) {
    await panel.locator(`input[value="${id}"]`).uncheck();
  }
  await expect(graph).toHaveAttribute("data-lens", "engineering,design,research-archive-and-synthesis-source-trails");
  await expect(summary).toHaveAttribute("aria-label", "Brains: 3 dimmed");
  await armGeometry();
  await research.click();
  await expect(graph).toHaveAttribute("data-lens", "");
  await expect(graph).toHaveAttribute("data-dimmed-nodes", "0");
  await expect(graph).toHaveAttribute("data-visible-nodes", total);
  for (const box of await boxes.all()) await expect(box).toBeChecked();
  await expect(summary).toHaveAttribute("aria-label", "Brains");
  expect(page.url()).toBe(`${workspace}/`);
  expect(await readGeometry()).toBe(dimmedGeometry);
  expect(await graph.getAttribute("data-settle-requests")).toBe(settleRequests);
  expect(await graph.getAttribute("data-motion-completions")).toBe(motionCompletions);

  await research.uncheck();
  await expect(graph).toHaveAttribute("data-lens", "research");
  const storedKeys = await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("brain-lens:")));
  expect(storedKeys).toHaveLength(1);
  expect(storedKeys[0]).toContain("/workspace-demo");
  expect(await page.evaluate((key) => localStorage.getItem(key), storedKeys[0])).toBe(JSON.stringify(["research"]));
  expect(await page.evaluate(() => Object.keys(sessionStorage).some((key) => key.startsWith("brain-lens:")))).toBe(false);

  await page.reload();
  await expect(graph).toHaveAttribute("data-lens", "research");
  await expect(graph).toHaveAttribute("data-dimmed-nodes", String(researchNotes));
  await expect(summary).toHaveAttribute("aria-label", "Brains: 1 dimmed");
  await summary.click();
  await expect(research).not.toBeChecked();
  await expect(page).toHaveURL(`${workspace}/`);

  await page.goto(`${workspace}/brains/engineering`);
  await expect(graph).toHaveAttribute("data-lens", "research");
  await expect(page.locator(".graph-controls > .brain-lens > summary")).toHaveAttribute("aria-label", "Brains: 1 dimmed");
  await expect(page).toHaveURL(`${workspace}/brains/engineering`);

  await page.goto(`${workspace}/brains/engineering/notes/principles/graph`);
  await expect(graph).toHaveAttribute("data-focused-node", "engineering/principles");
  await expect(graph).toHaveAttribute("data-lens", "research");
  await expect(graph).toHaveAttribute("data-dimmed-nodes", "0");
  await expect(page).toHaveURL(`${workspace}/brains/engineering/notes/principles/graph`);

  const fresh = await browser.newContext();
  const visitor = await fresh.newPage();
  await visitor.goto(`${workspace}/`);
  const visitorGraph = visitor.locator("#global-graph");
  await expect(visitorGraph).toHaveAttribute("data-visible-nodes", total);
  await expect(visitorGraph).toHaveAttribute("data-lens", "");
  await expect(visitorGraph).toHaveAttribute("data-dimmed-nodes", "0");
  await visitor.locator(".graph-controls > .brain-lens > summary").click();
  await expect(visitor.getByRole("group", { name: "Brain lens" }).locator('input[value="research"]')).toBeChecked();
  await fresh.close();
  await context.close();
});

test("dimmed Brain notes stay hoverable and open on click", async ({ page }) => {
  await page.goto(`${workspace}/`);
  const graph = page.locator("#global-graph");
  await expect(graph.locator("canvas.sigma-nodes")).toBeVisible();
  await expect.poll(async () => Number(await graph.getAttribute("data-motion-completions"))).toBeGreaterThan(0);
  const payload = await graphPayload(page);
  const archive = "research-archive-and-synthesis-source-trails";
  const archiveNodes = payload.nodes.filter((node) => node.brainId === archive);
  expect(archiveNodes.length).toBeGreaterThan(1);
  const target = archiveNodes.find((node) => node.id === `${archive}/synthesis-trails`)!;
  const foreignNeighbors = payload.nodes.filter((node) => node.brainId !== archive).length;
  expect(foreignNeighbors).toBeGreaterThan(0);

  const lens = page.locator(".graph-controls > .brain-lens");
  await lens.locator("summary").click();
  const panel = page.getByRole("group", { name: "Brain lens" });
  await expect(panel).toContainText("dimmed, not hidden");
  await expect(panel).toContainText("focused neighborhood always shows fully");
  await panel.locator(`input[value="${archive}"]`).uncheck();
  await expect(graph).toHaveAttribute("data-lens", archive);
  await expect(graph).toHaveAttribute("data-dimmed-nodes", String(archiveNodes.length));
  await page.keyboard.press("Escape");
  await expect(lens.locator("summary")).toHaveAttribute("aria-expanded", "false");

  await page.getByRole("button", { name: "Legend" }).click();
  const legend = page.getByRole("region", { name: "Graph legend" });
  await expect(legend).toContainText("Dimmed node belongs to a Brain unchecked in the lens");
  await expect(legend).toContainText("not hidden and still opens on click");
  await page.keyboard.press("Escape");
  await expect(legend).toBeHidden();

  // Hover preview is a reader preference, off until asked for.
  await page.locator("#graph-hover-preview").click();
  await expect(page.locator("#graph-hover-preview")).toHaveAttribute("aria-pressed", "true");
  const point = await pointerTargetFor(graph, target.id);
  await page.mouse.move(point.x, point.y);
  await expect(graph).toHaveAttribute("data-transient-inspection", target.id);
  await expect(graph).toHaveCSS("cursor", "pointer");
  // The hovered node and its neighborhood render at full emphasis over the
  // lens: its title is drawn and only unrelated archive notes stay dimmed.
  await expect(graph).toHaveAttribute("data-rendered-label-ids", new RegExp(`(^|,)${target.id}(,|$)`, "u"));
  await expect(graph).toHaveAttribute("data-dimmed-nodes", String(archiveNodes.length - 1));
  await expect(graph).toHaveAttribute("data-visible-nodes", String(payload.nodes.length));
  await expect(page).toHaveURL(`${workspace}/`);

  await page.mouse.click(point.x, point.y);
  await expect(page).toHaveURL(`${workspace}${target.route}`);
  await expect(page.locator("article")).toHaveAttribute("data-brain-id", archive);
});

test("graph search reaches dimmed Brains and focuses their notes at full emphasis", async ({ page }) => {
  await page.goto(`${workspace}/`);
  const graph = page.locator("#global-graph");
  await expect(graph.locator("canvas.sigma-nodes")).toBeVisible();
  const payload = await graphPayload(page);
  const researchNotes = payload.nodes.filter((node) => node.brainId === "research");
  expect(researchNotes.length).toBeGreaterThan(0);
  const evidence = researchNotes.find((node) => node.id === "research/evidence")!;

  await page.locator(".graph-controls > .brain-lens > summary").click();
  await page.getByRole("group", { name: "Brain lens" }).locator('input[value="research"]').uncheck();
  await expect(graph).toHaveAttribute("data-lens", "research");
  await expect(graph).toHaveAttribute("data-dimmed-nodes", String(researchNotes.length));

  await page.getByRole("button", { name: "Filters" }).click();
  await page.locator("#graph-search").fill(evidence.title);
  const result = page.locator("#graph-search-results button", { hasText: "@research" });
  await expect(result).toBeVisible();
  await expect(result).toContainText(evidence.title);
  await expect(result).toHaveAttribute("aria-label", `${evidence.title}, Research brain @research`);
  await result.click();

  await expect(graph).toHaveAttribute("data-focused-node", evidence.id);
  await expect(page.locator("[data-graph-focus-status]")).toContainText(evidence.title);
  await expect(graph).toHaveAttribute("data-lens", "research");
  await expect(graph).toHaveAttribute("data-dimmed-nodes", "0");
  await expect(graph).toHaveAttribute("data-visible-nodes", String(payload.nodes.length));
  await expect(page).toHaveURL(`${workspace}/brains/research/notes/evidence/graph`);
  // Focus is the pathname now, and nothing else rides along in a query.
  expect(new URL(page.url()).search).toBe("");
});

test("neighborhood pages list connected domains as lens chips that never remove nodes", async ({ page }) => {
  const focusedTitle = Array.from(
    { length: 6 },
    () => "A deliberately long focused neighborhood title that cannot fit within a phone viewport",
  ).join(" ");
  const neighborTitle = "An exceptionally long direct-neighbor title that must not clip at the fitted overview";
  await page.route("**/graph-data.json", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    data.nodes.find((node: { id: string }) => node.id === "engineering/principles").title = focusedTitle;
    data.nodes.find((node: { id: string }) => node.id === "engineering/delivery-loops").title = neighborTitle;
    await route.fulfill({ response, json: data });
  });
  const neighborhood = `${workspace}/brains/engineering/notes/principles/graph`;
  await page.goto(neighborhood);
  const graph = page.locator("#global-graph");
  await expect(graph).toHaveAttribute("data-focused-node", "engineering/principles");
  const payload = await graphPayload(page);
  const total = String(payload.nodes.length);
  await expect(graph).toHaveAttribute("data-visible-nodes", total);

  const domains = page.locator("[data-graph-domains]");
  await expect(domains).toBeVisible();
  await expect(domains).toContainText("Connected domains");
  const chips = domains.locator("li:not([hidden])");
  await expect(chips).toHaveCount(3);
  expect(await chips.evaluateAll((items) => items.map((item) => (item as HTMLElement).dataset.domainBrain)))
    .toEqual(["engineering", "design", "research"]);
  for (const [brainId, title, count] of [
    ["engineering", "Engineering", "2"],
    ["design", "Design", "1"],
    ["research", "Research", "1"],
  ]) {
    const chip = domains.locator(`[data-domain-brain="${brainId}"]`);
    await expect(chip).toBeVisible();
    await expect(chip.locator("[data-brain-mark]")).toHaveCount(1);
    await expect(chip.locator(".graph-domain__title")).toHaveText(title);
    await expect(chip.locator("[data-domain-count]")).toHaveText(count);
    await expect(chip.getByRole("button")).toHaveAttribute("aria-pressed", "false");
    await expect(chip.locator("[data-domain-state]")).toBeHidden();
  }
  await expect(domains.locator(`[data-domain-brain="research-archive-and-synthesis-source-trails"]`)).toBeHidden();

  const researchChip = domains.locator('[data-domain-brain="research"]').getByRole("button");
  await researchChip.click();
  await expect(researchChip).toHaveAttribute("aria-pressed", "true");
  await expect(researchChip).toContainText("dimmed");
  await expect(researchChip.locator("[data-domain-state]")).toBeVisible();
  await expect(graph).toHaveAttribute("data-lens", "research");
  await expect(graph).toHaveAttribute("data-dimmed-nodes", "0");
  await expect(graph).toHaveAttribute("data-visible-nodes", total);
  await expect(graph).toHaveAttribute("data-visible-brain-ids", allBrainIds);
  await expect(graph).toHaveAttribute("data-focused-node", "engineering/principles");
  await expect(chips).toHaveCount(3);
  await expect(page).toHaveURL(neighborhood);
  const lensSummary = page.locator(".graph-controls > .brain-lens > summary");
  await expect(lensSummary).toHaveAttribute("aria-label", "Brains: 1 dimmed");
  await lensSummary.click();
  const panel = page.getByRole("group", { name: "Brain lens" });
  await expect(panel.locator('input[value="research"]')).not.toBeChecked();
  await panel.locator('input[value="research-archive-and-synthesis-source-trails"]').uncheck();
  await expect(graph).toHaveAttribute("data-lens", "research,research-archive-and-synthesis-source-trails");
  await expect(graph).toHaveAttribute("data-dimmed-nodes", String(
    payload.nodes.filter((node) => node.brainId === "research-archive-and-synthesis-source-trails").length,
  ));
  await expect(chips).toHaveCount(3);
  await page.keyboard.press("Escape");

  await researchChip.click();
  await expect(researchChip).toHaveAttribute("aria-pressed", "false");
  await expect(researchChip.locator("[data-domain-state]")).toBeHidden();
  await expect(graph).toHaveAttribute("data-lens", "research-archive-and-synthesis-source-trails");
  await expect(page).toHaveURL(neighborhood);
  await lensSummary.click();
  await expect(panel.locator('input[value="research"]')).toBeChecked();
  await panel.getByRole("button", { name: "Show all" }).click();
  await expect(graph).toHaveAttribute("data-lens", "");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Copy link" }).focus();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(graph).toHaveAttribute("data-responsive-policy", "narrow");
  const focusStatus = page.locator("[data-graph-focus-status]");
  const focusDetails = page.locator("[data-graph-focus-details]");
  const disclosure = page.getByRole("button", { name: "Show focus details" });
  const open = page.getByRole("link", { name: "Open focused note" });
  const markersClearFocusBar = () => page.evaluate(() => {
    const graph = document.querySelector<HTMLElement>("#global-graph")!;
    const host = graph.getBoundingClientRect();
    const bar = document.querySelector<HTMLElement>("[data-graph-focus-status]")!.getBoundingClientRect();
    const markers = JSON.parse(graph.dataset.focusedMarkerGeometry ?? "[]") as { y: number; radius: number }[];
    return markers.length === 4 && markers.every((marker) => marker.y + marker.radius <= bar.top - host.top - 10);
  });
  await expect(disclosure).toHaveAttribute("aria-expanded", "false");
  await expect(disclosure).toBeFocused();
  await expect(focusDetails).toBeHidden();
  await expect(domains).toBeHidden();
  await expect(page.getByRole("button", { name: "Copy link" })).toBeHidden();
  await expect(open).toBeVisible();
  await expect.poll(() => focusStatus.evaluate((status) => {
    const bounds = status.getBoundingClientRect();
    return {
      atMost72: bounds.height <= 72,
      contained: bounds.left >= 0 && bounds.right <= innerWidth && bounds.bottom <= innerHeight,
      oneRow: status.querySelector("[data-graph-focus-summary]")!.getBoundingClientRect().height <= 44,
      touchTargets: [...status.querySelectorAll<HTMLElement>("[data-graph-focus-open], [data-graph-focus-disclosure]")]
        .every((control) => {
          const controlBounds = control.getBoundingClientRect();
          return controlBounds.width >= 44 && controlBounds.height >= 44;
        }),
      noOverflow: document.documentElement.scrollWidth <= innerWidth,
    };
  })).toEqual({ atMost72: true, contained: true, oneRow: true, touchTargets: true, noOverflow: true });
  await expect.poll(markersClearFocusBar).toBe(true);

  const collapsedGeometry = await graph.getAttribute("data-focused-marker-geometry");
  await graph.evaluate((host) => {
    host.dataset.geometryCheckPending = "";
  });
  await page.getByRole("button", { name: "Fit view" }).click();
  await expect(graph).not.toHaveAttribute("data-geometry-check-pending");
  const graphSpaceGeometry = await graph.getAttribute("data-graph-geometry");
  const fitRequests = Number(await graph.getAttribute("data-fit-requests"));
  await graph.evaluate((host) => {
    host.dataset.geometryCheckPending = "";
  });
  await disclosure.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Hide focus details" })).toBeFocused();
  await expect(page.getByRole("button", { name: "Hide focus details" })).toHaveAttribute("aria-expanded", "true");
  await expect(focusDetails).toBeVisible();
  await expect(page.locator("[data-graph-focus-title-full]")).toHaveText(focusedTitle);
  await expect(domains).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy link" })).toBeVisible();
  // A note's path is the graph page with that note focused, so focus clears
  // in place here exactly as it does anywhere else.
  await expect(page.locator("[data-graph-focus-clear]")).toHaveText("Clear focus");
  await expect(graph).toHaveAttribute("data-focused-node", "engineering/principles");
  await expect.poll(async () => Number(await graph.getAttribute("data-fit-requests"))).toBeGreaterThan(fitRequests);
  await expect(graph).not.toHaveAttribute("data-geometry-check-pending");
  expect(await graph.getAttribute("data-graph-geometry")).toBe(graphSpaceGeometry);
  await expect.poll(() => page.evaluate(() => {
    const graph = document.querySelector<HTMLElement>("#global-graph")!;
    const status = document.querySelector<HTMLElement>("[data-graph-focus-status]")!;
    const host = graph.getBoundingClientRect();
    const bar = status.getBoundingClientRect();
    const markers = JSON.parse(graph.dataset.focusedMarkerGeometry ?? "[]") as { y: number; radius: number }[];
    const controls = [...status.querySelectorAll<HTMLElement>("a, button")]
      .filter((control) => control.offsetParent !== null)
      .map((control) => control.getBoundingClientRect());
    return {
      markersClear: markers.length === 4 && markers.every((marker) => marker.y + marker.radius <= bar.top - host.top - 10),
      bounded: bar.top >= 0 && bar.bottom <= innerHeight,
      // The bar is one row with the details as an overlay above it, so what
      // scrolls within the height limit is the title segment or the panel
      // rather than the bar as a whole.
      scrollable: [status, ...status.querySelectorAll<HTMLElement>(
        "[data-graph-focus-details], .graph-focus-summary > span",
      )].some((element) => element.scrollHeight > element.clientHeight),
      touchTargets: controls.every((control) => control.width >= 44 && control.height >= 44),
      noOverflow: document.documentElement.scrollWidth <= innerWidth,
    };
  })).toEqual({ markersClear: true, bounded: true, scrollable: true, touchTargets: true, noOverflow: true });
  const collapseCompletions = Number(await graph.getAttribute("data-motion-completions"));
  await page.keyboard.press("Escape");
  await expect(disclosure).toBeFocused();
  await expect(disclosure).toHaveAttribute("aria-expanded", "false");
  await expect(focusDetails).toBeHidden();
  await expect(graph).toHaveAttribute("data-focused-node", "engineering/principles");
  await expect.poll(async () => Number(await graph.getAttribute("data-motion-completions")))
    .toBeGreaterThan(collapseCompletions);
  expect(collapsedGeometry).toBeTruthy();
  await expect(graph).toHaveAttribute("data-inspection-canvas-label", /…$/u);
  expect(await graph.getAttribute("data-inspection-canvas-label")).not.toContain(focusedTitle);
  const overviewNeighborLabel = await graph.getAttribute("data-focused-marker-geometry").then((value) =>
    (JSON.parse(value ?? "[]") as { id: string; label: string }[])
      .find(({ id }) => id === "engineering/delivery-loops")?.label
  );
  // Whatever the overview does with a long neighbour title, it never truncates
  // it silently: the label is omitted, drawn complete because wrapping made it
  // fit, or shortened with an ellipsis. Zooming reveals it in full below.
  expect(
    overviewNeighborLabel === "" ||
    overviewNeighborLabel.includes(neighborTitle) ||
    overviewNeighborLabel.endsWith("…"),
  ).toBe(true);

  // Zoom towards the neighbour itself. A label is only placed for a node that
  // is on screen, so zooming towards a fixed point can push the very node
  // being revealed out of frame.
  const neighborAt = async () => {
    const value = await graph.getAttribute("data-focused-marker-geometry");
    return (JSON.parse(value ?? "[]") as { id: string; label: string; x: number; y: number }[])
      .find(({ id }) => id === "engineering/delivery-loops");
  };
  const host = (await graph.boundingBox())!;
  for (let index = 0; index < 10; index += 1) {
    const neighbor = await neighborAt();
    if (neighbor?.label.includes(neighborTitle)) break;
    if (neighbor) await page.mouse.move(host.x + neighbor.x, host.y + neighbor.y);
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(120);
  }
  await expect.poll(async () => {
    const value = await graph.getAttribute("data-focused-marker-geometry");
    return (JSON.parse(value ?? "[]") as { id: string; label: string }[])
      .find(({ id }) => id === "engineering/delivery-loops")?.label;
  }).toContain(neighborTitle);
  const resetCompletions = Number(await graph.getAttribute("data-motion-completions"));
  await page.getByRole("button", { name: "Fit view" }).click();
  await expect.poll(async () => Number(await graph.getAttribute("data-motion-completions")))
    .toBeGreaterThan(resetCompletions);
  await expect(graph).toHaveAttribute("data-inspection-canvas-label", /…$/u);

  await page.setViewportSize({ width: 320, height: 568 });
  await expect.poll(() => focusStatus.evaluate((status) => {
    const bounds = status.getBoundingClientRect();
    return {
      atMost72: bounds.height <= 72,
      contained: bounds.left >= 0 && bounds.right <= innerWidth,
      noOverflow: document.documentElement.scrollWidth <= innerWidth,
    };
  })).toEqual({ atMost72: true, contained: true, noOverflow: true });
  await expect.poll(markersClearFocusBar).toBe(true);
  await disclosure.focus();
  await page.setViewportSize({ width: 800, height: 700 });
  await expect(disclosure).toBeHidden();
  await expect(open).toBeFocused();
  await expect(focusDetails).toBeVisible();
  const desktopFitRequests = await graph.getAttribute("data-fit-requests");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(50);
  await expect(graph).toHaveAttribute("data-fit-requests", desktopFitRequests ?? "");

  await page.goto(`${workspace}/brains/research-archive-and-synthesis-source-trails/notes/archive-boundaries/graph`);
  await expect(graph).toHaveAttribute("data-focused-node", "research-archive-and-synthesis-source-trails/archive-boundaries");
  await expect(domains.locator("li:not([hidden])")).toHaveCount(1);
  await expect(domains.locator('[data-domain-brain="research-archive-and-synthesis-source-trails"] .graph-domain__title'))
    .toHaveText("Research Archive");
  await expect(domains.locator("li:not([hidden]) [data-domain-count]")).toHaveText(["1"]);

  // Connected domains are no longer confined to a note's own neighborhood page:
  // which Brains a neighborhood reaches into is the same question on the
  // workspace graph, where the markup is present but empty until focus exists.
  await page.goto(`${workspace}/`);
  await expect(page.locator("[data-graph-domains]")).toHaveCount(1);
  await expect(page.locator("[data-graph-domains]")).toBeHidden();
  // A per-Brain graph is not the full workspace, so it has no domain list.
  await page.goto(`${workspace}/brains/engineering`);
  await expect(page.locator("[data-graph-domains]")).toHaveCount(0);
});

test("mobile root graph and Brain lens remain usable without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${workspace}/`);

  const graph = page.locator("#global-graph");
  await expect(graph.locator("canvas.sigma-nodes")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const launcher = page.getByRole("button", { name: "Navigation" });
  await expect(launcher).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".nav-actions")).toHaveJSProperty("inert", true);
  await expect(page.locator(".site-header .brain-lens")).toHaveCount(0);
  await expect(page.locator(".graph-controls > .brain-lens")).toHaveCount(1);
  await launcher.click();
  await expect(launcher).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".site-header").getByRole("link", { name: "Graph" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Search" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(launcher).toBeFocused();
  await expect(page.getByRole("button", { name: "About" })).toBeVisible();

  const controls = page.locator(".graph-controls");
  const actions = await controls.locator(
    ":scope > .graph-control, :scope > .graph-legend-disclosure > .graph-control, :scope > .brain-lens > summary",
  ).evaluateAll((elements) => elements.map((element) => {
    const { width, height } = element.getBoundingClientRect();
    return { width, height };
    // A control hidden at this width, such as the hover-preview toggle, is
    // not an action a phone reader can reach.
  }).filter(({ width }) => width > 0));
  expect(actions.length).toBeGreaterThan(0);
  expect(actions.every(({ width, height }) => width >= 44 && height >= 44)).toBe(true);

  const summary = controls.locator(".brain-lens > summary");
  await summary.click();
  const panel = page.getByRole("group", { name: "Brain lens" });
  expect(await panel.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return bounds.left >= 0 && bounds.right <= innerWidth && bounds.bottom <= innerHeight;
  })).toBe(true);
  expect(await panel.locator('input[name="brain-lens"]').evaluateAll((inputs) =>
    inputs.map((input) => (input as HTMLInputElement).value)
  )).toEqual(hierarchyOrder);
  await panel.locator('input[value="research"]').uncheck();
  await expect(graph).toHaveAttribute("data-lens", "research");
  await expect(summary).toHaveAttribute("aria-label", "Brains: 1 dimmed");
  await expect(page).toHaveURL(`${workspace}/`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator("main").dispatchEvent("pointerdown");
  await expect(summary).toHaveAttribute("aria-expanded", "false");
  await expect(graph).toHaveAttribute("data-lens", "research");
});

test("persistent context and graph controls stay contained across supported widths", async ({ page }) => {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(`${workspace}/`);
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

    await page.locator(".brain-lens > summary").click();
    expect(await page.locator(".brain-lens__panel").evaluate((panel) => {
      const bounds = panel.getBoundingClientRect();
      return bounds.left >= 0 && bounds.right <= innerWidth && bounds.bottom <= innerHeight;
    })).toBe(true);
    await page.keyboard.press("Escape");
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
  await expect(header.locator(".brain-lens")).toHaveCount(0);

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
    sessionStorage.getItem("graph-related-brains:/workspace-demo/brains/engineering") === "false"
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
    sessionStorage.getItem("graph-related-brains:/workspace-demo/brains/engineering") === "false"
  );
  await expect(graph).not.toHaveAttribute("data-filter-settle-pending");
  await page.waitForTimeout(300);
  await expect(graph).not.toHaveAttribute("data-filter-settle-pending");
  expect(await page.evaluate(() =>
    Object.keys(sessionStorage).filter((key) =>
      /graph-(motion|view):/.test(key) && key.includes(":brain:engineering:false:")
    ).length
  )).toBeGreaterThan(0);
  // The address is the focused note's neighborhood path, so reloading opens
  // that page: the same graph and the same focus, without the graph page's own
  // controls.
  await page.reload();
  await expect(page).toHaveURL(`${workspace}/brains/engineering/notes/principles/graph`);
  await expect(graph).toHaveAttribute("data-focused-node", "engineering/principles");
  // That page scopes to its own Brain, and related Brains are off, so it shows
  // no foreign notes.
  await expect(graph).toHaveAttribute("data-foreign-nodes", "0");

  // The related-Brains preference is keyed to the graph rather than the
  // address, so it survives a focus that rewrote the address.
  await page.goto(`${workspace}/brains/engineering`);
  await expect(relatedBrains).toHaveAttribute("aria-pressed", "false");
  // And turning them back on brings the foreign neighbours with it.
  await relatedBrains.click();
  await expect(graph).toHaveAttribute("data-foreign-nodes", "2");
  await relatedBrains.click();
  await expect(graph).toHaveAttribute("data-foreign-nodes", "0");

  await page.goto(`${workspace}/`);
  const crossEdges = String(payload.edges.filter((edge: { crossBrain: boolean }) => edge.crossBrain).length);
  await expect(graph).toHaveAttribute("data-graph-mode", "all");
  await expect(graph).toHaveAttribute("data-visible-nodes", String(payload.nodes.length));
  await expect(graph).toHaveAttribute("data-visible-brain-ids", allBrainIds);
  await expect(graph).toHaveAttribute("data-foreign-nodes", "0");
  await expect(graph).toHaveAttribute("data-cross-edges", crossEdges);
  await expect(page.locator("#graph-sidebar input[name='brain-lens'], #graph-sidebar input[name='brain-context']")).toHaveCount(0);
  await expect(page.locator(".combined-context, .graph-brain-filters")).toHaveCount(0);
  const lensSummary = page.locator(".graph-controls > .brain-lens > summary");
  await lensSummary.click();
  await expect(lensSummary).toHaveAttribute("aria-expanded", "true");
  const lensPanel = page.getByRole("group", { name: "Brain lens" });
  await lensPanel.getByRole("checkbox", { name: "Research @research", exact: true }).uncheck();
  await expect(graph).toHaveAttribute("data-lens", "research");
  await expect(graph).toHaveAttribute("data-visible-nodes", String(payload.nodes.length));
  await expect(graph).toHaveAttribute("data-visible-brain-ids", allBrainIds);
  await expect(graph).toHaveAttribute("data-cross-edges", crossEdges);
  await expect(page).toHaveURL(`${workspace}/`);
});

test("graph search pins in-session focus and copies the neighborhood path", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText(value: string) {
          (window as unknown as { copiedNeighborhoodLink?: string }).copiedNeighborhoodLink = value;
          return Promise.resolve();
        },
      },
    });
  });
  await page.goto(`${workspace}/brains/engineering`);
  const graph = page.locator("#global-graph");
  await expect(graph.locator("canvas.sigma-nodes")).toBeVisible();
  await page.getByRole("button", { name: "Filters" }).click();
  await page.locator("#graph-search").fill("Principles");
  const result = page.locator("#graph-search-results button", { hasText: "@engineering" });
  await result.focus();
  await page.keyboard.press("Enter");
  // A pinned neighborhood's address is its neighborhood page path, the same
  // string the copy action produces.
  await expect(page).toHaveURL(`${workspace}/brains/engineering/notes/principles/graph`);
  await expect(graph).toHaveAttribute("data-focused-node", "engineering/principles");
  await expect(page.locator("[data-graph-focus-status]")).toContainText("Principles");
  expect(await page.locator("[data-graph-focus-status]").evaluate((status) => {
    const title = status.querySelector("[data-graph-focus-title]")!.getBoundingClientRect();
    const copy = status.querySelector("[data-graph-focus-copy]")!.getBoundingClientRect();
    return Math.abs((title.top + title.bottom) / 2 - (copy.top + copy.bottom) / 2);
  })).toBeLessThan(8);
  await page.locator("[data-graph-focus-copy]").click();
  await expect(page.locator("[data-graph-focus-copy]")).toHaveText("Copied");
  const copied = await page.evaluate(() =>
    (window as unknown as { copiedNeighborhoodLink?: string }).copiedNeighborhoodLink
  );
  expect(copied).toBe(`${workspace}/brains/engineering/notes/principles/graph`);
  const recipient = await page.context().newPage();
  await recipient.setViewportSize({ width: 390, height: 844 });
  await recipient.goto(copied!);
  await expect(recipient).toHaveURL(copied!);
  const recipientGraph = recipient.locator("#global-graph");
  await expect(recipientGraph).toHaveAttribute("data-focused-node", "engineering/principles");
  await expect(recipientGraph).toHaveAttribute("data-visible-brain-ids", /engineering,design,research/u);
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

  // Reloading follows the canonical address, which is the focused note's
  // neighborhood page rather than the graph page carrying query state.
  await page.reload();
  await expect(page).toHaveURL(`${workspace}/brains/engineering/notes/principles/graph`);
  await expect(graph).toHaveAttribute("data-focused-node", "engineering/principles");

  // What follows is about the graph page's own focus controls, which a
  // neighborhood page deliberately does not have, so pin it there again.
  await page.goto(`${workspace}/brains/engineering`);
  await expect(graph.locator("canvas.sigma-nodes")).toBeVisible();
  const reopenFilters = page.getByRole("button", { name: /Filters|Close filters/ });
  if (await reopenFilters.getAttribute("aria-expanded") === "false") await reopenFilters.click();
  await page.locator("#graph-search").fill("Principles");
  await page.locator("#graph-search-results button", { hasText: "@engineering" }).click();
  await expect(graph).toHaveAttribute("data-focused-node", "engineering/principles");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Show focus details" }).click();
  const mobileCopy = page.locator("[data-graph-focus-copy]");
  await mobileCopy.click();
  await expect(mobileCopy).toHaveText("Copied");
  await expect(graph).toHaveAttribute("data-focused-node", "engineering/principles");
  const filtersToggle = page.getByRole("button", { name: /Filters|Close filters/ });
  if (await filtersToggle.getAttribute("aria-expanded") === "false") await filtersToggle.click();
  await page.keyboard.press("Escape");
  await expect(filtersToggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("button", { name: "Hide focus details" })).toHaveAttribute("aria-expanded", "true");
  await filtersToggle.click();
  await page.locator("#graph-search").fill("Delivery loops");
  await page.locator("#graph-search-results button", { hasText: "Delivery loops" }).click();
  await expect(graph).toHaveAttribute("data-focused-node", "engineering/delivery-loops");
  await expect(page.getByRole("button", { name: "Show focus details" })).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("[data-graph-focus-details]")).toBeHidden();
  await page.getByRole("button", { name: "Show focus details" }).click();
  await page.getByRole("button", { name: "Clear" }).click();
  await expect(graph).not.toHaveAttribute("data-focused-node");
  await expect(page.locator("[data-graph-focus-status]")).toBeHidden();

  await page.locator("#graph-search").fill("Principles");
  await page.locator("#graph-search-results button", { hasText: "@engineering" }).click();
  await expect(graph).toHaveAttribute("data-focused-node", "engineering/principles");

  const payload = await page.evaluate(async () => (await fetch("/workspace-demo/graph-data.json")).json());
  const focusedType = payload.nodes.find(
    (node: { compositeId: string }) => node.compositeId === "engineering/principles",
  ).type;
  const filters = page.getByRole("button", { name: /Filters|Close filters/ });
  if (await filters.getAttribute("aria-expanded") === "false") await filters.click();
  await page.locator(`[data-filter="type"][value="${focusedType}"]`).uncheck();
  await expect(graph).not.toHaveAttribute("data-focused-node");
  await expect(page).toHaveURL(`${workspace}/brains/engineering`);

  await page.goto(`${workspace}/brains/engineering?focus=design%2Fprinciples`);
  await expect(page.locator("#graph-related-toggle")).toHaveAttribute("aria-pressed", "false");
  await expect(graph).toHaveAttribute("data-focused-node", "design/principles");
  await expect(graph).toHaveAttribute("data-foreign-nodes", /[1-9]\d*/u);

  await page.goto(
    `${workspace}/brains/engineering?focus=engineering%2Fprinciples&focus=design%2Fprinciples`,
  );
  await expect(page).toHaveURL(`${workspace}/brains/engineering`);
  await expect(graph).not.toHaveAttribute("data-focused-node");
});

async function expectGraphShellScope(page: Page, brainId?: string) {
  const scopePath = brainId ? `/brains/${brainId}` : "";
  for (const route of ["tags", "recent", "orphans"]) {
    await expect(page.locator(`[data-scope-route="${route}"]`)).toHaveJSProperty(
      "href", `${workspace}${scopePath}/${route}`,
    );
  }
  const graphLink = page.locator(".graph-trigger");
  await expect(graphLink).toHaveJSProperty("href", `${workspace}${scopePath || "/"}`);
  expect(await graphLink.evaluate((anchor) => (anchor as HTMLAnchorElement).hidden)).toBe(!brainId);
  const home = page.locator(".graph-home-action");
  await expect(home).toHaveJSProperty("href", `${workspace}/`);
  if (brainId) await expect(home).toBeVisible();
  else await expect(home).toBeHidden();
  await expect(page.locator("#graph-filter-toggle")).toHaveCSS("border-inline-start-width", brainId ? "1px" : "0px");
  await page.keyboard.press("Control+k");
  const scope = page.getByLabel("Quick switcher scope");
  await expect(scope).toHaveValue(brainId ? "active" : "all");
  await expect(scope.locator("option")).toHaveCount(brainId ? 2 : 1);
  if (brainId) await expect(scope.locator('[value="active"]')).toContainText(`@${brainId}`);
  await page.getByLabel("Search notes and tags").fill("Principles");
  const results = page.locator("#switcher-results li");
  await expect(results).toHaveCount(brainId ? 1 : 2);
  if (brainId) await expect(results).toContainText(`@${brainId}`);
  else {
    await expect(results.filter({ hasText: "@engineering" })).toHaveCount(1);
    await expect(results.filter({ hasText: "@design" })).toHaveCount(1);
  }
  await page.keyboard.press("Escape");
}

test("neighborhood pages keep query-free URLs and move focus in place", async ({ page }) => {
  await page.addInitScript(() => {
    const calls: string[] = [];
    (window as unknown as { replaceStateCalls: string[] }).replaceStateCalls = calls;
    const original = history.replaceState.bind(history);
    history.replaceState = (data, unused, url) => {
      calls.push(String(url));
      original(data, unused, url);
    };
  });
  const neighborhood = `${workspace}/brains/engineering/notes/principles/graph`;
  await page.goto(neighborhood);
  const graph = page.locator("#global-graph");
  await expect(graph).toHaveAttribute("data-focused-node", "engineering/principles");
  // A note's path is the graph page with that note focused, so focus clears
  // in place here exactly as it does anywhere else.
  await expect(page.locator("[data-graph-focus-clear]")).toHaveText("Clear focus");
  await expect(page.locator("[data-graph-focus-copy]")).toBeVisible();
  await expect(page).toHaveURL(neighborhood);
  await expectGraphShellScope(page, "engineering");

  await page.getByRole("button", { name: "Filters" }).click();
  await page.locator("#graph-search").fill("Principles");
  await page.evaluate(() => { (window as unknown as { samePage: boolean }).samePage = true; });
  await page.locator("#graph-search-results button", { hasText: "@design" }).click();
  // Moving focus is not a page load: the address is replaced with the new
  // neighborhood's own path, which is the same string Copy link produces.
  await expect(page).toHaveURL(`${workspace}/brains/design/notes/principles/graph`);
  await expect(graph).toHaveAttribute("data-focused-node", "design/principles");
  await expect(page.locator("[data-graph-focus-status]")).toContainText("Principles");
  expect(page.url()).not.toContain("?");
  expect(await page.evaluate(() => (window as unknown as { samePage?: boolean }).samePage)).toBe(true);
  expect(await page.evaluate(() =>
    (window as unknown as { replaceStateCalls: string[] }).replaceStateCalls
  )).toEqual([`${new URL(workspace).pathname}/brains/design/notes/principles/graph`]);
  await expectGraphShellScope(page, "design");

  const focusedType = (await page.evaluate(async () =>
    (await fetch("/workspace-demo/graph-data.json")).json()
  )).nodes.find((node: { compositeId: string }) => node.compositeId === "design/principles").type;
  const filters = page.getByRole("button", { name: /Filters|Close filters/ });
  if (await filters.getAttribute("aria-expanded") === "false") await filters.click();
  await page.locator(`[data-filter="type"][value="${focusedType}"]`).uncheck();
  await expect(graph).not.toHaveAttribute("data-focused-node");
  // Nothing is focused now, and the address says so: it names the graph the
  // neighborhood belonged to, still without a query string.
  await expect(page).toHaveURL(`${workspace}/`);
  expect(page.url()).not.toContain("?");
  expect(await page.evaluate(() => (window as unknown as { samePage?: boolean }).samePage)).toBe(true);
  await expectGraphShellScope(page);
});

for (const width of [390, 1280]) for (const brainId of [undefined, "engineering"]) {
  test(`graph shell follows pin and clear from ${brainId ?? "workspace"} at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const graphPath = brainId ? `/brains/${brainId}` : "/";
    await page.goto(`${workspace}${graphPath}`);
    const graph = page.locator("#global-graph");
    await expect(graph).toHaveAttribute("data-visible-nodes");
    await graph.evaluate((host) => { host.dataset.scopeTest = "same-page"; });
    await expectGraphShellScope(page, brainId);
    if (brainId) await page.locator("#graph-related-toggle").click();
    await page.getByRole("button", { name: "Filters", exact: true }).click();
    await page.locator("#graph-search").fill("Principles");
    await page.locator("#graph-search-results button", { hasText: "@design" }).click();
    await expect(page).toHaveURL(`${workspace}/brains/design/notes/principles/graph`);
    await expectGraphShellScope(page, "design");
    await page.locator("[data-graph-focus-clear]").click();
    await expect(page).toHaveURL(`${workspace}${graphPath}`);
    await expectGraphShellScope(page, brainId);
    await expect(graph).toHaveAttribute("data-scope-test", "same-page");
    await page.reload();
    await expect(graph).toHaveAttribute("data-visible-nodes");
    await expectGraphShellScope(page, brainId);
  });
}

test("a neighborhood page's focus fit never becomes the root graph's saved camera", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const graph = page.locator("#global-graph");
  const sessionKeys = () => page.evaluate(() =>
    Object.keys(sessionStorage).filter((key) => /^graph-(motion|view):/.test(key))
  );
  // Fits keep the camera near its default and frame the graph through the
  // renderer's bounding box, so a saved view's extent is its zoom level.
  const savedViewArea = (scope: string) => page.evaluate((scope) => {
    const key = Object.keys(sessionStorage).find((key) =>
      key.startsWith("graph-view:") && key.includes(`:${scope}:`)
    );
    if (!key) return null;
    const { view } = JSON.parse(sessionStorage.getItem(key)!) as {
      view: { bbox: { x: [number, number]; y: [number, number] } };
    };
    return (view.bbox.x[1] - view.bbox.x[0]) * (view.bbox.y[1] - view.bbox.y[0]);
  }, scope);

  await page.goto(`${workspace}/brains/engineering/notes/principles/graph`);
  await expect(graph).toHaveAttribute("data-focused-node", "engineering/principles");
  await expect.poll(async () => Number(await graph.getAttribute("data-fit-requests"))).toBeGreaterThan(0);
  // The initial settle completes first, then the focus fit.
  await expect.poll(async () => Number(await graph.getAttribute("data-motion-completions"))).toBeGreaterThan(1);
  const neighborhoodScope = "neighborhood:engineering/principles";
  const neighborhoodArea = await savedViewArea(neighborhoodScope);
  expect(neighborhoodArea).toBeGreaterThan(0);
  expect(await savedViewArea("all")).toBeNull();
  expect((await sessionKeys()).filter((key) => !key.includes(`:${neighborhoodScope}:`))).toEqual([]);

  await page.goto(`${workspace}/`);
  await expect(graph).toHaveAttribute("data-graph-mode", "all");
  await expect(graph).not.toHaveAttribute("data-focused-node");
  // Nothing was saved for the root graph, so it settles and fits every note
  // instead of restoring the neighborhood close-up.
  await expect.poll(async () => Number(await graph.getAttribute("data-settle-requests"))).toBeGreaterThan(0);
  await expect.poll(async () => Number(await graph.getAttribute("data-motion-completions"))).toBeGreaterThan(0);
  expect(await savedViewArea("all")).toBeGreaterThan(neighborhoodArea!);
  expect(await savedViewArea(neighborhoodScope)).toBe(neighborhoodArea);
  await context.close();
});

test("graph ownership legend remains non-color-readable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${workspace}/brains/engineering`);
  const graph = page.locator("#global-graph");
  const relatedBrains = page.locator("#graph-related-toggle");
  const controls = page.locator(".graph-controls");
  const filterToggle = controls.getByRole("button", { name: "Filters" });
  const actions = controls.getByRole("button");
  await expect(actions).toHaveCount(6);
  await expect(controls.getByRole("button", { name: "Filters" })).toBeVisible();
  await expect(controls.getByRole("button", { name: "Help" })).toBeVisible();
  await expect(controls.getByRole("button", { name: "Fit view" })).toBeVisible();
  await expect(controls.getByRole("button", { name: "Show related brains" })).toBeVisible();
  await expect(controls.getByRole("button", { name: "Legend" })).toBeVisible();
  await expect(controls.getByRole("button", { name: "Brains", exact: true })).toBeVisible();
  const initialGeometry = await page.evaluate(() => {
    const controls = document.querySelector(".graph-controls")!.getBoundingClientRect();
    const navigation = document.querySelector(".site-header")!.getBoundingClientRect();
    const actions = [...document.querySelectorAll<HTMLElement>(
      ".graph-controls > button, .graph-controls > .graph-legend-disclosure > button, .graph-controls > .brain-lens > summary",
    )]
      .map((button) => button.getBoundingClientRect())
      // Controls hidden at this width, such as the hover-preview toggle, take
      // no space and are not actions a phone reader can reach.
      .filter((bounds) => bounds.width > 0);
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

  await page.goto(`${workspace}/`);
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
  await page.setViewportSize({ width: 699, height: 900 });
  await expect(page.locator("#global-graph")).toHaveAttribute("data-responsive-policy", "narrow");
  await page.setViewportSize({ width: 702, height: 900 });
  await expect(page.locator("#global-graph")).toHaveAttribute("data-responsive-policy", "wide");

  const geometry = await page.evaluate(() => {
    const controls = document.querySelector(".graph-controls")!.getBoundingClientRect();
    const navigation = document.querySelector(".site-header")!.getBoundingClientRect();
    const actions = [...document.querySelectorAll<HTMLElement>(
      ".graph-controls > button, .graph-controls > .graph-legend-disclosure > button, .graph-controls > .brain-lens > summary",
    )]
      .map((button) => button.getBoundingClientRect())
      // The hover-preview toggle hides itself on a coarse pointer.
      .filter((bounds) => bounds.width > 0);
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
  await expect(graph.locator("canvas.sigma-nodes")).toBeVisible();
  const completionsBefore = Number(await graph.getAttribute("data-motion-completions") ?? 0);
  await page.getByRole("button", { name: "Show related brains" }).click();
  await expect(graph).toHaveAttribute("data-foreign-nodes", "24");
  // Revealing related brains settles and refits the graph; label selection
  // runs again once the camera stops and its fades finish. Counting before
  // that catches a transient set, which under load can be empty for a frame.
  await expect.poll(async () => Number(await graph.getAttribute("data-motion-completions")), { timeout: 10_000 })
    .toBeGreaterThan(completionsBefore);
  await page.waitForTimeout(600);
  await expect.poll(async () => Number(await graph.getAttribute("data-rendered-foreign-labels")))
    .toBeGreaterThan(0);
  const automaticLabels = Number(await graph.getAttribute("data-rendered-foreign-labels"));
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

test("quick switcher scope follows the page path: Brain, note owner, then the whole workspace", async ({ page }) => {
  const scope = page.getByLabel("Quick switcher scope");
  const search = page.getByLabel("Search notes and tags");
  const results = page.locator("#switcher-results li");
  const scopeValues = () => scope.evaluate((select) =>
    [...(select as HTMLSelectElement).options].map((option) => option.value)
  );

  // A Brain page defaults to that Brain and offers the workspace as the only other scope.
  await page.goto(`${workspace}/brains/design`);
  await page.keyboard.press("Control+k");
  await expect(scope).toHaveValue("active");
  expect(await scopeValues()).toEqual(["active", "all"]);
  await search.fill("Principles");
  await expect(results).toHaveCount(1);
  await expect(results).toContainText("@design");
  await page.keyboard.press("Escape");

  // A note page defaults to its owner, derived from the path alone.
  await page.goto(`${workspace}/brains/engineering/notes/principles`);
  await page.getByRole("button", { name: "Navigation" }).click();
  await page.getByRole("button", { name: "Search" }).click();
  await expect(scope).toHaveValue("active");
  await expect(search).toBeFocused();
  await search.fill("Principles");
  await expect(results).toHaveCount(1);
  await expect(results).toContainText("@engineering");
  await search.fill("decisions");
  await expect(results.filter({ hasText: "#decisions" })).toContainText("tag · @engineering");

  // Widening to the workspace reveals the other Brains' results with owners.
  await page.keyboard.press("Tab");
  await expect(scope).toBeFocused();
  await scope.selectOption("all");
  await page.keyboard.press("Tab");
  await expect(search).toBeFocused();
  await search.fill("Principles");
  await expect(results).toHaveCount(2);
  await expect(results.filter({ hasText: "@design" })).toContainText("Principles");
  await expect(results.filter({ hasText: "@engineering" })).toContainText("Principles");
  await page.keyboard.press("Escape");

  // A neighborhood page is the note's page too.
  await page.goto(`${workspace}/brains/design/notes/principles/graph`);
  await page.keyboard.press("Control+k");
  await expect(scope).toHaveValue("active");
  await search.fill("Principles");
  await expect(results).toHaveCount(1);
  await expect(results).toContainText("@design");
  await page.keyboard.press("Escape");

  // Workspace-level pages default to every Brain and offer nothing narrower.
  for (const path of ["/", "/recent", "/tags/decisions"]) {
    await page.goto(`${workspace}${path}`);
    await page.keyboard.press("Control+k");
    await expect(scope).toHaveValue("all");
    expect(await scopeValues()).toEqual(["all"]);
    await search.fill("Principles");
    await expect(results).toHaveCount(2);
    await page.keyboard.press("Escape");
  }

  // Confirming a result opens the note's pathname-only route, where the
  // switcher defaults to that note's owner.
  await page.goto(`${workspace}/`);
  await page.keyboard.press("Control+k");
  await search.fill("Interaction model");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(`${workspace}/brains/design/notes/interaction-model`);
  await page.keyboard.press("Control+k");
  await expect(scope).toHaveValue("active");
  await search.fill("Principles");
  await expect(results).toHaveCount(1);
  await expect(results).toContainText("@design");
});

test("dedicated Search routes are absent", async ({ request }) => {
  expect((await request.get(`${workspace}/search`)).status()).toBe(404);
  expect((await request.get(`${workspace}/brains/engineering/search`)).status()).toBe(404);
  expect((await request.get(`${workspace}/pagefind/`)).status()).toBe(404);
  expect((await request.get(`${workspace}/search-index.json`)).status()).toBe(200);
});

test("workspace 404 recovery follows the namespaced path and ignores query scope", async ({ page }) => {
  // A miss beneath a Brain path recovers to that Brain's graph with one of its notes.
  const scopedMissing = `${workspace}/brains/engineering/notes/missing`;
  const response = await page.goto(scopedMissing);
  expect(response?.status()).toBe(404);
  await expect(page).toHaveURL(scopedMissing);
  await expect(page.getByRole("link", { name: "Return to @engineering's graph" })).toHaveAttribute(
    "href",
    "/workspace-demo/brains/engineering",
  );
  await expect(page.locator("[data-recommendation-owner]")).toContainText("@engineering");
  const initial = await page.locator("[data-recommendation-title]").textContent();
  await page.reload();
  await expect(page.locator("[data-recommendation-title]")).toHaveText(initial ?? "");
  const recommendedHref = await page.locator("[data-recommendation-link]").getAttribute("href");
  expect(recommendedHref).toMatch(/^\/workspace-demo\/brains\/engineering\/notes\/[^?#]+$/u);
  await page.locator("[data-recommendation-link]").click();
  expect(new URL(page.url()).search).toBe("");
  await expect(page.locator("article")).toHaveAttribute("data-brain-id", "engineering");

  // Query parameters are never scope: a root-level miss recovers to the full
  // workspace graph with a note from any Brain, and no selection card appears.
  const queriedMissing = `${workspace}/notes/missing?brains=engineering,design`;
  await page.goto(queriedMissing);
  await expect(page).toHaveURL(queriedMissing);
  await expect(page.getByRole("link", { name: "Return to the workspace graph" })).toHaveAttribute(
    "href",
    "/workspace-demo/",
  );
  await expect(page.getByRole("link", { name: "Return to the selected graph" })).toHaveCount(0);
  await expect(page.getByText("Choose a valid set of Brains")).toHaveCount(0);
  await expect(page.locator("[data-recommendation-owner]")).toContainText(
    new RegExp(`@(${hierarchyOrder.join("|")}) · `, "u"),
  );
  expect(await page.locator("[data-recommendation-link]").getAttribute("href")).not.toContain("?");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByLabel("Quick switcher scope")).toHaveValue("all");
  await page.keyboard.press("Escape");

  // An unknown Brain ID in the path is not scope either.
  await page.goto(`${workspace}/brains/unknown/notes/missing?brains=unknown`);
  await expect(page.getByRole("link", { name: "Return to the workspace graph" })).toHaveAttribute(
    "href",
    "/workspace-demo/",
  );
  await expect(page.locator("[data-recommendation-owner]")).not.toContainText("@unknown");
});

test("workspace-wide reports aggregate every Brain and name each entry's owner", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const ownersIn = (list: string) => page.locator(`${list} [data-note-owner]`).evaluateAll((owners) =>
    [...new Set(owners.map((owner) => owner.getAttribute("data-note-owner")))].sort()
  );

  await page.goto(`${workspace}/recent`);
  await expect(page).toHaveURL(`${workspace}/recent`);
  await expect(page.getByRole("heading", { name: "Recently changed" })).toBeVisible();
  expect(await ownersIn(".recent-list")).toEqual([...hierarchyOrder].sort());
  await expect(page.getByRole("link", { name: "Interaction model" }))
    .toHaveAttribute("href", "/workspace-demo/brains/design/notes/interaction-model");
  await expect(page.getByRole("link", { name: "Delivery loops" }))
    .toHaveAttribute("href", "/workspace-demo/brains/engineering/notes/delivery-loops");
  const owner = page.locator(".recent-list li", { hasText: "Delivery loops" }).locator("[data-note-owner]");
  await expect(owner).toHaveText("@engineering");
  await expect(owner).toHaveAttribute("title", "Engineering");
  await expect(owner.locator("[data-brain-mark]")).toHaveCount(1);

  await page.goto(`${workspace}/orphans`);
  await expect(page).toHaveURL(`${workspace}/orphans`);
  await expect(page.locator(".note-list li")).toHaveCount(3);
  expect(await ownersIn(".note-list")).toEqual(["design", "research-archive-and-synthesis-source-trails"]);
  await expect(page.getByRole("link", { name: "Color tokens" }))
    .toHaveAttribute("href", "/workspace-demo/brains/design/notes/color-tokens");
  await expect(page.locator(".note-list li", { hasText: "Archive boundaries" }).locator("[data-note-owner]"))
    .toHaveText("@research-archive-and-synthesis-source-trails");

  await page.goto(`${workspace}/tags`);
  await expect(page).toHaveURL(`${workspace}/tags`);
  const decisions = page.locator(".note-list li", { has: page.getByRole("link", { name: "#decisions" }) });
  await expect(decisions.getByRole("link", { name: "#decisions" })).toHaveAttribute("href", "/workspace-demo/tags/decisions");
  await expect(decisions).toContainText("2 notes");
  await expect(decisions.locator("[data-note-owner]")).toHaveText(["@engineering", "@design"]);
  const research = page.locator(".note-list li", { has: page.getByRole("link", { name: "#research" }) });
  await expect(research).toContainText("3 notes");
  await expect(research.locator("[data-note-owner]"))
    .toHaveText(["@research", "@research-archive-and-synthesis-source-trails"]);

  await decisions.getByRole("link", { name: "#decisions" }).click();
  await expect(page).toHaveURL(`${workspace}/tags/decisions`);
  const rows = page.locator(".note-list li");
  await expect(rows).toHaveCount(2);
  await expect(rows.filter({ hasText: "@engineering" }).getByRole("link", { name: "Principles" }))
    .toHaveAttribute("href", "/workspace-demo/brains/engineering/notes/principles");
  await expect(rows.filter({ hasText: "@design" }).getByRole("link", { name: "Principles" }))
    .toHaveAttribute("href", "/workspace-demo/brains/design/notes/principles");

  for (const path of ["/tags", "/tags/decisions", "/recent", "/orphans"]) {
    await page.goto(`${workspace}${path}`);
    await expect(page).toHaveURL(`${workspace}${path}`);
    await expect(page.getByRole("heading", { name: "Choose a brain" })).toHaveCount(0);
    await expect(page.locator('a[href*="brains="]')).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/workspace-demo/");
  }
  await context.close();
});

test("shared navigation targets the page context: workspace-wide at the root, Brain-scoped beneath a Brain", async ({ page }) => {
  const header = page.locator(".site-header");
  const launcher = page.getByRole("button", { name: "Navigation" });
  const expanded = () => header.locator(".nav-actions > .nav-action").evaluateAll((controls) =>
    controls
      .filter((control) => !(control as HTMLElement).hidden)
      .map((control) => [control.getAttribute("aria-label"), control.getAttribute("href")])
  );
  const rootReports = [
    ["Tags", "/workspace-demo/tags"],
    ["Recent", "/workspace-demo/recent"],
    ["Orphans", "/workspace-demo/orphans"],
  ];
  const designReports = [
    ["Tags", "/workspace-demo/brains/design/tags"],
    ["Recent", "/workspace-demo/brains/design/recent"],
    ["Orphans", "/workspace-demo/brains/design/orphans"],
  ];

  // The root graph is the destination Graph would open, so it omits Graph and Home.
  await page.goto(`${workspace}/`);
  await expect(page.getByRole("link", { name: "Home" })).toHaveCount(0);
  await launcher.click();
  expect(await expanded()).toEqual([["Search", null], ...rootReports]);
  await header.getByRole("link", { name: "Orphans" }).click();
  await expect(page).toHaveURL(`${workspace}/orphans`);

  // A workspace-wide report: Home and Graph both open the full workspace graph.
  await expect(page.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/workspace-demo/");
  await launcher.click();
  expect(await expanded()).toEqual([["Graph", "/workspace-demo/"], ["Search", null], ...rootReports]);
  await header.getByRole("link", { name: "Graph" }).click();
  await expect(page).toHaveURL(`${workspace}/`);
  await expect(page.locator("#global-graph")).toHaveAttribute("data-graph-mode", "all");

  // A Brain's graph: Brain-scoped reports and its own graph.
  await page.goto(`${workspace}/brains/design`);
  await launcher.click();
  expect(await expanded()).toEqual([["Graph", "/workspace-demo/brains/design"], ["Search", null], ...designReports]);
  await header.getByRole("link", { name: "Tags" }).click();
  await expect(page).toHaveURL(`${workspace}/brains/design/tags`);

  // A Brain-scoped report: Home opens the workspace graph, Graph the Brain's graph.
  await expect(page.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/workspace-demo/");
  await launcher.click();
  expect(await expanded()).toEqual([["Graph", "/workspace-demo/brains/design"], ["Search", null], ...designReports]);
  await header.getByRole("link", { name: "Graph" }).click();
  await expect(page).toHaveURL(`${workspace}/brains/design`);
  await expect(page.locator("#global-graph")).toHaveAttribute("data-visible-brain-ids", "design");

  // A note page keeps the Home and Graph pill; the menu carries the owner's reports and no Graph.
  await page.goto(`${workspace}/brains/design/notes/interaction-model`);
  const noteNavigation = page.locator(".page-note-nav");
  await expect(noteNavigation.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/workspace-demo/");
  await expect(noteNavigation.getByRole("link", { name: "Graph" }))
    .toHaveAttribute("href", "/workspace-demo/brains/design/notes/interaction-model/graph");
  await launcher.click();
  expect(await expanded()).toEqual([["Search", null], ...designReports]);
  await page.keyboard.press("Escape");
  await noteNavigation.getByRole("link", { name: "Home" }).click();
  await expect(page).toHaveURL(`${workspace}/`);

  // A neighborhood page lives beneath the note's Brain.
  await page.goto(`${workspace}/brains/design/notes/interaction-model/graph`);
  await launcher.click();
  expect(await expanded()).toEqual([["Graph", "/workspace-demo/brains/design"], ["Search", null], ...designReports]);

  // The not-found page is workspace-level.
  await page.goto(`${workspace}/nowhere`);
  await launcher.click();
  expect(await expanded()).toEqual([["Graph", "/workspace-demo/"], ["Search", null], ...rootReports]);
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
  await expect(page.locator(".recent-list li")).toHaveCount(3);
  await expect(page.locator(".recent-list [data-note-owner]")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Interaction model" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Delivery loops" })).toHaveCount(0);

  await page.goto(`${workspace}/brains/engineering/notes/principles`);
  const nearby = page.getByRole("navigation", { name: "Notes in the connection map" });
  await expect(nearby).toContainText("Principles↗ @design");
  await expect(nearby).toContainText("Evidence↗ @research");
  await expect(nearby).not.toContainText("Interaction model");
});
