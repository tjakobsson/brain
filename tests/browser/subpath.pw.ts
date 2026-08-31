import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

function deployment(testInfo: TestInfo) {
  const url = new URL(String(testInfo.project.use.baseURL));
  return { origin: url.origin, base: url.pathname.replace(/\/$/u, "") };
}

async function preserveGraphPixels(page: Page) {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext as unknown as (
      this: HTMLCanvasElement,
      contextId: string,
      options?: Record<string, unknown>,
    ) => RenderingContext | null;
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value(this: HTMLCanvasElement, contextId: string, options?: Record<string, unknown>) {
        const nextOptions =
          contextId === "webgl" || contextId === "webgl2"
            ? { ...options, preserveDrawingBuffer: true }
            : options;
        return original.call(this, contextId, nextOptions);
      },
    });
  });
}

async function graphInkBounds(host: Locator) {
  return host.evaluate((element) => {
    const hostBounds = element.getBoundingClientRect();
    let left = Number.POSITIVE_INFINITY;
    let top = Number.POSITIVE_INFINITY;
    let right = Number.NEGATIVE_INFINITY;
    let bottom = Number.NEGATIVE_INFINITY;
    let nodeLeft = Number.POSITIVE_INFINITY;
    let nodeTop = Number.POSITIVE_INFINITY;
    let nodeRight = Number.NEGATIVE_INFINITY;
    let nodeBottom = Number.NEGATIVE_INFINITY;
    let nodePixels = 0;
    let labelPixels = 0;

    const include = (canvas: HTMLCanvasElement, x: number, y: number) => {
      const bounds = canvas.getBoundingClientRect();
      const pageX = bounds.left - hostBounds.left + (x / canvas.width) * bounds.width;
      const pageY = bounds.top - hostBounds.top + (y / canvas.height) * bounds.height;
      left = Math.min(left, pageX);
      top = Math.min(top, pageY);
      right = Math.max(right, pageX);
      bottom = Math.max(bottom, pageY);
    };

    const nodeCanvas = element.querySelector<HTMLCanvasElement>("canvas.sigma-nodes");
    const nodeCanvasBounds = nodeCanvas?.getBoundingClientRect();
    const gl =
      (nodeCanvas?.getContext("webgl2") as WebGL2RenderingContext | null) ??
      (nodeCanvas?.getContext("webgl") as WebGLRenderingContext | null);
    if (nodeCanvas && gl) {
      const pixels = new Uint8Array(nodeCanvas.width * nodeCanvas.height * 4);
      gl.finish();
      gl.readPixels(0, 0, nodeCanvas.width, nodeCanvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      for (let y = 0; y < nodeCanvas.height; y += 1) {
        for (let x = 0; x < nodeCanvas.width; x += 1) {
          if (pixels[(y * nodeCanvas.width + x) * 4 + 3] === 0) continue;
          nodePixels += 1;
          const flippedY = nodeCanvas.height - 1 - y;
          include(nodeCanvas, x, flippedY);
          const pageX = nodeCanvasBounds!.left - hostBounds.left +
            (x / nodeCanvas.width) * nodeCanvasBounds!.width;
          const pageY = nodeCanvasBounds!.top - hostBounds.top +
            (flippedY / nodeCanvas.height) * nodeCanvasBounds!.height;
          nodeLeft = Math.min(nodeLeft, pageX);
          nodeTop = Math.min(nodeTop, pageY);
          nodeRight = Math.max(nodeRight, pageX);
          nodeBottom = Math.max(nodeBottom, pageY);
        }
      }
    }

    const labelCanvas = element.querySelector<HTMLCanvasElement>("canvas.sigma-labels");
    const context = labelCanvas?.getContext("2d");
    if (labelCanvas && context) {
      const pixels = context.getImageData(0, 0, labelCanvas.width, labelCanvas.height).data;
      for (let y = 0; y < labelCanvas.height; y += 1) {
        for (let x = 0; x < labelCanvas.width; x += 1) {
          if (pixels[(y * labelCanvas.width + x) * 4 + 3] === 0) continue;
          labelPixels += 1;
          include(labelCanvas, x, y);
        }
      }
    }

    if (!Number.isFinite(left)) throw new Error("Graph rendered no node or label pixels");
    return {
      left,
      top,
      right,
      bottom,
      nodeLeft,
      nodeTop,
      nodeRight,
      nodeBottom,
      nodePixels,
      labelPixels,
      width: hostBounds.width,
      height: hostBounds.height,
    };
  });
}

async function graphNodeComponents(host: Locator) {
  return host.evaluate((element) => {
    const canvas = element.querySelector<HTMLCanvasElement>("canvas.sigma-nodes");
    const gl =
      (canvas?.getContext("webgl2") as WebGL2RenderingContext | null) ??
      (canvas?.getContext("webgl") as WebGLRenderingContext | null);
    if (!canvas || !gl) throw new Error("Graph node canvas is unavailable");
    const pixels = new Uint8Array(canvas.width * canvas.height * 4);
    gl.finish();
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const occupied = new Uint8Array(canvas.width * canvas.height);
    const visited = new Uint8Array(canvas.width * canvas.height);
    for (let index = 0; index < occupied.length; index += 1) {
      occupied[index] = pixels[index * 4 + 3] > 0 ? 1 : 0;
    }
    const components: { x: number; y: number; pixels: number }[] = [];
    for (let start = 0; start < occupied.length; start += 1) {
      if (!occupied[start] || visited[start]) continue;
      const stack = [start];
      visited[start] = 1;
      let count = 0;
      let xTotal = 0;
      let yTotal = 0;
      while (stack.length > 0) {
        const index = stack.pop()!;
        const x = index % canvas.width;
        const y = Math.floor(index / canvas.width);
        count += 1;
        xTotal += x;
        yTotal += y;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) continue;
            const nextX = x + dx;
            const nextY = y + dy;
            if (nextX < 0 || nextX >= canvas.width || nextY < 0 || nextY >= canvas.height) continue;
            const next = nextY * canvas.width + nextX;
            if (!occupied[next] || visited[next]) continue;
            visited[next] = 1;
            stack.push(next);
          }
        }
      }
      if (count >= 4) components.push({ x: xTotal / count, y: yTotal / count, pixels: count });
    }
    return components;
  });
}

async function initialListContentClearsNavigation(page: Page) {
  return page.locator(".note-list li").first().evaluate((row) => {
    const navigation = document.querySelector<HTMLElement>(".site-header")!.getBoundingClientRect();
    return [...row.children].every((child) => {
      const bounds = child.getBoundingClientRect();
      return (
        bounds.right <= navigation.left ||
        bounds.left >= navigation.right ||
        bounds.bottom <= navigation.top ||
        bounds.top >= navigation.bottom
      );
    });
  });
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
  await expect(page.locator("#graph-count")).toContainText("22 of 22 notes");
  expect(
    await page.locator(".graph-shell").evaluate((shell) => {
      const controls = shell.querySelector(".graph-controls")!.getBoundingClientRect();
      const pill = document.querySelector(".site-header")!.getBoundingClientRect();
      return {
        viewportHeight: Math.round(shell.getBoundingClientRect().height) === innerHeight,
        overlapsPill: !(
          controls.right <= pill.left ||
          controls.left >= pill.right ||
          controls.bottom <= pill.top ||
          controls.top >= pill.bottom
        ),
      };
    }),
  ).toEqual({ viewportHeight: true, overlapsPill: false });

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
  await expect(page.locator("#graph-count")).toContainText("12 of 22 notes");
  await page.waitForTimeout(800);
  await page.reload();
  await expect(page.locator("#graph-tag-filter")).toHaveValue("pkm");
  await expect(page.locator("#graph-count")).toContainText("12 of 22 notes");
  await page.locator("#graph-tag-filter").selectOption("");
  await expect(page.locator("#graph-count")).toContainText("22 of 22 notes");

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
  await expect(page.locator(".note-meta")).toContainText("created 2026-08-27 00:00 UTC");
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
  await expect(page.locator(".local-graph")).toHaveCSS("border-top-width", "0px");
  const localGraphPanel = page.locator(".local-graph-panel");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(localGraphPanel).toHaveCSS("border-top-color", "rgb(42, 42, 51)");
  expect(
    await localGraphPanel.evaluate((panel) =>
      getComputedStyle(panel).getPropertyValue("--graph-spotlight-edge").trim(),
    ),
  ).toBe("#8b7ff0a3");
  await localGraphPanel.hover({ position: { x: 4, y: 120 } });
  await expect(localGraphPanel).toHaveAttribute("data-spotlight", "");
  await expect
    .poll(() => localGraphPanel.evaluate((panel) => getComputedStyle(panel, "::after").opacity))
    .toBe("1");
  await page.mouse.move(0, 0);
  await expect(localGraphPanel).not.toHaveAttribute("data-spotlight", "");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(localGraphPanel).toHaveCSS("border-top-color", "rgb(226, 223, 216)");
  expect(
    await localGraphPanel.evaluate((panel) =>
      getComputedStyle(panel).getPropertyValue("--graph-spotlight-edge").trim(),
    ),
  ).toBe("#5b4bc46b");
  await page.emulateMedia({ colorScheme: "dark" });

  const noteHeader = page.locator(".site-header");
  await page.evaluate(() => window.scrollTo(0, 0));
  const pillBeforeScroll = await noteHeader.boundingBox();
  await expect(noteHeader).toHaveCSS("width", "48px");
  await expect(noteHeader.getByRole("link", { name: "Graph" })).toBeVisible();
  await expect(noteHeader.getByRole("button", { name: "Search" })).toBeVisible();
  const compactMenu = noteHeader.locator(".nav-menu > summary");
  await expect(compactMenu).toBeVisible();
  await expect(compactMenu).toHaveAttribute("aria-label", "More navigation");
  await expect(noteHeader.locator(".menu-icon")).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 400));
  expect(await noteHeader.boundingBox()).toEqual(pillBeforeScroll);
  await compactMenu.focus();
  await page.keyboard.press("Enter");
  await expect(noteHeader.locator(".nav-menu")).toHaveJSProperty("open", true);
  await expect(compactMenu).toHaveAttribute("aria-expanded", "true");
  await expect(noteHeader.locator(".nav-menu-panel").getByRole("link", { name: "Search" })).toHaveCount(0);
  await page.setViewportSize({ width: 900, height: 200 });
  const compactMenuPanel = noteHeader.locator(".nav-menu-panel");
  await expect(compactMenuPanel).toHaveCSS("overflow-y", "auto");
  expect(
    await compactMenuPanel.evaluate((panel) => panel.getBoundingClientRect().bottom <= innerHeight),
  ).toBe(true);
  await compactMenu.click();
  await page.setViewportSize({ width: 1280, height: 720 });
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

  await attachmentResponse;
  await expect(page.locator("article img")).toHaveAttribute(
    "src",
    `${base}/vault-assets/media/diagram.svg`,
  );
  await page.getByRole("link", { name: "downloadable reference file" }).evaluate(async (link) => {
    const response = await fetch((link as HTMLAnchorElement).href);
    if (!response.ok) throw new Error(`attachment: HTTP ${response.status}`);
  });

  await page.getByRole("link", { name: "Graph", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${base}/?$`));
  await page.goto(`${base}/notes/welcome`);
  await page.locator(".nav-menu > summary").click();
  await page.locator(".nav-menu-panel").getByRole("link", { name: "Tags" }).click();
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
      `${base}/favicon.svg`,
      `${base}/vault-assets/media/diagram.svg`,
      `${base}/vault-assets/media/reference.txt`,
    ]),
  );
  expect([...requestedPaths].some((path) => path.startsWith(`${base}/pagefind/`))).toBe(false);
  expect(escapedRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("Fit view includes rendered graph bounds and excludes filtered nodes", async ({ page }, testInfo) => {
  const { base } = deployment(testInfo);
  await preserveGraphPixels(page);
  await page.setViewportSize({ width: 900, height: 600 });
  await page.route("**/graph-data.json", async (route) => {
    await route.fulfill({
      json: {
        nodes: [
          {
            id: "hub",
            title: "Connected hub",
            route: "/notes/hub",
            type: "permanent",
            status: "established",
            tags: ["fit"],
            degree: 12,
            x: 0,
            y: 0,
          },
          {
            id: "long",
            title: "A deliberately long rendered title near the graph boundary",
            route: "/notes/long",
            type: "literature",
            status: "developing",
            tags: ["fit"],
            degree: 1,
            x: 1,
            y: 0,
          },
          {
            id: "peer",
            title: "Nearby peer",
            route: "/notes/peer",
            type: "permanent",
            status: "draft",
            tags: ["fit"],
            degree: 1,
            x: 0,
            y: 1,
          },
          {
            id: "filtered-far-away",
            title: "Filtered far away",
            route: "/notes/filtered",
            type: "fleeting",
            status: "draft",
            tags: ["hidden"],
            degree: 0,
            x: 80,
            y: 80,
          },
        ],
        edges: [
          { source: "hub", target: "long" },
          { source: "hub", target: "peer" },
        ],
      },
    });
  });
  await page.goto(`${base}/`);
  await expect(page.locator("#global-graph canvas.sigma-nodes")).toBeVisible();
  await page.getByRole("button", { name: "Filters" }).click();
  await page.locator('[data-filter="type"][value="fleeting"]').uncheck();
  await expect(page.locator("#graph-count")).toContainText("3 of 4 notes");
  await page.waitForTimeout(1_000);

  const graph = page.locator("#global-graph");
  await graph.hover();
  await page.mouse.wheel(0, -500);
  await page.waitForTimeout(150);
  await page.getByRole("button", { name: "Fit view" }).click();
  await page.waitForTimeout(400);

  const bounds = await graphInkBounds(graph);
  expect(bounds.nodePixels).toBeGreaterThan(0);
  expect(bounds.labelPixels).toBeGreaterThan(0);
  expect(bounds.left).toBeGreaterThanOrEqual(18);
  expect(bounds.top).toBeGreaterThanOrEqual(55);
  expect(bounds.right).toBeLessThanOrEqual(bounds.width - 60);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.height - 18);
});

test("mobile navigation stays within the deployment base", async ({ page }, testInfo) => {
  const { base } = deployment(testInfo);
  await preserveGraphPixels(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/`);
  const graphHeader = page.locator(".site-header");
  const launcher = page.getByRole("button", { name: "Navigation" });
  await expect(page.locator(".site-header-slot")).toHaveCSS("position", "fixed");
  await expect(graphHeader).toHaveCSS("width", "48px");
  await expect(launcher).toHaveAttribute("aria-expanded", "false");
  await expect(graphHeader.locator(".graph-trigger")).toHaveCSS("opacity", "0");
  expect(
    await page.locator(".graph-shell").evaluate((shell) => {
      const controls = shell.querySelector(".graph-controls")!.getBoundingClientRect();
      const pill = document.querySelector(".site-header")!.getBoundingClientRect();
      return {
        viewportHeight: Math.round(shell.getBoundingClientRect().height) === innerHeight,
        overlapsPill: !(
          controls.right <= pill.left ||
          controls.left >= pill.right ||
          controls.bottom <= pill.top ||
          controls.top >= pill.bottom
        ),
      };
    }),
  ).toEqual({ viewportHeight: true, overlapsPill: false });
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
  const localLegendTrigger = page.locator(".local-graph-panel").getByRole("button", { name: "Legend" });
  await localLegendTrigger.click();
  const localLegend = page.getByRole("region", { name: "Graph legend" });
  await expect(localLegendTrigger).toHaveAttribute("aria-expanded", "true");
  await expect(localLegend).toContainText("Draft, developing, established");
  await expect(localLegend).toContainText("Larger nodes have more connections");
  await expect(localLegend).toContainText("Other nodes are notes up to two links away");
  await expect(localLegend).toContainText("Muted line links different brains");
  await page.keyboard.press("Escape");
  await expect(localLegend).toBeHidden();
  await expect(localLegendTrigger).toBeFocused();
  await localLegendTrigger.click();
  await page.locator("article h1").click();
  await expect(localLegend).toBeHidden();
  await expect(localLegendTrigger).toBeFocused();
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
  await page.getByRole("button", { name: "Fit view" }).click();
  await page.waitForTimeout(400);
  const fittedLocalBounds = await graphInkBounds(localGraph);
  expect(fittedLocalBounds.nodePixels).toBeGreaterThan(0);
  expect(fittedLocalBounds.labelPixels).toBe(0);
  expect(fittedLocalBounds.left).toBeGreaterThanOrEqual(18);
  expect(fittedLocalBounds.top).toBeGreaterThanOrEqual(18);
  expect(fittedLocalBounds.right).toBeLessThanOrEqual(fittedLocalBounds.width - 18);
  expect(fittedLocalBounds.bottom).toBeLessThanOrEqual(fittedLocalBounds.height - 18);
  const noteHeader = page.locator(".site-header");
  await expect(page.locator(".site-header-slot")).toHaveCSS("position", "fixed");
  await expect(page.locator(".site-header-slot")).toHaveCSS("height", "0px");
  await expect(noteHeader).toHaveCSS("width", "48px");
  await launcher.click();
  await expect(noteHeader.locator(".nav-menu")).toBeHidden();
  await expect(noteHeader.getByRole("link", { name: "Graph" })).toHaveAttribute("href", `${base}/`);
  await expect(noteHeader.getByRole("link", { name: "Tags" })).toHaveAttribute("href", `${base}/tags`);
  await expect(noteHeader.getByRole("link", { name: "Recent" })).toHaveAttribute("href", `${base}/recent`);
  await expect(noteHeader.getByRole("link", { name: "Orphans" })).toHaveAttribute("href", `${base}/orphans`);
  const controlPositions = await noteHeader.evaluate((header) => {
    const controls = [...header.querySelectorAll(".mobile-nav-actions > .nav-action")]
      .filter((control) => !(control as HTMLElement).hidden)
      .map((control) => control.getBoundingClientRect());
    const rail = header.getBoundingClientRect();
    return {
      vertical: controls.every((control, index) => index === 0 || control.top >= controls[index - 1].bottom),
      rightMargin: window.innerWidth - rail.right,
    };
  });
  expect(controlPositions.vertical).toBe(true);
  expect(controlPositions.rightMargin).toBeGreaterThanOrEqual(11);
  expect(controlPositions.rightMargin).toBeLessThanOrEqual(13);
  await noteHeader.getByRole("link", { name: "Recent" }).click();
  await expect(page).toHaveURL(new RegExp(`${base}/recent/?$`));
  await expect(page.locator(".site-header")).toHaveCSS("width", "48px");
  await expect(page.getByRole("button", { name: "Navigation" })).toHaveAttribute("aria-expanded", "false");
  expect(await initialListContentClearsNavigation(page)).toBe(true);
});

test("mobile local graphs reveal titles relative to their fitted view", async ({ page }, testInfo) => {
  const { base } = deployment(testInfo);
  await preserveGraphPixels(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const neighbors = Array.from({ length: 12 }, (_, index) => {
    const anchor = [0, 1, 3, 9].includes(index);
    return {
      id: `nearby-${index + 1}`,
      title: anchor
        ? `Nearby graph note with an unusually long descriptive mobile title ${index + 1}`
        : `An omitted nearby graph note with an exceptionally long title that should affect fitting only after labels are forced ${index + 1}`,
      route: `/notes/nearby-${index + 1}`,
      type: index % 2 === 0 ? "permanent" : "literature",
      status: index % 3 === 0 ? "established" : "developing",
      tags: [],
      degree: anchor ? 100 : 1,
      x: Math.cos(index * Math.PI / 6),
      y: Math.sin(index * Math.PI / 6),
    };
  });
  await page.route("**/graph-data.json", (route) => route.fulfill({
    json: {
      nodes: [{
        id: "welcome",
        title: "Welcome",
        route: "/notes/welcome",
        type: "permanent",
        status: "established",
        tags: [],
        degree: neighbors.length,
        x: 0,
        y: 0,
      }, ...neighbors],
      edges: neighbors.map((node) => ({ source: "welcome", target: node.id })),
    },
  }));
  await page.goto(`${base}/notes/welcome`);

  const graph = page.locator(".local-graph");
  const canvas = graph.locator("canvas.sigma-mouse");
  await expect(canvas).toBeVisible();
  await canvas.scrollIntoViewIfNeeded();
  await expect.poll(async () => Number(await graph.getAttribute("data-fit-completions"))).toBeGreaterThan(0);
  await page.waitForTimeout(100);
  expect((await graphInkBounds(graph)).labelPixels).toBe(0);
  await page.getByRole("button", { name: "Fit view" }).click();
  await page.waitForTimeout(400);
  const fittedRatio = Number(await graph.getAttribute("data-fitted-ratio"));
  expect(fittedRatio).toBeGreaterThan(0);
  const fittedInk = await graphInkBounds(graph);

  await canvas.hover();
  await page.mouse.wheel(0, -100);
  await expect.poll(async () => Number(await graph.getAttribute("data-rendered-labels"))).toBe(neighbors.length + 1);

  await page.getByRole("button", { name: "Fit view" }).click();
  await page.waitForTimeout(400);
  expect((await graphInkBounds(graph)).labelPixels).toBe(0);
  expect(Math.abs(Number(await graph.getAttribute("data-fitted-ratio")) - fittedRatio)).toBeLessThan(0.01);
  const resetInk = await graphInkBounds(graph);
  expect(
    Math.abs((resetInk.nodeRight - resetInk.nodeLeft) - (fittedInk.nodeRight - fittedInk.nodeLeft)),
  ).toBeLessThan(3);
  expect(
    Math.abs((resetInk.nodeBottom - resetInk.nodeTop) - (fittedInk.nodeBottom - fittedInk.nodeTop)),
  ).toBeLessThan(3);
});

test("mobile local graphs recompose clustered positions for their viewport", async ({ page }, testInfo) => {
  const { base } = deployment(testInfo);
  await preserveGraphPixels(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const neighbors = Array.from({ length: 8 }, (_, index) => ({
    id: `clustered-${index + 1}`,
    title: `Clustered nearby note ${index + 1}`,
    route: `/notes/clustered-${index + 1}`,
    type: "permanent",
    status: "developing",
    tags: [],
    degree: 1,
    x: (index - 3.5) * 0.002,
    y: index % 2 === 0 ? -0.001 : 0.001,
  }));
  await page.route("**/graph-data.json", (route) => route.fulfill({
    json: {
      nodes: [{
        id: "welcome",
        title: "Welcome",
        route: "/notes/welcome",
        type: "permanent",
        status: "established",
        tags: [],
        degree: neighbors.length,
        x: 0,
        y: 0,
      }, ...neighbors],
      edges: neighbors.map((node) => ({ source: "welcome", target: node.id })),
    },
  }));
  await page.goto(`${base}/notes/welcome`);

  const graph = page.locator(".local-graph");
  await expect(graph.locator("canvas.sigma-nodes")).toBeVisible();
  await page.getByRole("button", { name: "Fit view" }).click();
  await expect.poll(async () => Number(await graph.getAttribute("data-fitted-ratio"))).toBeGreaterThan(0);
  await expect.poll(async () => (await graphNodeComponents(graph)).length).toBe(neighbors.length + 1);
  const portrait = await graphNodeComponents(graph);
  const portraitMinimumDistance = Math.min(...portrait.flatMap((node, index) =>
    portrait.slice(index + 1).map((other) => Math.hypot(node.x - other.x, node.y - other.y))
  ));
  expect(portraitMinimumDistance).toBeGreaterThan(18);
  const portraitWidth = Math.max(...portrait.map(({ x }) => x)) - Math.min(...portrait.map(({ x }) => x));
  const portraitHeight = Math.max(...portrait.map(({ y }) => y)) - Math.min(...portrait.map(({ y }) => y));
  expect(portraitHeight).toBeGreaterThan(portraitWidth);

  const portraitCompletions = Number(await graph.getAttribute("data-fit-completions"));
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(async () => Number(await graph.getAttribute("data-fit-completions")))
    .toBeGreaterThan(portraitCompletions);
  await expect.poll(async () => (await graphNodeComponents(graph)).length).toBe(neighbors.length + 1);
  const landscape = await graphNodeComponents(graph);
  const landscapeWidth = Math.max(...landscape.map(({ x }) => x)) - Math.min(...landscape.map(({ x }) => x));
  const landscapeHeight = Math.max(...landscape.map(({ y }) => y)) - Math.min(...landscape.map(({ y }) => y));
  expect(landscapeWidth).toBeGreaterThan(landscapeHeight);

  const settledInk = await graphInkBounds(graph);
  await page.waitForTimeout(500);
  const stableInk = await graphInkBounds(graph);
  expect(Math.abs(stableInk.nodeLeft - settledInk.nodeLeft)).toBeLessThan(3);
  expect(Math.abs(stableInk.nodeTop - settledInk.nodeTop)).toBeLessThan(3);
  expect(Math.abs(stableInk.nodeRight - settledInk.nodeRight)).toBeLessThan(3);
  expect(Math.abs(stableInk.nodeBottom - settledInk.nodeBottom)).toBeLessThan(3);

  const completedLayouts = Number(await graph.getAttribute("data-fit-completions"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  await graph.locator("canvas.sigma-mouse").hover();
  await page.mouse.wheel(0, -300);
  await page.waitForTimeout(1_000);
  expect(Number(await graph.getAttribute("data-fit-completions"))).toBe(completedLayouts);
});

test("local graphs resume interrupted motion when the page becomes visible", async ({ page }, testInfo) => {
  const { base } = deployment(testInfo);
  await preserveGraphPixels(page);
  await page.addInitScript(() => {
    (window as typeof window & { __graphDocumentHidden: boolean }).__graphDocumentHidden = true;
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => (window as typeof window & { __graphDocumentHidden: boolean }).__graphDocumentHidden,
    });
  });
  await page.goto(`${base}/notes/welcome`);

  const graph = page.locator(".local-graph");
  await expect(graph.locator("canvas.sigma-nodes")).toBeVisible();
  await expect(graph).not.toHaveAttribute("data-fit-completions", /\d+/u);
  await page.evaluate(() => {
    (window as typeof window & { __graphDocumentHidden: boolean }).__graphDocumentHidden = false;
    document.dispatchEvent(new Event("visibilitychange"));
  });

  await expect.poll(async () => Number(await graph.getAttribute("data-fit-completions"))).toBeGreaterThan(0);
  await expect.poll(async () => (await graphNodeComponents(graph)).length).toBeGreaterThan(1);

  const initialCompletions = Number(await graph.getAttribute("data-fit-completions"));
  await page.getByRole("button", { name: "Fit view" }).click();
  await page.evaluate(() => {
    (window as typeof window & { __graphDocumentHidden: boolean }).__graphDocumentHidden = true;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.evaluate(() => {
    (window as typeof window & { __graphDocumentHidden: boolean }).__graphDocumentHidden = false;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(async () => Number(await graph.getAttribute("data-fit-completions")))
    .toBeGreaterThan(initialCompletions);
});

test("touch layouts keep the local graph interactive", async ({ browser }, testInfo) => {
  const { origin, base } = deployment(testInfo);
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 900, height: 600 } });
  const page = await context.newPage();
  await preserveGraphPixels(page);
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
  await expect(page.locator(".site-header")).toHaveCSS("width", "48px");
  await expect(page.getByRole("button", { name: "Navigation" })).toBeVisible();
  await expect(page.locator(".mobile-nav-actions")).toHaveJSProperty("inert", true);
  await page.goto(`${origin}${base}/tags`);
  await expect(page.locator(".site-header")).toHaveCSS("width", "48px");
  await expect(page.getByRole("button", { name: "Navigation" })).toBeVisible();
  expect(await initialListContentClearsNavigation(page)).toBe(true);

  await page.goto(`${origin}${base}/notes/welcome`);
  await expect(page.locator(".local-graph canvas.sigma-nodes")).toBeVisible();
  const touchGraph = page.locator(".local-graph");
  await touchGraph.scrollIntoViewIfNeeded();
  await expect.poll(async () => Number(await touchGraph.getAttribute("data-fit-completions"))).toBeGreaterThan(0);
  const components = await graphNodeComponents(touchGraph);
  expect(components.length).toBeGreaterThan(1);
  const target = [...components].sort((a, b) => a.pixels - b.pixels)[0];
  const nodeCanvas = page.locator(".local-graph canvas.sigma-nodes");
  const canvasBounds = (await nodeCanvas.boundingBox())!;
  const canvasPixels = await nodeCanvas.evaluate((canvas) => ({
    width: (canvas as HTMLCanvasElement).width,
    height: (canvas as HTMLCanvasElement).height,
  }));
  await page.touchscreen.tap(
    canvasBounds.x + (target.x / canvasPixels.width) * canvasBounds.width,
    canvasBounds.y + (1 - target.y / canvasPixels.height) * canvasBounds.height,
  );
  await expect(page).toHaveURL(new RegExp(`${base}/notes/[^/]+/?$`));
  await expect(page).not.toHaveURL(new RegExp(`${base}/notes/welcome/?$`));
  await context.close();
});
