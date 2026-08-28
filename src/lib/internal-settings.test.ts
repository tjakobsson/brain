import path from "node:path";
import { describe, expect, it } from "vitest";
import { INTERNAL_ENV, loadInternalSettings } from "./internal-settings";

describe("loadInternalSettings", () => {
  it("loads repository-local defaults", () => {
    expect(loadInternalSettings("/generator", {})).toEqual({
      mode: "vault",
      vault: path.resolve("/generator/examples/demo-vault"),
      workspace: undefined,
      output: path.resolve("/generator/dist"),
      site: undefined,
      base: "",
      exclusions: [],
      strictLinks: false,
      work: undefined,
    });
  });

  it("loads normalized command values", () => {
    expect(
      loadInternalSettings("/generator", {
        [INTERNAL_ENV.vault]: "/caller/vault",
        [INTERNAL_ENV.output]: "/tmp/staging",
        [INTERNAL_ENV.site]: "https://example.com",
        [INTERNAL_ENV.base]: "/vault-repo",
        [INTERNAL_ENV.exclusions]: JSON.stringify(["Archive/**", "Private.md"]),
        [INTERNAL_ENV.strictLinks]: "true",
        [INTERNAL_ENV.work]: "/work",
      }),
    ).toEqual({
      mode: "vault",
      vault: "/caller/vault",
      workspace: undefined,
      output: "/tmp/staging",
      site: "https://example.com",
      base: "/vault-repo",
      exclusions: ["Archive/**", "Private.md"],
      strictLinks: true,
      work: "/work",
    });
  });

  it("loads workspace mode without treating the manifest as a vault", () => {
    expect(
      loadInternalSettings("/generator", {
        [INTERNAL_ENV.mode]: "workspace",
        [INTERNAL_ENV.workspace]: "fixtures/workspace.json",
      }),
    ).toMatchObject({
      mode: "workspace",
      workspace: path.resolve("/generator/fixtures/workspace.json"),
    });
  });

  it("rejects malformed private settings", () => {
    expect(() =>
      loadInternalSettings("/generator", { [INTERNAL_ENV.exclusions]: "not json" }),
    ).toThrow("JSON array");
    expect(() =>
      loadInternalSettings("/generator", { [INTERNAL_ENV.exclusions]: '["", 1]' }),
    ).toThrow("non-empty strings");
    expect(() =>
      loadInternalSettings("/generator", { [INTERNAL_ENV.strictLinks]: "yes" }),
    ).toThrow("true or false");
    expect(() =>
      loadInternalSettings("/generator", { [INTERNAL_ENV.base]: "/vault-repo/" }),
    ).toThrow("normalized root-relative");
    expect(() =>
      loadInternalSettings("/generator", { [INTERNAL_ENV.mode]: "other" }),
    ).toThrow("must be vault or workspace");
    expect(() =>
      loadInternalSettings("/generator", { [INTERNAL_ENV.mode]: "workspace" }),
    ).toThrow("is required in workspace mode");
    expect(() =>
      loadInternalSettings("/generator", {
        [INTERNAL_ENV.mode]: "workspace",
        [INTERNAL_ENV.workspace]: "workspace.json",
        [INTERNAL_ENV.vault]: "vault",
      }),
    ).toThrow("mutually exclusive");
  });
});
