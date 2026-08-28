import path from "node:path";

export const INTERNAL_ENV = {
  mode: "BRAIN_INPUT_MODE",
  vault: "BRAIN_VAULT",
  workspace: "BRAIN_WORKSPACE",
  output: "BRAIN_OUTPUT",
  site: "BRAIN_SITE",
  base: "BRAIN_BASE",
  exclusions: "BRAIN_EXCLUSIONS",
  strictLinks: "BRAIN_STRICT_LINKS",
  work: "BRAIN_WORK",
} as const;

export interface InternalSettings {
  mode: "vault" | "workspace";
  vault: string;
  workspace?: string;
  output: string;
  site?: string;
  base: string;
  exclusions: string[];
  strictLinks: boolean;
  work?: string;
}

function parseExclusions(value: string | undefined): string[] {
  if (value === undefined || value === "") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (cause) {
    throw new Error(`${INTERNAL_ENV.exclusions} must be a JSON array of strings.`, { cause });
  }
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string" || item === "")) {
    throw new Error(`${INTERNAL_ENV.exclusions} must be a JSON array of non-empty strings.`);
  }
  return parsed;
}

function parseStrictLinks(value: string | undefined): boolean {
  if (value === undefined || value === "false") return false;
  if (value === "true") return true;
  throw new Error(`${INTERNAL_ENV.strictLinks} must be true or false.`);
}

export function loadInternalSettings(
  root: string = process.cwd(),
  env: NodeJS.ProcessEnv = process.env,
): InternalSettings {
  const base = env[INTERNAL_ENV.base] ?? "";
  if (base !== "" && base !== "/" && (!base.startsWith("/") || base.endsWith("/"))) {
    throw new Error(`${INTERNAL_ENV.base} must be a normalized root-relative base path.`);
  }

  const configuredMode = env[INTERNAL_ENV.mode]?.trim();
  if (configuredMode !== undefined && configuredMode !== "vault" && configuredMode !== "workspace") {
    throw new Error(`${INTERNAL_ENV.mode} must be vault or workspace.`);
  }
  const mode = configuredMode ?? (env[INTERNAL_ENV.workspace]?.trim() ? "workspace" : "vault");
  const workspace = env[INTERNAL_ENV.workspace]?.trim();
  const vault = env[INTERNAL_ENV.vault]?.trim();
  if (mode === "workspace" && !workspace) {
    throw new Error(`${INTERNAL_ENV.workspace} is required in workspace mode.`);
  }
  if (mode === "workspace" && vault) {
    throw new Error(`${INTERNAL_ENV.vault} and ${INTERNAL_ENV.workspace} are mutually exclusive.`);
  }
  if (mode === "vault" && workspace) {
    throw new Error(`${INTERNAL_ENV.workspace} requires workspace mode.`);
  }

  return {
    mode,
    vault: path.resolve(root, vault || "examples/demo-vault"),
    workspace: workspace ? path.resolve(root, workspace) : undefined,
    output: path.resolve(root, env[INTERNAL_ENV.output]?.trim() || "dist"),
    site: env[INTERNAL_ENV.site]?.trim() || undefined,
    base: base === "/" ? "" : base,
    exclusions: parseExclusions(env[INTERNAL_ENV.exclusions]),
    strictLinks: parseStrictLinks(env[INTERNAL_ENV.strictLinks]),
    work: env[INTERNAL_ENV.work]?.trim()
      ? path.resolve(root, env[INTERNAL_ENV.work].trim())
      : undefined,
  };
}

export const internalSettings = loadInternalSettings();
