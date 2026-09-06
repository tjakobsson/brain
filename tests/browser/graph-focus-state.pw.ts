import { expect, test, type Locator, type Page } from "@playwright/test";
import type { GraphData } from "../../src/lib/graph-data";

const workspace = (process.env.BRAIN_FOCUS_TEST_URL ?? "http://127.0.0.1:4331/workspace-demo").replace(/\/$/u, "");
test.use({ baseURL: `${workspace}/`, viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-root", "Workspace behavior needs one browser project.");
});

async function twoNoteGraph(page: Page, crossBrain = false) {
  const response = await page.request.get(`${workspace}/graph-data.json`);
  expect(response.ok()).toBe(true);
  const data = await response.json() as GraphData;
  const edge = data.edges.find((edge) => edge.source !== edge.target && (!crossBrain || edge.crossBrain))!;
  // Real note identities keep direct visits and reloads valid in static builds.
  // Two nodes avoid a layout worker and leave unambiguous pointer targets.
  const a = { ...data.nodes.find(({ id }) => id === edge.source)!, type: "permanent" as const,
    status: "established" as const, tags: [], degree: 1, x: -2, y: 0 };
  const b = { ...data.nodes.find(({ id }) => id === edge.target)!, type: "fleeting" as const,
    status: "draft" as const, tags: [], degree: 1, x: 2, y: 1 };
  await page.route("**/graph-data.json", (route) => route.fulfill({ json: { ...data, nodes: [a, b], edges: [edge] } }));
  return { a, b };
}

async function savedLayout(page: Page, scope: string) {
  return page.evaluate((scope) => {
    const key = Object.keys(sessionStorage).find((key) =>
      key.startsWith("graph-motion:") && key.endsWith(`:${scope}:landscape`)
    );
    if (!key) return null;
    const viewKey = key.replace("graph-motion:", "graph-view:");
    if (!sessionStorage.getItem(viewKey)) return null;
    return {
      key,
      positions: (JSON.parse(sessionStorage.getItem(key)!) as {
        positions: Record<string, { x: number; y: number }>;
      }).positions,
    };
  }, scope);
}

async function geometry(graph: Locator) {
  // These opt-in measurements ship in static builds. Unlike storage alone,
  // they prove that the newly mounted renderer restored the saved positions.
  await graph.evaluate((host) => {
    host.setAttribute("data-geometry-check-pending", "");
    host.setAttribute("data-measure-markers", "");
  });
  await expect(graph).not.toHaveAttribute("data-geometry-check-pending");
  const result = {
    positions: await graph.getAttribute("data-graph-geometry"),
    camera: await graph.getAttribute("data-camera-geometry"),
  };
  expect(result.positions).not.toBeNull();
  expect(result.camera).not.toBeNull();
  await graph.evaluate((host) => host.removeAttribute("data-measure-markers"));
  return result;
}

async function focusedMarker(graph: Locator, id: string) {
  const markers = JSON.parse((await graph.getAttribute("data-focused-marker-geometry"))!) as
    { id: string; x: number; y: number }[];
  const marker = markers.find((marker) => marker.id === id)!;
  expect(marker).toBeDefined();
  return marker;
}

async function rearrange(page: Page, graph: Locator, marker: { id: string; x: number; y: number }) {
  const box = (await graph.boundingBox())!;
  const x = box.x + marker.x;
  const y = box.y + marker.y;
  await page.mouse.move(x, y);
  await expect(graph).toHaveAttribute("data-pointer-node", marker.id);
  await page.mouse.down();
  await page.mouse.move(
    x + (marker.x < box.width / 2 ? 70 : -70),
    y + (marker.y < box.height / 2 ? 40 : -40),
    { steps: 8 },
  );
  await page.mouse.up();
  await page.mouse.move(5, 5);
}

for (const filter of ["type", "status", "tag"] as const) {
  test(`a restored-filter neighbor stays focused until an explicit ${filter} filter edit`, async ({ page }) => {
    const { a, b } = await twoNoteGraph(page);
    await page.addInitScript(() => {
      sessionStorage.setItem("brain:graph-filter-values", JSON.stringify({
        types: ["permanent"], statuses: ["draft", "developing", "established"], tag: "",
      }));
    });
    await page.goto(`${workspace}${a.route}/graph`);
    const graph = page.locator("#global-graph");
    await expect(graph).toHaveAttribute("data-focused-node", a.id);
    await expect(graph).toHaveAttribute("data-visible-nodes", "2");
    await expect(page.locator('[data-filter="type"][value="fleeting"]')).not.toBeChecked();
    await graph.evaluate((host) => { host.dataset.focusStateTest = "same-page"; });

    const neighbor = page.locator(`[data-neighbor-node="${b.id}"]`);
    await expect(neighbor).toBeVisible();
    await neighbor.click();
    await expect(graph).toHaveAttribute("data-focused-node", b.id);
    await expect(graph).toHaveAttribute("data-visible-nodes", "2");
    await expect(graph).toHaveAttribute("data-focus-state-test", "same-page");
    await expect(page).toHaveURL(`${workspace}${b.route}/graph`);

    await page.locator("#graph-filter-toggle").click();
    if (filter === "type") await page.locator('[data-filter="type"][value="permanent"]').uncheck();
    else if (filter === "status") await page.locator('[data-filter="status"][value="established"]').uncheck();
    else {
      const tag = await page.locator('#graph-tag-filter option:not([value=""])').first().getAttribute("value");
      expect(tag).toBeTruthy();
      await page.locator("#graph-tag-filter").selectOption(tag!);
    }
    await expect(graph).not.toHaveAttribute("data-focused-node");
    await expect(page.locator("[data-graph-focus-status]")).toBeHidden();
    await expect(graph).toHaveAttribute("data-focus-state-test", "same-page");
    await expect(page).toHaveURL(`${workspace}/`);
  });
}

test("moving A to B saves rearrangement under B and restores it when B reloads", async ({ page }) => {
  const { a, b } = await twoNoteGraph(page);
  await page.goto(`${workspace}${a.route}/graph`);
  const graph = page.locator("#global-graph");
  await expect(graph).toHaveAttribute("data-focused-node", a.id);
  await expect.poll(async () => Number(await graph.getAttribute("data-motion-completions"))).toBeGreaterThanOrEqual(3);
  await expect.poll(() => savedLayout(page, `neighborhood:${a.compositeId}`)).not.toBeNull();
  const original = (await savedLayout(page, `neighborhood:${a.compositeId}`))!;
  await graph.evaluate((host) => { host.dataset.focusStateTest = "same-page"; });

  await page.locator(`[data-neighbor-node="${b.id}"]`).click();
  await expect(graph).toHaveAttribute("data-focused-node", b.id);
  await expect(graph).toHaveAttribute("data-focus-state-test", "same-page");
  await expect(page).toHaveURL(`${workspace}${b.route}/graph`);
  const scope = `neighborhood:${b.compositeId}`;
  await expect.poll(() => savedLayout(page, scope)).not.toBeNull();
  expect((await savedLayout(page, scope))!.positions).toEqual(original.positions);

  await rearrange(page, graph, await focusedMarker(graph, b.id));
  await expect.poll(async () => (await savedLayout(page, scope))!.positions).not.toEqual(original.positions);
  const changed = (await savedLayout(page, scope))!;
  const beforeReload = await geometry(graph);
  expect((await savedLayout(page, `neighborhood:${a.compositeId}`))!.positions).toEqual(original.positions);

  await page.reload();
  await expect(graph).toHaveAttribute("data-focused-node", b.id);
  await expect.poll(async () => Number(await graph.getAttribute("data-motion-completions"))).toBeGreaterThan(0);
  expect(await savedLayout(page, scope)).toEqual(changed);
  expect((await geometry(graph)).positions).toBe(beforeReload.positions);
  await expect(graph).not.toHaveAttribute("data-settle-requests");
});

test("clearing focus saves rearrangement under the root scope and restores it on reload", async ({ page }) => {
  const { a } = await twoNoteGraph(page);
  await page.goto(`${workspace}${a.route}/graph`);
  const graph = page.locator("#global-graph");
  await expect(graph).toHaveAttribute("data-focused-node", a.id);
  await expect.poll(async () => Number(await graph.getAttribute("data-motion-completions"))).toBeGreaterThanOrEqual(3);
  const scope = `neighborhood:${a.compositeId}`;
  await expect.poll(() => savedLayout(page, scope)).not.toBeNull();
  const original = (await savedLayout(page, scope))!;
  const originalGeometry = await geometry(graph);
  const marker = await focusedMarker(graph, a.id);
  await graph.evaluate((host) => { host.dataset.focusStateTest = "same-page"; });

  await page.locator("[data-graph-focus-clear]").click();
  await expect(graph).not.toHaveAttribute("data-focused-node");
  await expect(graph).toHaveAttribute("data-focus-state-test", "same-page");
  await expect(page).toHaveURL(`${workspace}/`);
  expect((await geometry(graph)).positions).toBe(originalGeometry.positions);

  await rearrange(page, graph, marker);
  await expect.poll(() => savedLayout(page, "all")).not.toBeNull();
  await expect.poll(async () => (await savedLayout(page, "all"))!.positions).not.toEqual(original.positions);
  const changed = (await savedLayout(page, "all"))!;
  const beforeReload = await geometry(graph);
  expect((await savedLayout(page, scope))!.positions).toEqual(original.positions);

  await page.reload();
  await expect(graph).toHaveAttribute("data-visible-nodes", "2");
  await expect(graph).not.toHaveAttribute("data-focused-node");
  expect(await savedLayout(page, "all")).toEqual(changed);
  expect(await geometry(graph)).toEqual(beforeReload);
  await expect(graph).not.toHaveAttribute("data-settle-requests");
});

test("clearing focus before the neighborhood settles keeps the graph's own view an overview", async ({ page }) => {
  // Hold the layout worker so the neighborhood's initial settle is still in
  // flight when focus is cleared. Without cancelling it, that settle would
  // finish with the neighborhood's camera and commit it under the graph's
  // own scope, and a reload would restore the close-up as the overview.
  const worker = await heldWorker(page);
  // With motion allowed, the settle also animates, so it is in flight even
  // if the worker's timeout fallback runs before the held script arrives.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const { data, a } = await focusedNoteOfFixture(page);
  await page.goto(`${workspace}${a.route}/graph`);
  const graph = page.locator("#global-graph");
  await expect(graph).toHaveAttribute("data-focused-node", a.id);
  await expect(graph).toHaveAttribute("data-settle-requests", "1");
  // The neighborhood's settle has asked for its layout and is waiting on the
  // held script: it is in flight when focus is cleared.
  await expect.poll(() => worker.requests).toBe(1);
  expect(worker.releases).toBe(0);
  const completionsAtClear = Number(await graph.getAttribute("data-motion-completions") ?? 0);

  await page.locator("[data-graph-focus-clear]").click();
  await expect(graph).not.toHaveAttribute("data-focused-node");
  await expect(page).toHaveURL(`${workspace}/`);
  await expect(graph).toHaveAttribute("data-visible-nodes", String(data.nodes.length));
  // The cancelled settle never completes; the graph's own settle does.
  await expect.poll(async () => Number(await graph.getAttribute("data-motion-completions")), { timeout: 10_000 })
    .toBeGreaterThan(completionsAtClear);

  const everyMarkerInView = async () => {
    await graph.evaluate((host) => {
      host.setAttribute("data-geometry-check-pending", "");
      host.setAttribute("data-measure-markers", "");
    });
    await expect(graph).not.toHaveAttribute("data-geometry-check-pending");
    const inView = await graph.evaluate((host) => {
      const element = host as HTMLElement;
      const markers = JSON.parse(element.dataset.markerGeometry!) as { x: number; y: number }[];
      return markers.length > 0 && markers.every((marker) =>
        marker.x >= 0 && marker.x <= element.clientWidth && marker.y >= 0 && marker.y <= element.clientHeight);
    });
    await graph.evaluate((host) => host.removeAttribute("data-measure-markers"));
    return inView;
  };
  // The whole graph is in view, not the cleared neighborhood, and it got
  // there by a settle of its own rather than the neighborhood's.
  expect(await everyMarkerInView()).toBe(true);
  expect(worker.requests).toBe(2);
  await expect.poll(() => savedLayout(page, "all")).not.toBeNull();
  const beforeReload = await geometry(graph);

  await page.reload();
  await expect(graph).toHaveAttribute("data-visible-nodes", String(data.nodes.length));
  await expect(graph).not.toHaveAttribute("data-focused-node");
  await expect(graph).not.toHaveAttribute("data-settle-requests");
  expect(await geometry(graph)).toEqual(beforeReload);
  expect(await everyMarkerInView()).toBe(true);
});

async function heldWorker(page: Page) {
  const counts = { requests: 0, releases: 0 };
  await page.route("**/graph-layout.worker*", async (route) => {
    counts.requests += 1;
    await new Promise((resolve) => setTimeout(resolve, 1500));
    counts.releases += 1;
    await route.continue();
  });
  return counts;
}

async function focusedNoteOfFixture(page: Page) {
  const response = await page.request.get(`${workspace}/graph-data.json`);
  const data = await response.json() as GraphData;
  const edge = data.edges.find((edge) => edge.source !== edge.target)!;
  return {
    data,
    a: data.nodes.find(({ id }) => id === edge.source)!,
    b: data.nodes.find(({ id }) => id === edge.target)!,
  };
}

test("leaving before the graph's own settle finishes does not keep the neighborhood's close-up", async ({ page }) => {
  const worker = await heldWorker(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const { data, a } = await focusedNoteOfFixture(page);
  await page.goto(`${workspace}${a.route}/graph`);
  const graph = page.locator("#global-graph");
  await expect(graph).toHaveAttribute("data-focused-node", a.id);
  await expect.poll(() => worker.requests).toBe(1);
  await page.locator("[data-graph-focus-clear]").click();
  await expect(page).toHaveURL(`${workspace}/`);
  // The graph's own settle has been asked for and is still waiting on the
  // held script when the page is left.
  await expect.poll(() => worker.requests).toBe(2);
  expect(worker.releases).toBe(0);

  await page.reload();
  await expect(graph).toHaveAttribute("data-visible-nodes", String(data.nodes.length));
  await expect(graph).not.toHaveAttribute("data-focused-node");
  // Nothing half-settled was saved under the graph's scope: it settles afresh.
  await expect(graph).toHaveAttribute("data-settle-requests", "1");
  await expect.poll(async () => Number(await graph.getAttribute("data-motion-completions")), { timeout: 10_000 })
    .toBeGreaterThan(0);
  await graph.evaluate((host) => {
    host.setAttribute("data-geometry-check-pending", "");
    host.setAttribute("data-measure-markers", "");
  });
  await expect(graph).not.toHaveAttribute("data-geometry-check-pending");
  expect(await graph.evaluate((host) => {
    const element = host as HTMLElement;
    const markers = JSON.parse(element.dataset.markerGeometry!) as { x: number; y: number }[];
    return markers.length > 0 && markers.every((marker) =>
      marker.x >= 0 && marker.x <= element.clientWidth && marker.y >= 0 && marker.y <= element.clientHeight);
  })).toBe(true);
});

test("a page kept for Back that was hidden mid-settle settles its scope when shown again", async ({ page }) => {
  const worker = await heldWorker(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const { data, a } = await focusedNoteOfFixture(page);
  await page.goto(`${workspace}${a.route}/graph`);
  const graph = page.locator("#global-graph");
  await expect(graph).toHaveAttribute("data-focused-node", a.id);
  await expect.poll(() => worker.requests).toBe(1);
  await page.locator("[data-graph-focus-clear]").click();
  await expect(page).toHaveURL(`${workspace}/`);
  await expect(graph).toHaveAttribute("data-settle-requests", "2");
  await expect.poll(() => worker.requests).toBe(2);
  expect(worker.releases).toBe(0);
  const completions = async () => Number(await graph.getAttribute("data-motion-completions") ?? 0);
  const hiddenAt = await completions();

  // The browser hides the page into its back-forward cache mid-settle and
  // later shows the same document again: no remount, the same graph.
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })));
  await page.waitForTimeout(200);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  await expect(graph).toHaveAttribute("data-settle-requests", "3");
  await expect.poll(completions, { timeout: 10_000 }).toBeGreaterThan(hiddenAt);
  await expect(graph).toHaveAttribute("data-visible-nodes", String(data.nodes.length));
  await graph.evaluate((host) => {
    host.setAttribute("data-geometry-check-pending", "");
    host.setAttribute("data-measure-markers", "");
  });
  await expect(graph).not.toHaveAttribute("data-geometry-check-pending");
  expect(await graph.evaluate((host) => {
    const element = host as HTMLElement;
    const markers = JSON.parse(element.dataset.markerGeometry!) as { x: number; y: number }[];
    return markers.length > 0 && markers.every((marker) =>
      marker.x >= 0 && marker.x <= element.clientWidth && marker.y >= 0 && marker.y <= element.clientHeight);
  })).toBe(true);
  await expect.poll(() => savedLayout(page, "all")).not.toBeNull();
});

test("a page kept for Back while a moved pin was still settling comes back framing that pin", async ({ page }) => {
  // Fits animate, so a second move can land while the first is under way.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const { data } = await focusedNoteOfFixture(page);
  // A chain a - b - c: open on a, move to b, then on to c.
  const neighborsOf = (id: string) => [...new Set(data.edges
    .filter((edge) => edge.source !== edge.target && (edge.source === id || edge.target === id))
    .map((edge) => edge.source === id ? edge.target : edge.source))];
  const b = data.nodes.find((node) => neighborsOf(node.id).length >= 2)!;
  expect(b).toBeDefined();
  const [aId, cId] = neighborsOf(b.id);
  const a = data.nodes.find(({ id }) => id === aId)!;
  const c = data.nodes.find(({ id }) => id === cId)!;
  await page.goto(`${workspace}${a.route}/graph`);
  const graph = page.locator("#global-graph");
  await expect(graph).toHaveAttribute("data-focused-node", a.id);
  const completions = async () => Number(await graph.getAttribute("data-motion-completions") ?? 0);
  // Let the page settle completely first, so no fit is still owed from opening.
  await expect.poll(completions, { timeout: 10_000 }).toBeGreaterThanOrEqual(2);
  await page.waitForTimeout(300);
  const settledAt = await completions();
  await graph.evaluate((host) => { host.dataset.focusStateTest = "same-page"; });

  // Move the pin twice in quick succession: the second move interrupts the
  // first move's fit, so the new neighborhood's scope owes a settle.
  await page.locator(`[data-neighbor-node="${b.id}"]`).click();
  await expect(graph).toHaveAttribute("data-focused-node", b.id);
  await page.locator(`[data-neighbor-node="${c.id}"]`).click();
  await expect(graph).toHaveAttribute("data-focused-node", c.id);
  await expect(graph).toHaveAttribute("data-focus-state-test", "same-page");
  expect(await completions()).toBe(settledAt);
  const fitsBefore = Number(await graph.getAttribute("data-fit-requests") ?? 0);
  const settlesBefore = Number(await graph.getAttribute("data-settle-requests") ?? 0);

  // Hidden for Back before that fit finishes, then shown again as it was.
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })));
  await page.waitForTimeout(200);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  await expect(graph).toHaveAttribute("data-settle-requests", String(settlesBefore + 1));
  await expect.poll(completions, { timeout: 10_000 }).toBeGreaterThan(settledAt);
  // Still pinned, and the pin was fitted again after the settle rather than
  // the camera being left framing the whole graph.
  await expect(graph).toHaveAttribute("data-focused-node", c.id);
  await expect.poll(async () => Number(await graph.getAttribute("data-fit-requests") ?? 0), { timeout: 10_000 })
    .toBeGreaterThan(fitsBefore);
  await expect.poll(async () => {
    const markers = JSON.parse((await graph.getAttribute("data-focused-marker-geometry")) ?? "[]") as
      { id: string; x: number; y: number }[];
    const box = (await graph.boundingBox())!;
    const marker = markers.find((marker) => marker.id === c.id);
    return Boolean(marker && marker.x > 0 && marker.x < box.width && marker.y > 0 && marker.y < box.height);
  }).toBe(true);
});

test("a focus move that interrupts the settle does not leave a later clear re-settling the graph", async ({ page }) => {
  const worker = await heldWorker(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const { a, b } = await focusedNoteOfFixture(page);
  await page.goto(`${workspace}${a.route}/graph`);
  const graph = page.locator("#global-graph");
  await expect(graph).toHaveAttribute("data-focused-node", a.id);
  await expect.poll(() => worker.requests).toBe(1);
  await graph.evaluate((host) => { host.dataset.focusStateTest = "same-page"; });

  // Moving focus mid-settle fits the new neighborhood; that fit is the motion
  // that replaces the cancelled one.
  await page.locator(`[data-neighbor-node="${b.id}"]`).click();
  await expect(graph).toHaveAttribute("data-focused-node", b.id);
  await expect(graph).toHaveAttribute("data-focus-state-test", "same-page");
  await expect(graph).toHaveAttribute("data-settle-requests", "1");
  const completions = async () => Number(await graph.getAttribute("data-motion-completions") ?? 0);
  await expect.poll(completions, { timeout: 10_000 }).toBeGreaterThanOrEqual(2);
  const settled = await completions();
  const before = await geometry(graph);

  // Clearing focus afterwards is an ordinary clear: no motion was interrupted
  // by it, so nothing re-lays out the graph or moves the camera.
  await page.keyboard.press("c");
  await expect(graph).not.toHaveAttribute("data-focused-node");
  await expect(page).toHaveURL(`${workspace}/`);
  await page.waitForTimeout(400);
  await expect(graph).toHaveAttribute("data-settle-requests", "1");
  expect(await completions()).toBe(settled);
  expect(await geometry(graph)).toEqual(before);
});

for (const brainScoped of [false, true]) {
  test(`a rotated saved ${brainScoped ? "Brain" : "workspace"} view restores upright without losing pan or zoom`, async ({ page }) => {
    const { a } = await twoNoteGraph(page, true);
    const scope = brainScoped ? `brain:${a.brainId}:false` : "all";
    await page.goto(brainScoped ? `${workspace}/brains/${a.brainId}` : `${workspace}/`);
    const graph = page.locator("#global-graph");
    await expect.poll(() => savedLayout(page, scope)).not.toBeNull();
    const originalLayout = (await savedLayout(page, scope))!;
    const before = await geometry(graph);
    const savedCamera = { x: 0.61, y: 0.37, ratio: 1.27, angle: (brainScoped ? -1 : 1) * Math.PI / 4 };

    // Seed after navigation, so pagehide cannot overwrite the older tilted
    // state. This exercises Sigma's real camera, not a permissive test mock.
    await page.addInitScript(({ key, camera }) => {
      const cached = JSON.parse(sessionStorage.getItem(key)!);
      cached.view.camera = camera;
      sessionStorage.setItem(key, JSON.stringify(cached));
    }, { key: originalLayout.key.replace("graph-motion:", "graph-view:"), camera: savedCamera });
    await page.reload();
    await expect(graph).toHaveAttribute("data-visible-nodes");
    const restored = await geometry(graph);
    const camera = restored.camera!.split(":").map(Number);
    expect(camera.slice(0, 4)).toEqual([savedCamera.x, savedCamera.y, 0, savedCamera.ratio]);
    expect(camera.slice(4)).toEqual(before.camera!.split(":").map(Number).slice(4));
    expect(restored.positions).toBe(before.positions);
    expect(await savedLayout(page, scope)).toEqual(originalLayout);
    await expect(graph).not.toHaveAttribute("data-settle-requests");
    await expect(graph).not.toHaveAttribute("data-fit-requests");
  });
}

test("Brain-focused sessions with related Brains off and on cannot overwrite the workspace neighborhood", async ({ page }) => {
  const { a } = await twoNoteGraph(page, true);
  await page.goto(`${workspace}${a.route}/graph`);
  const graph = page.locator("#global-graph");
  await expect(graph).toHaveAttribute("data-focused-node", a.id);
  await expect.poll(async () => Number(await graph.getAttribute("data-motion-completions"))).toBeGreaterThanOrEqual(3);
  const workspaceScope = `neighborhood:${a.compositeId}`;
  await expect.poll(() => savedLayout(page, workspaceScope)).not.toBeNull();
  const original = (await savedLayout(page, workspaceScope))!;
  await rearrange(page, graph, await focusedMarker(graph, a.id));
  await expect.poll(async () => (await savedLayout(page, workspaceScope))!.positions).not.toEqual(original.positions);
  const workspaceLayout = (await savedLayout(page, workspaceScope))!;
  const workspaceGeometry = await geometry(graph);
  const workspaceView = await page.evaluate((key) =>
    sessionStorage.getItem(key.replace("graph-motion:", "graph-view:")), workspaceLayout.key);
  const savedScopes = new Map([[workspaceScope, workspaceLayout]]);

  await page.goto(`${workspace}/brains/${a.brainId}`);
  await expect.poll(async () => Number(await graph.getAttribute("data-motion-completions"))).toBeGreaterThan(0);
  await expect(page.locator("#graph-related-toggle")).toHaveAttribute("aria-pressed", "false");
  await page.locator("#graph-filter-toggle").click();
  await page.locator("#graph-search").fill(a.title);
  await page.locator("#graph-search-results").getByRole("button", {
    name: `${a.title}, ${a.brainTitle} brain @${a.brainId}`, exact: true,
  }).click();
  let motionBeforeSettle = Number(await graph.getAttribute("data-motion-completions"));
  await page.locator("#graph-filter-toggle").click();
  await expect(graph).toHaveAttribute("data-focused-node", a.id);
  await expect(page).toHaveURL(`${workspace}${a.route}/graph`);

  for (const related of [false, true]) {
    if (related) {
      motionBeforeSettle = Number(await graph.getAttribute("data-motion-completions"));
      await page.locator("#graph-related-toggle").click();
    }
    await expect(graph).toHaveAttribute("data-related-brains-visible", String(related));
    // Sidebar resize and related-Brain filtering each settle, then refit focus.
    // Wait for both and a fresh render before sampling the drag's baseline.
    await expect.poll(async () => Number(await graph.getAttribute("data-motion-completions")))
      .toBeGreaterThanOrEqual(motionBeforeSettle + 2);
    await geometry(graph);
    const scope = `${workspaceScope}:brain:${a.brainId}:${related}`;
    await expect.poll(() => savedLayout(page, scope)).not.toBeNull();
    await expect(graph).not.toHaveAttribute("data-filter-settle-pending");
    const before = (await savedLayout(page, scope))!;
    await rearrange(page, graph, await focusedMarker(graph, a.id));
    await expect.poll(async () => (await savedLayout(page, scope))!.positions).not.toEqual(before.positions);
    savedScopes.set(scope, (await savedLayout(page, scope))!);
    for (const [savedScope, layout] of savedScopes) {
      expect(await savedLayout(page, savedScope)).toEqual(layout);
    }
    expect(await page.evaluate((key) =>
      sessionStorage.getItem(key.replace("graph-motion:", "graph-view:")), workspaceLayout.key)).toBe(workspaceView);
  }
  expect(new Set([...savedScopes.values()].map(({ key }) => key)).size).toBe(3);

  // Reloading the shared path mounts the full workspace, not the originating Brain graph.
  await page.reload();
  await expect(graph).toHaveAttribute("data-focused-node", a.id);
  await expect.poll(async () => Number(await graph.getAttribute("data-motion-completions"))).toBeGreaterThan(0);
  expect((await geometry(graph)).positions).toBe(workspaceGeometry.positions);
  await expect(graph).not.toHaveAttribute("data-settle-requests");
  for (const [scope, layout] of savedScopes) {
    expect(await savedLayout(page, scope)).toEqual(layout);
  }
});
