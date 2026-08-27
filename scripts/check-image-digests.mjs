#!/usr/bin/env node
import fs from "node:fs";

const files = process.argv.slice(2);
if (files.length < 2) {
  console.error("Usage: check-image-digests.mjs <automation-file> <automation-file> [...]");
  process.exit(2);
}

const imagePattern = /ghcr\.io\/tjakobsson\/brain@(sha256:[a-f0-9]{64})/gu;
const references = files.map((file) => {
  const matches = [...fs.readFileSync(file, "utf8").matchAll(imagePattern)].map((match) => match[1]);
  if (matches.length !== 1) {
    throw new Error(`${file} must contain exactly one immutable generator image reference.`);
  }
  return { file, digest: matches[0] };
});

const expected = references[0].digest;
const divergent = references.filter((reference) => reference.digest !== expected);
if (divergent.length > 0) {
  throw new Error(
    `Generator image digest mismatch:\n${references.map(({ file, digest }) => `  ${file}: ${digest}`).join("\n")}`,
  );
}

console.log(`Generator automation surfaces agree on ${expected}.`);
