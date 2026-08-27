import path from "node:path";
import { parseArgs } from "node:util";

const COMMANDS = new Set(["build", "preview"]);
const SINGLE_OPTIONS = new Set([
  "vault",
  "output",
  "site",
  "base",
  "strict-links",
  "host",
  "port",
]);

export const GENERATOR_USAGE = `Usage:
  brain-manual build [options]
  brain-manual preview [options]

Options:
  --vault <path>       Vault directory (default: ./vault)
  --output <path>      Generated site directory (default: ./dist)
  --site <origin>      Canonical HTTP(S) origin
  --base <path>        Deployment base path (default: /)
  --exclude <pattern>  Exclude a vault pattern; repeatable
  --strict-links       Fail on unresolved note links
  --host <host>        Preview host (default: localhost)
  --port <port>        Preview port (default: 4321)`;

export class GeneratorUsageError extends Error {
  constructor(message, options) {
    super(`${message}\n\n${GENERATOR_USAGE}`, options);
    this.name = "GeneratorUsageError";
  }
}

function usageError(message, cause) {
  return new GeneratorUsageError(message, cause ? { cause } : undefined);
}

function normalizeSite(value) {
  if (value === undefined) return undefined;

  let site;
  try {
    site = new URL(value);
  } catch (cause) {
    throw usageError(`Invalid --site value ${JSON.stringify(value)}: expected an absolute HTTP(S) origin.`, cause);
  }

  if (
    !["http:", "https:"].includes(site.protocol) ||
    site.username ||
    site.password ||
    site.pathname !== "/" ||
    site.search ||
    site.hash
  ) {
    throw usageError(
      `Invalid --site value ${JSON.stringify(value)}: expected an HTTP(S) origin without credentials, path, query, or fragment.`,
    );
  }

  return site.origin;
}

function normalizeBase(value = "") {
  if (value === "" || value === "/") return "";
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    value.includes("?") ||
    value.includes("#")
  ) {
    throw usageError(
      `Invalid --base value ${JSON.stringify(value)}: expected / or a root-relative path such as /vault-repo.`,
    );
  }

  const normalized = value.endsWith("/") ? value.slice(0, -1) : value;
  const segments = normalized.slice(1).split("/");
  if (segments.some((segment) => segment === "")) {
    throw usageError(`Invalid --base value ${JSON.stringify(value)}: empty path segments are not allowed.`);
  }

  for (const segment of segments) {
    let decoded;
    try {
      decoded = decodeURIComponent(segment);
    } catch (cause) {
      throw usageError(`Invalid --base value ${JSON.stringify(value)}: malformed percent encoding.`, cause);
    }
    if (decoded === "." || decoded === ".." || decoded.includes("/") || decoded.includes("\\")) {
      throw usageError(`Invalid --base value ${JSON.stringify(value)}: dot and encoded separator segments are not allowed.`);
    }
  }

  return normalized;
}

function normalizeExclusions(values = []) {
  return values.map((value) => {
    if (value.trim() === "") {
      throw usageError("Invalid --exclude value: patterns must not be empty.");
    }
    return value;
  });
}

function normalizeHost(value = "localhost") {
  if (value.trim() === "" || /[\s/?#]/u.test(value)) {
    throw usageError(`Invalid --host value ${JSON.stringify(value)}: expected a hostname or IP address.`);
  }
  return value;
}

function normalizePort(value = "4321") {
  if (!/^\d+$/u.test(value)) {
    throw usageError(`Invalid --port value ${JSON.stringify(value)}: expected an integer from 1 to 65535.`);
  }
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw usageError(`Invalid --port value ${JSON.stringify(value)}: expected an integer from 1 to 65535.`);
  }
  return port;
}

/**
 * Parse public generator arguments without inspecting or modifying the file system.
 * Paths are resolved from the caller's working directory, not the generator checkout.
 */
export function parseGeneratorInputs(argv, { cwd = process.cwd() } = {}) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      tokens: true,
      options: {
        vault: { type: "string" },
        output: { type: "string" },
        site: { type: "string" },
        base: { type: "string" },
        exclude: { type: "string", multiple: true },
        "strict-links": { type: "boolean" },
        host: { type: "string" },
        port: { type: "string" },
      },
    });
  } catch (cause) {
    throw usageError(`Invalid arguments: ${cause.message}`, cause);
  }

  const [command, ...extraPositionals] = parsed.positionals;
  if (!COMMANDS.has(command)) {
    throw usageError(
      command === undefined
        ? "Missing command: expected build or preview."
        : `Unknown command ${JSON.stringify(command)}: expected build or preview.`,
    );
  }
  if (extraPositionals.length > 0) {
    throw usageError(`Unexpected positional argument ${JSON.stringify(extraPositionals[0])}.`);
  }

  const seen = new Set();
  for (const token of parsed.tokens) {
    if (token.kind !== "option" || !SINGLE_OPTIONS.has(token.name)) continue;
    if (seen.has(token.name)) {
      throw usageError(`Option --${token.name} may only be specified once.`);
    }
    seen.add(token.name);
  }

  if (command === "build" && (parsed.values.host !== undefined || parsed.values.port !== undefined)) {
    throw usageError("Options --host and --port are only valid for the preview command.");
  }

  const common = {
    command,
    vault: path.resolve(cwd, parsed.values.vault ?? "vault"),
    output: path.resolve(cwd, parsed.values.output ?? "dist"),
    site: normalizeSite(parsed.values.site),
    base: normalizeBase(parsed.values.base),
    exclusions: normalizeExclusions(parsed.values.exclude),
    strictLinks: parsed.values["strict-links"] ?? false,
  };

  if (command === "build") return common;
  return {
    ...common,
    host: normalizeHost(parsed.values.host),
    port: normalizePort(parsed.values.port),
  };
}
