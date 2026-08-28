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
const imagePattern = /ghcr\.io\/tjakobsson\/brain@(sha256:[a-f0-9]{64})/gu;

const flags = new Set(process.argv.slice(2));
const write = flags.delete("--write");
const verifyRemote = flags.delete("--verify-remote");
const requireUnreleased = flags.delete("--require-unreleased");
if (flags.size > 0) {
  console.error(`Unknown release-check option: ${[...flags][0]}`);
  process.exit(2);
}

const candidate = JSON.parse(fs.readFileSync(candidatePath, "utf8"));
if (!/^\d+\.\d+\.\d+$/u.test(candidate.version)) throw new Error("Candidate version must be semantic.");
if (!/^[a-f0-9]{40}$/u.test(candidate.sourceCommit)) throw new Error("Candidate sourceCommit must be a full Git SHA.");
if (!/^sha256:[a-f0-9]{64}$/u.test(candidate.imageDigest)) throw new Error("Candidate imageDigest must be sha256.");

const packageMetadata = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (packageMetadata.version !== candidate.version) {
  throw new Error(`Package version ${packageMetadata.version} does not match candidate ${candidate.version}.`);
}

function runGit(args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed.`);
  return result.stdout.trim();
}

runGit(["cat-file", "-e", `${candidate.sourceCommit}^{commit}`]);
const ancestor = spawnSync("git", ["merge-base", "--is-ancestor", candidate.sourceCommit, "HEAD"], {
  cwd: root,
});
if (ancestor.status !== 0) throw new Error("Candidate sourceCommit is not an ancestor of the release commit.");

const imageSourcePaths = [
  ".dockerignore",
  "Dockerfile",
  "LICENSE",
  "THIRD_PARTY_NOTICES.md",
  "astro.config.ts",
  "examples/demo-vault",
  "package-lock.json",
  "package.json",
  "public",
  "scripts/generator-inputs.mjs",
  "scripts/generator-safety.mjs",
  "scripts/generator.mjs",
  "scripts/live-server.mjs",
  "scripts/static-server.mjs",
  "src",
  "tsconfig.json",
];
const sourceDrift = runGit(["diff", "--name-only", `${candidate.sourceCommit}..HEAD`, "--", ...imageSourcePaths]);
if (sourceDrift) {
  throw new Error(`Image source changed after candidate build:\n${sourceDrift}`);
}

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
    fs.writeFileSync(filePath, source.replace(imagePattern, `ghcr.io/tjakobsson/brain@${candidate.imageDigest}`));
  } else if (!write && references[0][1] !== candidate.imageDigest) {
    throw new Error(`${file} does not record candidate digest ${candidate.imageDigest}.`);
  }
}

function inspectAttestation(field) {
  const reference = `ghcr.io/tjakobsson/brain@${candidate.imageDigest}`;
  const result = spawnSync(
    "docker",
    [
      "buildx",
      "imagetools",
      "inspect",
      reference,
      "--format",
      `{{ if .${field} }}present{{ else }}missing{{ end }}`,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(result.error?.message || result.stderr.trim() || result.stdout.trim() || `Unable to inspect ${field}.`);
  }
  const value = result.stdout.trim();
  if (value !== "present") throw new Error(`${field} attestation is missing.`);
  return "verified in OCI index";
}

function inspectRemoteImage() {
  const reference = `ghcr.io/tjakobsson/brain@${candidate.imageDigest}`;
  const manifestResult = spawnSync(
    "docker",
    ["buildx", "imagetools", "inspect", reference, "--format", "{{json .Manifest}}"],
    { encoding: "utf8" },
  );
  if (manifestResult.status !== 0) throw new Error(manifestResult.stderr.trim() || "Unable to inspect candidate manifest.");
  const manifest = JSON.parse(manifestResult.stdout);
  const platforms = manifest.manifests
    .map((entry) => entry.platform)
    .filter((platform) => platform?.os === "linux" && platform.architecture !== "unknown")
    .map((platform) => `${platform.os}/${platform.architecture}`)
    .sort();
  if (JSON.stringify(platforms) !== JSON.stringify(["linux/amd64", "linux/arm64"])) {
    throw new Error(`Candidate platforms are ${platforms.join(", ") || "missing"}.`);
  }

  const imageResult = spawnSync(
    "docker",
    ["buildx", "imagetools", "inspect", reference, "--format", "{{json .Image}}"],
    { encoding: "utf8" },
  );
  if (imageResult.status !== 0) throw new Error(imageResult.stderr.trim() || "Unable to inspect candidate image labels.");
  const images = Object.values(JSON.parse(imageResult.stdout));
  if (
    images.some(
      (image) => image.config?.Labels?.["org.opencontainers.image.revision"] !== candidate.sourceCommit,
    )
  ) {
    throw new Error("Candidate provenance labels do not match sourceCommit.");
  }

  const notices = spawnSync(
    "docker",
    [
      "run",
      "--rm",
      "--entrypoint",
      "/usr/bin/node",
      reference,
      "-e",
      "for (const file of ['/app/LICENSE', '/app/THIRD_PARTY_NOTICES.md']) require('node:fs').accessSync(file)",
    ],
    { encoding: "utf8" },
  );
  if (notices.status !== 0) throw new Error(notices.stderr.trim() || "Release notices are missing from the image.");
}

if (requireUnreleased) {
  const tag = `v${candidate.version}`;
  const worktree = runGit(["status", "--porcelain"]);
  if (worktree) throw new Error("Release checks require a clean worktree.");
  if (runGit(["tag", "--list", tag])) throw new Error(`Release tag ${tag} already exists.`);
  const remoteTag = spawnSync("git", ["ls-remote", "--tags", "origin", `refs/tags/${tag}`], {
    cwd: root,
    encoding: "utf8",
  });
  if (remoteTag.status !== 0) throw new Error(remoteTag.stderr.trim() || "Unable to inspect remote release tags.");
  if (remoteTag.stdout.trim()) throw new Error(`Remote release tag ${tag} already exists.`);
}

const sbom = verifyRemote ? inspectAttestation("SBOM") : "remote verification not requested";
const provenance = verifyRemote ? inspectAttestation("Provenance") : "remote verification not requested";
if (verifyRemote) inspectRemoteImage();
console.log(`Release mode: ${write ? "record candidate" : "dry run"}`);
console.log(`Version: v${candidate.version}`);
console.log(`Source commit: ${candidate.sourceCommit}`);
console.log(`Image digest: ${candidate.imageDigest}`);
console.log(`SBOM: ${sbom}`);
console.log(`Provenance: ${provenance}`);
console.log(
  `Required major-version change: ${contractChanged ? `yes, advance beyond v${releasedContract.major}` : "none"}`,
);
console.log(`Release tag availability: ${requireUnreleased ? "verified" : "not requested"}`);
