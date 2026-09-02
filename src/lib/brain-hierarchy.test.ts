import { describe, expect, it } from "vitest";
import { brainHierarchy, brainHierarchyOrder } from "./brain-hierarchy";
import type { WorkspaceBrain } from "./workspace.mjs";

const brain = (id: string, group?: string): WorkspaceBrain => ({
  id,
  title: id,
  path: `./${id}`,
  configuredPath: `./${id}`,
  group,
  accent: "#000000",
  exclusions: [],
  effectiveExclusions: [],
});

const registry = {
  groups: [
    { id: "knowledge", title: "Knowledge" },
    { id: "product", title: "Product", parent: "knowledge" },
    { id: "discovery", title: "Discovery", parent: "knowledge" },
  ],
  brains: [
    brain("research", "discovery"),
    brain("engineering", "product"),
    brain("loose"),
    brain("design", "product"),
  ],
};

describe("brain hierarchy", () => {
  it("orders groups by declaration, Brains by declaration within each, then ungrouped", () => {
    const sections = brainHierarchy(registry);
    expect(sections.map(({ id, depth }) => `${id}:${depth}`)).toEqual([
      "knowledge:0",
      "product:1",
      "discovery:1",
      ":0",
    ]);
    expect(sections.map((section) => section.brains.map(({ id }) => id))).toEqual([
      [],
      ["engineering", "design"],
      ["research"],
      ["loose"],
    ]);
    expect(sections.at(-1)?.title).toBe("Other brains");
    expect(brainHierarchyOrder(registry)).toEqual(["engineering", "design", "research", "loose"]);
  });

  it("omits the ungrouped section when every Brain has a group", () => {
    const grouped = { ...registry, brains: registry.brains.filter(({ id }) => id !== "loose") };
    expect(brainHierarchy(grouped).map(({ id }) => id)).toEqual(["knowledge", "product", "discovery"]);
  });
});
