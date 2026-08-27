import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveVaultDir } from "./vault-path";

describe("resolveVaultDir", () => {
  it("defaults to the repository vault", () => {
    expect(resolveVaultDir("/project", undefined)).toBe(path.resolve("/project/vault"));
  });

  it("resolves a relative configured path from the repository", () => {
    expect(resolveVaultDir("/project", ".generated/stress-vault")).toBe(
      path.resolve("/project/.generated/stress-vault"),
    );
  });

  it("preserves an absolute configured path", () => {
    expect(resolveVaultDir("/project", "/tmp/external-vault")).toBe("/tmp/external-vault");
  });
});
