import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const actionSource = fs.readFileSync(path.resolve("action.yml"), "utf8");
const action = parse(actionSource);
const runner = fs.readFileSync(path.resolve("scripts/run-generator-action.sh"), "utf8");
const pagesSource = fs.readFileSync(path.resolve(".github/workflows/publish-pages.yml"), "utf8");
const pages = parse(pagesSource);
const sourceParity = fs.readFileSync(path.resolve(".github/workflows/source-parity.yml"), "utf8");
const candidateParity = fs.readFileSync(path.resolve(".github/workflows/action-parity.yml"), "utf8");

describe("workspace distribution contracts", () => {
  it("packages the public workspace fixture in the source image", () => {
    const dockerfile = fs.readFileSync(path.resolve("Dockerfile"), "utf8");
    expect(dockerfile).toContain("COPY --chown=65532:65532 examples/demo-workspace ./examples/demo-workspace");
  });

  it("exposes mutually exclusive Action inputs and preserves the no-input vault default", () => {
    expect(action.inputs.vault).toMatchObject({ required: false, default: "" });
    expect(action.inputs.workspace).toMatchObject({ required: false, default: "" });
    expect(actionSource).toContain("INPUT_WORKSPACE: ${{ inputs.workspace }}");
    expect(runner).toContain("Options --vault and --workspace are mutually exclusive");
    expect(runner).toContain('vault_input="vault"');
  });

  it("mounts the caller-prepared checkout read-only for workspace builds", () => {
    expect(runner).toContain("type=bind,src=$workspace_root,dst=$workspace_root,readonly");
    expect(runner).toContain('args+=(--workspace "$workspace_path")');
    expect(runner).toContain('workspace_relative_path "$vault_path" "Brain directory"');
    expect(runner).toContain("scripts/generator-safety.mjs");
    expect(runner).toContain("await validateGeneratorInputs");
  });

  it("runs source-image and candidate Action workspace parity", () => {
    for (const workflow of [sourceParity, candidateParity]) {
      expect(workflow).toContain("--workspace examples/demo-workspace/workspace.json");
      expect(workflow).toContain('Brain "missing-brain"');
    }
    expect(sourceParity).toContain("INPUT_WORKSPACE: examples/demo-workspace/workspace.json");
    expect(candidateParity).toContain("workspace: examples/demo-workspace/workspace.json");
    expect(sourceParity).toContain("npm run test:container-workspace");
    expect(sourceParity).toContain(".generated/workspace-source-action");
    expect(sourceParity).not.toContain("--normalize-pagefind");
    expect(candidateParity).not.toContain("--normalize-pagefind");
  });

  it("exposes exclusive reusable Pages inputs with the legacy vault fallback", () => {
    const inputs = pages.on.workflow_call.inputs;
    expect(inputs.vault).toMatchObject({ required: false, default: "", type: "string" });
    expect(inputs.workspace).toMatchObject({ required: false, default: "", type: "string" });
    expect(pagesSource).toContain('vault_input="vault"');
    expect(pagesSource).toContain("Options --vault and --workspace are mutually exclusive");
  });

  it("rejects Pages workspace sources outside the caller checkout before deployment", () => {
    expect(pagesSource).toContain("resolves outside the caller repository checkout");
    expect(pagesSource).toContain("use the Brain build Action instead");
    expect(pagesSource).toContain("fs.realpathSync(configured)");
    expect(pages.jobs.deploy.needs).toBe("build");
    expect(pages.jobs.deploy.steps[0].uses).toMatch(/^actions\/deploy-pages@[a-f0-9]{40}$/u);
    expect(pages.jobs.deploy.if).toBeUndefined();
  });
});
