import type { LinkIndex } from "./vault-scan";
import { getWorkspaceSnapshot } from "./vault-state";

/**
 * The shared Phase-1 link index. Primed by the vault Astro integration at
 * config setup; falls back to a memoized lazy scan so remark plugins and
 * endpoints work regardless of hook ordering.
 */
export function getLinkIndex(): LinkIndex {
  return getWorkspaceSnapshot().index;
}

export type { LinkIndex } from "./vault-scan";
