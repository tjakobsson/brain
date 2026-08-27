#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  GENERATOR_USAGE,
  GeneratorUsageError,
  parseGeneratorInputs,
} from "./generator-inputs.mjs";
import { GeneratorValidationError, validateGeneratorInputs } from "./generator-safety.mjs";
import { serveStaticSite } from "./static-server.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function runNode(script, args, env) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    env,
    stdio: "inherit",
  });
  if (result.status !== 0) throw new Error(`Generator stage failed with exit code ${result.status ?? 1}.`);
}

function internalEnvironment(inputs, staging) {
  return {
    ...process.env,
    BRAIN_MANUAL_VAULT: inputs.vault,
    BRAIN_MANUAL_OUTPUT: staging,
    BRAIN_MANUAL_SITE: inputs.site ?? "",
    BRAIN_MANUAL_BASE: inputs.base,
    BRAIN_MANUAL_EXCLUSIONS: JSON.stringify(inputs.exclusions),
    BRAIN_MANUAL_STRICT_LINKS: String(inputs.strictLinks),
  };
}

function promote(staging, output) {
  const backup = `${output}.backup-${randomUUID()}`;
  const hadOutput = fs.existsSync(output);
  if (hadOutput) fs.renameSync(output, backup);
  try {
    fs.renameSync(staging, output);
    if (hadOutput) fs.rmSync(backup, { recursive: true, force: true });
  } catch (error) {
    if (hadOutput && fs.existsSync(backup) && !fs.existsSync(output)) fs.renameSync(backup, output);
    throw error;
  }
}

export async function buildSite(inputs) {
  const validated = await validateGeneratorInputs(inputs);
  const work = process.env.BRAIN_MANUAL_WORK?.trim();
  if (work) {
    fs.mkdirSync(path.join(work, "astro-types"), { recursive: true });
    const workModules = path.join(work, "node_modules");
    if (!fs.existsSync(workModules)) fs.symlinkSync(path.join(root, "node_modules"), workModules, "dir");
    if (fs.realpathSync(workModules) !== path.join(root, "node_modules")) {
      throw new Error(`Work directory contains an unsafe node_modules entry: ${workModules}`);
    }
  }
  const buildId = randomUUID();
  const staging = path.join(
    work || path.dirname(validated.output),
    `.${path.basename(validated.output)}.staging-${buildId}`,
  );
  const promotionStaging = work
    ? path.join(path.dirname(validated.output), `.${path.basename(validated.output)}.staging-${buildId}`)
    : staging;
  const env = internalEnvironment(validated, staging);

  try {
    runNode(path.join(root, "node_modules", "astro", "bin", "astro.mjs"), ["build"], env);
    runNode(path.join(root, "node_modules", "pagefind", "lib", "runner", "bin.cjs"), [
      "--site",
      staging,
    ], env);
    for (const name of fs.readdirSync(path.join(staging, "pagefind"))) {
      if (!/^wasm\..+\.pagefind$/u.test(name)) continue;
      const file = path.join(staging, "pagefind", name);
      const gzip = fs.readFileSync(file);
      if (gzip[0] !== 0x1f || gzip[1] !== 0x8b) throw new Error(`Invalid Pagefind WASM: ${file}`);
      gzip.fill(0, 4, 8); // Architecture packages carry different gzip timestamps.
      fs.writeFileSync(file, gzip);
    }
    if (process.env.BRAIN_MANUAL_TEST_FAIL_AFTER_PAGEFIND === "true") {
      throw new Error("Forced late-stage failure.");
    }
    if (work) {
      // Node's native directory copy fails across some container bind mounts.
      fs.cpSync(staging, promotionStaging, { recursive: true, filter: () => true });
    }
    promote(promotionStaging, validated.output);
    console.log(`Generated site: ${validated.output}`);
    return validated;
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
    if (promotionStaging !== staging) {
      fs.rmSync(promotionStaging, { recursive: true, force: true });
    }
  }
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(GENERATOR_USAGE);
    return;
  }
  const inputs = parseGeneratorInputs(argv);
  if (inputs.command === "preview") {
    const validated = await buildSite(inputs);
    await serveStaticSite({
      output: validated.output,
      base: validated.base,
      host: validated.host,
      port: validated.port,
    });
    const displayHost = validated.host.includes(":") ? `[${validated.host}]` : validated.host;
    console.log(`Preview server: http://${displayHost}:${validated.port}${validated.base}/`);
    return;
  }
  await buildSite(inputs);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    if (error instanceof GeneratorUsageError || error instanceof GeneratorValidationError) {
      console.error(error.message);
    } else {
      console.error(error instanceof Error ? error.message : String(error));
    }
    process.exitCode = 1;
  });
}
