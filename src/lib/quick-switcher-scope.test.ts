import { describe, expect, it } from "vitest";
import {
  defaultQuickSwitcherScope,
  inQuickSwitcherScope,
  quickSwitcherScopes,
} from "./quick-switcher-scope";

const brainPage = { workspace: true, activeBrainId: "engineering" } as const;
const workspacePage = { workspace: true } as const;
const vaultPage = { workspace: false, activeBrainId: "default" } as const;

const engineering = { brainId: "engineering" };
const design = { brainId: "design" };

describe("quick switcher scope", () => {
  it("defaults to the owning Brain on pages beneath a Brain path and offers the workspace", () => {
    expect(quickSwitcherScopes(brainPage)).toEqual(["active", "all"]);
    expect(defaultQuickSwitcherScope(brainPage)).toBe("active");
  });

  it("offers only the whole workspace on workspace-level pages", () => {
    expect(quickSwitcherScopes(workspacePage)).toEqual(["all"]);
    expect(defaultQuickSwitcherScope(workspacePage)).toBe("all");
    expect(defaultQuickSwitcherScope({ workspace: true, activeBrainId: null })).toBe("all");
    expect(defaultQuickSwitcherScope({ workspace: true, activeBrainId: "" })).toBe("all");
  });

  it("has a single scope in vault mode regardless of the Brain ID", () => {
    expect(quickSwitcherScopes(vaultPage)).toEqual(["all"]);
    expect(defaultQuickSwitcherScope(vaultPage)).toBe("all");
  });

  it("filters entries to the owning Brain only in the active scope", () => {
    expect(inQuickSwitcherScope(engineering, "active", brainPage)).toBe(true);
    expect(inQuickSwitcherScope(design, "active", brainPage)).toBe(false);
    expect(inQuickSwitcherScope(design, "all", brainPage)).toBe(true);
  });

  it("never narrows results where no Brain is active", () => {
    expect(inQuickSwitcherScope(design, "active", workspacePage)).toBe(true);
    expect(inQuickSwitcherScope(design, "all", workspacePage)).toBe(true);
    expect(inQuickSwitcherScope(design, "active", vaultPage)).toBe(true);
  });
});
