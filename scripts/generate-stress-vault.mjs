import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const brainCount = 4;
const notesPerBrain = 500;
const clustersPerBrain = 5;
const notesPerCluster = notesPerBrain / clustersPerBrain;
const nodeCount = brainCount * notesPerBrain;
const types = ["fleeting", "literature", "permanent"];
const statuses = ["draft", "developing", "established"];
const accents = ["#3366cc", "#b56cff", "#16856b", "#b85c38"];

function outputArgument(argv) {
  const index = argv.indexOf("--output");
  if (index === -1) return null;
  if (!argv[index + 1] || argv[index + 1].startsWith("--")) {
    throw new Error("--output requires a path");
  }
  if (argv.length !== 2 || index !== 0) {
    throw new Error("Usage: node scripts/generate-stress-vault.mjs [--output <new-directory>]");
  }
  return path.resolve(argv[index + 1]);
}

const requestedOutput = outputArgument(process.argv.slice(2));
const output = requestedOutput ?? fs.mkdtempSync(path.join(os.tmpdir(), "brain-stress-workspace-"));
if (requestedOutput) fs.mkdirSync(output);

const brainId = (index) => `brain-${String(index + 1).padStart(2, "0")}`;
const title = (index) => `Generated note ${String(index + 1).padStart(4, "0")}`;
const wikiLink = (index, variant) => {
  const target = title(index);
  if (variant % 17 === 0) return `[[${target}#Connections]]`;
  if (variant % 11 === 0) return `[[${target}|a nearby generated note]]`;
  return `[[${target}]]`;
};
const foreignLink = (targetBrainIndex, index, variant) => {
  const target = `@${brainId(targetBrainIndex)}/${title(index)}`;
  if (variant % 20 === 0) return `[[${target}#Connections]]`;
  return `[[${target}|a note in the next brain]]`;
};

const brains = Array.from({ length: brainCount }, (_, brainIndex) => ({
  id: brainId(brainIndex),
  title: `Stress brain ${brainIndex + 1}`,
  path: `./brains/${brainId(brainIndex)}`,
  group: "generated",
  accent: accents[brainIndex],
  description: `${notesPerBrain} deterministic generated notes`,
}));
fs.mkdirSync(path.join(output, "brains"));
fs.writeFileSync(
  path.join(output, "workspace.json"),
  `${JSON.stringify({
    version: 1,
    title: "Generated stress workspace",
    groups: [{ id: "generated", title: "Generated brains" }],
    brains,
  }, null, 2)}\n`,
);

for (let brainIndex = 0; brainIndex < brainCount; brainIndex += 1) {
  const brainRoot = path.join(output, "brains", brainId(brainIndex));
  for (let cluster = 0; cluster < clustersPerBrain; cluster += 1) {
    fs.mkdirSync(path.join(brainRoot, `cluster-${String(cluster + 1).padStart(2, "0")}`), {
      recursive: true,
    });
  }

  for (let index = 0; index < notesPerBrain; index += 1) {
    const cluster = Math.floor(index / notesPerCluster);
    const localIndex = index % notesPerCluster;
    const clusterStart = cluster * notesPerCluster;
    const nextLocal = clusterStart + ((localIndex + 1) % notesPerCluster);
    const groupHub = clusterStart + Math.floor(localIndex / 10) * 10;
    const clusterName = `cluster-${String(cluster + 1).padStart(2, "0")}`;
    const day = String(((brainIndex * notesPerBrain + index) % 28) + 1).padStart(2, "0");
    const crossBrain = index % 10 === 0
      ? ` It also crosses to ${foreignLink((brainIndex + 1) % brainCount, index, index)}.`
      : "";
    const extra = [
      localIndex % 10 === 0
        ? `\n> [!note] Group hub\n> This note anchors a ten-note group around ${wikiLink(groupHub, index)}.\n`
        : "",
      index % 25 === 0 ? "\nThe generated dataset marks this as a ==sample highlighted idea==.\n" : "",
    ].join("");
    const markdown = `---
type: ${types[(index + brainIndex) % types.length]}
status: ${statuses[(index + cluster + brainIndex) % statuses.length]}
tags: [generated, ${brainId(brainIndex)}, ${clusterName}]
created: 2026-08-${day}
updated: 2026-08-${day}
---

This is note ${localIndex + 1} in ${clusterName} of ${brainId(brainIndex)}. It exercises the workspace pipeline at scale.

## Connections

It continues to ${wikiLink(nextLocal, index + 1)} and groups around ${wikiLink(groupHub, index)}.${crossBrain}
${extra}`;

    fs.writeFileSync(path.join(brainRoot, clusterName, `${title(index)}.md`), markdown);
  }
}

console.log(`Generated ${nodeCount} Markdown notes across ${brainCount} brains in ${output}`);
console.log(`Workspace manifest: ${path.join(output, "workspace.json")}`);
