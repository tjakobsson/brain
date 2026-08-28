import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  GENERATOR_USAGE,
  GeneratorUsageError,
  parseGeneratorInputs,
} from "./generator-inputs.mjs";

const cwd = path.resolve("/caller/project");
const temporaryDirectories: string[] = [];

afterEach(() => {
  temporaryDirectories.splice(0).forEach((directory) => fs.rmSync(directory, { recursive: true, force: true }));
});

function workspace(contents: unknown): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "brain-inputs-"));
  temporaryDirectories.push(directory);
  const manifest = path.join(directory, "workspace.json");
  fs.writeFileSync(manifest, typeof contents === "string" ? contents : JSON.stringify(contents));
  return manifest;
}

function parse(args: string[]) {
  return parseGeneratorInputs(args, { cwd });
}

function expectUsageError(args: string[], message: string) {
  expect(() => parse(args)).toThrowError(GeneratorUsageError);
  expect(() => parse(args)).toThrow(message);
  expect(() => parse(args)).toThrow(GENERATOR_USAGE);
}

describe("parseGeneratorInputs", () => {
  it("documents only the Brain commands", () => {
    expect(GENERATOR_USAGE).toContain("brain build [options]");
    expect(GENERATOR_USAGE).toContain("brain preview [options]");
    expect(GENERATOR_USAGE).toContain("brain serve [options]");
    expect(GENERATOR_USAGE).not.toContain(["brain", "manual"].join("-"));
  });

  it("normalizes build defaults from the caller working directory", () => {
    expect(parse(["build"])).toEqual({
      command: "build",
      mode: "vault",
      vault: path.join(cwd, "examples/demo-vault"),
      output: path.join(cwd, "dist"),
      site: undefined,
      base: "",
      exclusions: [],
      strictLinks: false,
    });
  });

  it("normalizes preview defaults", () => {
    expect(parse(["preview"])).toEqual({
      command: "preview",
      mode: "vault",
      vault: path.join(cwd, "examples/demo-vault"),
      output: path.join(cwd, "dist"),
      site: undefined,
      base: "",
      exclusions: [],
      strictLinks: false,
      host: "localhost",
      port: 4321,
    });
  });

  it("normalizes serve defaults", () => {
    expect(parse(["serve"])).toEqual({
      command: "serve",
      mode: "vault",
      vault: path.join(cwd, "examples/demo-vault"),
      output: path.join(cwd, "dist"),
      site: undefined,
      base: "",
      exclusions: [],
      strictLinks: false,
      host: "localhost",
      port: 4321,
    });
  });

  it.each(["build", "preview", "serve"])("loads workspace mode for %s", (command) => {
    const manifest = workspace({
      version: 1,
      title: "Team knowledge",
      brains: [{ id: "engineering", title: "Engineering", path: "./engineering" }],
    });
    const result = parse([command, "--workspace", manifest]);

    expect(result).toMatchObject({
      command,
      mode: "workspace",
      workspace: manifest,
      workspaceDefinition: {
        title: "Team knowledge",
        brains: [{ id: "engineering", path: path.join(path.dirname(manifest), "engineering") }],
      },
    });
    expect(result).not.toHaveProperty("vault");
  });

  it.each(["build", "preview", "serve"])("rejects conflicting input modes for %s", (command) => {
    expectUsageError(
      [command, "--vault", "notes", "--workspace", "workspace.json"],
      "--vault and --workspace are mutually exclusive",
    );
  });

  it("reports malformed JSON and unsupported workspace versions", () => {
    expectUsageError(["build", "--workspace", workspace('{"version": 1,')], "malformed JSON");
    expectUsageError(
      ["build", "--workspace", workspace({ version: 2, title: "Future", brains: [] })],
      "unsupported version 2",
    );
  });

  it("resolves relative paths and preserves absolute paths", () => {
    const result = parse([
      "build",
      "--vault",
      "notes",
      "--output=/tmp/generated-site",
    ]);

    expect(result.vault).toBe(path.join(cwd, "notes"));
    expect(result.output).toBe(path.resolve("/tmp/generated-site"));
  });

  it("normalizes site origins and base paths", () => {
    expect(
      parse([
        "build",
        "--site",
        "https://example.com:443/",
        "--base",
        "/vault-repo/",
      ]),
    ).toMatchObject({ site: "https://example.com", base: "/vault-repo" });
    expect(parse(["build", "--base", "/"]).base).toBe("");
  });

  it.each([
    "example.com",
    "ftp://example.com",
    "https://user@example.com",
    "https://example.com/vault",
    "https://example.com/?query=1",
    "https://example.com/#notes",
  ])("rejects malformed site value %s", (site) => {
    expectUsageError(["build", "--site", site], "Invalid --site value");
  });

  it.each([
    "vault-repo",
    "https://example.com/vault",
    "//example.com/vault",
    "/vault//notes",
    "/vault/../notes",
    "/vault/%2e%2e/notes",
    "/vault%2Fnotes",
    "/vault?query=1",
    "/vault#notes",
    "/vault\\notes",
    "/vault/%zz",
  ])("rejects malformed base value %s", (base) => {
    expectUsageError(["build", "--base", base], "Invalid --base value");
  });

  it("preserves repeated exclusions in occurrence order", () => {
    expect(
      parse([
        "build",
        "--exclude",
        "Archive/**",
        "--exclude=Private/**",
        "--exclude",
        "draft.md",
      ]).exclusions,
    ).toEqual(["Archive/**", "Private/**", "draft.md"]);
  });

  it.each(["preview", "serve"])("accepts strict links and %s network options", (command) => {
    expect(
      parse([
        command,
        "--strict-links",
        "--host",
        "0.0.0.0",
        "--port",
        "8080",
      ]),
    ).toMatchObject({ strictLinks: true, host: "0.0.0.0", port: 8080 });
  });

  it.each(["0", "65536", "1.5", "+4321", "1e3"])("rejects invalid port %s", (port) => {
    expectUsageError(["serve", "--port", port], "Invalid --port value");
  });

  it("rejects empty exclusions and hosts", () => {
    expectUsageError(["build", "--exclude", ""], "patterns must not be empty");
    expectUsageError(["preview", "--host", ""], "Invalid --host value");
  });

  it.each(["vault", "workspace", "output", "site", "base", "strict-links", "host", "port"])(
    "rejects repeated singleton option --%s",
    (option) => {
      const command = option === "host" || option === "port" ? "serve" : "build";
      const value = option === "strict-links" ? [] : option === "port" ? ["4321"] : ["value"];
      expectUsageError(
        [command, `--${option}`, ...value, `--${option}`, ...value],
        `Option --${option} may only be specified once`,
      );
    },
  );

  it("rejects preview-only options for builds", () => {
    expectUsageError(["build", "--host", "localhost"], "only valid for preview and serve commands");
    expectUsageError(["build", "--port", "4321"], "only valid for preview and serve commands");
  });

  it("returns actionable errors for malformed invocations", () => {
    expectUsageError([], "Missing command");
    expectUsageError(["deploy"], "Unknown command");
    expectUsageError(["build", "extra"], "Unexpected positional argument");
    expectUsageError(["build", "--unknown"], "Invalid arguments");
    expectUsageError(["build", "--vault"], "Invalid arguments");
  });
});
