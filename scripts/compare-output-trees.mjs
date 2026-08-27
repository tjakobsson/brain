#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const directories = process.argv.slice(2).map((directory) => path.resolve(directory));
if (directories.length < 2) {
  console.error("Usage: compare-output-trees.mjs <directory> <directory> [...]");
  process.exit(2);
}

function inventory(directory) {
  return fs
    .readdirSync(directory, { recursive: true, encoding: "utf8" })
    .filter((entry) => fs.statSync(path.join(directory, entry)).isFile())
    .sort()
    .map((entry) => ({
      path: entry,
      sha256: crypto.createHash("sha256").update(fs.readFileSync(path.join(directory, entry))).digest("hex"),
    }));
}

const expected = inventory(directories[0]);
for (const directory of directories.slice(1)) {
  const actual = inventory(directory);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Generated output differs: ${directories[0]} != ${directory}`);
  }
}

console.log(`Matched ${expected.length} generated files across ${directories.length} build surfaces.`);
