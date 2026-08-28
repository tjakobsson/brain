import fs from "node:fs/promises";
import path from "node:path";
import { loadWorkspaceManifest, WorkspaceValidationError } from "../src/lib/workspace.mjs";

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

function patternExcluded(root, candidate, patterns, directory) {
  const relative = path.relative(root, candidate).split(path.sep).join("/");
  return patterns.some(
    (pattern) =>
      path.posix.matchesGlob(relative, pattern) ||
      (directory && path.posix.matchesGlob(`${relative}/`, pattern)),
  );
}

async function validateBrainRoot(brainPath, { brainId, exclusions = [], vaultMode = false }) {
  let realRoot;
  const label = vaultMode ? "Vault" : `Brain ${JSON.stringify(brainId)}`;
  try {
    realRoot = await fs.realpath(brainPath);
    const stat = await fs.stat(realRoot);
    if (!stat.isDirectory()) {
      throw validationError(`${label} is not a directory: ${brainPath}`);
    }
    await fs.access(realRoot, fs.constants.R_OK);
  } catch (cause) {
    if (cause instanceof GeneratorValidationError) throw cause;
    throw validationError(`${label} is not a readable directory: ${brainPath}`, cause);
  }

  if (!(await hasCandidateMarkdown(realRoot, realRoot, exclusions, label))) {
    throw validationError(`${label} contains no publishable Markdown notes: ${realRoot}`);
  }
  return realRoot;
}

async function hasCandidateMarkdown(root, directory, exclusions, label) {
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (cause) {
    throw validationError(`${label} directory is not readable: ${directory}`, cause);
  }

  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const entryPath = path.join(directory, entry.name);
    if (patternExcluded(root, entryPath, exclusions, entry.isDirectory())) continue;
    if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".md") return true;
    if (
      entry.isDirectory() &&
      !DEFAULT_IGNORED_DIRECTORIES.has(entry.name) &&
      (await hasCandidateMarkdown(root, entryPath, exclusions, label))
    ) {
      return true;
    }
  }
  return false;
}

async function validateVault(vault, exclusions) {
  return validateBrainRoot(vault, { exclusions, vaultMode: true });
}

async function validateWorkspaceManifest(workspace) {
  let realWorkspace;
  try {
    realWorkspace = await fs.realpath(workspace);
    if (!(await fs.stat(realWorkspace)).isFile()) {
      throw validationError(`Workspace manifest is not a file: ${workspace}`);
    }
    await fs.access(realWorkspace, fs.constants.R_OK);
  } catch (cause) {
    if (cause instanceof GeneratorValidationError) throw cause;
    throw validationError(`Workspace manifest is not readable: ${workspace}`, cause);
  }

  try {
    return { path: realWorkspace, definition: loadWorkspaceManifest(realWorkspace) };
  } catch (cause) {
    if (cause instanceof WorkspaceValidationError) throw validationError(cause.message, cause);
    throw cause;
  }
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

async function validateWork(work) {
  if (work === undefined) return undefined;
  let entry;
  try {
    entry = await fs.lstat(work);
  } catch (cause) {
    if (cause.code !== "ENOENT") throw validationError(`Cannot inspect work directory: ${work}`, cause);
  }
  if (entry) {
    try {
      const realWork = await fs.realpath(work);
      if (!(await fs.stat(realWork)).isDirectory()) {
        throw validationError(`Work path is not a directory: ${work}`);
      }
      await fs.access(realWork, fs.constants.W_OK);
      return realWork;
    } catch (cause) {
      if (cause instanceof GeneratorValidationError) throw cause;
      throw validationError(`Work directory is not writable: ${work}`, cause);
    }
  }

  const missing = [path.basename(work)];
  let ancestor = path.dirname(work);
  while (true) {
    try {
      await fs.lstat(ancestor);
      const realAncestor = await fs.realpath(ancestor);
      if (!(await fs.stat(realAncestor)).isDirectory()) {
        throw validationError(`Work ancestor is not a directory: ${ancestor}`);
      }
      await fs.access(realAncestor, fs.constants.W_OK);
      return path.join(realAncestor, ...missing.reverse());
    } catch (cause) {
      if (cause instanceof GeneratorValidationError) throw cause;
      if (cause.code !== "ENOENT") {
        throw validationError(`Work parent is not writable: ${ancestor}`, cause);
      }
    }
    const parent = path.dirname(ancestor);
    if (parent === ancestor) throw validationError(`Work parent does not exist or is not writable: ${work}`);
    missing.push(path.basename(ancestor));
    ancestor = parent;
  }
}

function rejectDirectoryOverlap(candidate, kind, input, description) {
  if (pathsOverlap(candidate, input) || pathsOverlap(input, candidate)) {
    throw validationError(`Unsafe ${kind} path ${candidate}: ${kind} must not overlap ${description} ${input}.`);
  }
}

function rejectFileOverlap(candidate, kind, input, description) {
  if (pathsOverlap(candidate, input)) {
    throw validationError(`Unsafe ${kind} path ${candidate}: ${kind} must not contain ${description} ${input}.`);
  }
}

/**
 * Validate and canonicalize generator paths without creating, deleting, or writing files.
 */
export async function validateGeneratorInputs(inputs) {
  const output = await validateOutput(inputs.output);
  const work = await validateWork(inputs.work);
  const mode = inputs.mode ?? (inputs.workspace ? "workspace" : "vault");
  if (mode !== "vault" && mode !== "workspace") {
    throw validationError(`Invalid generator input mode ${JSON.stringify(mode)}.`);
  }
  if (inputs.vault && inputs.workspace) {
    throw validationError("Vault and workspace inputs are mutually exclusive.");
  }

  if (mode === "workspace") {
    if (!inputs.workspace) throw validationError("Workspace mode requires a workspace manifest.");
    const workspace = await validateWorkspaceManifest(inputs.workspace);
    const brains = [];
    const byRoot = new Map();
    for (const brain of workspace.definition.brains) {
      const root = await validateBrainRoot(brain.path, {
        brainId: brain.id,
        exclusions: [...brain.effectiveExclusions, ...(inputs.exclusions ?? [])],
      });
      const existing = byRoot.get(root);
      if (existing !== undefined) {
        throw validationError(
          `Brains ${JSON.stringify(existing)} and ${JSON.stringify(brain.id)} resolve to the same source directory: ${root}`,
        );
      }
      byRoot.set(root, brain.id);
      brains.push({ ...brain, path: root });
    }

    rejectFileOverlap(output, "output", workspace.path, "workspace manifest");
    if (work) rejectFileOverlap(work, "work directory", workspace.path, "workspace manifest");
    for (const brain of brains) {
      rejectDirectoryOverlap(output, "output", brain.path, `brain ${JSON.stringify(brain.id)}`);
      if (work) rejectDirectoryOverlap(work, "work directory", brain.path, `brain ${JSON.stringify(brain.id)}`);
    }

    return {
      ...inputs,
      mode,
      workspace: workspace.path,
      workspaceDefinition: { ...workspace.definition, manifestPath: workspace.path, brains },
      output,
      work,
    };
  }

  if (!inputs.vault) throw validationError("Vault mode requires a vault directory.");
  const vault = await validateVault(inputs.vault, inputs.exclusions ?? []);

  if (pathsOverlap(output, vault)) {
    throw validationError(`Unsafe output path ${output}: output must not be the vault or one of its ancestors.`);
  }
  if (pathsOverlap(vault, output)) {
    throw validationError(`Unsafe output path ${output}: output must be outside the read-only vault ${vault}.`);
  }
  if (work && (pathsOverlap(work, vault) || pathsOverlap(vault, work))) {
    throw validationError(`Unsafe work directory ${work}: work must be outside the read-only vault ${vault}.`);
  }

  return { ...inputs, mode, vault, output, work };
}
