import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_BRAIN_ACCENTS,
  WorkspaceValidationError,
  parseWorkspaceManifest,
  type WorkspaceDefinition,
} from "./workspace.mjs";

const manifestPath = path.resolve("fixtures/workspace/workspace.json");

function manifest(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    title: "Product knowledge",
    description: "Public team notes",
    exclusions: ["shared-private/**"],
    groups: [
      { id: "company", title: "Company" },
      { id: "product", title: "Product", parent: "company" },
    ],
    brains: [
      {
        id: "engineering",
        title: "Engineering",
        path: "./brains/engineering",
        group: "product",
        exclusions: ["drafts/**"],
      },
      {
        id: "design",
        title: "Design",
        path: "../design",
        group: "product",
        description: "Interaction design",
        accent: "#B56CFF",
      },
    ],
    ...overrides,
  };
}

function parse(value: unknown = manifest()): WorkspaceDefinition {
  return parseWorkspaceManifest(JSON.stringify(value), manifestPath);
}

function invalid(value: unknown, message: string) {
  expect(() => parse(value)).toThrowError(WorkspaceValidationError);
  expect(() => parse(value)).toThrow(message);
}

describe("workspace manifest", () => {
  it("loads a valid registry and resolves paths and exclusions", () => {
    const result = parse();

    expect(result).toEqual({
      version: 1,
      title: "Product knowledge",
      description: "Public team notes",
      exclusions: ["shared-private/**"],
      groups: [
        { id: "company", title: "Company", parent: undefined },
        { id: "product", title: "Product", parent: "company" },
      ],
      brains: [
        {
          id: "engineering",
          title: "Engineering",
          path: path.resolve(path.dirname(manifestPath), "brains/engineering"),
          configuredPath: "./brains/engineering",
          group: "product",
          description: undefined,
          accent: expect.stringMatching(/^#[0-9a-f]{6}$/),
          exclusions: ["drafts/**"],
          effectiveExclusions: ["shared-private/**", "drafts/**"],
        },
        {
          id: "design",
          title: "Design",
          path: path.resolve(path.dirname(manifestPath), "../design"),
          configuredPath: "../design",
          group: "product",
          description: "Interaction design",
          accent: "#b56cff",
          exclusions: [],
          effectiveExclusions: ["shared-private/**"],
        },
      ],
      manifestPath,
    });
    expect(DEFAULT_BRAIN_ACCENTS).toContain(result.brains[0].accent);
  });

  it("assigns default accents from stable IDs rather than registry order", () => {
    const first = parse();
    const second = parse({ ...manifest(), brains: [...manifest().brains].reverse() });
    const accents = (workspace: WorkspaceDefinition) =>
      Object.fromEntries(workspace.brains.map((brain) => [brain.id, brain.accent]));

    expect(accents(second)).toEqual(accents(first));
  });

  it("reports malformed JSON with the manifest path", () => {
    expect(() => parseWorkspaceManifest('{"version": 1,', manifestPath)).toThrow(
      `Invalid workspace ${manifestPath}: malformed JSON`,
    );
  });

  it("rejects unsupported versions and empty registries", () => {
    invalid({ ...manifest(), version: 2 }, "unsupported version 2");
    invalid({ ...manifest(), brains: [] }, "brains must be a non-empty array");
  });

  it("rejects duplicate brain IDs and identifies both entries", () => {
    invalid(
      {
        ...manifest(),
        brains: [
          { id: "same", title: "First", path: "first" },
          { id: "same", title: "Second", path: "second" },
        ],
      },
      'duplicate brain ID "same" at brains[0] and brains[1]',
    );
  });

  it("rejects duplicate group IDs and identifies both entries", () => {
    invalid(
      {
        ...manifest(),
        groups: [
          { id: "same", title: "First" },
          { id: "same", title: "Second" },
        ],
      },
      'duplicate group ID "same" at groups[0] and groups[1]',
    );
  });

  it.each([
    ["brain ID", { ...manifest(), brains: [{ id: "Not Safe", title: "Bad", path: "bad" }] }, "brains[0].id"],
    ["group ID", { ...manifest(), groups: [{ id: "Not Safe", title: "Bad" }] }, "groups[0].id"],
  ])("rejects an invalid %s", (_label, value, message) => invalid(value, `${message} must use lower-case kebab-case`));

  it("rejects missing hierarchy references", () => {
    invalid(
      { ...manifest(), groups: [{ id: "child", title: "Child", parent: "missing" }] },
      'references missing parent "missing"',
    );
    invalid(
      { ...manifest(), brains: [{ id: "one", title: "One", path: "one", group: "missing" }] },
      'references missing group "missing"',
    );
  });

  it("rejects hierarchy cycles with the complete cycle chain", () => {
    invalid(
      {
        ...manifest(),
        groups: [
          { id: "one", title: "One", parent: "two" },
          { id: "two", title: "Two", parent: "three" },
          { id: "three", title: "Three", parent: "one" },
        ],
        brains: [{ id: "brain", title: "Brain", path: "brain", group: "one" }],
      },
      "one -> two -> three -> one",
    );
  });

  it.each(["red", "#fff", "#12345g", "#12345678"])("rejects invalid accent %s", (accent) => {
    invalid(
      { ...manifest(), brains: [{ id: "brain", title: "Brain", path: "brain", accent }] },
      "accent must be a six-digit hexadecimal color",
    );
  });

  it("rejects malformed required fields, exclusions, and unknown properties", () => {
    invalid({ ...manifest(), title: "" }, "title must be a non-empty string");
    invalid({ ...manifest(), exclusions: [""] }, "exclusions must be an array of non-empty strings");
    invalid(
      { ...manifest(), brains: [{ id: "brain", title: "Brain", path: "brain", exclusions: [1] }] },
      "brains[0].exclusions must be an array of non-empty strings",
    );
    invalid({ ...manifest(), typo: true }, 'unknown property "typo"');
  });
});
