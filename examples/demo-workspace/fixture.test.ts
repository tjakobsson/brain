import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadWorkspaceManifest } from "../../src/lib/workspace.mjs";

const fixture = path.resolve("examples/demo-workspace/workspace.json");

describe("public multi-brain fixture", () => {
  it("covers hierarchy, exclusions, links, equal attachment paths, and metadata", () => {
    const workspace = loadWorkspaceManifest(fixture);
    expect(workspace.groups).toContainEqual({ id: "product", title: "Product", parent: "knowledge" });
    expect(workspace.brains).toHaveLength(3);
    expect(workspace.brains.find((brain) => brain.id === "engineering")?.effectiveExclusions).toEqual([
      "shared-private/**",
      "drafts/**",
    ]);

    const engineering = fs.readFileSync(
      path.join(path.dirname(fixture), "brains/engineering/Principles.md"),
      "utf8",
    );
    const design = fs.readFileSync(path.join(path.dirname(fixture), "brains/design/Interaction model.md"), "utf8");
    expect(engineering).toContain("[[Delivery loops]]");
    expect(engineering).toContain("[[@design/Principles|the design principles]]");
    expect(engineering).toContain("[[Unwritten runbook]]");
    expect(design).toContain("[[@missing-brain/Unknown principle]]");
    expect(engineering).toContain("status: established");
    expect(fs.readFileSync(path.join(path.dirname(fixture), "brains/design/Principles.md"), "utf8")).toContain(
      "status: developing",
    );
    expect(fs.readFileSync(path.join(path.dirname(fixture), "brains/engineering/Delivery loops.md"), "utf8")).toContain(
      "status: draft",
    );

    const engineeringDiagram = path.join(path.dirname(fixture), "brains/engineering/media/diagram.svg");
    const designDiagram = path.join(path.dirname(fixture), "brains/design/media/diagram.svg");
    expect(path.relative(workspace.brains[0].path, engineeringDiagram)).toBe("media/diagram.svg");
    expect(path.relative(workspace.brains[1].path, designDiagram)).toBe("media/diagram.svg");
    expect(fs.readFileSync(engineeringDiagram, "utf8")).not.toBe(fs.readFileSync(designDiagram, "utf8"));
  });

  it("has case-insensitively unique titles inside each brain and a duplicate across brains", () => {
    const workspace = loadWorkspaceManifest(fixture);
    const ownersByTitle = new Map<string, string[]>();

    for (const brain of workspace.brains) {
      const titles = fs
        .readdirSync(brain.path, { recursive: true, encoding: "utf8" })
        .filter((entry) => path.extname(entry).toLowerCase() === ".md")
        .map((entry) => path.basename(entry, path.extname(entry)).toLowerCase());
      expect(new Set(titles).size, `duplicate title in @${brain.id}`).toBe(titles.length);
      for (const title of titles) ownersByTitle.set(title, [...(ownersByTitle.get(title) ?? []), brain.id]);
    }

    expect(ownersByTitle.get("principles")).toEqual(["engineering", "design"]);
  });
});
