/**
 * Quick switcher scope follows the page's namespaced path and nothing else.
 *
 * Pages generated beneath `/brains/<id>/` (a Brain's graph and reports, its
 * notes, and their neighborhood pages) carry that Brain as `activeBrainId`, so
 * the switcher defaults to it and offers the whole workspace as a second scope.
 * Workspace-level pages (the root graph, workspace-wide reports, the not-found
 * page) carry no Brain, so the only scope is every configured Brain. Vault
 * mode has one Brain and therefore one scope. Query parameters and stored
 * state are never consulted: an authenticating proxy may drop them, and they
 * never identify a destination.
 */
export type QuickSwitcherScope = "active" | "all";

export interface QuickSwitcherContext {
  readonly workspace: boolean;
  readonly activeBrainId?: string | null;
}

function activeBrainId(context: QuickSwitcherContext): string | null {
  return context.workspace && context.activeBrainId ? context.activeBrainId : null;
}

/** The scopes a page offers, default first. */
export function quickSwitcherScopes(context: QuickSwitcherContext): readonly QuickSwitcherScope[] {
  return activeBrainId(context) ? ["active", "all"] : ["all"];
}

export function defaultQuickSwitcherScope(context: QuickSwitcherContext): QuickSwitcherScope {
  return quickSwitcherScopes(context)[0];
}

/** Whether an index entry belongs to the given scope on the given page. */
export function inQuickSwitcherScope(
  entry: { readonly brainId: string },
  scope: QuickSwitcherScope,
  context: QuickSwitcherContext,
): boolean {
  const brainId = activeBrainId(context);
  return scope !== "active" || brainId === null || entry.brainId === brainId;
}
