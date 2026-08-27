import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, ".generated", "stress-vault");
const nodeCount = 2_000;
const clusterCount = 20;
const nodesPerCluster = nodeCount / clusterCount;
const types = ["fleeting", "literature", "permanent"];
const statuses = ["draft", "developing", "established"];

const title = (index) => `Generated note ${String(index + 1).padStart(4, "0")}`;
const wikiLink = (index, variant) => {
  const target = title(index);
  if (variant % 17 === 0) return `[[${target}#Connections]]`;
  if (variant % 11 === 0) return `[[${target}|a nearby generated note]]`;
  return `[[${target}]]`;
};

fs.rmSync(output, { recursive: true, force: true });

for (let index = 0; index < nodeCount; index++) {
  const cluster = Math.floor(index / nodesPerCluster);
  const localIndex = index % nodesPerCluster;
  const clusterStart = cluster * nodesPerCluster;
  const nextLocal = clusterStart + ((localIndex + 1) % nodesPerCluster);
  const groupHub = clusterStart + Math.floor(localIndex / 10) * 10;
  const nextCluster = ((cluster + 1) % clusterCount) * nodesPerCluster;
  const secondTarget = localIndex % 10 === 0 ? nextCluster + localIndex : groupHub;
  const clusterName = `cluster-${String(cluster + 1).padStart(2, "0")}`;
  const directory = path.join(output, clusterName);
  const day = String((index % 28) + 1).padStart(2, "0");
  const extra = [
    localIndex % 10 === 0
      ? `\n> [!note] Cluster hub\n> This note connects a ten-note group to ${wikiLink(secondTarget, index)}.\n`
      : "",
    index % 25 === 0 ? "\nThe generated dataset marks this as a ==sample highlighted idea==.\n" : "",
  ].join("");
  const markdown = `---
type: ${types[index % types.length]}
status: ${statuses[(index + cluster) % statuses.length]}
tags: [generated, ${clusterName}]
created: 2026-08-${day}
updated: 2026-08-${day}
---

This is note ${localIndex + 1} in ${clusterName}. It exists to exercise the real vault pipeline at scale.

## Connections

It continues to ${wikiLink(nextLocal, index + 1)} and groups around ${wikiLink(secondTarget, index)}.
${extra}`;

  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, `${title(index)}.md`), markdown);
}

console.log(`Generated ${nodeCount} Markdown notes in ${output}`);
