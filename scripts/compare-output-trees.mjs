#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const args = process.argv.slice(2);
const normalizePagefind = args[0] === "--normalize-pagefind";
if (normalizePagefind) args.shift();
const directories = args.map((directory) => path.resolve(directory));
if (directories.length < 2) {
  console.error("Usage: compare-output-trees.mjs [--normalize-pagefind] <directory> <directory> [...]");
  process.exit(2);
}

function digest(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function cborLength(buffer, offset, additional) {
  if (additional < 24) return [additional, offset];
  const sizes = new Map([[24, 1], [25, 2], [26, 4], [27, 8]]);
  const size = sizes.get(additional);
  if (!size) throw new Error(`Unsupported Pagefind CBOR length at byte ${offset - 1}.`);
  const value = size === 8 ? Number(buffer.readBigUInt64BE(offset)) : buffer.readUIntBE(offset, size);
  return [value, offset + size];
}

function decodeCbor(buffer, start = 0) {
  const initial = buffer[start];
  const major = initial >> 5;
  const additional = initial & 0x1f;
  let [length, offset] = cborLength(buffer, start + 1, additional);
  if (major === 0) return [length, offset];
  if (major === 1) return [-1 - length, offset];
  if (major === 2) return [{ bytes: buffer.subarray(offset, offset + length).toString("hex") }, offset + length];
  if (major === 3) return [buffer.subarray(offset, offset + length).toString("utf8"), offset + length];
  if (major === 4 || major === 5) {
    const values = [];
    const count = major === 5 ? length * 2 : length;
    for (let index = 0; index < count; index += 1) {
      const [value, next] = decodeCbor(buffer, offset);
      values.push(value);
      offset = next;
    }
    if (major === 5) {
      return [Array.from({ length }, (_, index) => [values[index * 2], values[index * 2 + 1]]), offset];
    }
    return [values, offset];
  }
  if (major === 7 && additional === 20) return [false, offset];
  if (major === 7 && additional === 21) return [true, offset];
  if (major === 7 && (additional === 22 || additional === 23)) return [null, offset];
  throw new Error(`Unsupported Pagefind CBOR value at byte ${start}.`);
}

function canonicalValue(value) {
  if (!Array.isArray(value)) return value;
  const values = value.map(canonicalValue);
  if (values.every((entry) => Array.isArray(entry) && typeof entry[0] === "string")) {
    values.sort((left, right) => left[0].localeCompare(right[0]));
  }
  return values;
}

function canonicalFilter(file) {
  const contents = zlib.gunzipSync(fs.readFileSync(file));
  const prefix = Buffer.from("pagefind_dcd");
  if (!contents.subarray(0, prefix.length).equals(prefix)) {
    throw new Error(`Unsupported Pagefind filter format: ${file}`);
  }
  const [value, offset] = decodeCbor(contents.subarray(prefix.length));
  if (offset !== contents.length - prefix.length) {
    throw new Error(`Trailing Pagefind filter data: ${file}`);
  }
  return JSON.stringify(canonicalValue(value));
}

function replaceSameLength(buffer, source, replacement) {
  if (source.length !== replacement.length) throw new Error("Pagefind hash replacement changed length.");
  const result = Buffer.from(buffer);
  let offset = 0;
  while ((offset = result.indexOf(source, offset)) !== -1) {
    result.write(replacement, offset, source.length, "ascii");
    offset += source.length;
  }
  return result;
}

function inventory(directory) {
  const entries = fs
    .readdirSync(directory, { recursive: true, encoding: "utf8" })
    .filter((entry) => fs.statSync(path.join(directory, entry)).isFile())
    .sort();
  if (!normalizePagefind) {
    return entries.map((entry) => ({
      path: entry,
      sha256: digest(fs.readFileSync(path.join(directory, entry))),
    }));
  }

  const filterPattern = /^pagefind\/filter\/(.+)_[a-f0-9]+\.pf_filter$/u;
  const metadataPattern = /^pagefind\/pagefind\.(.+)_[a-f0-9]+\.pf_meta$/u;
  const filterReplacements = new Map();
  const normalized = [];

  for (const entry of entries) {
    const match = entry.match(filterPattern);
    if (!match) continue;
    const file = path.join(directory, entry);
    const canonical = canonicalFilter(file);
    const originalStem = path.basename(entry, ".pf_filter");
    const replacementStem = `${match[1]}_${digest(canonical).slice(0, 7)}`;
    filterReplacements.set(originalStem, replacementStem);
    normalized.push({ path: `pagefind/filter/${match[1]}.pf_filter`, sha256: digest(canonical) });
  }

  const metadataReplacements = new Map();
  for (const entry of entries) {
    const match = entry.match(metadataPattern);
    if (!match) continue;
    let contents = zlib.gunzipSync(fs.readFileSync(path.join(directory, entry)));
    for (const [source, replacement] of filterReplacements) {
      contents = replaceSameLength(contents, source, replacement);
    }
    const hash = digest(contents);
    metadataReplacements.set(match[1], `${match[1]}_${hash.slice(0, 10)}`);
    normalized.push({ path: `pagefind/pagefind.${match[1]}.pf_meta`, sha256: hash });
  }

  for (const entry of entries) {
    if (filterPattern.test(entry) || metadataPattern.test(entry)) continue;
    const file = path.join(directory, entry);
    if (entry === "pagefind/pagefind-entry.json") {
      const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
      for (const [language, replacement] of metadataReplacements) {
        if (manifest.languages[language]) manifest.languages[language].hash = replacement;
      }
      normalized.push({ path: entry, sha256: digest(JSON.stringify(manifest)) });
    } else {
      normalized.push({ path: entry, sha256: digest(fs.readFileSync(file)) });
    }
  }
  return normalized.sort((left, right) => left.path.localeCompare(right.path));
}

const expected = inventory(directories[0]);
for (const directory of directories.slice(1)) {
  const actual = inventory(directory);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Generated output differs: ${directories[0]} != ${directory}`);
  }
}

console.log(`Matched ${expected.length} generated files across ${directories.length} build surfaces.`);
