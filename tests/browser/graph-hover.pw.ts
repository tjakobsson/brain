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
      route: "/notes/portable-notes",
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
      route: "/notes/portable-notes",
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

async function longestLabelAnchor(labelsCanvas: Locator) {
  return labelsCanvas.evaluate((canvas) => {
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
      y: bounds.top + ((longest.top + longest.bottom) / 2 / element.height) * bounds.height,
    };
  });
}

async function nodeLeftOfLabel(page: Page, graph: Locator, label: { left: number; y: number }) {
  for (let offset = 2; offset <= 90; offset += 2) {
    const point = { x: label.left - offset, y: label.y };
    await page.mouse.move(point.x, point.y);
    if ((await graph.evaluate((host) => host.style.cursor)) === "pointer") return point;
  }
  throw new Error("Could not find graph node left of its label");
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

  const label = await longestLabelAnchor(labelsCanvas);
  const target = await nodeLeftOfLabel(page, graph, label);
  await page.waitForTimeout(50);

  const emphasizedNodes = await nodesCanvas.screenshot();
  const emphasizedLabels = await labelsCanvas.screenshot();
  expect(emphasizedNodes.equals(normalNodes)).toBe(false);
  expect(emphasizedLabels.equals(normalLabels)).toBe(false);
  if (colorScheme === "dark") {
    const hoverInk = await graph.locator("canvas.sigma-hovers").evaluate((canvas) => {
      const element = canvas as HTMLCanvasElement;
      const pixels = element.getContext("2d")!.getImageData(0, 0, element.width, element.height).data;
      let visible = 0;
      let nearWhite = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index + 3] === 0) continue;
        visible += 1;
        if (pixels[index] > 240 && pixels[index + 1] > 240 && pixels[index + 2] > 240) nearWhite += 1;
      }
      return { visible, nearWhite };
    });
    expect(hoverInk.visible).toBeGreaterThan(0);
    expect(hoverInk.nearWhite / hoverInk.visible).toBeLessThan(0.15);
  }
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

  await page.mouse.click(target.x, target.y);
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
  const target = await nodeLeftOfLabel(page, graph, await longestLabelAnchor(labelsCanvas));
  await page.mouse.move(target.x, target.y);
  await expect(graph).toHaveCSS("cursor", "pointer");
  await page.waitForTimeout(50);

  expect((await nodesCanvas.screenshot()).equals(normalNodes)).toBe(false);
  expect((await labelsCanvas.screenshot()).equals(normalLabels)).toBe(false);
  await page.mouse.move(0, 0);
  await expect(graph).toHaveCSS("cursor", "auto");
  await expect(page).toHaveURL(new RegExp(`${base}/notes/welcome/?$`));
});
}

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
  const target = await nodeLeftOfLabel(page, graph, await longestLabelAnchor(labelsCanvas));
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

  await touch(target, 550);
  await expect(page).toHaveURL(new RegExp(`${base}/?$`));
  await expect(graph).toHaveAttribute("data-pinned-inspection");
  const pinned = await nodesCanvas.screenshot();
  expect(pinned.equals(normal)).toBe(false);

  const bounds = (await graph.boundingBox())!;
  await touch({ x: bounds.x + bounds.width - 12, y: bounds.y + bounds.height - 12 });
  await expect(graph).not.toHaveAttribute("data-pinned-inspection");
  expect((await nodesCanvas.screenshot()).equals(pinned)).toBe(false);
  await context.close();
});
