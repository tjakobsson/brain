import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const action = parse(fs.readFileSync(path.resolve("action.yml"), "utf8"));
const pages = parse(fs.readFileSync(path.resolve(".github/workflows/publish-pages.yml"), "utf8"));
const examples = [
  "docs/examples/build-action-major.yml",
  "docs/examples/build-action-sha.yml",
  "docs/examples/pages-major.yml",
  "docs/examples/pages-sha.yml",
];

describe("documented consumer workflows", () => {
  it.each(examples)("parses %s", (file) => {
    expect(() => parse(fs.readFileSync(path.resolve(file), "utf8"))).not.toThrow();
  });

  it.each(["docs/examples/build-action-major.yml", "docs/examples/build-action-sha.yml"])(
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

  it.each(["docs/examples/pages-major.yml", "docs/examples/pages-sha.yml"])(
    "matches reusable workflow inputs and permissions in %s",
    (file) => {
      const workflow = parse(fs.readFileSync(path.resolve(file), "utf8"));
      const job = workflow.jobs.publish;
      expect(Object.keys(job.with ?? {}).every((input) => input in pages.on.workflow_call.inputs)).toBe(
        true,
      );
      expect(workflow.permissions).toEqual({
        contents: "read",
        pages: "write",
        "id-token": "write",
      });
    },
  );
});
