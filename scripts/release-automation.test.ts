import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const candidateWorkflowPath = path.resolve(".github/workflows/candidate-image.yml");
const candidateParityWorkflowPath = path.resolve(".github/workflows/action-parity.yml");
const releaseCheckWorkflowPath = path.resolve(".github/workflows/release-check.yml");
const releaseWorkflowPath = path.resolve(".github/workflows/release.yml");
const sourceParityWorkflowPath = path.resolve(".github/workflows/source-parity.yml");
const candidateWorkflow = parse(fs.readFileSync(candidateWorkflowPath, "utf8"));
const candidateParityWorkflow = parse(fs.readFileSync(candidateParityWorkflowPath, "utf8"));
const releaseCheckWorkflow = parse(fs.readFileSync(releaseCheckWorkflowPath, "utf8"));
const releaseWorkflow = parse(fs.readFileSync(releaseWorkflowPath, "utf8"));
const sourceParityWorkflow = parse(fs.readFileSync(sourceParityWorkflowPath, "utf8"));
const releaseSource = fs.readFileSync(releaseWorkflowPath, "utf8");
const sourceParitySource = fs.readFileSync(sourceParityWorkflowPath, "utf8");
const candidate = JSON.parse(fs.readFileSync(path.resolve("release/candidate.json"), "utf8"));
const packageMetadata = JSON.parse(fs.readFileSync(path.resolve("package.json"), "utf8"));

describe("release automation", () => {
  it("keeps stable tags out of candidate builds", () => {
    expect(candidateWorkflow.on.push.tags).toBeUndefined();
  });

  it("runs pinned-candidate checks only when candidate metadata changes", () => {
    expect(candidateParityWorkflow.on.pull_request.paths).toEqual(["release/candidate.json"]);
    expect(candidateParityWorkflow.on.push.paths).toEqual(["release/candidate.json"]);
    expect(releaseCheckWorkflow.on.pull_request.paths).toEqual(["release/candidate.json"]);
    expect(releaseCheckWorkflow.on.push.paths).toEqual(["release/candidate.json"]);
  });

  it("compares normal source changes with an image built from the same commit", () => {
    expect(sourceParityWorkflow.on.pull_request.paths).toContain("src/**");
    expect(sourceParityWorkflow.on.pull_request.paths).toContain("examples/demo-vault/**");
    expect(sourceParityWorkflow.on.push.paths).toEqual(sourceParityWorkflow.on.pull_request.paths);
    expect(sourceParitySource).toContain("docker build --tag brain:source .");
    expect(sourceParitySource).toContain(".generated/source-command");
    expect(sourceParitySource).toContain(".generated/source-image/site");
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

  it("keeps workspace distribution interfaces on the maintained v1 line", () => {
    expect(packageMetadata.version).toBe("1.2.3");
    expect(candidate.version).toBe("1.2.3");
    expect(releaseSource).toContain('const major = process.env.VERSION.split(".")[0]');
  });
});
