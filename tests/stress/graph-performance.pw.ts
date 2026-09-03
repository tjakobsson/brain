import { expect, test } from "@playwright/test";

interface GraphPerformance {
  frameGaps: number[];
  longTasks: { start: number; duration: number }[];
}

interface WorkspaceFixture {
  name: string;
  baseURL: string;
  nodeCount: number;
  brainIds: string;
  /** A title substring whose matches include exactly one `established` note. */
  search: string;
  searchResults: number;
}

// The full workspace graph is the default load in both fixtures. The demo
// workspace is the public fixture; the synthetic one is the 2,000-note budget.
const fixtures: WorkspaceFixture[] = [
  {
    name: "the demo workspace",
    baseURL: "http://127.0.0.1:4333/stress-demo/",
    nodeCount: 8,
    brainIds: "engineering,design,research,research-archive-and-synthesis-source-trails",
    search: "Principles",
    searchResults: 1,
  },
  {
    name: "a 2,000-note workspace",
    baseURL: "http://127.0.0.1:4332/stress/",
    nodeCount: 2000,
    brainIds: "brain-01,brain-02,brain-03,brain-04",
    search: "Generated note 0001",
    searchResults: 3,
  },
];

for (const fixture of fixtures) {
  test.describe(fixture.name, () => {
    test.use({ baseURL: fixture.baseURL });

    test("the full graph stays interactive while motion runs", async ({ page }) => {
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

      await page.goto("./");
      const graph = page.locator("#global-graph");
      await expect(graph.locator("canvas.sigma-nodes")).toBeVisible();
      await expect(graph).toHaveAttribute("data-visible-nodes", String(fixture.nodeCount));
      await expect(graph).toHaveAttribute("data-visible-brain-ids", fixture.brainIds);
      expect(new URL(page.url()).search).toBe("");

      await expect.poll(() => page.evaluate((nodeCount) =>
        Object.entries(sessionStorage).some(([key, value]) =>
          key.startsWith("graph-motion:") && Object.keys(JSON.parse(value).positions ?? {}).length === nodeCount
        ), fixture.nodeCount
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
      await expect(graph).not.toHaveAttribute("data-visible-nodes", String(fixture.nodeCount));
      const filteredAt = await page.evaluate(() => performance.now());
      await page.locator("#graph-search").fill(fixture.search);
      await expect(page.locator("#graph-search-results button")).toHaveCount(fixture.searchResults);
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
      const afterZoom = await nodesCanvas.screenshot();
      await page.mouse.down();
      await page.mouse.move(box!.x + box!.width / 2 + 120, box!.y + box!.height / 2 + 60, { steps: 6 });
      await page.mouse.up();
      await page.waitForTimeout(200);
      expect((await nodesCanvas.screenshot()).equals(afterZoom)).toBe(false);
      expect(new URL(page.url()).search).toBe("");

      const filterMilliseconds = filteredAt - beforeMotion.now;
      const searchMilliseconds = searchedAt - filteredAt;
      console.info(JSON.stringify({
        fixture: fixture.name,
        nodeCount: fixture.nodeCount,
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
  });
}
