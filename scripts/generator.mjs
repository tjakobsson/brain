#!/usr/bin/env node
import { spawn } from "node:child_process";
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
import { serveLiveSite } from "./live-server.mjs";
import { serveStaticSite } from "./static-server.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;

export function runNode(script, args, env, { signal, stdio = "inherit" } = {}) {
  return new Promise((resolve, reject) => {
    const detached = process.platform !== "win32";
    const child = spawn(process.execPath, [script, ...args], {
      cwd: root,
      detached,
      env,
      stdio,
    });
    let aborted = false;

    const terminate = () => {
      aborted = true;
      if (child.pid === undefined) return;
      try {
        if (detached) process.kill(-child.pid, "SIGTERM");
        else child.kill("SIGTERM");
      } catch (error) {
        if (error.code !== "ESRCH") reject(error);
      }
    };
    const cleanup = () => signal?.removeEventListener("abort", terminate);

    if (signal?.aborted) terminate();
    else signal?.addEventListener("abort", terminate, { once: true });
    child.once("error", (error) => {
      cleanup();
      reject(error);
    });
    child.once("exit", (code, childSignal) => {
      cleanup();
      if (aborted) {
        reject(new Error("Generator stage aborted."));
      } else if (code !== 0) {
        reject(
          new Error(
            childSignal
              ? `Generator stage terminated by ${childSignal}.`
              : `Generator stage failed with exit code ${code ?? 1}.`,
          ),
        );
      } else {
        resolve();
      }
    });
  });
}

function internalEnvironment(inputs, staging) {
  return {
    ...process.env,
    BRAIN_INPUT_MODE: inputs.mode,
    BRAIN_VAULT: inputs.mode === "vault" ? inputs.vault : "",
    BRAIN_WORKSPACE: inputs.mode === "workspace" ? inputs.workspace : "",
    BRAIN_OUTPUT: staging,
    BRAIN_SITE: inputs.site ?? "",
    BRAIN_BASE: inputs.base,
    BRAIN_EXCLUSIONS: JSON.stringify(inputs.exclusions),
    BRAIN_STRICT_LINKS: String(inputs.strictLinks),
    BRAIN_WORK: inputs.work ?? "",
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

function prepareWork(validated) {
  const work = validated.work;
  if (work) {
    fs.mkdirSync(path.join(work, "astro-types"), { recursive: true });
    const workModules = path.join(work, "node_modules");
    if (!fs.existsSync(workModules)) fs.symlinkSync(path.join(root, "node_modules"), workModules, "dir");
    if (fs.realpathSync(workModules) !== path.join(root, "node_modules")) {
      throw new Error(`Work directory contains an unsafe node_modules entry: ${workModules}`);
    }
  }
  return work;
}

async function generateSite(validated, destination, { signal } = {}) {
  const env = internalEnvironment(validated, destination);
  try {
    await runNode(path.join(root, "node_modules", "astro", "bin", "astro.mjs"), ["build"], env, {
      signal,
    });
    if (process.env.BRAIN_TEST_FAIL_AFTER_BUILD === "true") {
      throw new Error("Forced late-stage failure.");
    }
  } catch (error) {
    fs.rmSync(destination, { recursive: true, force: true });
    throw error;
  }
}

export async function buildSite(inputs, { signal } = {}) {
  const configuredWork = process.env.BRAIN_WORK?.trim();
  const validated = await validateGeneratorInputs({
    ...inputs,
    work: configuredWork ? path.resolve(configuredWork) : undefined,
  });
  const work = prepareWork(validated);
  const buildId = randomUUID();
  const staging = path.join(
    work || path.dirname(validated.output),
    `.${path.basename(validated.output)}.staging-${buildId}`,
  );
  const promotionStaging = work
    ? path.join(path.dirname(validated.output), `.${path.basename(validated.output)}.staging-${buildId}`)
    : staging;

  try {
    await generateSite(validated, staging, { signal });
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

export async function buildLiveGeneration(inputs, { signal } = {}) {
  const configuredWork = process.env.BRAIN_WORK?.trim();
  const validated = await validateGeneratorInputs({
    ...inputs,
    work: configuredWork ? path.resolve(configuredWork) : undefined,
  });
  const work = prepareWork(validated);
  const generation = path.join(
    work || path.dirname(validated.output),
    `.${path.basename(validated.output)}.generation-${randomUUID()}`,
  );
  await generateSite(validated, generation, { signal });
  return { output: generation, validated };
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 1 && (argv[0] === "--version" || argv[0] === "-V")) {
    console.log(version);
    return;
  }
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(GENERATOR_USAGE);
    return;
  }
  const inputs = parseGeneratorInputs(argv);
  if (inputs.command === "serve") {
    const controller = new AbortController();
    const stop = () => controller.abort();
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    try {
      await serveLiveSite({
        inputs,
        signal: controller.signal,
        buildGeneration: (signal) => buildLiveGeneration(inputs, { signal }),
      });
    } finally {
      process.removeListener("SIGINT", stop);
      process.removeListener("SIGTERM", stop);
    }
    return;
  }
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
