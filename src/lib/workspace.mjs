import fs from "node:fs";
import path from "node:path";

export const WORKSPACE_VERSION = 1;

// Brain labels and markers accompany these colors so identity never depends on hue alone.
export const DEFAULT_BRAIN_ACCENTS = Object.freeze([
  "#5b4bc4",
  "#b13f67",
  "#087f5b",
  "#9c4d10",
  "#1769aa",
  "#7b3fb2",
  "#a23b32",
  "#3f6f8f",
]);

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const ACCENT_PATTERN = /^#[0-9a-f]{6}$/iu;

export class WorkspaceValidationError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "WorkspaceValidationError";
  }
}

function fail(manifestPath, message, cause) {
  throw new WorkspaceValidationError(`Invalid workspace ${manifestPath}: ${message}`, cause ? { cause } : undefined);
}

function objectAt(value, location, manifestPath) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(manifestPath, `${location} must be an object.`);
  }
  return value;
}

function onlyKeys(value, keys, location, manifestPath) {
  const unknown = Object.keys(value).find((key) => !keys.has(key));
  if (unknown !== undefined) fail(manifestPath, `${location} contains unknown property ${JSON.stringify(unknown)}.`);
}

function requiredString(value, location, manifestPath) {
  if (typeof value !== "string" || value.trim() === "") {
    fail(manifestPath, `${location} must be a non-empty string.`);
  }
  return value;
}

function optionalString(value, location, manifestPath) {
  if (value === undefined) return undefined;
  return requiredString(value, location, manifestPath);
}

function id(value, location, manifestPath) {
  const result = requiredString(value, location, manifestPath);
  if (!ID_PATTERN.test(result)) {
    fail(manifestPath, `${location} must use lower-case kebab-case.`);
  }
  return result;
}

function exclusions(value, location, manifestPath) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((pattern) => typeof pattern !== "string" || pattern.trim() === "")) {
    fail(manifestPath, `${location} must be an array of non-empty strings.`);
  }
  return [...value];
}

function defaultAccent(brainId) {
  let hash = 2166136261;
  for (const character of brainId) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return DEFAULT_BRAIN_ACCENTS[(hash >>> 0) % DEFAULT_BRAIN_ACCENTS.length];
}

function parseGroups(value, manifestPath) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail(manifestPath, "groups must be an array.");

  const groups = value.map((candidate, index) => {
    const location = `groups[${index}]`;
    const group = objectAt(candidate, location, manifestPath);
    onlyKeys(group, new Set(["id", "title", "parent"]), location, manifestPath);
    return {
      id: id(group.id, `${location}.id`, manifestPath),
      title: requiredString(group.title, `${location}.title`, manifestPath),
      parent: group.parent === undefined ? undefined : id(group.parent, `${location}.parent`, manifestPath),
    };
  });

  const byId = new Map();
  for (const [index, group] of groups.entries()) {
    const previous = byId.get(group.id);
    if (previous !== undefined) {
      fail(manifestPath, `duplicate group ID ${JSON.stringify(group.id)} at groups[${previous}] and groups[${index}].`);
    }
    byId.set(group.id, index);
  }

  for (const [index, group] of groups.entries()) {
    if (group.parent !== undefined && !byId.has(group.parent)) {
      fail(manifestPath, `groups[${index}] (${group.id}) references missing parent ${JSON.stringify(group.parent)}.`);
    }
  }

  const complete = new Set();
  for (const group of groups) {
    if (complete.has(group.id)) continue;
    const chain = [];
    const positions = new Map();
    let current = group;
    while (current !== undefined && !complete.has(current.id)) {
      const cycleStart = positions.get(current.id);
      if (cycleStart !== undefined) {
        const cycle = [...chain.slice(cycleStart), current.id].join(" -> ");
        fail(manifestPath, `group hierarchy contains a cycle: ${cycle}.`);
      }
      positions.set(current.id, chain.length);
      chain.push(current.id);
      current = current.parent === undefined ? undefined : groups[byId.get(current.parent)];
    }
    chain.forEach((groupId) => complete.add(groupId));
  }

  return groups;
}

function parseBrains(value, groups, globalExclusions, directory, manifestPath) {
  if (!Array.isArray(value) || value.length === 0) {
    fail(manifestPath, "brains must be a non-empty array.");
  }
  const groupIds = new Set(groups.map((group) => group.id));
  const brains = value.map((candidate, index) => {
    const location = `brains[${index}]`;
    const brain = objectAt(candidate, location, manifestPath);
    onlyKeys(
      brain,
      new Set(["id", "title", "path", "group", "description", "accent", "exclusions"]),
      location,
      manifestPath,
    );
    const brainId = id(brain.id, `${location}.id`, manifestPath);
    const group = brain.group === undefined ? undefined : id(brain.group, `${location}.group`, manifestPath);
    if (group !== undefined && !groupIds.has(group)) {
      fail(manifestPath, `${location} (${brainId}) references missing group ${JSON.stringify(group)}.`);
    }
    if (brain.accent !== undefined && (typeof brain.accent !== "string" || !ACCENT_PATTERN.test(brain.accent))) {
      fail(manifestPath, `${location}.accent must be a six-digit hexadecimal color such as #5b4bc4.`);
    }
    const localExclusions = exclusions(brain.exclusions, `${location}.exclusions`, manifestPath);
    const sourcePath = requiredString(brain.path, `${location}.path`, manifestPath);
    return {
      id: brainId,
      title: requiredString(brain.title, `${location}.title`, manifestPath),
      path: path.resolve(directory, sourcePath),
      configuredPath: sourcePath,
      group,
      description: optionalString(brain.description, `${location}.description`, manifestPath),
      accent: brain.accent?.toLowerCase() ?? defaultAccent(brainId),
      exclusions: localExclusions,
      effectiveExclusions: [...globalExclusions, ...localExclusions],
    };
  });

  const byId = new Map();
  for (const [index, brain] of brains.entries()) {
    const previous = byId.get(brain.id);
    if (previous !== undefined) {
      fail(manifestPath, `duplicate brain ID ${JSON.stringify(brain.id)} at brains[${previous}] and brains[${index}].`);
    }
    byId.set(brain.id, index);
  }
  return brains;
}

/** Parse and validate workspace JSON without accessing its brain directories. */
export function parseWorkspaceManifest(source, manifestPath = "workspace.json") {
  const resolvedManifest = path.resolve(manifestPath);
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch (cause) {
    fail(resolvedManifest, `malformed JSON (${cause.message}).`, cause);
  }

  const workspace = objectAt(parsed, "workspace", resolvedManifest);
  onlyKeys(workspace, new Set(["version", "title", "description", "exclusions", "groups", "brains"]), "workspace", resolvedManifest);
  if (workspace.version !== WORKSPACE_VERSION) {
    fail(
      resolvedManifest,
      `unsupported version ${JSON.stringify(workspace.version)}; supported version is ${WORKSPACE_VERSION}.`,
    );
  }
  const globalExclusions = exclusions(workspace.exclusions, "exclusions", resolvedManifest);
  const groups = parseGroups(workspace.groups, resolvedManifest);
  return {
    version: WORKSPACE_VERSION,
    title: requiredString(workspace.title, "title", resolvedManifest),
    description: optionalString(workspace.description, "description", resolvedManifest),
    exclusions: globalExclusions,
    groups,
    brains: parseBrains(workspace.brains, groups, globalExclusions, path.dirname(resolvedManifest), resolvedManifest),
    manifestPath: resolvedManifest,
  };
}

export function loadWorkspaceManifest(manifestPath) {
  const resolvedManifest = path.resolve(manifestPath);
  let source;
  try {
    source = fs.readFileSync(resolvedManifest, "utf8");
  } catch (cause) {
    throw new WorkspaceValidationError(`Workspace manifest is not readable: ${resolvedManifest}`, { cause });
  }
  return parseWorkspaceManifest(source, resolvedManifest);
}
