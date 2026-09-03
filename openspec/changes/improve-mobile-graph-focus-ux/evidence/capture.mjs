import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const output = path.dirname(fileURLToPath(import.meta.url));
const [name, widthValue, state = "collapsed"] = process.argv.slice(2);
if (!name || !widthValue) {
  throw new Error("Usage: node capture.mjs <name.png> <width> [collapsed|expanded]");
}

const width = Number(widthValue);
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width, height: width === 320 ? 568 : 844 },
  colorScheme: "light",
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();

try {
  await page.route("**/graph-data.json", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    const focused = data.nodes.find((node) => node.id === "engineering/principles");
    if (!focused) throw new Error("Could not find the focused evidence node");
    focused.title = "A deliberately long focused neighborhood title that cannot fit within a phone viewport";
    await route.fulfill({ response, json: data });
  });

  await page.goto("http://127.0.0.1:4321/brains/engineering/notes/principles/graph/");
  await page.evaluate(() => document.fonts.ready);
  const graph = page.locator("#global-graph");
  await graph.locator("canvas.sigma-nodes").waitFor({ state: "visible" });
  await page.locator("[data-graph-focus-status]").waitFor({ state: "visible" });
  await page.waitForFunction(() =>
    Number(document.querySelector("#global-graph")?.getAttribute("data-motion-completions")) > 0
  );

  const disclosure = page.locator("[data-graph-focus-disclosure]");
  if (state === "expanded") {
    await disclosure.click();
    await disclosure.waitFor({ state: "visible" });
  }

  const fits = Number(await graph.getAttribute("data-fit-requests"));
  await page.getByRole("button", { name: "Fit view" }).click();
  await page.waitForFunction((previous) =>
    Number(document.querySelector("#global-graph")?.getAttribute("data-fit-requests")) > previous,
  fits);
  await page.waitForTimeout(500);

  const diagnostics = await page.evaluate(() => {
    const host = document.querySelector("#global-graph");
    const focus = document.querySelector("[data-graph-focus-status]");
    const debug = window.__graphDebug;
    const focusId = host?.getAttribute("data-focused-node");
    const ids = focusId
      ? [focusId, ...debug.graph.neighbors(focusId)].filter((id) => !debug.hidden.has(id))
      : [];
    const markers = ids.map((id) => {
      const data = debug.renderer.getNodeDisplayData(id);
      const point = debug.renderer.framedGraphToViewport(data);
      return { id, x: point.x, y: point.y, radius: debug.renderer.scaleSize(data.size) };
    });
    const bounds = focus?.getBoundingClientRect();
    return {
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      camera: debug.renderer.getCamera().getState(),
      focusBar: bounds && {
        left: bounds.left,
        top: bounds.top,
        right: bounds.right,
        bottom: bounds.bottom,
        width: bounds.width,
        height: bounds.height,
      },
      markers,
      renderedLabelIds: host?.getAttribute("data-rendered-label-ids"),
    };
  });

  await page.screenshot({
    path: path.join(output, name),
    animations: "disabled",
  });
  console.log(JSON.stringify(diagnostics, null, 2));
} finally {
  await context.close();
  await browser.close();
}
