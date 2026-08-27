import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const historicalFiles = new Set([
  "openspec/changes/package-second-brain-generator/design.md",
  "openspec/changes/complete-brain-rename-and-live-serve/proposal.md",
  "openspec/changes/complete-brain-rename-and-live-serve/design.md",
  "openspec/changes/complete-brain-rename-and-live-serve/tasks.md",
  "openspec/changes/complete-brain-rename-and-live-serve/specs/brain-product-interface/spec.md",
]);
const formerNames = [
  ["brain", "manual"].join("-"),
  ["BRAIN", "MANUAL"].join("_"),
  ["Brain", "Manual"].join(" "),
];

describe("Brain product naming", () => {
  it("keeps former names only in explicit historical records", () => {
    const files = execFileSync("git", ["ls-files", "-co", "--exclude-standard"], {
      encoding: "utf8",
    })
      .trim()
      .split("\n")
      .filter(Boolean);
    const violations: string[] = [];

    for (const file of files) {
      if (historicalFiles.has(file)) continue;
      const absolute = path.resolve(file);
      if (!fs.statSync(absolute).isFile()) continue;
      const body = fs.readFileSync(absolute);
      if (body.includes(0)) continue;
      const text = body.toString("utf8");
      if (formerNames.some((name) => text.includes(name))) violations.push(file);
    }

    expect(violations).toEqual([]);
  });
});
