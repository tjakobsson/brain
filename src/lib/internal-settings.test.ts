import path from "node:path";
import { describe, expect, it } from "vitest";
import { INTERNAL_ENV, loadInternalSettings } from "./internal-settings";

describe("loadInternalSettings", () => {
  it("loads repository-local defaults", () => {
    expect(loadInternalSettings("/generator", {})).toEqual({
      vault: path.resolve("/generator/vault"),
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
      vault: "/caller/vault",
      output: "/tmp/staging",
      site: "https://example.com",
      base: "/vault-repo",
      exclusions: ["Archive/**", "Private.md"],
      strictLinks: true,
      work: "/work",
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
  });
});
