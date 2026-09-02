import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const output = path.dirname(fileURLToPath(import.meta.url));
const workspace = "http://127.0.0.1:4331/workspace-demo";
const vault = "http://127.0.0.1:4328";
const browser = await chromium.launch();

async function withPage(options, run) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    colorScheme: "light",
    deviceScaleFactor: 1,
    ...options,
  });
  const page = await context.newPage();
  try {
    await run(page);
  } finally {
    await context.close();
  }
}

async function ready(page, url) {
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
}

async function screenshot(page, name, options = {}) {
  await page.screenshot({
    path: path.join(output, name),
    animations: "disabled",
    ...options,
  });
}

async function screenshotRange(page, start, end, name, padding = 18) {
  const first = await start.boundingBox();
  const last = await end.boundingBox();
  if (!first || !last) throw new Error(`Could not measure ${name}`);
  await screenshot(page, name, {
    clip: {
      x: Math.max(0, first.x - padding),
      y: Math.max(0, first.y - padding),
      width: Math.min(page.viewportSize().width, Math.max(first.width, last.width) + padding * 2),
      height: last.y + last.height - first.y + padding * 2,
    },
  });
}

async function waitForGraph(page) {
  const graph = page.locator("#global-graph");
  await graph.locator("canvas.sigma-nodes").waitFor({ state: "visible" });
  await page.waitForTimeout(700);
  return graph;
}

async function graphTarget(page, graph) {
  const label = await graph.locator("canvas.sigma-labels").evaluate((canvas) => {
    const element = canvas;
    const context = element.getContext("2d");
    const pixels = context.getImageData(0, 0, element.width, element.height).data;
    const bands = [];
    let band = null;
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
    if (!longest) return null;
    const bounds = element.getBoundingClientRect();
    return {
      left: bounds.left + (longest.left / element.width) * bounds.width,
      right: bounds.left + (longest.right / element.width) * bounds.width,
      y: bounds.top + ((longest.top + longest.bottom) / 2 / element.height) * bounds.height,
    };
  });
  if (label) {
    for (let x = label.left; x <= label.right; x += 2) {
      await page.mouse.move(x, label.y);
      if ((await graph.evaluate((host) => host.style.cursor)) === "pointer") {
        return { x, y: label.y };
      }
    }
    for (let offset = 2; offset <= 90; offset += 2) {
      const point = { x: label.left - offset, y: label.y };
      await page.mouse.move(point.x, point.y);
      if ((await graph.evaluate((host) => host.style.cursor)) === "pointer") return point;
    }
  }

  const target = await graph.evaluate((host) => {
    const bounds = host.getBoundingClientRect();
    let fallback = null;
    for (let y = 70; y < bounds.height; y += 4) {
      for (let x = 70; x < bounds.width; x += 4) {
        host.dispatchEvent(new PointerEvent("pointermove", {
          bubbles: true,
          clientX: bounds.left + x,
          clientY: bounds.top + y,
          pointerType: "mouse",
        }));
        if (!host.dataset.transientInspection) continue;
        const point = { x: bounds.left + x, y: bounds.top + y };
        fallback ??= point;
        if (document.elementFromPoint(point.x, point.y) instanceof HTMLCanvasElement) return point;
      }
    }
    return fallback;
  });
  if (!target) throw new Error("Could not resolve a graph target");
  return target;
}

await withPage({}, async (page) => {
  await ready(page, `${workspace}/`);
  await screenshot(page, "01-brain-chooser-desktop.png");
});

await withPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, async (page) => {
  await ready(page, `${workspace}/`);
  await page.getByRole("checkbox", { name: "Combine Engineering", exact: true }).check();
  const design = page.getByRole("checkbox", { name: "Combine Design", exact: true });
  await design.check();
  await design.scrollIntoViewIfNeeded();
  await screenshot(page, "02-brain-chooser-phone-selected.png");
});

await withPage({}, async (page) => {
  await ready(page, `${workspace}/brains/research-archive-and-synthesis-source-trails/notes/archive-boundaries`);
  await page.getByRole("button", { name: "Navigation" }).click();
  await screenshot(page, "03-note-home-focused-graph-desktop.png");
});

await withPage({ viewport: { width: 390, height: 500 }, isMobile: true, hasTouch: true }, async (page) => {
  await ready(page, `${workspace}/`);
  await page.getByRole("button", { name: "About", exact: true }).click();
  await page.getByLabel("About Brain").waitFor({ state: "visible" });
  await screenshot(page, "04-chooser-about-short-phone.png");
});

await withPage({}, async (page) => {
  await ready(page, `${workspace}/brains/engineering/notes/principles?brains=engineering,design`);
  await page.getByRole("button", { name: "Navigation" }).click();
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("dialog", { name: "Quick switcher" }).waitFor({ state: "visible" });
  await screenshot(page, "05-combined-note-context.png");
});

const focusedGraph = `${workspace}/graph?brains=engineering,design&focus=engineering%2Fprinciples`;
await withPage({}, async (page) => {
  await ready(page, focusedGraph);
  await waitForGraph(page);
  await page.locator("[data-graph-focus-status]").waitFor({ state: "visible" });
  await screenshot(page, "06-graph-focus-light.png");

  const graph = page.locator("#global-graph");
  const target = await graphTarget(page, graph);
  await page.mouse.click(target.x, target.y, { button: "right" });
  await page.locator("[data-graph-context-menu]").waitFor({ state: "visible" });
  await screenshot(page, "07-graph-focus-context-menu.png");
});

await withPage({ colorScheme: "dark" }, async (page) => {
  await ready(page, focusedGraph);
  await waitForGraph(page);
  await page.locator("[data-graph-focus-status]").waitFor({ state: "visible" });
  await screenshot(page, "08-graph-focus-dark.png");
});

await withPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, async (page) => {
  await ready(page, focusedGraph);
  await waitForGraph(page);
  await page.locator("[data-graph-focus-status]").waitFor({ state: "visible" });
  await screenshot(page, "09-graph-focus-phone.png");
});

await withPage({}, async (page) => {
  await ready(page, `${workspace}/graph?brains=engineering,design`);
  await waitForGraph(page);
  await page.getByRole("button", { name: "Legend", exact: true }).click();
  await screenshot(page, "10-global-legend-desktop.png");
});

await withPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, async (page) => {
  await ready(page, `${workspace}/graph?brains=engineering,design`);
  await waitForGraph(page);
  await page.getByRole("button", { name: "Legend", exact: true }).click();
  await screenshot(page, "11-global-legend-phone.png");
});

await withPage({ viewport: { width: 800, height: 600 }, hasTouch: true }, async (page) => {
  await ready(page, `${workspace}/graph?brains=engineering,design`);
  await waitForGraph(page);
  await page.getByRole("button", { name: "Legend", exact: true }).click();
  await screenshot(page, "12-global-legend-coarse-tablet.png");
});

await withPage({}, async (page) => {
  await ready(page, `${vault}/notes/portable-notes`);
  const heading = page.getByRole("heading", { name: "Open formats" });
  await heading.scrollIntoViewIfNeeded();
  await screenshotRange(page, heading, page.locator("article p").last(), "13-external-links-desktop.png");
});

await withPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, async (page) => {
  await ready(page, `${vault}/notes/portable-notes`);
  const heading = page.getByRole("heading", { name: "Open formats" });
  await heading.scrollIntoViewIfNeeded();
  await screenshotRange(page, heading, page.locator("article p").last(), "14-external-links-phone.png", 10);
});

await withPage({}, async (page) => {
  await ready(page, `${workspace}/brains/research/notes/missing?brains=engineering,design`);
  await page.locator("[data-recommendation]:not([hidden])").waitFor({ state: "visible" });
  await screenshot(page, "15-scoped-404-workspace.png");
});

await withPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, async (page) => {
  await ready(page, `${workspace}/brains/engineering/notes/missing`);
  await page.locator("[data-recommendation]:not([hidden])").waitFor({ state: "visible" });
  await page.locator("[data-not-found] [data-open-switcher]").click();
  await page.getByRole("dialog", { name: "Quick switcher" }).waitFor({ state: "visible" });
  await screenshot(page, "16-404-search-phone.png");
});

await withPage({}, async (page) => {
  await ready(page, `${workspace}/graph?brains=engineering,unknown`);
  await page.locator("[data-selection-error]").waitFor({ state: "visible" });
  await screenshot(page, "17-invalid-combined-selection.png");
});

await withPage({}, async (page) => {
  await ready(page, `${workspace}/brains/design/notes/principles`);
  const mentions = page.getByRole("heading", { name: "Linked mentions", exact: true }).locator("..");
  await mentions.scrollIntoViewIfNeeded();
  await screenshot(page, "linked-mention-highlight.png", { clip: await mentions.boundingBox() });

  await ready(page, `${workspace}/brains/design/notes/interaction-model`);
  const paragraph = page.locator("article p", { hasText: "These principles" });
  await paragraph.scrollIntoViewIfNeeded();
  await screenshot(page, "potential-link-highlight.png", { clip: await paragraph.boundingBox() });
});

await browser.close();
