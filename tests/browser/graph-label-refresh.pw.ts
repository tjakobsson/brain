import { expect, test } from "@playwright/test";

interface LabelLine {
  text: string;
  x: number;
  y: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  alpha: number;
}

declare global {
  interface HTMLCanvasElement {
    graphTestLines?: LabelLine[];
  }
}

// The normal browser server provides this fixture. A running dev server can
// also run these focused regressions without rebuilding every deployment.
test.use({
  baseURL: process.env.BRAIN_LABEL_TEST_URL ?? "http://127.0.0.1:4334/realistic/",
  viewport: { width: 1280, height: 900 },
});
test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-root", "Run once against the realistic fixture.");
  // Record the current label frame, including its measured line boxes. This
  // works against production builds without exposing renderer internals.
  await page.addInitScript(() => {
    const clear = CanvasRenderingContext2D.prototype.clearRect;
    const fill = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.clearRect = function (...args) {
      if (this.canvas.classList.contains("sigma-labels")) this.canvas.graphTestLines = [];
      return clear.apply(this, args);
    };
    CanvasRenderingContext2D.prototype.fillText = function (...args) {
      if (this.canvas.classList.contains("sigma-labels")) {
        const [text, x, y] = args;
        const size = Number(/([\d.]+)px/u.exec(this.font)![1]);
        const width = this.measureText(text).width;
        const lines = this.canvas.graphTestLines ??= [];
        lines.push({ text, x, y, left: x - width / 2, right: x + width / 2,
          top: y - size * 0.82, bottom: y - size * 0.82 + size * 1.15, alpha: this.globalAlpha });
      }
      return fill.apply(this, args);
    };
  });
});

const notePath = "brains/design-systems-and-interface-craft/notes/" +
  "a-design-review-ritual-compounds-into-the-shared-context-of-a-team";

for (const exit of ["pointer leave", "preview toggle"] as const) {
  test(`local labels recover after zoom and ${exit}`, async ({ page }) => {
    await page.goto(`./${notePath}`);
    const graph = page.locator(".local-graph");
    await graph.scrollIntoViewIfNeeded();
    await expect(graph).toHaveAttribute("data-fit-completions", /[1-9]/u);
    await page.waitForTimeout(500);
    await page.keyboard.press("d");
    await expect(graph).toHaveAttribute("data-hover-preview", "true");

    const target = await graph.locator("canvas.sigma-labels").evaluate((canvas) => {
      const lines = (canvas as HTMLCanvasElement).graphTestLines!;
      // The note owning this map is labelled and has second-hop notes outside
      // its hover neighborhood, so inspection must suppress some labels.
      const line = lines.find((line) => line.text.includes("design review ritual"));
      if (!line) throw new Error("Missing connection-map root label");
      const bounds = canvas.getBoundingClientRect();
      return { x: bounds.x + line.x, y: bounds.y + line.y };
    });
    await page.mouse.move(target.x, target.y);
    await expect(graph).toHaveAttribute("data-transient-inspection", /.+/u);
    await page.mouse.wheel(0, -60);
    await page.waitForTimeout(600);
    const inspectedCount = Number(await graph.getAttribute("data-rendered-labels"));

    if (exit === "pointer leave") await page.mouse.move(0, 0);
    else await page.keyboard.press("d");
    await expect(graph).not.toHaveAttribute("data-transient-inspection");
    await expect.poll(async () => Number(await graph.getAttribute("data-rendered-labels")))
      .toBeGreaterThan(inspectedCount);
  });
}

test("local label selection changes fade rather than flicker", async ({ page }) => {
  await page.goto(`./${notePath}`);
  const graph = page.locator(".local-graph");
  await graph.scrollIntoViewIfNeeded();
  await expect(graph).toHaveAttribute("data-fit-completions", /[1-9]/u);
  await page.waitForTimeout(500);
  const labels = graph.locator("canvas.sigma-labels");
  // Only the labels canvas: Sigma paints a lit neighborhood's titles on its
  // hover layer, so what fades here is the plain selection around it.
  const frame = () => labels.evaluate((canvas) => {
    const lines = (canvas as HTMLCanvasElement).graphTestLines ?? [];
    return {
      texts: [...new Set(lines.map(({ text }) => text))].sort(),
      partial: [...new Set(lines.filter(({ alpha }) => alpha > 0 && alpha < 1).map(({ text }) => text))],
      opaque: lines.length > 0 && lines.every(({ alpha }) => alpha === 1),
    };
  });
  const settled = async () => {
    await expect.poll(async () => (await frame()).opaque).toBe(true);
    return (await frame()).texts;
  };
  // A frame drawn partway through a fade, whichever titles it holds.
  const midFade = async () => {
    let seen: string[] = [];
    await expect.poll(async () => {
      seen = (await frame()).partial;
      return seen.length;
    }, { intervals: [5], timeout: 3000 }).toBeGreaterThan(0);
    return seen;
  };
  const before = await settled();
  expect(before.length).toBeGreaterThan(1);

  // Preview ending is a selection change without a camera move: the titles
  // that inspection took away come back through translucent frames.
  const target = await labels.evaluate((canvas) => {
    const line = (canvas as HTMLCanvasElement).graphTestLines!.find((line) => line.text.includes("design review ritual"));
    if (!line) throw new Error("Missing connection-map root label");
    const bounds = canvas.getBoundingClientRect();
    return { x: bounds.x + line.x, y: bounds.y + line.y };
  });
  await page.keyboard.press("d");
  await expect(graph).toHaveAttribute("data-hover-preview", "true");
  await page.mouse.move(target.x, target.y);
  await expect(graph).toHaveAttribute("data-transient-inspection", /.+/u);
  // Inspection clears the titles outside the neighborhood, and they leave
  // through translucent frames rather than in one: what was drawn is drawn
  // until its fade ends. (The lit titles move to Sigma's hover layer.)
  const leaving = await midFade();
  for (const text of leaving) expect(before).toContain(text);
  await expect.poll(async () => (await frame()).partial.length, { timeout: 3000 }).toBe(0);
  await page.waitForTimeout(400);
  const inspected = (await frame()).texts;
  expect(inspected).not.toEqual(before);
  await page.keyboard.press("d");
  await expect(graph).not.toHaveAttribute("data-transient-inspection");
  const returning = await midFade();
  const restored = await settled();
  // What was translucent was on its way in or out, never a title outside both.
  for (const text of returning) expect([...inspected, ...restored]).toContain(text);
  await page.mouse.move(0, 0);
  await expect(graph).not.toHaveAttribute("data-pointer-node");
  expect(await settled()).toEqual(before);

  // A camera change swaps titles the same way.
  const box = (await graph.boundingBox())!;
  for (let step = 0; step < 2; step += 1) {
    await graph.locator("canvas.sigma-mouse").dispatchEvent("wheel", {
      clientX: box.x + box.width / 2, clientY: box.y + box.height / 2, deltaY: -120, bubbles: true,
    });
    await page.waitForTimeout(150);
  }
  await midFade();
  expect(await settled()).not.toEqual(before);
});

test("global preview toggle refreshes labels under a stationary pointer", async ({ page }) => {
  const under = "product-strategy-and-planning-notes/a-design-review-ritual-trades-away-every-clever-abstraction";
  const neighbor = "product-strategy-and-planning-notes/feature-flag-hygiene-predicts-the-shared-context-of-a-team";
  const data = await (await page.request.get("./graph-data.json")).json() as { nodes: { id: string }[] };
  await page.goto("./");
  const graph = page.locator("#global-graph");
  await expect(graph).toHaveAttribute("data-visible-nodes", String(data.nodes.length));
  await expect(graph).toHaveAttribute("data-motion-completions", /[1-9]/u);
  await expect(graph).toHaveAttribute("data-hover-preview", "false");
  await graph.evaluate((host) => host.setAttribute("data-measure-markers", ""));
  await expect(graph).toHaveAttribute("data-marker-geometry", /\d/u);
  // The overview starts below the minimum legible label size. Zoom before
  // choosing a pointer target, then leave the camera alone for both toggles.
  for (let step = 0; step < 2; step += 1) {
    await graph.locator("canvas.sigma-mouse").dispatchEvent("wheel", {
      clientX: 640, clientY: 450, deltaY: -120, bubbles: true,
    });
    await page.waitForTimeout(700);
  }
  const target = await graph.evaluate((host, index) => {
    const markers: { x: number; y: number }[] = JSON.parse((host as HTMLElement).dataset.markerGeometry!);
    const marker = markers[index];
    const bounds = host.getBoundingClientRect();
    return { x: bounds.x + marker.x, y: bounds.y + marker.y };
  }, data.nodes.findIndex(({ id }) => id === under));
  await page.mouse.move(target.x, target.y);
  await expect(graph).toHaveAttribute("data-pointer-node", under);
  await page.waitForTimeout(500);
  const normal = (await graph.getAttribute("data-rendered-label-ids"))!;
  expect(normal.split(",")).not.toContain(neighbor);
  const normalLines = await graph.locator("canvas.sigma-labels").evaluate((canvas) =>
    (canvas as HTMLCanvasElement).graphTestLines!.map(({ text }) => text).sort());
  // Measure the camera afresh after each toggle, rather than comparing a stale
  // diagnostic attribute. Nothing below moves the pointer or the camera.
  const geometry = async () => {
    await graph.evaluate((host) => {
      host.setAttribute("data-geometry-check-pending", "");
      host.setAttribute("data-measure-markers", "");
    });
    await expect(graph).not.toHaveAttribute("data-geometry-check-pending");
    return {
      camera: await graph.getAttribute("data-camera-geometry"),
      graph: await graph.getAttribute("data-graph-geometry"),
    };
  };
  const before = await geometry();

  await page.keyboard.press("d");
  await expect(graph).toHaveAttribute("data-transient-inspection", under);
  // Whatever is drawn translucent while the inspection settles. Which titles
  // it takes away depends on the font, so the check below is on those.
  const translucent = new Set<string>();
  for (const started = Date.now(); Date.now() - started < 700;) {
    for (const text of await graph.locator("canvas.sigma-labels").evaluate((canvas) =>
      (canvas as HTMLCanvasElement).graphTestLines!.filter(({ alpha }) => alpha > 0 && alpha < 1).map(({ text }) => text),
    )) translucent.add(text);
    await page.waitForTimeout(5);
  }
  await expect.poll(async () => (await graph.getAttribute("data-rendered-label-ids"))!.split(","))
    .toContain(neighbor);
  await expect.poll(async () => graph.locator("canvas.sigma-labels").evaluate((canvas, normalLines) =>
    (canvas as HTMLCanvasElement).graphTestLines!.some(({ text, alpha }) =>
      alpha === 1 && !normalLines.includes(text)), normalLines)).toBe(true);
  expect(await geometry()).toEqual(before);
  await expect(graph).toHaveAttribute("data-pointer-node", under);
  // Titles the inspection took away left through translucent frames rather
  // than in one: each one missing now was seen partway through its fade.
  await expect.poll(async () => graph.locator("canvas.sigma-labels").evaluate((canvas) =>
    (canvas as HTMLCanvasElement).graphTestLines!.every(({ alpha }) => alpha === 1))).toBe(true);
  const inspectedLines = await graph.locator("canvas.sigma-labels").evaluate((canvas) =>
    (canvas as HTMLCanvasElement).graphTestLines!.map(({ text }) => text));
  for (const text of normalLines.filter((line) => !inspectedLines.includes(line))) {
    expect([...translucent]).toContain(text);
  }

  await page.keyboard.press("d");
  await expect(graph).not.toHaveAttribute("data-transient-inspection");
  await expect(graph).toHaveAttribute("data-rendered-label-ids", normal);
  await expect.poll(async () => graph.locator("canvas.sigma-labels").evaluate((canvas) =>
    (canvas as HTMLCanvasElement).graphTestLines!.map(({ text }) => text).sort())).toEqual(normalLines);
  expect(await geometry()).toEqual(before);
  await expect(graph).toHaveAttribute("data-pointer-node", under);
});

test("zoom-out label selection avoids the final rendered marker radii", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("./");
  const graph = page.locator("#global-graph");
  await expect(graph).toHaveAttribute("data-visible-nodes", "400");
  await expect(graph).toHaveAttribute("data-motion-completions", /[1-9]/u);
  await graph.evaluate((host) => host.setAttribute("data-measure-markers", ""));
  await expect(graph).toHaveAttribute("data-camera-ratio", /\d/u);
  await page.mouse.move(0, 0);
  const zoom = async (deltaY: number) => {
    const ratio = Number(await graph.getAttribute("data-camera-ratio"));
    const target = Math.max(0.05, ratio * (deltaY > 0 ? 1.7 : 1 / 1.7));
    await graph.locator("canvas.sigma-mouse").dispatchEvent("wheel", {
      clientX: 640, clientY: 360, deltaY, bubbles: true,
    });
    let lastCamera = "";
    let changedAt = 0;
    await expect.poll(async () => {
      const frame = await graph.evaluate((host) => ({
        camera: (host as HTMLElement).dataset.cameraRatio!,
        opaque: host.querySelector<HTMLCanvasElement>("canvas.sigma-labels")!
          .graphTestLines!.every((line) => line.alpha === 1),
      }));
      if (frame.camera !== lastCamera) {
        lastCamera = frame.camera;
        changedAt = Date.now();
      }
      // Allow the 120ms selection debounce after the final camera frame, then
      // wait for every retiring label to leave, not just for the zoom to end.
      return Math.abs(Number(frame.camera) - target) < 1e-12 &&
        Date.now() - changedAt >= 150 && frame.opaque;
    }, { intervals: [50] }).toBe(true);
  };
  // Dispatch wheel events without hovering a node: pointer-required labels
  // deliberately bypass collision selection.
  // Reach the minimum ratio, then cross several selection thresholds while
  // zooming out. Measure only after camera, selection and fades have settled.
  for (let step = 0; step < 7; step += 1) {
    await zoom(-120);
  }
  await expect(graph).toHaveAttribute("data-camera-ratio", "0.05");
  let labelledFrames = 0;
  for (let step = 0; step < 5; step += 1) {
    await zoom(120);
    const result = await graph.evaluate((host) => {
      const lines = host.querySelector<HTMLCanvasElement>("canvas.sigma-labels")!.graphTestLines!;
      const markers: { x: number; y: number; r: number }[] =
        JSON.parse((host as HTMLElement).dataset.markerGeometry!);
      const overlaps = lines.flatMap((line) => markers.filter((marker) =>
        marker.x > 0 && marker.x < host.clientWidth && marker.y > 0 && marker.y < host.clientHeight &&
        Math.min(line.right, marker.x + marker.r) - Math.max(line.left, marker.x - marker.r) > 0.05 &&
        Math.min(line.bottom, marker.y + marker.r) - Math.max(line.top, marker.y - marker.r) > 0.05
      ).map((marker) => ({ text: line.text, marker })));
      return { lines: lines.length, overlaps };
    });
    if (result.lines > 0) labelledFrames += 1;
    expect(result.overlaps).toEqual([]);
  }
  expect(labelledFrames).toBeGreaterThan(0);
});
