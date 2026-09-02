import type { WorkspaceBrain, WorkspaceDefinition, WorkspaceGroup } from "./workspace.mjs";

export interface BrainHierarchySection {
  id: string;
  title: string;
  /** Nesting depth of the group; ungrouped Brains sit at depth 0. */
  depth: number;
  brains: WorkspaceBrain[];
}

/**
 * The declared hierarchy of a workspace: groups in manifest order, each with
 * its Brains in manifest order, then any ungrouped Brains. Empty groups stay
 * so parent groups still frame their children.
 */
export function brainHierarchy(
  registry: Pick<WorkspaceDefinition, "groups" | "brains">,
): BrainHierarchySection[] {
  const groupsById = new Map(registry.groups.map((group) => [group.id, group]));
  const depthOf = (group: WorkspaceGroup): number => {
    let depth = 0;
    let parent = group.parent ? groupsById.get(group.parent) : undefined;
    while (parent) {
      depth += 1;
      parent = parent.parent ? groupsById.get(parent.parent) : undefined;
    }
    return depth;
  };
  const sections = registry.groups.map((group) => ({
    id: group.id,
    title: group.title,
    depth: depthOf(group),
    brains: registry.brains.filter((brain) => brain.group === group.id),
  }));
  const ungrouped = registry.brains.filter((brain) => !brain.group || !groupsById.has(brain.group));
  if (ungrouped.length > 0) {
    sections.push({ id: "", title: "Other brains", depth: 0, brains: ungrouped });
  }
  return sections;
}

/** Brain IDs flattened in declared hierarchy order. */
export function brainHierarchyOrder(
  registry: Pick<WorkspaceDefinition, "groups" | "brains">,
): string[] {
  return brainHierarchy(registry).flatMap((section) => section.brains.map((brain) => brain.id));
}
