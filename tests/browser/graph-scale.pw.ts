import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * The realistic-scale fixture: 400 notes across four brains, with the
 * sentence-length titles and long brain ids a real published vault produces.
 * Everything here is measured at 390x844, the viewport the change's baseline
 * screenshots were taken at.
 */

const BRAIN_IDS = [
  "engineering-practice-and-delivery-systems",
  "design-systems-and-interface-craft",
  "research-synthesis-and-source-trails",
  "product-strategy-and-planning-notes",
];

test("the realistic-scale workspace serves its full graph", async ({ page }) => {
  await page.goto("./");
  const graph = page.locator("#global-graph");
  await expect(graph.locator("canvas.sigma-nodes")).toBeVisible();
  await expect(graph).toHaveAttribute("data-visible-nodes", "400");
  await expect(graph).toHaveAttribute("data-visible-brain-ids", BRAIN_IDS.join(","));
});

interface Marker { x: number; y: number; r: number }

/** Median of a numeric sample. */
function median(values: readonly number[]): number {
  return [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
}

/**
 * Marker diameter against the distance to the nearest other marker, in CSS
 * pixels, at whatever camera the graph is currently at. Above 1 the markers are
 * wider than the gaps between them, which is what "one continuous mass" means.
 */
async function markerDensity(page: Page, graph: Locator) {
  await graph.evaluate((host) => host.setAttribute("data-measure-markers", ""));
  await page.waitForFunction(() =>
    Boolean(document.querySelector("#global-graph")?.getAttribute("data-marker-geometry")),
  );
  const markers: Marker[] = JSON.parse((await graph.getAttribute("data-marker-geometry"))!);
  await graph.evaluate((host) => host.removeAttribute("data-measure-markers"));
  const spacings = markers.map((marker, index) => {
    let closest = Number.POSITIVE_INFINITY;
    for (let other = 0; other < markers.length; other += 1) {
      if (other === index) continue;
      closest = Math.min(closest, Math.hypot(marker.x - markers[other]!.x, marker.y - markers[other]!.y));
    }
    return closest;
  });
  const diameter = median(markers.map((marker) => marker.r * 2));
  const spacing = median(spacings);
  return { count: markers.length, diameter, spacing, ratio: diameter / spacing };
}

test("the fitted overview keeps individual markers separable", async ({ page }) => {
  await page.goto("./");
  const graph = page.locator("#global-graph");
  await expect(graph.locator("canvas.sigma-nodes")).toBeVisible();
  await expect(graph).toHaveAttribute("data-visible-nodes", "400");
  await expect.poll(async () => Number(await graph.getAttribute("data-settle-requests"))).toBeGreaterThan(0);
  await page.waitForTimeout(2_000);

  const density = await markerDensity(page, graph);
  console.info(JSON.stringify(density));
  expect(density.count).toBe(400);
  // The baseline measured 1.27: markers wider than the gaps between them. The
  // reference behavior measures roughly 0.15 at a comparable node count.
  expect(density.ratio).toBeLessThan(0.4);
  expect(density.ratio).toBeGreaterThan(0.05);
  // Separable means a visible gap, not merely a smaller overlap.
  expect(density.spacing - density.diameter).toBeGreaterThan(2);
});

/** Every rendered label's ink bounds on the labels canvas, in CSS pixels. */
async function renderedLabelBounds(graph: Locator) {
  return graph.evaluate((host) => {
    const canvas = host.querySelector<HTMLCanvasElement>("canvas.sigma-labels")!;
    const context = canvas.getContext("2d")!;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const rows: { left: number; right: number; top: number; bottom: number }[] = [];
    let band: (typeof rows)[number] | null = null;
    for (let y = 0; y < canvas.height; y += 1) {
      let left = canvas.width;
      let right = -1;
      for (let x = 0; x < canvas.width; x += 1) {
        if (pixels[(y * canvas.width + x) * 4 + 3] === 0) continue;
        left = Math.min(left, x);
        right = x;
      }
      if (right < 0) {
        if (band) rows.push(band);
        band = null;
      } else if (band) {
        band.right = Math.max(band.right, right);
        band.left = Math.min(band.left, left);
        band.bottom = y;
      } else {
        band = { left, right, top: y, bottom: y };
      }
    }
    if (band) rows.push(band);
    // Titles drawn on the same rows are one row-band but several titles:
    // split at any run of empty columns wider than a word space.
    const scale = host.getBoundingClientRect().width / canvas.width;
    const wordGap = Math.round(16 / scale);
    const titles: typeof rows = [];
    for (const row of rows) {
      let run: (typeof rows)[number] | null = null;
      let emptySince = -1;
      for (let x = row.left; x <= row.right; x += 1) {
        let inked = false;
        for (let y = row.top; y <= row.bottom && !inked; y += 1) {
          inked = pixels[(y * canvas.width + x) * 4 + 3] !== 0;
        }
        if (inked) {
          if (run && emptySince >= 0 && x - emptySince > wordGap) {
            titles.push(run);
            run = null;
          }
          if (run) run.right = x;
          else run = { left: x, right: x, top: row.top, bottom: row.bottom };
          emptySince = -1;
        } else if (emptySince < 0) {
          emptySince = x;
        }
      }
      if (run) titles.push(run);
    }
    return {
      canvasWidth: canvas.width * scale,
      bands: titles.map((row) => ({
        left: row.left * scale,
        right: row.right * scale,
        top: row.top * scale,
        bottom: row.bottom * scale,
        width: (row.right - row.left) * scale,
      })),
    };
  });
}

async function zoomTo(page: Page, graph: Locator, targetRatio: number) {
  const box = (await graph.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let step = 0; step < 40; step += 1) {
    const ratio = await cameraRatio(page, graph);
    if (ratio <= targetRatio) return ratio;
    await page.mouse.wheel(0, -240);
    await page.waitForTimeout(90);
  }
  return cameraRatio(page, graph);
}

async function cameraRatio(page: Page, graph: Locator) {
  await graph.evaluate((host) => host.setAttribute("data-measure-markers", ""));
  await page.waitForFunction(() =>
    Boolean(document.querySelector("#global-graph")?.getAttribute("data-camera-ratio")),
  );
  const ratio = Number(await graph.getAttribute("data-camera-ratio"));
  await graph.evaluate((host) => host.removeAttribute("data-measure-markers"));
  return ratio;
}

async function renderedLabelSize(page: Page, graph: Locator) {
  await graph.evaluate((host) => host.setAttribute("data-measure-markers", ""));
  await page.waitForFunction(() =>
    Boolean(document.querySelector("#global-graph")?.getAttribute("data-rendered-label-size")),
  );
  const size = Number(await graph.getAttribute("data-rendered-label-size"));
  await graph.evaluate((host) => host.removeAttribute("data-measure-markers"));
  return size;
}

test("no rendered label is cut off by an edge of the graph area", async ({ page }) => {
  await page.goto("./");
  const graph = page.locator("#global-graph");
  await expect(graph.locator("canvas.sigma-nodes")).toBeVisible();
  await page.waitForTimeout(2_000);
  // Deep enough that labels are drawn in company, and with the pointer taken
  // off the canvas afterwards so no hover decides which labels those are.
  await zoomTo(page, graph, 0.2);
  await page.mouse.move(60, 40);
  await page.waitForTimeout(800);

  const { canvasWidth, bands } = await renderedLabelBounds(graph);
  expect(bands.length).toBeGreaterThan(0);
  for (const band of bands) {
    // Centring bounds a label to twice its node's distance from the nearer
    // edge, so a label that reaches an edge would mean the budget was wrong.
    expect(band.left).toBeGreaterThanOrEqual(0);
    expect(band.right).toBeLessThanOrEqual(canvasWidth);
  }
});

test("label text and markers grow together as the camera zooms", async ({ page }) => {
  await page.goto("./");
  const graph = page.locator("#global-graph");
  await expect(graph.locator("canvas.sigma-nodes")).toBeVisible();
  await page.waitForTimeout(2_000);

  const samples: { ratio: number; size: number; diameter: number }[] = [];
  for (const target of [1.12, 0.6, 0.3, 0.12]) {
    const ratio = await zoomTo(page, graph, target);
    await page.waitForTimeout(400);
    samples.push({
      ratio,
      size: await renderedLabelSize(page, graph),
      diameter: (await markerDensity(page, graph)).diameter,
    });
  }
  console.info(JSON.stringify(samples));

  // Text never shrinks as the camera zooms in, and markers always grow. A
  // phone fit fills the height, which already puts label text at its ceiling
  // before any label is drawn, so growth is asserted on markers and the text
  // law is pinned by its clamps and by the unit tests over renderedLabelSize.
  for (let index = 1; index < samples.length; index += 1) {
    expect(samples[index]!.size).toBeGreaterThanOrEqual(samples[index - 1]!.size);
    expect(samples[index]!.diameter).toBeGreaterThan(samples[index - 1]!.diameter);
  }
  expect(samples.at(-1)!.diameter).toBeGreaterThan(samples[0]!.diameter * 1.5);
  // And the clamps hold at both ends.
  expect(samples.at(-1)!.size).toBeLessThanOrEqual(12);
  expect(samples[0]!.size).toBeGreaterThanOrEqual(9);
});

test("a dense fitted overview renders no labels it cannot place", async ({ page }) => {
  await page.goto("./");
  const graph = page.locator("#global-graph");
  await expect(graph.locator("canvas.sigma-nodes")).toBeVisible();
  await page.waitForTimeout(2_000);

  // 400 notes on a 390 pixel viewport: almost nothing can be placed without
  // colliding, and the one peripheral hub that could is not drawn alone. The
  // baseline drew six overlapping; the first fix drew exactly one.
  await expect(graph).toHaveAttribute("data-rendered-labels", "0");
  const { bands } = await renderedLabelBounds(graph);
  expect(bands).toHaveLength(0);
});

test("label selection is stable frame to frame at one camera state", async ({ page }) => {
  await page.goto("./");
  const graph = page.locator("#global-graph");
  await expect(graph.locator("canvas.sigma-nodes")).toBeVisible();
  await page.waitForTimeout(2_000);
  await zoomTo(page, graph, 0.5);
  await page.waitForTimeout(800);

  const first = await graph.getAttribute("data-rendered-label-ids");
  for (let frame = 0; frame < 5; frame += 1) {
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    expect(await graph.getAttribute("data-rendered-label-ids")).toBe(first);
  }
});

test("the owner-labels preference is the reader's, remembered and never in the URL", async ({ page }) => {
  await page.goto("./");
  const graph = page.locator("#global-graph");
  await expect(graph.locator("canvas.sigma-nodes")).toBeVisible();
  await page.waitForTimeout(1_500);

  // Narrow defaults to off: a 41-character Brain id would spend more of the
  // label than the title does.
  await expect(graph).toHaveAttribute("data-owner-labels", "false");
  const toggle = page.locator("[data-owner-labels-toggle]");
  await page.locator("[data-graph-lens] > summary").click();
  await expect(toggle).not.toBeChecked();
  await expect(toggle).toHaveAccessibleName(/owning Brain/i);

  await toggle.check();
  await expect(graph).toHaveAttribute("data-owner-labels", "true");
  expect(new URL(page.url()).search).toBe("");

  // It is the reader's, so it survives a reload.
  await page.reload();
  await expect(graph.locator("canvas.sigma-nodes")).toBeVisible();
  await expect(graph).toHaveAttribute("data-owner-labels", "true");
  expect(new URL(page.url()).search).toBe("");

  await page.locator("[data-graph-lens] > summary").click();
  await page.locator("[data-owner-labels-toggle]").uncheck();
  await expect(graph).toHaveAttribute("data-owner-labels", "false");
  await page.reload();
  await expect(graph.locator("canvas.sigma-nodes")).toBeVisible();
  await expect(graph).toHaveAttribute("data-owner-labels", "false");
});

test("owner labels default on for a wide viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("./");
  const graph = page.locator("#global-graph");
  await expect(graph.locator("canvas.sigma-nodes")).toBeVisible();
  // Nothing stored, so the default applies: on where there is room for it.
  await expect(graph).toHaveAttribute("data-owner-labels", "true");
});

test("connected neighbors are readable as text and move focus", async ({ page }) => {
  const focus = "engineering-practice-and-delivery-systems%2Fretrieval-practice-beats-rereading-the-source";
  await page.goto(`./?focus=${focus}`);
  const graph = page.locator("#global-graph");
  await expect(graph.locator("canvas.sigma-nodes")).toBeVisible();
  await page.waitForTimeout(2_000);

  await page.locator("[data-graph-focus-disclosure]").click();
  const rows = page.locator("[data-graph-neighbors-list] button");

  // Every visible neighbour is listed, uncapped, where the canvas could place
  // almost none of their labels.
  const neighborhood = JSON.parse(await graph.getAttribute("data-focused-marker-geometry") ?? "[]");
  await expect(rows).toHaveCount(neighborhood.length - 1);
  expect(neighborhood.length - 1).toBeGreaterThan(Number(await graph.getAttribute("data-rendered-labels")));

  // Alphabetical, and complete rather than shortened.
  const titles = await rows.locator(".graph-neighbor__title").allInnerTexts();
  expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)));
  for (const title of titles) expect(title).not.toContain("…");

  // A neighbour in another Brain says so, even though canvas labels here carry
  // no owner at all on a narrow viewport.
  await expect(graph).toHaveAttribute("data-owner-labels", "false");
  await expect(page.locator("[data-graph-neighbors-list] .graph-neighbor__owner").first()).toBeVisible();

  // Rows are reachable on a phone.
  for (const box of await rows.evaluateAll((items) =>
    items.map((item) => item.getBoundingClientRect()))) {
    expect(box.height).toBeGreaterThanOrEqual(44);
  }

  // Activating a row moves focus, refills the list, and leaves the bar open.
  const firstTitle = titles[0]!;
  await rows.first().click();
  await page.waitForTimeout(1_200);
  await expect(page.locator("[data-graph-focus-title-full], [data-graph-focus-title]").first())
    .toContainText(firstTitle);
  await expect(page.locator("[data-graph-focus-details]")).toBeVisible();
  await expect(page.locator("[data-graph-focus-disclosure]")).toHaveAttribute("aria-expanded", "true");
  await expect(rows.first()).toBeVisible();
  expect(await rows.locator(".graph-neighbor__title").allInnerTexts()).not.toEqual(titles);
});

test("a note with no visible connections has no list at all", async ({ page }) => {
  await page.goto("./");
  const graph = page.locator("#global-graph");
  await expect(graph.locator("canvas.sigma-nodes")).toBeVisible();
  await page.waitForTimeout(1_500);
  // Nothing focused: the block is absent rather than empty.
  await expect(page.locator("[data-graph-neighbors]")).toBeHidden();
});

test("a neighbor row on a neighborhood page moves focus in place and the address follows", async ({ page }) => {
  const own = "/brains/engineering-practice-and-delivery-systems/notes/retrieval-practice-beats-rereading-the-source/graph";
  await page.goto(`.${own}`);
  const graph = page.locator("#global-graph");
  await expect(graph.locator("canvas.sigma-nodes")).toBeVisible();
  // A cold arrival fits, settles the layout, then fits once more; count fits
  // only once all three have completed, or the arrival's own fit lands in the
  // tally for the move.
  await expect.poll(async () => Number(await graph.getAttribute("data-motion-completions")), { timeout: 15_000 })
    .toBeGreaterThanOrEqual(3);
  await page.waitForTimeout(400);
  // A marker that survives only if the page is never reloaded.
  await page.evaluate(() => { (window as unknown as { samePage: boolean }).samePage = true; });

  // Expanding the bar shrinks the usable viewport, which refits the
  // neighborhood above the panel; let that fit finish before counting.
  const completionsBeforeExpand = Number(await graph.getAttribute("data-motion-completions"));
  await page.locator("[data-graph-focus-disclosure]").click();
  const rows = page.locator("[data-graph-neighbors-list] button");
  await expect(rows.first()).toBeVisible();
  await expect.poll(async () => Number(await graph.getAttribute("data-motion-completions")), { timeout: 10_000 })
    .toBeGreaterThan(completionsBeforeExpand);
  const target = await rows.first().getAttribute("data-neighbor-node");
  const fitsBefore = Number(await graph.getAttribute("data-fit-requests"));
  await rows.first().click();

  // The move is the same glide the graph page makes, not a page load that
  // opens on the whole graph and zooms back in: the page survives, one fit
  // runs, and the address is the new neighborhood's own path.
  await expect(graph).toHaveAttribute("data-focused-node", target!);
  await expect(page).toHaveURL(/\/graph\/?$/u);
  expect(new URL(page.url()).pathname).not.toContain("retrieval-practice-beats-rereading-the-source");
  expect(new URL(page.url()).search).toBe("");
  expect(await page.evaluate(() => (window as unknown as { samePage?: boolean }).samePage)).toBe(true);
  await expect.poll(async () => Number(await graph.getAttribute("data-fit-requests"))).toBe(fitsBefore + 1);
});

test("clearing focus is one tap from the collapsed bar", async ({ page }) => {
  const own = "/brains/engineering-practice-and-delivery-systems/notes/retrieval-practice-beats-rereading-the-source/graph";
  await page.goto(`.${own}`);
  const graph = page.locator("#global-graph");
  await expect(graph.locator("canvas.sigma-nodes")).toBeVisible();
  await expect(graph).toHaveAttribute("data-focused-node", /.+/u);

  // Never behind the disclosure: the bar stays collapsed throughout.
  const disclosure = page.locator("[data-graph-focus-disclosure]");
  await expect(disclosure).toHaveAttribute("aria-expanded", "false");
  const clear = page.locator("[data-graph-focus-clear]");
  await expect(clear).toBeVisible();
  const box = (await clear.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await expect(clear).toHaveAccessibleName("Clear graph focus");

  await clear.click();
  await expect(graph).not.toHaveAttribute("data-focused-node");
  await expect(page.locator("[data-graph-focus-status]")).toBeHidden();
  await expect(page).toHaveURL(/\/realistic\/?$/u);
  await expect(disclosure).toHaveAttribute("aria-expanded", "false");
});

test("a hovered title withdraws when the pointer leaves an unpinned graph", async ({ page }) => {
  await page.goto("./");
  const graph = page.locator("#global-graph");
  await expect(graph.locator("canvas.sigma-nodes")).toBeVisible();
  await page.waitForTimeout(2_000);
  await expect(graph).toHaveAttribute("data-rendered-labels", "0");
  // Preview is what makes a hover reveal a neighborhood; it is off by default.
  await page.keyboard.press("d");
  await expect(graph).toHaveAttribute("data-hover-preview", "true");

  // Hover the largest marker, re-run label selection by nudging the camera
  // out and back to the fitted ratio, then take the pointer off the canvas.
  await graph.evaluate((host) => host.setAttribute("data-measure-markers", ""));
  await page.waitForFunction(() => document.querySelector("#global-graph")?.getAttribute("data-marker-geometry"));
  const markers: Marker[] = JSON.parse((await graph.getAttribute("data-marker-geometry"))!);
  await graph.evaluate((host) => host.removeAttribute("data-measure-markers"));
  const hub = markers.reduce((best, marker) => (marker.r > best.r ? marker : best), markers[0]!);
  const box = (await graph.boundingBox())!;
  await page.mouse.move(box.x + hub.x, box.y + hub.y);
  await expect(graph).toHaveAttribute("data-transient-inspection", /.+/u);
  await page.mouse.wheel(0, 240);
  await page.waitForTimeout(400);
  await page.mouse.wheel(0, -240);
  await page.waitForTimeout(400);
  await page.mouse.move(60, 40);
  await expect(graph).not.toHaveAttribute("data-transient-inspection");
  await page.waitForTimeout(500);

  // Unpinned, the pointer's title lives on the hover plate, not in label
  // selection, so nothing is left behind when the pointer goes.
  await expect(graph).toHaveAttribute("data-rendered-labels", "0");
});

test("a focus fit keeps the focused note's title on screen", async ({ page }) => {
  // A neighborhood whose neighbors lie far to the right and below: the
  // marker-only fit pins the focused note to the left padding, where a centred
  // 300 pixel title would run off the screen. The reported case, made certain.
  const brain = { id: "eng", title: "Engineering", accent: "#3366cc" };
  const node = (id: string, title: string, x: number, y: number, degree: number) => ({
    id: `eng/${id}`, compositeId: `eng/${id}`, brainId: brain.id, brainTitle: brain.title, brainAccent: brain.accent,
    title, route: `/brains/eng/notes/${id}`, type: "permanent", status: "established", tags: [], degree, x, y,
  });
  const graphData = {
    mode: "workspace",
    brains: [brain],
    nodes: [
      node("edge-focus", "Documentation as a product is worth more than the first draft of a system", 0, 0, 3),
      node("far-right", "Far right", 3, 0, 1),
      node("far-corner", "Far corner", 3, 4, 1),
      node("far-below", "Far below", 0.3, 4, 1),
    ],
    edges: ["far-right", "far-corner", "far-below"].map((id) => ({ source: "eng/edge-focus", target: `eng/${id}` })),
  };
  await page.route("**/graph-data.json", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(graphData) }),
  );
  await page.goto("./?focus=eng%2Fedge-focus");
  const graph = page.locator("#global-graph");
  await expect(graph.locator("canvas.sigma-nodes")).toBeVisible();
  await expect(graph).toHaveAttribute("data-focused-node", "eng/edge-focus");
  await page.waitForTimeout(2_000);

  const me = (JSON.parse((await graph.getAttribute("data-focused-marker-geometry"))!) as
    { id: string; x: number; y: number; radius: number }[]).find((marker) => marker.id === "eng/edge-focus")!;
  const { canvasWidth, bands } = await renderedLabelBounds(graph);
  // The focused note's title: the ink just below its marker, spanning its x.
  const lines = bands.filter((band) =>
    band.top > me.y + me.radius - 2 && band.top < me.y + me.radius + 48 &&
    band.left <= me.x && band.right >= me.x
  );
  expect(lines.length, `focused title at (${me.x}, ${me.y})`).toBeGreaterThan(0);
  for (const line of lines) {
    // Ink that is cut at the edge simply starts at pixel zero, so "inside the
    // canvas" cannot fail. A centred title is symmetric about its node; a cut
    // one is not, and it touches the edge.
    const leftReach = me.x - line.left;
    const rightReach = line.right - me.x;
    expect(Math.abs(leftReach - rightReach), `line ${line.left}–${line.right} under x=${me.x}`).toBeLessThan(12);
    expect(line.left).toBeGreaterThan(2);
    expect(line.right).toBeLessThan(canvasWidth - 2);
  }
});

test("help on a phone shows gestures, not keys", async ({ page }) => {
  await page.goto("./");
  const graph = page.locator("#global-graph");
  await expect(graph.locator("canvas.sigma-nodes")).toBeVisible();
  const help = page.getByRole("button", { name: "Help" });
  await expect(help).toBeVisible();
  await help.click();
  const panel = page.getByRole("region", { name: "Graph help" });
  await expect(panel).toBeVisible();
  await expect(panel.locator("[data-graph-help-touch]")).toBeVisible();
  await expect(panel.locator("[data-graph-help-touch]")).toContainText("Long press");
  await expect(panel.locator("[data-graph-help-keys]")).toBeHidden();
  // And the panel stays on screen.
  const box = (await panel.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
});
