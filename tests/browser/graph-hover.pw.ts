import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

function deployment(testInfo: TestInfo) {
  const url = new URL(String(testInfo.project.use.baseURL));
  return { base: url.pathname.replace(/\/$/u, "") };
}

const targetId = "hover-target";
const graphData = {
  nodes: [
    {
      id: targetId,
      title: "A deliberately unmistakable hover target title",
      route: "/notes/welcome",
      type: "permanent",
      status: "established",
      tags: [],
      degree: 100,
      x: 0,
      y: 0,
    },
    {
      id: "neighbor",
      title: "Neighbor",
      route: "/notes/portable-notes",
      type: "literature",
      status: "developing",
      tags: [],
      degree: 2,
      x: 1,
      y: 0,
    },
    {
      id: "unrelated-a",
      title: "Other A",
      route: "/notes/atomic-notes",
      type: "fleeting",
      status: "draft",
      tags: [],
      degree: 1,
      x: -1,
      y: 1,
    },
    {
      id: "unrelated-b",
      title: "Other B",
      route: "/notes/maps-of-content",
      type: "fleeting",
      status: "draft",
      tags: [],
      degree: 1,
      x: -1,
      y: -1,
    },
  ],
  edges: [
    { source: targetId, target: "neighbor" },
    { source: "unrelated-a", target: "unrelated-b" },
  ],
};
const contextGraphData = {
  ...graphData,
  edges: [...graphData.edges, { source: "neighbor", target: "unrelated-a" }],
};

async function renderedLabelAnchor(labelsCanvas: Locator, selection: "longest" | "shortest" = "longest") {
  return labelsCanvas.evaluate((canvas, selection) => {
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
    const ordered = bands.sort((a, b) => b.right - b.left - (a.right - a.left));
    const selected = selection === "longest" ? ordered[0] : ordered.at(-1);
    if (!selected) throw new Error("No rendered graph title found");
    const bounds = element.getBoundingClientRect();
    return {
      left: bounds.left + (selected.left / element.width) * bounds.width,
      right: bounds.left + (selected.right / element.width) * bounds.width,
      y: bounds.top + ((selected.top + selected.bottom) / 2 / element.height) * bounds.height,
    };
  }, selection);
}

async function nodeLeftOfLabel(page: Page, graph: Locator, label: { left: number; y: number }) {
  for (let offset = 2; offset <= 90; offset += 2) {
    const point = { x: label.left - offset, y: label.y };
    await page.mouse.move(point.x, point.y);
    if ((await graph.evaluate((host) => host.style.cursor)) === "pointer") return point;
  }
  throw new Error("Could not find graph node left of its label");
}

async function targetWithinLabel(
  page: Page,
  graph: Locator,
  label: { left: number; right: number; y: number },
) {
  for (let x = label.left; x <= label.right; x += 2) {
    const point = { x, y: label.y };
    await page.mouse.move(point.x, point.y);
    if ((await graph.evaluate((host) => host.style.cursor)) === "pointer") return point;
  }
  throw new Error("Could not find graph target within its rendered label");
}

async function unrelatedContextTarget(page: Page, graph: Locator, menu: Locator, close = true) {
  const point = await graph.evaluate((host) => {
    const bounds = host.getBoundingClientRect();
    const menu = document.querySelector<HTMLElement>("[data-graph-context-menu]")!;
    for (let y = 30; y < bounds.height - 30; y += 18) {
      for (let x = 30; x < bounds.width - 30; x += 18) {
        const clientX = bounds.left + x;
        const clientY = bounds.top + y;
        host.dispatchEvent(new PointerEvent("pointermove", {
          bubbles: true,
          clientX,
          clientY,
          pointerType: "mouse",
        }));
        if (host.style.cursor === "pointer") continue;
        host.dispatchEvent(new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          button: 2,
          clientX,
          clientY,
        }));
        if (!menu.hidden) return { x: clientX, y: clientY };
      }
    }
    return null;
  });
  if (!point) throw new Error("Could not find a lower-emphasis context node");
  await expect(menu.getByRole("menuitem", { name: "Move focus here" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Open note" })).toBeVisible();
  if (close) await page.keyboard.press("Escape");
  return point;
}

async function graphCounts(graph: Locator) {
  return graph.evaluate((host) => ({
    responsive: Number((host as HTMLElement).dataset.responsiveUpdates ?? 0),
    settles: Number((host as HTMLElement).dataset.settleRequests ?? 0),
    fits: Number((host as HTMLElement).dataset.fitRequests ?? 0),
    completions: Number(
      (host as HTMLElement).dataset.motionCompletions
      ?? (host as HTMLElement).dataset.fitCompletions
      ?? 0,
    ),
  }));
}

async function canvasInkPixels(canvas: Locator) {
  return canvas.evaluate((element) => {
    const target = element as HTMLCanvasElement;
    const pixels = target.getContext("2d")!.getImageData(0, 0, target.width, target.height).data;
    let count = 0;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] > 0) count += 1;
    }
    return count;
  });
}

async function verifyStableResponsiveInspection(
  page: Page,
  graph: Locator,
  finalViewport: { width: number; height: number },
  finalPolicy: "narrow" | "wide",
) {
  await graph.scrollIntoViewIfNeeded();
  const before = await graphCounts(graph);
  await page.setViewportSize(finalViewport);
  await expect.poll(async () => (await graphCounts(graph)).responsive).toBe(before.responsive + 1);
  await expect.poll(async () => (await graphCounts(graph)).completions).toBe(before.completions + 1);
  await page.waitForTimeout(300);

  const settled = await graphCounts(graph);
  expect(settled).toEqual({
    responsive: before.responsive + 1,
    settles: before.settles + 1,
    fits: before.fits,
    completions: before.completions + 1,
  });
  await expect(graph).toHaveAttribute("data-responsive-policy", finalPolicy);

  const labelsCanvas = graph.locator("canvas.sigma-labels");
  const label = await renderedLabelAnchor(labelsCanvas);
  const target = await targetWithinLabel(page, graph, label);
  await expect(graph).toHaveAttribute("data-transient-inspection", /.+/u);
  await expect(graph).toHaveAttribute("data-inspection-target-geometry", /"kind":"marker"/u);
  await expect(graph).toHaveAttribute("data-inspection-target-geometry", /"kind":"label"/u);
  const identity = await graph.getAttribute("data-transient-inspection");
  const targets = await graph.getAttribute("data-inspection-target-geometry");
  const graphGeometry = await graph.getAttribute("data-graph-geometry");
  const cameraGeometry = await graph.getAttribute("data-camera-geometry");
  const hoverCounts = await graphCounts(graph);

  for (let index = 0; index < 6; index += 1) {
    await page.mouse.move(target.x, target.y);
    await expect(graph).toHaveAttribute("data-transient-inspection", identity!);
  }
  await page.waitForTimeout(250);
  expect(await graph.getAttribute("data-inspection-target-geometry")).toBe(targets);
  expect(await graph.getAttribute("data-graph-geometry")).toBe(graphGeometry);
  expect(await graph.getAttribute("data-camera-geometry")).toBe(cameraGeometry);
  expect(await graphCounts(graph)).toEqual(hoverCounts);

  await page.mouse.click(target.x, target.y);
  return identity;
}

for (const colorScheme of ["light", "dark"] as const) {
test(`a hovered graph node stays emphasized and clickable in ${colorScheme} mode`, async ({ page }, testInfo) => {
  const { base } = deployment(testInfo);
  await page.emulateMedia({ colorScheme });
  await page.route("**/graph-data.json", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(graphData) }),
  );
  await page.goto(`${base}/`);

  const graph = page.locator("#global-graph");
  const mouseCanvas = graph.locator("canvas.sigma-mouse");
  const nodesCanvas = graph.locator("canvas.sigma-nodes");
  const labelsCanvas = graph.locator("canvas.sigma-labels");
  await expect(nodesCanvas).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate((id) =>
        Object.entries(sessionStorage).some(([key, raw]) => {
          if (!key.startsWith("graph-motion:")) return false;
          try {
            return Object.hasOwn(JSON.parse(raw).positions ?? {}, id);
          } catch {
            return false;
          }
        }), targetId),
    )
    .toBe(true);
  await page.waitForTimeout(400);
  const normalNodes = await nodesCanvas.screenshot();
  const normalLabels = await labelsCanvas.screenshot();

  const label = await renderedLabelAnchor(labelsCanvas);
  const target = await nodeLeftOfLabel(page, graph, label);
  await page.waitForTimeout(50);

  const emphasizedNodes = await nodesCanvas.screenshot();
  const emphasizedLabels = await labelsCanvas.screenshot();
  expect(emphasizedNodes.equals(normalNodes)).toBe(false);
  expect(emphasizedLabels.equals(normalLabels)).toBe(false);
  await expect(graph).toHaveAttribute("data-rendered-label-ids", "hover-target,neighbor");
  await expect(graph).toHaveAttribute("data-rendered-markers", "4");
  expect(await graph.getAttribute("data-graph-geometry"))
    .toBe(await graph.getAttribute("data-inspection-start-graph-geometry"));
  expect(await graph.getAttribute("data-camera-geometry"))
    .toBe(await graph.getAttribute("data-inspection-start-camera-geometry"));
  await graph.evaluate((host) => {
    const scope = window as unknown as {
      hoverStyleChanges: number;
      hoverStyleObserver: MutationObserver;
    };
    scope.hoverStyleChanges = 0;
    scope.hoverStyleObserver = new MutationObserver((records) => {
      scope.hoverStyleChanges += records.length;
    });
    scope.hoverStyleObserver.observe(host, { attributes: true, attributeFilter: ["style"] });
  });
  for (let index = 0; index < 12; index += 1) {
    await page.mouse.move(target.x, target.y);
    await expect(graph).toHaveCSS("cursor", "pointer");
    await page.waitForTimeout(25);
  }
  const styleChanges = await page.evaluate(() => {
    const scope = window as unknown as {
      hoverStyleChanges: number;
      hoverStyleObserver: MutationObserver;
    };
    scope.hoverStyleObserver.disconnect();
    return scope.hoverStyleChanges;
  });
  expect(styleChanges).toBe(0);
  expect((await nodesCanvas.screenshot()).equals(emphasizedNodes)).toBe(true);

  let retainedTitlePoints = 0;
  let transferred = false;
  for (let x = label.left; x <= label.right; x += Math.max(4, (label.right - label.left) / 20)) {
    await page.mouse.move(x, label.y);
    const inspected = await graph.getAttribute("data-transient-inspection");
    if (inspected === targetId) retainedTitlePoints += 1;
    if (inspected === "neighbor") transferred = true;
    await expect(graph).toHaveAttribute("data-rendered-label-ids", "hover-target,neighbor");
  }
  expect(retainedTitlePoints).toBeGreaterThan(2);
  expect(transferred).toBe(true);
  await page.mouse.move(label.left + 4, label.y);
  await expect(graph).toHaveAttribute("data-transient-inspection", targetId);
  await page.mouse.click(label.left + 4, label.y);
  await expect(page).toHaveURL(new RegExp(`${base}/notes/welcome/?$`));
  await expect(mouseCanvas).toHaveCount(0);
});
}

const localGraphData = {
  nodes: [
    { ...graphData.nodes[0], id: "welcome" },
    { ...graphData.nodes[1], id: "portable-notes" },
    graphData.nodes[2],
  ],
  edges: [
    { source: "welcome", target: "portable-notes" },
    { source: "portable-notes", target: "unrelated-a" },
  ],
};

test("fractional-scale breakpoint changes settle global and local targets once", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-root", "Fractional scale coverage runs once in Chromium.");
  const { base } = deployment(testInfo);
  const context = await browser.newContext({
    baseURL: String(testInfo.project.use.baseURL),
    deviceScaleFactor: 1.25,
    viewport: { width: 702, height: 760 },
  });
  const page = await context.newPage();
  await page.route("**/graph-data.json", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(localGraphData) }),
  );

  await page.goto(`${base}/`);
  const global = page.locator("#global-graph");
  await expect(global.locator("canvas.sigma-nodes")).toBeVisible();
  await expect.poll(async () => (await graphCounts(global)).completions).toBeGreaterThan(0);
  const globalIdentity = await verifyStableResponsiveInspection(
    page,
    global,
    { width: 699, height: 760 },
    "narrow",
  );
  const globalRoute = localGraphData.nodes.find((node) => node.id === globalIdentity)?.route;
  expect(globalRoute).toBeTruthy();
  await expect(page).toHaveURL(new RegExp(`${base}${globalRoute}/?$`));

  const local = page.locator(".local-graph");
  await expect(local.locator("canvas.sigma-nodes")).toBeVisible();
  await expect.poll(async () => (await graphCounts(local)).completions).toBeGreaterThan(0);
  const localIdentity = await verifyStableResponsiveInspection(
    page,
    local,
    { width: 702, height: 760 },
    "wide",
  );
  const localRoute = localGraphData.nodes.find((node) => node.id === localIdentity)?.route;
  expect(localRoute).toBeTruthy();
  await expect(page).toHaveURL(new RegExp(`${base}${localRoute}/?$`));
  await context.close();
});

test("global inspection follows a fractional breakpoint camera change", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-root", "Fractional scale coverage runs once in Chromium.");
  const { base } = deployment(testInfo);
  const context = await browser.newContext({
    baseURL: String(testInfo.project.use.baseURL),
    deviceScaleFactor: 1.25,
    viewport: { width: 702, height: 760 },
  });
  const page = await context.newPage();
  await page.route("**/graph-data.json", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(localGraphData) }),
  );
  await page.goto(`${base}/`);
  const graph = page.locator("#global-graph");
  await expect(graph.locator("canvas.sigma-nodes")).toBeVisible();
  await expect.poll(async () => (await graphCounts(graph)).completions).toBeGreaterThan(0);
  await graph.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await expect(graph).not.toHaveAttribute("data-transient-inspection");
  const before = await graphCounts(graph);

  await page.setViewportSize({ width: 699, height: 760 });
  await expect(graph).toHaveAttribute("data-responsive-policy", "narrow");
  await expect.poll(async () => (await graphCounts(graph)).completions).toBe(before.completions + 1);
  await page.waitForTimeout(300);
  await targetWithinLabel(
    page,
    graph,
    await renderedLabelAnchor(graph.locator("canvas.sigma-labels"), "shortest"),
  );
  await expect(graph).toHaveAttribute("data-transient-inspection", /.+/u);
  expect((await graphCounts(graph)).responsive).toBe(before.responsive + 1);

  expect(await graphCounts(graph)).toEqual({
    responsive: before.responsive + 1,
    settles: before.settles + 1,
    fits: before.fits,
    completions: before.completions + 1,
  });
  await context.close();
});

test("global camera actions apply pending responsive state without a resize settle", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-root", "Fractional scale coverage runs once in Chromium.");
  test.setTimeout(60_000);
  const { base } = deployment(testInfo);
  const context = await browser.newContext({
    baseURL: String(testInfo.project.use.baseURL),
    deviceScaleFactor: 1.25,
    viewport: { width: 702, height: 760 },
  });

  for (const action of ["fit", "search"] as const) {
    const page = await context.newPage();
    await page.route("**/graph-data.json", (route) =>
      route.fulfill({ contentType: "application/json", body: JSON.stringify(localGraphData) }),
    );
    await page.goto(`${base}/`);
    const graph = page.locator("#global-graph");
    await expect(graph.locator("canvas.sigma-nodes")).toBeVisible();
    await expect.poll(async () => (await graphCounts(graph)).completions).toBeGreaterThan(0);
    if (action === "search") {
      await page.getByRole("button", { name: "Filters" }).click();
      await page.locator("#graph-search").fill("Neighbor");
      await expect(page.getByRole("button", { name: "Neighbor", exact: true })).toBeVisible();
    }
    const before = await graphCounts(graph);

    await page.setViewportSize({ width: 699, height: 760 });
    if (action === "fit") await page.getByRole("button", { name: "Fit view" }).click();
    else await page.getByRole("button", { name: "Neighbor", exact: true }).click();

    expect((await graphCounts(graph)).responsive).toBe(before.responsive + 1);
    await expect(graph).toHaveAttribute("data-responsive-policy", "narrow");
    const dimensions = await graph.evaluate((host) => `${host.clientWidth}:${host.clientHeight}`);
    await expect(graph).toHaveAttribute("data-responsive-dimensions", dimensions);
    await expect.poll(async () => (await graphCounts(graph)).completions).toBe(before.completions + 1);
    await page.waitForTimeout(300);
    expect(await graphCounts(graph)).toEqual({
      responsive: before.responsive + 1,
      settles: before.settles,
      fits: before.fits + 1,
      completions: before.completions + 1,
    });
    await page.close();
  }
  await context.close();
});

for (const colorScheme of ["light", "dark"] as const) {
test(`local graph inspection fades unrelated content in ${colorScheme} mode`, async ({ page }, testInfo) => {
  const { base } = deployment(testInfo);
  await page.emulateMedia({ colorScheme });
  await page.route("**/graph-data.json", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(localGraphData) }),
  );
  await page.goto(`${base}/notes/welcome`);

  const graph = page.locator(".local-graph");
  const nodesCanvas = graph.locator("canvas.sigma-nodes");
  const labelsCanvas = graph.locator("canvas.sigma-labels");
  await expect(nodesCanvas).toBeVisible();
  await page.waitForTimeout(800);
  const normalNodes = await nodesCanvas.screenshot();
  const normalLabels = await labelsCanvas.screenshot();
  const target = await nodeLeftOfLabel(page, graph, await renderedLabelAnchor(labelsCanvas));
  await page.mouse.move(target.x, target.y);
  await expect(graph).toHaveCSS("cursor", "pointer");
  await page.waitForTimeout(50);

  expect((await nodesCanvas.screenshot()).equals(normalNodes)).toBe(false);
  expect((await labelsCanvas.screenshot()).equals(normalLabels)).toBe(false);
  await expect(graph).toHaveAttribute("data-rendered-label-ids", "portable-notes,welcome");
  await expect(graph).toHaveAttribute("data-rendered-markers", "3");
  expect(await graph.getAttribute("data-graph-geometry"))
    .toBe(await graph.getAttribute("data-inspection-start-graph-geometry"));
  expect(await graph.getAttribute("data-camera-geometry"))
    .toBe(await graph.getAttribute("data-inspection-start-camera-geometry"));
  for (let index = 0; index < 8; index += 1) {
    await page.mouse.move(target.x, target.y);
    await expect(graph).toHaveAttribute("data-rendered-label-ids", "portable-notes,welcome");
  }
  await page.mouse.move(0, 0);
  await expect(graph).toHaveCSS("cursor", "auto");
  await expect(page).toHaveURL(new RegExp(`${base}/notes/welcome/?$`));
});
}

test("desktop marker and title context menus establish shareable focus without replacing empty-stage behavior", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-root", "Desktop context-menu coverage runs once.");
  const { base } = deployment(testInfo);
  await page.route("**/graph-data.json", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(contextGraphData) }),
  );
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
  await page.goto(`${base}/?camera=7&filter=draft`);
  const graph = page.locator("#global-graph");
  const nodes = graph.locator("canvas.sigma-nodes");
  const labels = graph.locator("canvas.sigma-labels");
  const hovers = graph.locator("canvas.sigma-hovers");
  await expect(labels).toBeVisible();
  await expect(hovers).toBeVisible();
  await page.waitForTimeout(800);
  await page.emulateMedia({ colorScheme: "light" });
  const normalLight = await nodes.screenshot();
  await page.evaluate(() => {
    document.addEventListener("contextmenu", (event) => {
      document.body.dataset.lastContextPrevented = String(event.defaultPrevented);
    });
  });
  const initialLabel = await renderedLabelAnchor(labels);
  const target = await targetWithinLabel(page, graph, initialLabel);
  const graphBounds = (await graph.boundingBox())!;
  const emptyPoint = {
    x: graphBounds.x + graphBounds.width - 8,
    y: graphBounds.y + graphBounds.height - 8,
  };
  await page.mouse.move(target.x, target.y);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(emptyPoint.x, emptyPoint.y);
  await page.waitForTimeout(50);
  const labelDuringSecondaryPress = await renderedLabelAnchor(labels);
  expect(labelDuringSecondaryPress.left).toBeCloseTo(initialLabel.left, 0);
  expect(labelDuringSecondaryPress.y).toBeCloseTo(initialLabel.y, 0);
  await page.mouse.up({ button: "right" });
  const menu = page.getByRole("menu");
  if (await menu.isVisible()) await page.keyboard.press("Escape");
  const targetAfterSecondaryPress = await targetWithinLabel(
    page,
    graph,
    await renderedLabelAnchor(labels),
  );
  await page.mouse.click(targetAfterSecondaryPress.x, targetAfterSecondaryPress.y, { button: "right" });
  await expect(menu).toBeVisible();
  await page.mouse.move(emptyPoint.x, emptyPoint.y);
  await page.waitForTimeout(50);
  const labelAfterContextMove = await renderedLabelAnchor(labels);
  expect(labelAfterContextMove.left).toBeCloseTo(initialLabel.left, 0);
  expect(labelAfterContextMove.y).toBeCloseTo(initialLabel.y, 0);
  expect(await menu.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return bounds.left >= 0 && bounds.top >= 0 && bounds.right <= innerWidth && bounds.bottom <= innerHeight;
  })).toBe(true);
  await expect(page.locator("body")).toHaveAttribute("data-last-context-prevented", "true");
  await menu.getByRole("menuitem", { name: "Pin neighborhood" }).click();
  await expect(graph).toHaveAttribute("data-focused-inspection");
  await expect(page.locator("[data-graph-focus-status]")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${base}/?\\?focus=default%2F.+$`));
  expect(page.url()).not.toMatch(/[?&](?:camera|x|y|ratio|filter)=/u);
  await page.waitForTimeout(500);
  const focusedLight = await nodes.screenshot();
  expect(focusedLight.equals(normalLight)).toBe(false);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForTimeout(50);
  const focusedDark = await nodes.screenshot();
  const focusedHoverInk = await canvasInkPixels(hovers);

  const focusedNode = await graph.getAttribute("data-focused-node");
  const focusedLabel = await renderedLabelAnchor(labels);
  const neighborLabel = await renderedLabelAnchor(labels, "shortest");
  const neighborTarget = await targetWithinLabel(page, graph, neighborLabel);
  await page.mouse.move(neighborTarget.x, neighborTarget.y);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(emptyPoint.x, emptyPoint.y);
  await page.waitForTimeout(50);
  const focusedLabelDuringSecondaryPress = await renderedLabelAnchor(labels);
  expect(focusedLabelDuringSecondaryPress.left).toBeCloseTo(focusedLabel.left, 0);
  expect(focusedLabelDuringSecondaryPress.y).toBeCloseTo(focusedLabel.y, 0);
  await page.mouse.up({ button: "right" });
  await page.mouse.click(neighborTarget.x, neighborTarget.y, { button: "right" });
  await expect(menu).toBeVisible();
  await page.mouse.move(emptyPoint.x, emptyPoint.y);
  await page.waitForTimeout(50);
  const focusedLabelAfterContextMove = await renderedLabelAnchor(labels);
  expect(focusedLabelAfterContextMove.left).toBeCloseTo(focusedLabel.left, 0);
  expect(focusedLabelAfterContextMove.y).toBeCloseTo(focusedLabel.y, 0);
  await page.keyboard.press("Escape");
  await page.mouse.move(neighborTarget.x, neighborTarget.y);
  await page.waitForTimeout(50);
  await expect(graph).not.toHaveAttribute("data-transient-inspection");
  expect(await canvasInkPixels(hovers)).toBe(focusedHoverInk);
  await expect(graph).toHaveAttribute("data-focused-node", focusedNode ?? "");
  await graph.dispatchEvent("pointerleave", { pointerType: "mouse" });
  await expect(graph).not.toHaveAttribute("data-transient-inspection");
  expect(await canvasInkPixels(hovers)).toBe(focusedHoverInk);

  await page.mouse.move(
    graphBounds.x + graphBounds.width / 2,
    graphBounds.y + graphBounds.height / 2,
  );
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(300);
  const filters = page.getByRole("button", { name: "Filters" });
  await filters.click();
  await expect(filters).toHaveAttribute("aria-expanded", "true");
  const unrelatedTarget = await unrelatedContextTarget(page, graph, menu);
  await expect(filters).toHaveAttribute("aria-expanded", "false");
  await page.mouse.move(unrelatedTarget.x, unrelatedTarget.y);
  await expect(graph).toHaveCSS("cursor", "auto");
  const focusedUrl = page.url();
  await page.mouse.click(unrelatedTarget.x, unrelatedTarget.y);
  await page.waitForTimeout(100);
  await expect(page).toHaveURL(focusedUrl);
  await expect(graph).toHaveAttribute("data-focused-node", focusedNode ?? "");

  const beforeFocusedFit = await graphCounts(graph);
  await page.getByRole("button", { name: "Fit view" }).click();
  await expect.poll(async () => (await graphCounts(graph)).fits).toBe(beforeFocusedFit.fits + 1);
  await expect.poll(async () => (await graphCounts(graph)).completions)
    .toBeGreaterThan(beforeFocusedFit.completions);
  const labelAfterFocusedFit = await renderedLabelAnchor(labels);
  expect(labelAfterFocusedFit.left).toBeCloseTo(focusedLabel.left, 0);
  expect(labelAfterFocusedFit.y).toBeCloseTo(focusedLabel.y, 0);

  await expect(page.locator("[data-graph-focus-open]")).toHaveAttribute("href", /\/notes\//u);
  await page.locator("[data-graph-focus-clear]").click();
  await expect(graph).not.toHaveAttribute("data-focused-inspection");
  await expect(page).toHaveURL(new RegExp(`${base}/?$`));
  expect((await nodes.screenshot()).equals(focusedDark)).toBe(false);

  const marker = await nodeLeftOfLabel(page, graph, await renderedLabelAnchor(labels));
  await page.mouse.click(marker.x, marker.y, { button: "right" });
  await expect(menu).toBeVisible();
  await menu.getByRole("menuitem", { name: "Copy neighborhood link" }).click();
  const focusCopy = page.locator("[data-graph-focus-copy]");
  await expect(focusCopy).toHaveText("Copied");
  const copied = await page.evaluate(() =>
    (window as unknown as { copiedNeighborhoodLink?: string }).copiedNeighborhoodLink
  );
  expect(copied).toBeTruthy();
  const copiedUrl = new URL(copied!);
  expect(copiedUrl.pathname).toBe(`${base}/notes/${focusedNode}/graph`);
  expect(copiedUrl.search).toBe("");
  expect(copiedUrl.hash).toBe("");
  const recipient = await page.context().newPage();
  await recipient.setViewportSize({ width: 390, height: 844 });
  await recipient.route("**/graph-data.json", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(graphData) }),
  );
  // The fixture node is synthetic, so serve a real neighborhood page shell
  // whose initial focus names it.
  await recipient.route(`**/notes/${focusedNode}/graph`, async (route) => {
    const response = await route.fetch({
      url: new URL(`${base}/notes/welcome/graph/`, route.request().url()).href,
    });
    const body = (await response.text()).replaceAll("default/welcome", `default/${focusedNode}`);
    await route.fulfill({ response, body });
  });
  await recipient.goto(copied!);
  await expect(recipient).toHaveURL(copied!);
  const recipientGraph = recipient.locator("#global-graph");
  await expect(recipientGraph).toHaveAttribute("data-focused-node", focusedNode ?? "");
  await expect.poll(async () => Number(await recipientGraph.getAttribute("data-fit-requests")))
    .toBeGreaterThan(0);
  await expect(recipientGraph).toHaveAttribute("data-rendered-label-ids", "hover-target,neighbor");
  await expect(recipient.locator("[data-graph-focus-status]")).toBeVisible();
  await recipient.close();

  const bounds = (await graph.boundingBox())!;
  await page.mouse.click(bounds.x + bounds.width - 8, bounds.y + bounds.height - 8, { button: "right" });
  await expect(menu).toBeHidden();
  await expect(page.locator("body")).toHaveAttribute("data-last-context-prevented", "false");

  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(300);
  await unrelatedContextTarget(page, graph, menu, false);
  await menu.getByRole("menuitem", { name: "Move focus here" }).click();
  const movedFocusedNode = await graph.getAttribute("data-focused-node");
  expect(movedFocusedNode).toMatch(/^unrelated-[ab]$/u);
  expect(new URL(page.url()).searchParams.get("focus")).toBe(`default/${movedFocusedNode}`);

  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(300);
  await unrelatedContextTarget(page, graph, menu, false);
  await menu.getByRole("menuitem", { name: "Open note" }).click();
  await expect(page).toHaveURL(new RegExp(`${base}/notes/.+`));
  const openedPath = new URL(page.url()).pathname.replace(/\/$/u, "");
  const expectedPaths = movedFocusedNode === "unrelated-a"
    ? [`${base}/notes/welcome`]
    : [`${base}/notes/welcome`, `${base}/notes/portable-notes`];
  expect(expectedPaths).toContain(openedPath);
});

test("touch long press pins and clears graph inspection", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-root", "Trusted touch dispatch uses Chromium CDP once.");
  const { base } = deployment(testInfo);
  const context = await browser.newContext({
    baseURL: String(testInfo.project.use.baseURL),
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.route("**/graph-data.json", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(graphData) }),
  );
  await page.goto(`${base}/`);

  const graph = page.locator("#global-graph");
  const nodesCanvas = graph.locator("canvas.sigma-nodes");
  const labelsCanvas = graph.locator("canvas.sigma-labels");
  await expect(nodesCanvas).toBeVisible();
  await page.waitForTimeout(800);
  const target = await nodeLeftOfLabel(page, graph, await renderedLabelAnchor(labelsCanvas));
  await page.mouse.move(0, 0);
  await page.waitForTimeout(50);
  const normal = await nodesCanvas.screenshot();

  const cdp = await context.newCDPSession(page);
  const touch = async (point: { x: number; y: number }, hold = 0) => {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: point.x, y: point.y }],
    });
    if (hold) await page.waitForTimeout(hold);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  const drag = async (start: { x: number; y: number }, end: { x: number; y: number }) => {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: start.x, y: start.y }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: end.x, y: end.y }],
    });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  const addSecondTouch = async (point: { x: number; y: number }) => {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: point.x, y: point.y }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: point.x, y: point.y },
        { x: point.x + 20, y: point.y + 20 },
      ],
    });
    await page.waitForTimeout(550);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };

  await addSecondTouch(target);
  await expect(graph).not.toHaveAttribute("data-focused-inspection");
  await touch(target, 550);
  await expect(page).toHaveURL(new RegExp(`${base}/?\\?focus=default%2F.+$`));
  await expect(graph).toHaveAttribute("data-focused-inspection");
  await expect(page.locator("[data-graph-focus-status]")).toBeVisible();
  const pinned = await nodesCanvas.screenshot();
  expect(pinned.equals(normal)).toBe(false);

  const bounds = (await graph.boundingBox())!;
  const empty = { x: bounds.x + bounds.width - 12, y: bounds.y + bounds.height - 12 };
  await drag(empty, { x: empty.x - 50, y: empty.y - 50 });
  await expect(graph).toHaveAttribute("data-focused-inspection");

  await touch(empty);
  await expect(graph).not.toHaveAttribute("data-focused-inspection");
  await expect(page).toHaveURL(new RegExp(`${base}/?$`));
  expect((await nodesCanvas.screenshot()).equals(pinned)).toBe(false);
  await context.close();
});
