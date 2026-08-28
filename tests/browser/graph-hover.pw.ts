import { expect, test, type TestInfo } from "@playwright/test";

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

test("a hovered graph node stays under the pointer and remains the click target", async ({ page }, testInfo) => {
  const { base } = deployment(testInfo);
  await page.route("**/graph-data.json", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(graphData) }),
  );
  await page.goto(`${base}/`);

  const graph = page.locator("#global-graph");
  const mouseCanvas = graph.locator("canvas.sigma-mouse");
  const nodesCanvas = graph.locator("canvas.sigma-nodes");
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
      y: bounds.top + ((longest.top + longest.bottom) / 2 / element.height) * bounds.height,
    };
  });

  let target: { x: number; y: number } | null = null;
  for (let offset = 2; offset <= 90; offset += 2) {
    const point = { x: label.left - offset, y: label.y };
    await page.mouse.move(point.x, point.y);
    if ((await graph.evaluate((host) => host.style.cursor)) === "pointer") {
      target = point;
      break;
    }
  }
  expect(target).not.toBeNull();
  await page.waitForTimeout(50);

  const before = await nodesCanvas.screenshot();
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
    await page.mouse.move(target!.x, target!.y);
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
  expect((await nodesCanvas.screenshot()).equals(before)).toBe(true);

  await page.mouse.click(target!.x, target!.y);
  await expect(page).toHaveURL(new RegExp(`${base}/notes/welcome/?$`));
  await expect(mouseCanvas).toHaveCount(0);
});
