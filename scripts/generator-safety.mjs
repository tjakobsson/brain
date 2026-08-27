import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_IGNORED_DIRECTORIES = new Set([".obsidian", ".github", "Templates"]);

export class GeneratorValidationError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "GeneratorValidationError";
  }
}

function validationError(message, cause) {
  return new GeneratorValidationError(message, cause ? { cause } : undefined);
}

function pathsOverlap(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

async function validateVault(vault) {
  let realVault;
  try {
    realVault = await fs.realpath(vault);
    const stat = await fs.stat(realVault);
    if (!stat.isDirectory()) {
      throw validationError(`Vault is not a directory: ${vault}`);
    }
    await fs.access(realVault, fs.constants.R_OK);
  } catch (cause) {
    if (cause instanceof GeneratorValidationError) throw cause;
    throw validationError(`Vault is not a readable directory: ${vault}`, cause);
  }

  if (!(await hasCandidateMarkdown(realVault))) {
    throw validationError(`Vault contains no publishable Markdown notes: ${realVault}`);
  }
  return realVault;
}

async function hasCandidateMarkdown(directory) {
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (cause) {
    throw validationError(`Vault directory is not readable: ${directory}`, cause);
  }

  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const entryPath = path.join(directory, entry.name);
    if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".md") return true;
    if (
      entry.isDirectory() &&
      !DEFAULT_IGNORED_DIRECTORIES.has(entry.name) &&
      (await hasCandidateMarkdown(entryPath))
    ) {
      return true;
    }
  }
  return false;
}

async function validateOutput(output) {
  let outputEntry;
  try {
    outputEntry = await fs.lstat(output);
  } catch (cause) {
    if (cause.code !== "ENOENT") {
      throw validationError(`Cannot inspect output path: ${output}`, cause);
    }
  }

  if (outputEntry) {
    let realOutput;
    try {
      realOutput = await fs.realpath(output);
      if (!(await fs.stat(realOutput)).isDirectory()) {
        throw validationError(`Output path is not a directory: ${output}`);
      }
      await fs.access(realOutput, fs.constants.W_OK);
      await fs.access(path.dirname(realOutput), fs.constants.W_OK);
    } catch (cause) {
      if (cause instanceof GeneratorValidationError) throw cause;
      throw validationError(`Output directory is not writable: ${output}`, cause);
    }
    return realOutput;
  }

  const missingSegments = [path.basename(output)];
  let ancestor = path.dirname(output);
  while (true) {
    try {
      await fs.lstat(ancestor);
      const realAncestor = await fs.realpath(ancestor);
      if (!(await fs.stat(realAncestor)).isDirectory()) {
        throw validationError(`Output ancestor is not a directory: ${ancestor}`);
      }
      await fs.access(realAncestor, fs.constants.W_OK);
      return path.join(realAncestor, ...missingSegments.reverse());
    } catch (cause) {
      if (cause instanceof GeneratorValidationError) throw cause;
      if (cause.code !== "ENOENT") {
        throw validationError(`Output parent is not writable: ${ancestor}`, cause);
      }
    }

    const parent = path.dirname(ancestor);
    if (parent === ancestor) {
      throw validationError(`Output parent does not exist or is not writable: ${output}`);
    }
    missingSegments.push(path.basename(ancestor));
    ancestor = parent;
  }
}

/**
 * Validate and canonicalize generator paths without creating, deleting, or writing files.
 */
export async function validateGeneratorInputs(inputs) {
  const vault = await validateVault(inputs.vault);
  const output = await validateOutput(inputs.output);

  if (pathsOverlap(output, vault)) {
    throw validationError(`Unsafe output path ${output}: output must not be the vault or one of its ancestors.`);
  }
  if (pathsOverlap(vault, output)) {
    throw validationError(`Unsafe output path ${output}: output must be outside the read-only vault ${vault}.`);
  }

  return { ...inputs, vault, output };
}
