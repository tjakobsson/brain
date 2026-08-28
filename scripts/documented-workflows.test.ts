import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const action = parse(fs.readFileSync(path.resolve("action.yml"), "utf8"));
const examples = [
  "docs/examples/build-action-major.yml",
  "docs/examples/build-action-workspace-major.yml",
  "docs/examples/pages-major.yml",
  "docs/examples/pages-reusable-major.yml",
  "docs/examples/pages-workspace-major.yml",
];
const actionExamples = examples.filter(
  (file) => !file.endsWith("pages-reusable-major.yml") && !file.endsWith("pages-workspace-major.yml"),
);

describe("documented consumer workflows", () => {
  it.each(examples)("parses %s", (file) => {
    expect(() => parse(fs.readFileSync(path.resolve(file), "utf8"))).not.toThrow();
  });

  it.each(actionExamples)(
    "uses only published Action inputs in %s",
    (file) => {
      const workflow = parse(fs.readFileSync(path.resolve(file), "utf8"));
      const step = workflow.jobs.build.steps.find((candidate: { uses?: string }) =>
        candidate.uses?.startsWith("tjakobsson/brain@"),
      );
      expect(Object.keys(step.with ?? {})).toEqual(
        expect.arrayContaining(Object.keys(step.with ?? {}).filter((input) => input in action.inputs)),
      );
      expect(Object.keys(step.with ?? {}).every((input) => input in action.inputs)).toBe(true);
    },
  );

  it("documents the reusable Pages workspace input", () => {
    const workflow = parse(
      fs.readFileSync(path.resolve("docs/examples/pages-workspace-major.yml"), "utf8"),
    );
    expect(workflow.jobs.pages.uses).toBe(
      "tjakobsson/brain/.github/workflows/publish-pages.yml@v1",
    );
    expect(workflow.jobs.pages.with).toEqual({
      workspace: "examples/demo-workspace/workspace.json",
      "strict-links": false,
    });
  });

  it("documents reusable Pages single-brain defaults", () => {
    const workflow = parse(
      fs.readFileSync(path.resolve("docs/examples/pages-reusable-major.yml"), "utf8"),
    );
    expect(workflow.jobs.pages.uses).toBe(
      "tjakobsson/brain/.github/workflows/publish-pages.yml@v1",
    );
    expect(workflow.jobs.pages.with).toEqual({ vault: "vault" });
  });

  it.each(["docs/examples/pages-major.yml"])(
    "uses the direct Action and official Pages flow in %s",
    (file) => {
      const workflow = parse(fs.readFileSync(path.resolve(file), "utf8"));
      const buildUses = workflow.jobs.build.steps.map((step: { uses?: string }) => step.uses);
      const deployUses = workflow.jobs.deploy.steps.map((step: { uses?: string }) => step.uses);
      expect(
        buildUses.some((uses: string | undefined) => uses?.startsWith("tjakobsson/brain@")),
      ).toBe(true);
      expect(buildUses).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^actions\/checkout@[a-f0-9]{40}$/u),
          expect.stringMatching(/^actions\/configure-pages@[a-f0-9]{40}$/u),
          expect.stringMatching(/^actions\/upload-pages-artifact@[a-f0-9]{40}$/u),
        ]),
      );
      expect(deployUses).toContainEqual(
        expect.stringMatching(/^actions\/deploy-pages@[a-f0-9]{40}$/u),
      );
      expect(workflow.jobs.deploy.needs).toBe("build");
      expect(workflow.jobs.deploy.environment.name).toBe("github-pages");
      expect(
        Object.values(workflow.jobs).some(
          (job: unknown) => typeof job === "object" && job !== null && "uses" in job,
        ),
      ).toBe(false);
      expect(workflow.permissions).toEqual({
        contents: "read",
        pages: "write",
        "id-token": "write",
      });
    },
  );
});
