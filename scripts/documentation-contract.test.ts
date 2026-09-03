import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const historicalPrefixes = ["openspec/changes/archive/"];
const formerApplicationName = ["ob", "sidian"].join("");
const migrationFiles = new Set([
  "CHANGELOG.md",
  "openspec/changes/support-multiple-brains/proposal.md",
  "openspec/changes/support-multiple-brains/design.md",
  "openspec/changes/support-multiple-brains/tasks.md",
  "openspec/changes/support-multiple-brains/specs/local-live-serving/spec.md",
  "openspec/changes/support-multiple-brains/specs/note-publishing/spec.md",
  "openspec/changes/support-multiple-brains/specs/portable-site-generation/spec.md",
  "openspec/changes/support-multiple-brains/specs/vault-conventions/spec.md",
]);

function repositoryFiles(): string[] {
  return execFileSync("git", ["ls-files", "-co", "--exclude-standard"], { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter(Boolean);
}

describe("Brain Markdown documentation contract", () => {
  it("keeps product claims independent of other knowledge-management applications", () => {
    const violations: string[] = [];

    for (const file of repositoryFiles()) {
      if (historicalPrefixes.some((prefix) => file.startsWith(prefix))) continue;
      if (migrationFiles.has(file)) continue;

      const absolute = path.resolve(file);
      if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) continue;
      const body = fs.readFileSync(absolute);
      if (body.includes(0)) continue;

      body
        .toString("utf8")
        .split("\n")
        .forEach((line, index) => {
          const withoutMigrationDirectory = line.replaceAll(`.${formerApplicationName}`, "");
          if (new RegExp(formerApplicationName, "iu").test(withoutMigrationDirectory)) {
            violations.push(`${file}:${index + 1}`);
          }
        });
    }

    expect(violations).toEqual([]);
  });

  it("documents the accepted workspace v1 contract and fixture commands", () => {
    const guide = fs.readFileSync(path.resolve("docs/workspaces.md"), "utf8");
    const requiredTerms = [
      '"version": 1',
      '"exclusions"',
      '"groups"',
      '"brains"',
      '"parent"',
      '"accent"',
      "[[@design/Interaction model|the design model]]",
      "/brains/<brain-id>/notes/<slug>",
      "/brains/<brain-id>/notes/<slug>/graph",
      "public input",
      "declared hierarchy order",
      "--vault <path>",
      "read-only",
      "separate repository checkouts",
      "reusable Pages workflow",
    ];

    for (const term of requiredTerms) expect(guide).toContain(term);
    expect(guide.match(/--workspace examples\/demo-workspace\/workspace\.json/gu)).toHaveLength(3);
    expect(guide.match(/--workspace \/workspace\/workspace\.json/gu)).toHaveLength(2);
  });
});
