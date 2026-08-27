import fs from "node:fs";
import path from "node:path";

export interface VaultManifestEntry {
  path: string;
  absolutePath: string;
  realPath: string;
  kind: "markdown" | "file";
}

export interface VaultManifest {
  root: string;
  entries: VaultManifestEntry[];
}

export interface VaultManifestOptions {
  vaultDir: string;
  outputDir: string;
  exclusions?: readonly string[];
}

function within(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`))
  );
}

function posixRelative(root: string, candidate: string): string {
  return path.relative(root, candidate).split(path.sep).join("/");
}

function prospectiveRealPath(candidate: string): string {
  const missing: string[] = [];
  let current = candidate;
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) return candidate;
    missing.push(path.basename(current));
    current = parent;
  }
  return path.join(fs.realpathSync(current), ...missing.reverse());
}

function defaultExcluded(relative: string): boolean {
  const segments = relative.split("/");
  return segments.some(
    (segment) => segment.startsWith(".") || segment === ".obsidian" || segment === ".github",
  ) || segments.slice(0, -1).includes("Templates");
}

function patternExcluded(relative: string, patterns: readonly string[], directory: boolean): boolean {
  return patterns.some(
    (pattern) =>
      path.posix.matchesGlob(relative, pattern) ||
      (directory && path.posix.matchesGlob(`${relative}/`, pattern)),
  );
}

export function createVaultManifest(options: VaultManifestOptions): VaultManifest {
  const root = fs.realpathSync(options.vaultDir);
  const output = prospectiveRealPath(path.resolve(options.outputDir));
  const exclusions = options.exclusions ?? [];
  const entries: VaultManifestEntry[] = [];

  function excluded(logicalPath: string, realPath: string, directory: boolean): boolean {
    const logicalRelative = posixRelative(root, logicalPath);
    const realRelative = posixRelative(root, realPath);
    if (defaultExcluded(logicalRelative) || defaultExcluded(realRelative)) return true;
    if (
      patternExcluded(logicalRelative, exclusions, directory) ||
      patternExcluded(realRelative, exclusions, directory)
    ) {
      return true;
    }
    return within(output, logicalPath) || within(output, realPath);
  }

  function walk(logicalDirectory: string, ancestors: Set<string>): void {
    const names = fs.readdirSync(logicalDirectory).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    for (const name of names) {
      const logicalPath = path.join(logicalDirectory, name);
      const logicalRelative = posixRelative(root, logicalPath);
      if (defaultExcluded(logicalRelative)) continue;

      let realPath: string;
      let stat: fs.Stats;
      try {
        realPath = fs.realpathSync(logicalPath);
        if (!within(root, realPath)) continue;
        stat = fs.statSync(realPath);
      } catch {
        continue;
      }

      if (excluded(logicalPath, realPath, stat.isDirectory())) continue;
      if (stat.isDirectory()) {
        if (ancestors.has(realPath)) continue;
        walk(logicalPath, new Set([...ancestors, realPath]));
      } else if (stat.isFile()) {
        entries.push({
          path: logicalRelative,
          absolutePath: logicalPath,
          realPath,
          kind: path.extname(name).toLowerCase() === ".md" ? "markdown" : "file",
        });
      }
    }
  }

  walk(root, new Set([root]));
  entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { root, entries };
}
