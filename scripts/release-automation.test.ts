import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const candidateWorkflowPath = path.resolve(".github/workflows/candidate-image.yml");
const releaseWorkflowPath = path.resolve(".github/workflows/release.yml");
const candidateWorkflow = parse(fs.readFileSync(candidateWorkflowPath, "utf8"));
const releaseWorkflow = parse(fs.readFileSync(releaseWorkflowPath, "utf8"));
const releaseSource = fs.readFileSync(releaseWorkflowPath, "utf8");
const candidate = JSON.parse(fs.readFileSync(path.resolve("release/candidate.json"), "utf8"));
const packageMetadata = JSON.parse(fs.readFileSync(path.resolve("package.json"), "utf8"));

describe("release automation", () => {
  it("keeps stable tags out of candidate builds", () => {
    expect(candidateWorkflow.on.push.tags).toBeUndefined();
  });

  it("promotes the recorded digest instead of rebuilding it", () => {
    expect(releaseWorkflow.on.push.tags).toEqual(["v*.*.*"]);
    expect(releaseSource).toContain("docker buildx imagetools create");
    expect(releaseSource).not.toContain("docker/build-push-action");
  });

  it("moves the maintained major tag before creating the GitHub release", () => {
    expect(releaseSource.indexOf("Move maintained major tag")).toBeLessThan(
      releaseSource.indexOf("Create GitHub Release"),
    );
  });

  it("keeps package and candidate versions aligned", () => {
    expect(packageMetadata.version).toBe(candidate.version);
  });
});
