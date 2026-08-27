import path from "node:path";

export const VAULT_PATH_ENV = "BRAIN_MANUAL_VAULT";

export function resolveVaultDir(
  root: string = process.cwd(),
  configuredPath: string | undefined = process.env[VAULT_PATH_ENV],
): string {
  return path.resolve(root, configuredPath?.trim() || "examples/demo-vault");
}

export const VAULT_DIR = resolveVaultDir();
