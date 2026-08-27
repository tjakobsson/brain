import path from "node:path";

export const INTERNAL_ENV = {
  vault: "BRAIN_MANUAL_VAULT",
  output: "BRAIN_MANUAL_OUTPUT",
  site: "BRAIN_MANUAL_SITE",
  base: "BRAIN_MANUAL_BASE",
  exclusions: "BRAIN_MANUAL_EXCLUSIONS",
  strictLinks: "BRAIN_MANUAL_STRICT_LINKS",
  work: "BRAIN_MANUAL_WORK",
} as const;

export interface InternalSettings {
  vault: string;
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

  return {
    vault: path.resolve(root, env[INTERNAL_ENV.vault]?.trim() || "vault"),
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
