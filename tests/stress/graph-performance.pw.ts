import { expect, test } from "@playwright/test";

interface GraphPerformance {
  frameGaps: number[];
  longTasks: { start: number; duration: number }[];
}

test("a 2,000-note combined graph stays interactive while motion runs", async ({ page }) => {
  await page.addInitScript(() => {
    const measurements: GraphPerformance = { frameGaps: [], longTasks: [] };
    (window as unknown as { __graphPerformance: GraphPerformance }).__graphPerformance = measurements;
    let previous = performance.now();
    const frame = (now: number) => {
      measurements.frameGaps.push(now - previous);
      previous = now;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    new PerformanceObserver((list) => {
      measurements.longTasks.push(...list.getEntries().map((entry) => ({
        start: entry.startTime,
        duration: entry.duration,
      })));
    }).observe({ type: "longtask", buffered: true });
  });

  await page.goto("graph?brains=brain-01,brain-02,brain-03,brain-04");
  const graph = page.locator("#global-graph");
  await expect(graph.locator("canvas.sigma-nodes")).toBeVisible();
  await expect(graph).toHaveAttribute("data-visible-nodes", "2000");
  await expect(graph).toHaveAttribute("data-visible-brain-ids", "brain-01,brain-02,brain-03,brain-04");

  await expect.poll(() => page.evaluate(() =>
    Object.entries(sessionStorage).some(([key, value]) =>
      key.startsWith("graph-motion:") && Object.keys(JSON.parse(value).positions ?? {}).length === 2000
    )
  ), { timeout: 2_500 }).toBe(true);

  await page.getByRole("button", { name: "Filters" }).click();
  await page.waitForTimeout(2_500);
  const beforeMotion = await page.evaluate(() => ({
    now: performance.now(),
    frames: (() => {
      const measurements = (window as unknown as { __graphPerformance: GraphPerformance }).__graphPerformance;
      measurements.longTasks.length = 0;
      return measurements.frameGaps.length;
    })(),
    sessions: Object.fromEntries(Object.entries(sessionStorage).filter(([key]) => key.startsWith("graph-motion:"))),
  }));

  await page.getByRole("checkbox", { name: "established" }).uncheck();
  await expect(graph).not.toHaveAttribute("data-visible-nodes", "2000");
  const filteredAt = await page.evaluate(() => performance.now());
  await page.locator("#graph-search").fill("Generated note 0001");
  await expect(page.locator("#graph-search-results button")).toHaveCount(3);
  const searchedAt = await page.evaluate(() => performance.now());
  await expect.poll(() => page.evaluate((previous) =>
    Object.entries(sessionStorage).some(([key, value]) =>
      key.startsWith("graph-motion:") && value !== previous[key]
    ), beforeMotion.sessions
  ), { timeout: 2_500 }).toBe(true);

  const measurements = await page.evaluate(({ started, firstFrame }) => {
    const current = (window as unknown as { __graphPerformance: GraphPerformance }).__graphPerformance;
    const frameGaps = current.frameGaps.slice(firstFrame);
    const sortedFrameGaps = [...frameGaps].sort((a, b) => a - b);
    return {
      motionMilliseconds: performance.now() - started,
      frameCount: frameGaps.length,
      maxFrameGap: Math.max(...frameGaps),
      p95FrameGap: sortedFrameGaps[Math.floor(sortedFrameGaps.length * 0.95)] ?? 0,
      maxLongTask: Math.max(0, ...current.longTasks.map((entry) => entry.duration)),
    };
  }, { started: beforeMotion.now, firstFrame: beforeMotion.frames });

  const nodesCanvas = graph.locator("canvas.sigma-nodes");
  await page.waitForTimeout(500);
  const settled = await nodesCanvas.screenshot();
  await page.waitForTimeout(250);
  expect((await nodesCanvas.screenshot()).equals(settled)).toBe(true);
  const beforeZoom = await nodesCanvas.screenshot();
  const box = await graph.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.wheel(0, -400);
  await page.waitForTimeout(200);
  expect((await nodesCanvas.screenshot()).equals(beforeZoom)).toBe(false);

  const filterMilliseconds = filteredAt - beforeMotion.now;
  const searchMilliseconds = searchedAt - filteredAt;
  console.info(JSON.stringify({
    ...measurements,
    filterMilliseconds,
    searchMilliseconds,
  }));
  expect(measurements.motionMilliseconds).toBeLessThan(2_500);
  expect(filterMilliseconds).toBeLessThan(500);
  expect(searchMilliseconds).toBeLessThan(500);
  expect(measurements.frameCount).toBeGreaterThan(10);
  // Headless Chromium uses a software renderer, so guard against half-second stalls
  // and use the canvas comparisons above to catch continuous motion or failed zoom.
  expect(measurements.maxFrameGap).toBeLessThan(500);
  expect(measurements.maxLongTask).toBeLessThan(500);
});
