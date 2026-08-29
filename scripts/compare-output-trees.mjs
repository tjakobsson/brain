#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const directories = args.map((directory) => path.resolve(directory));
if (directories.length < 2) {
  console.error("Usage: compare-output-trees.mjs <directory> <directory> [...]");
  process.exit(2);
}

function digest(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function inventory(directory) {
  const entries = fs
    .readdirSync(directory, { recursive: true, encoding: "utf8" })
    .filter((entry) => fs.statSync(path.join(directory, entry)).isFile())
    .sort();
  return entries.map((entry) => ({
    path: entry,
    sha256: digest(fs.readFileSync(path.join(directory, entry))),
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
