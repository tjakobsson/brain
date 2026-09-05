import { quickSwitcherScopes } from "./quick-switcher-scope";
import { joinBase, routes, routesFor } from "./routes";

/** Keep the static shell consistent with an in-place graph pathname change. */
export function syncGraphPageScope(base: string, activeBrainId?: string): void {
  const contextualRoutes = activeBrainId
    ? routesFor({ mode: "workspace", brainId: activeBrainId })
    : routes;
  for (const name of ["tags", "recent", "orphans"] as const) {
    const anchor = document.querySelector<HTMLAnchorElement>(`[data-scope-route="${name}"]`);
    if (anchor) anchor.href = joinBase(base, contextualRoutes[name]);
  }
  const graph = document.querySelector<HTMLAnchorElement>(".graph-trigger");
  if (graph) {
    graph.href = joinBase(base, activeBrainId ? contextualRoutes.graph : routes.home);
    graph.hidden = !activeBrainId;
  }
  const home = document.querySelector<HTMLAnchorElement>(".graph-home-action");
  if (home) home.hidden = !activeBrainId;

  const input = document.querySelector<HTMLInputElement>("#quick-switcher input");
  const select = document.querySelector<HTMLSelectElement>("[data-switcher-scope]");
  if (!input || !select || input.dataset.activeBrainId === activeBrainId) return;
  if (activeBrainId) input.dataset.activeBrainId = activeBrainId;
  else delete input.dataset.activeBrainId;
  const registry = JSON.parse(input.dataset.brainRegistry ?? "[]") as { id: string; title: string }[];
  const brain = registry.find(({ id }) => id === activeBrainId);
  select.replaceChildren(...quickSwitcherScopes({ workspace: true, activeBrainId }).map((scope) => {
    const option = document.createElement("option");
    option.value = scope;
    option.textContent = scope === "active"
      ? `@${activeBrainId}${brain ? ` \u00b7 ${brain.title}` : ""}`
      : "All brains";
    return option;
  }));
  input.dispatchEvent(new Event("brain:scope-change"));
}
