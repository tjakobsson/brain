import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

function deployment(testInfo: TestInfo) {
  const url = new URL(String(testInfo.project.use.baseURL));
  return { base: url.pathname.replace(/\/$/u, "") };
}

/**
 * Hover preview, the neighborhood lighting up under the pointer, is a reader
 * preference that starts off. Tests about that behavior turn it on first.
 */
async function enableHoverPreview(page: Page, graph: Locator) {
  if (await graph.getAttribute("data-hover-preview") === "true") return;
  // The D key works for either graph and does not depend on the control
  // being visible at the current width.
  await page.keyboard.press("d");
  await expect(graph).toHaveAttribute("data-hover-preview", "true");
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
    // Two labels drawn on the same rows are one row-band but two titles. Split
    // a band wherever a run of empty columns wider than a word space separates
    // ink, so the anchor is a single title's midpoint and not the empty canvas
    // between two nodes that happen to be level.
    const scale = element.width / element.getBoundingClientRect().width;
    const wordGap = Math.round(16 * scale);
    const titles: typeof bands = [];
    for (const rows of bands) {
      let run: (typeof bands)[number] | null = null;
      let emptySince = -1;
      for (let x = rows.left; x <= rows.right; x += 1) {
        let inked = false;
        for (let y = rows.top; y <= rows.bottom && !inked; y += 1) {
          inked = pixels[(y * element.width + x) * 4 + 3] !== 0;
        }
        if (inked) {
          if (run && emptySince >= 0 && x - emptySince > wordGap) {
            titles.push(run);
            run = null;
          }
          if (run) run.right = x;
          else run = { top: rows.top, bottom: rows.bottom, left: x, right: x };
          emptySince = -1;
        } else if (emptySince < 0) {
          emptySince = x;
        }
      }
      if (run) titles.push(run);
    }
    const ordered = titles.sort((a, b) => b.right - b.left - (a.right - a.left));
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

/**
 * The node a rendered label belongs to. Labels are centred horizontally on
 * their node and drawn below its marker, so the node is above the label's
 * midpoint rather than to the left of where the text starts.
 */
async function nodeAboveLabel(
  page: Page,
  graph: Locator,
  label: { left: number; right: number; y: number },
) {
  const x = (label.left + label.right) / 2;
  for (let offset = 4; offset <= 90; offset += 2) {
    const point = { x, y: label.y - offset };
    await page.mouse.move(point.x, point.y);
    if ((await graph.evaluate((host) => host.style.cursor)) === "pointer") return point;
  }
  throw new Error("Could not find graph node above its label");
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
  // Focusing fits the camera to the neighborhood, and until that settles the
  // lower-emphasis nodes can still be outside the viewport, where nothing can
  // be right-clicked. Retry rather than scan a moving graph once.
  const scan = () => graph.evaluate((host) => {
    const bounds = host.getBoundingClientRect();
    const menu = document.querySelector<HTMLElement>("[data-graph-context-menu]")!;
    let opened = 0;
    let pointerPoints = 0;
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
        if (host.style.cursor === "pointer") { pointerPoints += 1; continue; }
        host.dispatchEvent(new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          button: 2,
          clientX,
          clientY,
        }));
        // The menu opens on empty graph space too, offering only the actions
        // that are about the graph, so an open menu no longer proves a node was
        // hit. The node actions being present does.
        const nodeAction = menu.querySelector<HTMLElement>("[data-graph-menu-focus]");
        if (!menu.hidden) opened += 1;
        if (!menu.hidden && nodeAction && !nodeAction.hidden) return { x: clientX, y: clientY };
        menu.hidden = true;
      }
    }
    return { opened, pointerPoints, focused: host.dataset.focusedNode ?? "none" };
  });
  let found = await scan();
  for (let attempt = 0; attempt < 8 && !("x" in found); attempt += 1) {
    await page.waitForTimeout(250);
    found = await scan();
  }
  if (!("x" in found)) {
    throw new Error(`Could not find a lower-emphasis context node ${JSON.stringify(found)}`);
  }
  await expect(menu.getByRole("menuitem", { name: "Move focus here" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Open note" })).toBeVisible();
  if (close) await page.keyboard.press("Escape");
  return found;
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
  await enableHoverPreview(page, graph);
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
  await enableHoverPreview(page, graph);
  const normalNodes = await nodesCanvas.screenshot();
  const normalLabels = await labelsCanvas.screenshot();

  const label = await renderedLabelAnchor(labelsCanvas);
  const target = await nodeAboveLabel(page, graph, label);
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

  // Sweeping across a rendered title keeps its node inspected. The label sits
  // centred below its node rather than in a row beside its neighbours, so a
  // sweep along one title's row no longer passes over another node's title.
  // That a title is itself an inspection target is proved just below, where
  // the pointer lands on one and then clicks it.
  let retainedTitlePoints = 0;
  for (let x = label.left; x <= label.right; x += Math.max(4, (label.right - label.left) / 20)) {
    await page.mouse.move(x, label.y);
    const inspected = await graph.getAttribute("data-transient-inspection");
    if (inspected === targetId) retainedTitlePoints += 1;
    if (inspected === null) continue;
    // Whatever the pointer is over, that node's own title is on screen.
    expect((await graph.getAttribute("data-rendered-label-ids"))?.split(",")).toContain(inspected);
  }
  expect(retainedTitlePoints).toBeGreaterThan(2);

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
  await enableHoverPreview(page, graph);
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
  await enableHoverPreview(page, graph);
  const normalNodes = await nodesCanvas.screenshot();
  const normalLabels = await labelsCanvas.screenshot();
  const target = await nodeAboveLabel(page, graph, await renderedLabelAnchor(labelsCanvas));
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
  // What must not change when a context menu opens is the graph itself: which
  // nodes are where, where the camera is, and which titles are drawn. Comparing
  // the widest band of ink instead measures a proxy that legitimately shifts
  // when the pointer's own title joins the rendered set.
  // Node positions and the camera, which a context menu must never change.
  // Which labels are drawn is deliberately not compared: layout and selection
  // resolve once the camera settles rather than on every frame, so the set can
  // legitimately arrive a moment later.
  const graphState = async () => ({
    geometry: await graph.getAttribute("data-graph-geometry"),
    camera: await graph.getAttribute("data-camera-geometry"),
  });
  const graphBounds = (await graph.boundingBox())!;
  const emptyPoint = {
    x: graphBounds.x + graphBounds.width - 8,
    y: graphBounds.y + graphBounds.height - 8,
  };
  await page.mouse.move(target.x, target.y);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(emptyPoint.x, emptyPoint.y);
  await page.waitForTimeout(50);
  const duringSecondaryPress = await graphState();
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
  expect(await graphState()).toEqual(duringSecondaryPress);
  expect(await menu.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return bounds.left >= 0 && bounds.top >= 0 && bounds.right <= innerWidth && bounds.bottom <= innerHeight;
  })).toBe(true);
  await expect(page.locator("body")).toHaveAttribute("data-last-context-prevented", "true");
  await menu.getByRole("menuitem", { name: "Pin neighborhood" }).click();
  await expect(graph).toHaveAttribute("data-focused-inspection");
  await expect(page.locator("[data-graph-focus-status]")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${base}/notes/[^/?]+/graph/?$`));
  expect(page.url()).not.toMatch(/[?&](?:camera|x|y|ratio|filter)=/u);
  await page.waitForTimeout(500);
  const focusedLight = await nodes.screenshot();
  expect(focusedLight.equals(normalLight)).toBe(false);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForTimeout(50);
  const focusedDark = await nodes.screenshot();
  const focusedHoverInk = await canvasInkPixels(hovers);

  const focusedNode = await graph.getAttribute("data-focused-node");
  const focusedState = await graphState();
  const neighborLabel = await renderedLabelAnchor(labels, "shortest");
  const neighborTarget = await targetWithinLabel(page, graph, neighborLabel);
  await page.mouse.move(neighborTarget.x, neighborTarget.y);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(emptyPoint.x, emptyPoint.y);
  await page.waitForTimeout(50);
  expect((await graphState()).geometry).toBe(focusedState.geometry);
  await page.mouse.up({ button: "right" });
  await page.mouse.click(neighborTarget.x, neighborTarget.y, { button: "right" });
  await expect(menu).toBeVisible();
  await page.mouse.move(emptyPoint.x, emptyPoint.y);
  await page.waitForTimeout(50);
  expect((await graphState()).geometry).toBe(focusedState.geometry);
  await page.keyboard.press("Escape");
  await page.mouse.move(neighborTarget.x, neighborTarget.y);
  await page.waitForTimeout(50);
  // The pin does not move for a passing pointer, but the neighbor under it
  // shows its title on a plate: more hover ink than the pinned note alone.
  await expect(graph).not.toHaveAttribute("data-transient-inspection");
  await expect.poll(async () => await canvasInkPixels(hovers)).toBeGreaterThan(focusedHoverInk);
  await expect(graph).toHaveAttribute("data-focused-node", focusedNode ?? "");
  await graph.dispatchEvent("pointerleave", { pointerType: "mouse" });
  await expect(graph).not.toHaveAttribute("data-transient-inspection");
  await expect.poll(async () => await canvasInkPixels(hovers)).toBe(focusedHoverInk);

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
  // Fitting a focused neighborhood moves the camera, which is its job, but it
  // must not move the nodes themselves.
  expect((await graphState()).geometry).toBe(focusedState.geometry);

  await expect(page.locator("[data-graph-focus-open]")).toHaveAttribute("href", /\/notes\//u);
  await page.locator("[data-graph-focus-clear]").click();
  await expect(graph).not.toHaveAttribute("data-focused-inspection");
  await expect(page).toHaveURL(new RegExp(`${base}/?$`));
  expect((await nodes.screenshot()).equals(focusedDark)).toBe(false);

  const marker = await nodeAboveLabel(page, graph, await renderedLabelAnchor(labels));
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

  // Empty graph space now opens the graph's own menu, offering only the actions
  // that do not need a note. That replaces the native menu here, which the
  // graph used to leave alone.
  const bounds = (await graph.boundingBox())!;
  await page.mouse.click(bounds.x + bounds.width - 8, bounds.y + bounds.height - 8, { button: "right" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Fit view" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Clear focus" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Open note" })).toBeHidden();
  await expect(menu.getByRole("menuitem", { name: "Copy neighborhood link" })).toBeHidden();
  await expect(page.locator("body")).toHaveAttribute("data-last-context-prevented", "true");
  await page.keyboard.press("Escape");

  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(300);
  await unrelatedContextTarget(page, graph, menu, false);
  await menu.getByRole("menuitem", { name: "Move focus here" }).click();
  const movedFocusedNode = await graph.getAttribute("data-focused-node");
  expect(movedFocusedNode).toMatch(/^unrelated-[ab]$/u);
  // The address is the focused note's neighborhood path, not query state.
  await expect(page).toHaveURL(new RegExp(`${base}/notes/[^/?]+/graph/?$`));
  expect(new URL(page.url()).search).toBe("");

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
  const target = await nodeAboveLabel(page, graph, await renderedLabelAnchor(labelsCanvas));
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
  await expect(page).toHaveURL(new RegExp(`${base}/notes/[^/?]+/graph/?$`));
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

/**
 * A pinch is a camera gesture, not a tap. Sigma re-emits `downStage` carrying
 * `original.type === "touchend"` when a pinch drops from two contact points to
 * one, which used to be read as a press on empty canvas and cleared the pin on
 * the following lift. Every lift order is covered because the order decides
 * which handler sees the re-emitted event.
 */
for (const gesture of ["second contact lifts first", "first contact lifts first", "both contacts land together"] as const) {
  test(`pinch keeps a pinned neighborhood when the ${gesture}`, async ({ browser }, testInfo) => {
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
    const target = await nodeAboveLabel(page, graph, await renderedLabelAnchor(labelsCanvas));

    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: target.x, y: target.y, id: 1 }],
    });
    await page.waitForTimeout(550);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

    await expect(graph).toHaveAttribute("data-focused-inspection");
    await expect(page).toHaveURL(new RegExp(`${base}/notes/[^/?]+/graph/?$`));
    const focusUrl = page.url();
    const pinned = await nodesCanvas.screenshot();

    const bounds = (await graph.boundingBox())!;
    const centre = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    const first = { x: centre.x - 40, y: centre.y + 90, id: 1 };
    const second = { x: centre.x + 40, y: centre.y + 90, id: 2 };

    if (gesture === "both contacts land together") {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [first, second] });
    } else {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [first] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [first, second] });
    }
    // Spread the contact points apart: the zoom is what makes this a camera
    // gesture rather than a two-finger tap.
    for (const spread of [30, 60, 90]) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { ...first, x: centre.x - 40 - spread },
          { ...second, x: centre.x + 40 + spread },
        ],
      });
      await page.waitForTimeout(40);
    }

    const remaining = gesture === "first contact lifts first"
      ? { ...second, x: centre.x + 40 + 90 }
      : { ...first, x: centre.x - 40 - 90 };
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [remaining] });
    await page.waitForTimeout(60);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(200);

    // The camera moved and the pin did not.
    expect((await nodesCanvas.screenshot()).equals(pinned)).toBe(false);
    await expect(graph).toHaveAttribute("data-focused-inspection");
    expect(page.url()).toBe(focusUrl);
    await expect(page.locator("[data-graph-focus-status]")).toBeVisible();

    // And a genuine single-contact tap on empty canvas still clears it, so the
    // guard disqualifies camera gestures rather than disabling the behavior.
    const empty = { x: bounds.x + bounds.width - 12, y: bounds.y + bounds.height - 12 };
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: empty.x, y: empty.y, id: 1 }],
    });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(graph).not.toHaveAttribute("data-focused-inspection");
    await expect(page).toHaveURL(new RegExp(`${base}/?$`));
    await context.close();
  });
}

for (const landing of ["empty canvas", "marker", "title"] as const) {
  test(`a combined touch release on ${landing} cannot clear focus or navigate`, async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-root", "Combined TouchEvent coverage runs once.");
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
    await page.goto(`${base}/?focus=default%2F${targetId}`);
    const graph = page.locator("#global-graph");
    await expect(graph).toHaveAttribute("data-focused-node", targetId);
    await expect.poll(async () => (await graphCounts(graph)).completions).toBeGreaterThan(0);
    await page.waitForTimeout(800);
    await graph.evaluate((host) => host.setAttribute("data-measure-markers", ""));
    await expect(graph).toHaveAttribute("data-camera-ratio", /.+/u);
    const ratio = await graph.getAttribute("data-camera-ratio");
    const focusedUrl = page.url();

    // CDP releases contacts separately. A DOM event is needed to exercise one
    // final touchend carrying both changed contacts, which Sigma can read as a tap.
    await graph.evaluate((host, landing) => {
      const canvas = host.querySelector<HTMLCanvasElement>("canvas.sigma-mouse")!;
      const bounds = host.getBoundingClientRect();
      const markers = JSON.parse(host.dataset.focusedMarkerGeometry!) as { id: string; x: number; y: number }[];
      const marker = markers.find(({ id }) => id === host.dataset.focusedNode)!;
      const targets = JSON.parse(host.dataset.inspectionTargetGeometry!) as
        { kind: string; left: number; right: number; top: number; bottom: number }[];
      const label = targets.find(({ kind }) => kind === "label")!;
      const point = landing === "empty canvas"
        ? { x: bounds.width - 12, y: bounds.height - 12 }
        : landing === "marker"
          ? marker
          : { x: (label.left + label.right) / 2, y: label.bottom - 9 };
      const contact = (identifier: number, x: number) => new Touch({
        identifier,
        target: canvas,
        clientX: bounds.left + x,
        clientY: bounds.top + point.y,
      });
      const send = (type: string, touches: Touch[], changedTouches: Touch[]) =>
        canvas.dispatchEvent(new TouchEvent(type, {
          bubbles: true, cancelable: true, touches, targetTouches: touches, changedTouches,
        }));
      const first = contact(1, point.x);
      let second = contact(2, point.x - 60);
      send("touchstart", [first, second], [first, second]);
      second = contact(2, point.x - 110);
      send("touchmove", [first, second], [second]);
      send("touchend", [], [first, second]);
    }, landing);

    await page.waitForTimeout(600);
    await expect(page).toHaveURL(focusedUrl);
    await expect(graph).toHaveAttribute("data-focused-node", targetId);
    if (landing === "empty canvas") await expect(graph).not.toHaveAttribute("data-camera-ratio", ratio!);
    // Disqualification must end with this sequence: a fresh empty tap still clears.
    await graph.evaluate((host) => {
      const canvas = host.querySelector<HTMLCanvasElement>("canvas.sigma-mouse")!;
      const bounds = host.getBoundingClientRect();
      const point = new Touch({ identifier: 1, target: canvas, clientX: bounds.right - 12, clientY: bounds.bottom - 12 });
      for (const type of ["touchstart", "touchend"]) {
        const touches = type === "touchstart" ? [point] : [];
        canvas.dispatchEvent(new TouchEvent(type, {
          bubbles: true, cancelable: true, touches, targetTouches: touches, changedTouches: [point],
        }));
      }
    });
    await expect(graph).not.toHaveAttribute("data-focused-node");
    await context.close();
  });
}

/**
 * A pinch turns a few degrees every time a hand makes one, and sigma reads
 * that twist as a camera rotation: the graph tilts under labels that stay
 * level, and holds the tilt until some later fit snaps it upright. Zooming is
 * the gesture; turning is an accident of holding a phone.
 */
test("a pinch zooms without tilting the graph", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-root", "Trusted touch dispatch uses Chromium CDP once.");
  const { base } = deployment(testInfo);
  const context = await browser.newContext({
    baseURL: String(testInfo.project.use.baseURL),
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto(`${base}/`);
  const graph = page.locator("#global-graph");
  await expect(graph.locator("canvas.sigma-nodes")).toBeVisible();
  await page.waitForTimeout(900);

  const markers = async (): Promise<{ x: number; y: number }[]> => {
    await graph.evaluate((el) => {
      delete el.dataset.markerGeometry;
      el.setAttribute("data-measure-markers", "");
    });
    await expect(graph).toHaveAttribute("data-marker-geometry", /\[\{/u);
    return JSON.parse((await graph.getAttribute("data-marker-geometry"))!);
  };
  // The angle of the line between two drawn markers is the graph's own
  // horizon: whatever the camera does, a zoom leaves it where it was.
  const horizon = (drawn: { x: number; y: number }[], from: number, to: number) =>
    (Math.atan2(drawn[to]!.y - drawn[from]!.y, drawn[to]!.x - drawn[from]!.x) * 180) / Math.PI;
  const span = (drawn: { x: number; y: number }[], from: number, to: number) =>
    Math.hypot(drawn[to]!.x - drawn[from]!.x, drawn[to]!.y - drawn[from]!.y);

  const before = await markers();
  // The widest-apart pair, so the angle between them is the least noisy.
  let pair = { from: 0, to: 1 };
  for (let from = 0; from < before.length; from += 1) {
    for (let to = from + 1; to < before.length; to += 1) {
      if (span(before, from, to) > span(before, pair.from, pair.to)) pair = { from, to };
    }
  }
  expect(span(before, pair.from, pair.to)).toBeGreaterThan(40);

  const bounds = (await graph.boundingBox())!;
  const centre = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  const cdp = await context.newCDPSession(page);
  // Contacts that spread apart and turn twelve degrees at the same time: the
  // gesture a hand makes when it means only to zoom.
  const contact = (index: 1 | 2, progress: number) => {
    const side = index === 1 ? -1 : 1;
    const distance = 55 + 45 * progress;
    const radians = (12 * progress * Math.PI) / 180;
    return {
      id: index,
      x: centre.x + side * distance * Math.cos(radians),
      y: centre.y + side * distance * Math.sin(radians),
    };
  };
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [contact(1, 0)] });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [contact(1, 0), contact(2, 0)],
  });
  for (const progress of [0.25, 0.5, 0.75, 1]) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [contact(1, progress), contact(2, progress)],
    });
    await page.waitForTimeout(30);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [contact(2, 1)] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(400);

  const after = await markers();
  expect(after).toHaveLength(before.length);
  // The pinch did zoom: the contacts went from 110 pixels apart to 200.
  expect(span(after, pair.from, pair.to) / span(before, pair.from, pair.to)).toBeGreaterThan(1.5);
  // And the graph is still level.
  expect(horizon(after, pair.from, pair.to)).toBeCloseTo(horizon(before, pair.from, pair.to), 1);
  await context.close();
});

test("pinch keeps a pinned neighborhood on a note-page connection map", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-root", "Trusted touch dispatch uses Chromium CDP once.");
  const { base } = deployment(testInfo);
  const context = await browser.newContext({
    baseURL: String(testInfo.project.use.baseURL),
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.route("**/graph-data.json", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(localGraphData) }),
  );
  await page.goto(`${base}/notes/welcome`);

  const graph = page.locator(".local-graph");
  const nodesCanvas = graph.locator("canvas.sigma-nodes");
  await expect(nodesCanvas).toBeVisible();
  await graph.scrollIntoViewIfNeeded();
  await expect.poll(async () => Number(await graph.getAttribute("data-fit-completions"))).toBeGreaterThan(0);
  const labelsCanvas = graph.locator("canvas.sigma-labels");
  const target = await nodeAboveLabel(page, graph, await renderedLabelAnchor(labelsCanvas));
  await page.mouse.move(0, 0);
  await page.waitForTimeout(50);

  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: target.x, y: target.y, id: 1 }],
  });
  await page.waitForTimeout(550);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  // A connection map has no focus bar and no focus URL: the container attribute
  // is where its pin lives, and it goes through the same `wireHoverAndClick`.
  await expect(graph).toHaveAttribute("data-focused-inspection");
  const pinned = await nodesCanvas.screenshot();

  const bounds = (await graph.boundingBox())!;
  const centre = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  const first = { x: centre.x - 30, y: centre.y, id: 1 };
  const second = { x: centre.x + 30, y: centre.y, id: 2 };
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [first] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [first, second] });
  for (const spread of [25, 50, 75]) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { ...first, x: centre.x - 30 - spread },
        { ...second, x: centre.x + 30 + spread },
      ],
    });
    await page.waitForTimeout(40);
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [{ ...first, x: centre.x - 105 }],
  });
  await page.waitForTimeout(60);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(200);

  expect((await nodesCanvas.screenshot()).equals(pinned)).toBe(false);
  await expect(graph).toHaveAttribute("data-focused-inspection");
  await expect(page).toHaveURL(new RegExp(`${base}/notes/welcome/?$`));
  // Some browsers release both contacts in one event, which Sigma can mistake
  // for a tap when the first contact stayed still during the pinch.
  await graph.evaluate((host) => {
    const canvas = host.querySelector<HTMLCanvasElement>("canvas.sigma-mouse")!;
    const bounds = host.getBoundingClientRect();
    const contact = (identifier: number, x: number) => new Touch({
      identifier, target: canvas, clientX: x, clientY: bounds.bottom - 12,
    });
    const send = (type: string, touches: Touch[], changedTouches: Touch[]) =>
      canvas.dispatchEvent(new TouchEvent(type, {
        bubbles: true, cancelable: true, touches, targetTouches: touches, changedTouches,
      }));
    const first = contact(1, bounds.right - 12);
    let second = contact(2, bounds.right - 72);
    send("touchstart", [first, second], [first, second]);
    second = contact(2, bounds.right - 122);
    send("touchmove", [first, second], [second]);
    send("touchend", [], [first, second]);
  });
  await expect(graph).toHaveAttribute("data-focused-inspection");
  await expect(page).toHaveURL(new RegExp(`${base}/notes/welcome/?$`));
  await context.close();
});

test("a note's neighborhood path clears focus in place like any graph page", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-root", "Neighborhood focus routing runs once.");
  const { base } = deployment(testInfo);
  await page.route("**/graph-data.json", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(localGraphData) }),
  );
  await page.goto(`${base}/notes/welcome/graph`);
  const graph = page.locator("#global-graph");
  await expect(graph.locator("canvas.sigma-nodes")).toBeVisible();
  await expect(page.locator("[data-graph-focus-status]")).toBeVisible();
  await page.evaluate(() => { (window as unknown as { samePage: boolean }).samePage = true; });

  // The path names the focus, and clearing it is the same act as on the graph
  // page: focus goes, the address becomes the graph's own, the page stays. A
  // reader who followed a copied link is never stranded, and never reloaded.
  const disclosure = page.locator("[data-graph-focus-disclosure]");
  if (await disclosure.isVisible()) await disclosure.click();
  const clear = page.getByRole("button", { name: "Clear graph focus" });
  await expect(clear).toBeVisible();
  await clear.click();
  await expect(page).toHaveURL(new RegExp(`${base}/?$`));
  await expect(page.locator("[data-graph-focus-status]")).toBeHidden();
  expect(await page.evaluate(() => (window as unknown as { samePage?: boolean }).samePage)).toBe(true);
});

test("a sparse connection map labels every node, and a focused note keeps its indicator", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-root", "Label selection coverage runs once.");
  const { base } = deployment(testInfo);
  await page.route("**/graph-data.json", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(localGraphData) }),
  );
  await page.goto(`${base}/notes/welcome`);
  const local = page.locator(".local-graph");
  await expect(local.locator("canvas.sigma-nodes")).toBeVisible();
  await local.scrollIntoViewIfNeeded();
  await expect.poll(async () => Number(await local.getAttribute("data-fit-completions"))).toBeGreaterThan(0);

  // A connection map is sparse enough to place every label, which the density
  // grid could not guarantee: it culled by cell, not by whether one fit.
  await expect.poll(async () => await local.getAttribute("data-rendered-labels"))
    .toBe(await local.getAttribute("data-rendered-markers"));

  // And a focused note stays identifiable on the canvas by its own indicator,
  // drawn on the hover layer, independently of whether a label is placed.
  await page.goto(`${base}/notes/welcome/graph`);
  const graph = page.locator("#global-graph");
  await expect(graph.locator("canvas.sigma-nodes")).toBeVisible();
  await expect(graph).toHaveAttribute("data-focused-node", "welcome");
  await page.waitForTimeout(1_500);
  const indicatorInk = await canvasInkPixels(graph.locator("canvas.sigma-hovers"));
  expect(indicatorInk).toBeGreaterThan(0);
});

test("hover previews a neighborhood only when the reader asks", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-root", "Fine-pointer preference runs once.");
  const { base } = deployment(testInfo);
  await page.route("**/graph-data.json", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(graphData) }),
  );
  await page.goto(`${base}/`);
  const graph = page.locator("#global-graph");
  const labelsCanvas = graph.locator("canvas.sigma-labels");
  await expect(graph.locator("canvas.sigma-nodes")).toBeVisible();
  await expect.poll(async () => (await graphCounts(graph)).completions).toBeGreaterThan(0);
  await page.waitForTimeout(400);

  // Off by default: the pointer knows the node and shows it, and nothing else
  // in the graph changes.
  const toggle = page.locator("#graph-hover-preview");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(graph).toHaveAttribute("data-hover-preview", "false");
  const target = await nodeAboveLabel(page, graph, await renderedLabelAnchor(labelsCanvas));
  await expect(graph).toHaveAttribute("data-pointer-node", /.+/u);
  await expect(graph).not.toHaveAttribute("data-transient-inspection");
  const under = await graph.getAttribute("data-pointer-node");

  // D turns it on, and what the pointer is already over follows at once.
  await page.keyboard.press("d");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(graph).toHaveAttribute("data-transient-inspection", under!);

  // Remembered across a reload.
  await page.reload();
  await expect(graph.locator("canvas.sigma-nodes")).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(600);
  await page.mouse.move(target.x, target.y);
  await expect(graph).toHaveAttribute("data-transient-inspection", /.+/u);

  // The control turns it off again, and the inspection ends without the
  // pointer having moved.
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await page.mouse.move(target.x, target.y);
  await expect(graph).toHaveAttribute("data-pointer-node", /.+/u);
  await expect(graph).not.toHaveAttribute("data-transient-inspection");
});

test("F pins, moves and lifts the pin for the node under the pointer", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-root", "Keyboard focus runs once.");
  const { base } = deployment(testInfo);
  await page.route("**/graph-data.json", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(graphData) }),
  );
  await page.goto(`${base}/`);
  const graph = page.locator("#global-graph");
  const labelsCanvas = graph.locator("canvas.sigma-labels");
  await expect(graph.locator("canvas.sigma-nodes")).toBeVisible();
  await expect.poll(async () => (await graphCounts(graph)).completions).toBeGreaterThan(0);
  await page.waitForTimeout(400);

  // Pin the hub.
  await nodeAboveLabel(page, graph, await renderedLabelAnchor(labelsCanvas));
  await expect(graph).toHaveAttribute("data-pointer-node", targetId);
  await page.keyboard.press("f");
  await expect(graph).toHaveAttribute("data-focused-node", targetId);
  await expect(page).toHaveURL(new RegExp(`${base}/notes/hover-target/graph/?$`));

  // Move the pin to a neighbor.
  const markerOf = async (id: string) => {
    const markers = JSON.parse((await graph.getAttribute("data-focused-marker-geometry"))!) as
      { id: string; x: number; y: number }[];
    const bounds = (await graph.boundingBox())!;
    const marker = markers.find((entry) => entry.id === id)!;
    return { x: bounds.x + marker.x, y: bounds.y + marker.y };
  };
  await page.waitForTimeout(700);
  let neighbor = await markerOf("neighbor");
  await page.mouse.move(neighbor.x, neighbor.y);
  await expect(graph).toHaveAttribute("data-pointer-node", "neighbor");
  await page.keyboard.press("f");
  await expect(graph).toHaveAttribute("data-focused-node", "neighbor");
  await expect(page).toHaveURL(new RegExp(`${base}/notes/neighbor/graph/?$`));

  // Lift it: F over the pinned note itself.
  await page.waitForTimeout(700);
  neighbor = await markerOf("neighbor");
  await page.mouse.move(neighbor.x, neighbor.y);
  await expect(graph).toHaveAttribute("data-pointer-node", "neighbor");
  await page.keyboard.press("f");
  await expect(graph).not.toHaveAttribute("data-focused-node");
  await expect(page).toHaveURL(new RegExp(`${base}/?$`));

  // C clears a pin from anywhere; Z fits, pinned or not.
  await page.waitForTimeout(700);
  await nodeAboveLabel(page, graph, await renderedLabelAnchor(labelsCanvas));
  await page.keyboard.press("f");
  await expect(graph).toHaveAttribute("data-focused-node", targetId);
  await page.mouse.move(5, 400);
  await page.keyboard.press("c");
  await expect(graph).not.toHaveAttribute("data-focused-node");
  await expect(page).toHaveURL(new RegExp(`${base}/?$`));
  const fitsBefore = Number(await graph.getAttribute("data-fit-requests"));
  await page.keyboard.press("z");
  await expect.poll(async () => Number(await graph.getAttribute("data-fit-requests"))).toBe(fitsBefore + 1);
});

test("F moves focus to an unrelated node without enabling click navigation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-root", "Keyboard focus runs once.");
  const { base } = deployment(testInfo);
  await page.route("**/graph-data.json", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(graphData) }),
  );
  await page.goto(`${base}/`);
  const graph = page.locator("#global-graph");
  await expect.poll(async () => (await graphCounts(graph)).completions).toBeGreaterThan(0);
  await page.waitForTimeout(400);
  const hub = await nodeAboveLabel(page, graph, await renderedLabelAnchor(graph.locator("canvas.sigma-labels")));
  await page.mouse.click(hub.x, hub.y, { button: "right" });
  const menu = page.getByRole("menu");
  // Copy pins without fitting, keeping the disconnected pair in the viewport.
  await menu.getByRole("menuitem", { name: "Copy neighborhood link" }).click();
  await expect(graph).toHaveAttribute("data-focused-node", targetId);
  const target = await unrelatedContextTarget(page, graph, menu);
  await page.mouse.move(target.x, target.y);
  await expect(graph).toHaveCSS("cursor", "auto");
  await expect(graph).not.toHaveAttribute("data-pointer-node");
  const focusedUrl = page.url();
  await page.mouse.click(target.x, target.y);
  await expect(page).toHaveURL(focusedUrl);
  await expect(graph).toHaveAttribute("data-focused-node", targetId);

  await page.keyboard.press("f");
  await expect(graph).toHaveAttribute("data-focused-node", /^unrelated-[ab]$/u);
  const focused = await graph.getAttribute("data-focused-node");
  await expect(page).toHaveURL(new RegExp(`${base}/notes/${focused}/graph/?$`));
});

test("closing a context menu reconciles the pointer before F can pin", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-root", "Keyboard context-menu coverage runs once.");
  const { base } = deployment(testInfo);
  await page.route("**/graph-data.json", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(graphData) }),
  );
  await page.goto(`${base}/`);
  const graph = page.locator("#global-graph");
  await expect.poll(async () => (await graphCounts(graph)).completions).toBeGreaterThan(0);
  await page.waitForTimeout(400);
  await enableHoverPreview(page, graph);
  const target = await nodeAboveLabel(page, graph, await renderedLabelAnchor(graph.locator("canvas.sigma-labels")));
  const bounds = (await graph.boundingBox())!;
  const menu = page.getByRole("menu");

  for (const destination of ["empty canvas", "outside graph"] as const) {
    await page.mouse.click(target.x, target.y, { button: "right" });
    await expect(menu).toBeVisible();
    const inspected = await graph.getAttribute("data-transient-inspection");
    expect(inspected).toBeTruthy();
    if (destination === "empty canvas") {
      await page.mouse.move(bounds.x + 5, bounds.y + bounds.height / 2);
    } else {
      await page.locator("#graph-fit-view").hover();
    }
    // Inspection remains on the menu's note until dismissal, not on the route to it.
    await expect(graph).toHaveAttribute("data-transient-inspection", inspected!);
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(graph).not.toHaveAttribute("data-pointer-node");
    await expect(graph).not.toHaveAttribute("data-transient-inspection");
    await page.keyboard.press("f");
    await expect(graph).not.toHaveAttribute("data-focused-node");
    await expect(page).toHaveURL(new RegExp(`${base}/?$`));
  }
});

test("hovering a node by its title shows its plate, preview or not", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-root", "Fine-pointer hover runs once.");
  const { base } = deployment(testInfo);
  await page.route("**/graph-data.json", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(graphData) }),
  );
  await page.goto(`${base}/`);
  const graph = page.locator("#global-graph");
  const hovers = graph.locator("canvas.sigma-hovers");
  const labelsCanvas = graph.locator("canvas.sigma-labels");
  await expect(graph.locator("canvas.sigma-nodes")).toBeVisible();
  await expect.poll(async () => (await graphCounts(graph)).completions).toBeGreaterThan(0);
  await page.waitForTimeout(400);
  await expect(graph).toHaveAttribute("data-hover-preview", "false");
  const quiet = await canvasInkPixels(hovers);

  // On the title, well off the marker: the renderer's own hit test would not
  // call this a hover, but the graph does, and the plate follows the graph.
  const label = await renderedLabelAnchor(labelsCanvas);
  await targetWithinLabel(page, graph, label);
  await expect(graph).toHaveAttribute("data-pointer-node", /.+/u);
  await expect(graph).not.toHaveAttribute("data-transient-inspection");
  await expect.poll(async () => await canvasInkPixels(hovers)).toBeGreaterThan(quiet);

  // Leave, and the plate goes.
  await page.mouse.move(5, 400);
  await expect(graph).not.toHaveAttribute("data-pointer-node");
  await expect.poll(async () => await canvasInkPixels(hovers)).toBe(quiet);
});

test("keys are shown where their actions already are", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-root", "Fine-pointer discoverability runs once.");
  const { base } = deployment(testInfo);
  await page.route("**/graph-data.json", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(graphData) }),
  );
  await page.goto(`${base}/`);
  const graph = page.locator("#global-graph");
  const labelsCanvas = graph.locator("canvas.sigma-labels");
  await expect(graph.locator("canvas.sigma-nodes")).toBeVisible();
  await expect.poll(async () => (await graphCounts(graph)).completions).toBeGreaterThan(0);
  await page.waitForTimeout(400);

  // The tooltip names the key.
  await expect(page.locator("#graph-fit-view")).toHaveAttribute("title", /\(Z\)/u);

  // The menu shows the key beside each action that has one, without the key
  // becoming part of the action's name.
  const target = await nodeAboveLabel(page, graph, await renderedLabelAnchor(labelsCanvas));
  await page.mouse.click(target.x, target.y, { button: "right" });
  const menu = page.locator("[data-graph-context-menu]");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Pin neighborhood", exact: true })).toBeVisible();
  await expect(menu.locator("[data-graph-menu-focus] kbd")).toHaveText("F");
  await expect(menu.locator("[data-graph-menu-fit] kbd")).toHaveText("Z");
  await expect(menu.locator("[data-graph-menu-clear] kbd")).toHaveText("C");
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();

  // Help lists the keys on a keyboard layout, and gestures stay out of the way.
  const help = page.getByRole("button", { name: "Help" });
  await help.click();
  const panel = page.getByRole("region", { name: "Graph help" });
  await expect(panel).toBeVisible();
  await expect(panel.locator("[data-graph-help-keys]")).toBeVisible();
  await expect(panel.locator("[data-graph-help-keys] kbd").first()).toHaveText("F");
  await expect(panel.locator("[data-graph-help-touch]")).toBeHidden();
  // One disclosure at a time: opening the legend closes help.
  await page.getByRole("button", { name: "Legend" }).click();
  await expect(panel).toBeHidden();
  await expect(page.getByRole("region", { name: "Graph legend" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("region", { name: "Graph legend" })).toBeHidden();
});

test("1 to 5 set how far a pinned neighborhood reaches, and refit to it", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-root", "Keyboard reach runs once.");
  const { base } = deployment(testInfo);
  // welcome - portable-notes - unrelated-a: a chain, so each ring adds a note.
  await page.route("**/graph-data.json", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(localGraphData) }),
  );
  await page.goto(`${base}/?focus=default%2Fwelcome`);
  const graph = page.locator("#global-graph");
  await expect(graph).toHaveAttribute("data-focused-node", "welcome");
  await expect(graph).toHaveAttribute("data-neighborhood-depth", "1");
  await expect.poll(async () => (await graphCounts(graph)).completions).toBeGreaterThan(0);
  await page.waitForTimeout(600);
  const lit = async () => (JSON.parse((await graph.getAttribute("data-focused-marker-geometry"))!) as { id: string }[])
    .map((marker) => marker.id).sort();
  const ring1 = await lit();
  expect(ring1).toEqual(["portable-notes", "welcome"]);

  const fitsBefore = Number(await graph.getAttribute("data-fit-requests"));
  await page.keyboard.press("2");
  await expect(graph).toHaveAttribute("data-neighborhood-depth", "2");
  await expect.poll(lit).toEqual(["portable-notes", "unrelated-a", "welcome"]);
  // The bar lists the second ring and says how far it is.
  await expect(page.locator("[data-graph-neighbors-list] button", { hasText: "Other A" })).toContainText("2 links away");
  // And the view refit to the wider neighborhood.
  await expect.poll(async () => Number(await graph.getAttribute("data-fit-requests"))).toBe(fitsBefore + 1);

  // Remembered across a reload, then back to one.
  await page.reload();
  await expect(graph).toHaveAttribute("data-neighborhood-depth", "2");
  await page.waitForTimeout(600);
  await page.keyboard.press("1");
  await expect(graph).toHaveAttribute("data-neighborhood-depth", "1");
  await expect.poll(lit).toEqual(ring1);
});
