#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";

const root = path.resolve(import.meta.dirname, "..");
const candidatePath = path.join(root, "release", "candidate.json");
const contractPath = path.join(root, "release", "contract-v1.json");
const automationFiles = [
  "action.yml",
  ".github/workflows/action-parity.yml",
  ".github/workflows/publish-pages.yml",
];
const imagePattern = /ghcr\.io\/tjakobsson\/brain-manual@(sha256:[a-f0-9]{64})/gu;

const flags = new Set(process.argv.slice(2));
const write = flags.delete("--write");
const verifyRemote = flags.delete("--verify-remote");
if (flags.size > 0) {
  console.error(`Unknown release-check option: ${[...flags][0]}`);
  process.exit(2);
}

const candidate = JSON.parse(fs.readFileSync(candidatePath, "utf8"));
if (!/^\d+\.\d+\.\d+$/u.test(candidate.version)) throw new Error("Candidate version must be semantic.");
if (!/^[a-f0-9]{40}$/u.test(candidate.sourceCommit)) throw new Error("Candidate sourceCommit must be a full Git SHA.");
if (!/^sha256:[a-f0-9]{64}$/u.test(candidate.imageDigest)) throw new Error("Candidate imageDigest must be sha256.");

function selectedInterface(metadata, includeType = false) {
  return Object.fromEntries(
    Object.entries(metadata).map(([name, value]) => {
      const selected = { required: value.required ?? false, default: value.default ?? null };
      if (includeType) selected.type = value.type;
      return [name, selected];
    }),
  );
}

const action = parse(fs.readFileSync(path.join(root, "action.yml"), "utf8"));
const pages = parse(fs.readFileSync(path.join(root, ".github/workflows/publish-pages.yml"), "utf8"));
const currentContract = {
  major: Number(candidate.version.split(".")[0]),
  action: {
    inputs: selectedInterface(action.inputs),
    outputs: Object.keys(action.outputs ?? {}).sort(),
  },
  pagesWorkflow: {
    inputs: selectedInterface(pages.on.workflow_call.inputs, true),
    outputs: Object.keys(pages.on.workflow_call.outputs ?? {}).sort(),
  },
};
const releasedContract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
const contractChanged = JSON.stringify(currentContract) !== JSON.stringify(releasedContract);
if (contractChanged && currentContract.major <= releasedContract.major) {
  throw new Error(`Public interfaces changed; version ${candidate.version} must advance beyond major v${releasedContract.major}.`);
}

for (const file of automationFiles) {
  const filePath = path.join(root, file);
  const source = fs.readFileSync(filePath, "utf8");
  const references = [...source.matchAll(imagePattern)];
  if (references.length !== 1) throw new Error(`${file} must contain exactly one immutable image reference.`);
  if (write && references[0][1] !== candidate.imageDigest) {
    fs.writeFileSync(filePath, source.replace(imagePattern, `ghcr.io/tjakobsson/brain-manual@${candidate.imageDigest}`));
  } else if (!write && references[0][1] !== candidate.imageDigest) {
    throw new Error(`${file} does not record candidate digest ${candidate.imageDigest}.`);
  }
}

function inspectAttestation(field) {
  const reference = `ghcr.io/tjakobsson/brain-manual@${candidate.imageDigest}`;
  const result = spawnSync(
    "docker",
    ["buildx", "imagetools", "inspect", reference, "--format", `{{ json .${field} }}`],
    { encoding: "utf8" },
  );
  if (result.status !== 0) throw new Error(result.stderr.trim() || `Unable to inspect ${field}.`);
  const value = result.stdout.trim();
  if (value === "" || value === "null" || value === "{}") throw new Error(`${field} attestation is missing.`);
  return "verified in OCI index";
}

const tags = spawnSync("git", ["tag", "--list", `v${candidate.version}`], {
  cwd: root,
  encoding: "utf8",
});
if (tags.status !== 0) throw new Error(tags.stderr.trim());
if (tags.stdout.trim() !== "") throw new Error(`Release tag v${candidate.version} already exists.`);

const sbom = verifyRemote ? inspectAttestation("SBOM") : "remote verification not requested";
const provenance = verifyRemote ? inspectAttestation("Provenance") : "remote verification not requested";
console.log(`Release mode: ${write ? "record candidate" : "dry run"}`);
console.log(`Version: v${candidate.version}`);
console.log(`Source commit: ${candidate.sourceCommit}`);
console.log(`Image digest: ${candidate.imageDigest}`);
console.log(`SBOM: ${sbom}`);
console.log(`Provenance: ${provenance}`);
console.log(
  `Required major-version change: ${contractChanged ? `yes, advance beyond v${releasedContract.major}` : "none"}`,
);
console.log("Published release: no");
