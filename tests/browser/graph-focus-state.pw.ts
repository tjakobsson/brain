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
  await page.locator("#graph-filter-toggle").click();
  await expect(graph).toHaveAttribute("data-focused-node", a.id);
  await expect(page).toHaveURL(`${workspace}${a.route}/graph`);

  for (const related of [false, true]) {
    if (related) await page.locator("#graph-related-toggle").click();
    await expect(graph).toHaveAttribute("data-related-brains-visible", String(related));
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
