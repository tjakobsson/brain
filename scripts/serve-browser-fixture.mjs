import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serveStaticSite } from "./static-server.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vault = path.join(root, "examples", "demo-vault");
const workspace = path.join(root, "examples", "demo-workspace", "workspace.json");
// A realistic-scale workspace the label and density assertions need: 400 notes
// across four brains, with the same sentence-length titles and long brain ids
// as the 2,000-note stress fixture but a build the browser suite can afford.
const realisticRoot = fs.mkdtempSync(path.join(os.tmpdir(), "brain-browser-realistic-"));
const realisticWorkspace = path.join(realisticRoot, "workspace", "workspace.json");
const deployments = [
  { base: "", output: path.join(root, ".generated", "browser-root-site"), port: 4328 },
  { base: "/vault-repo", output: path.join(root, ".generated", "browser-subpath-site"), port: 4329 },
  {
    base: "",
    output: path.join(root, ".generated", "browser-custom-domain-site"),
    port: 4330,
    site: "http://notes.localhost:4330",
  },
  {
    base: "/workspace-demo",
    output: path.join(root, ".generated", "browser-workspace-site"),
    port: 4331,
    workspace,
  },
  {
    base: "/realistic",
    output: path.join(root, ".generated", "browser-realistic-site"),
    port: 4334,
    workspace: realisticWorkspace,
  },
];

function runNode(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

runNode(path.join(root, "scripts", "generate-stress-vault.mjs"), [
  "--output",
  path.dirname(realisticWorkspace),
  "--notes-per-brain",
  "100",
]);

for (const deployment of deployments) {
  const args = [
    "build",
    deployment.workspace ? "--workspace" : "--vault",
    deployment.workspace ?? vault,
    "--output",
    deployment.output,
    "--site",
    deployment.site ?? `http://127.0.0.1:${deployment.port}`,
    "--base",
    deployment.base || "/",
  ];
  if (!deployment.workspace) args.push("--strict-links");
  runNode(path.join(root, "scripts", "generator.mjs"), args);
}

const sites = await Promise.all(
  deployments.map((deployment) =>
    serveStaticSite({
      output: deployment.output,
      base: deployment.base,
      host: "127.0.0.1",
      port: deployment.port,
    }),
  ),
);
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await Promise.all(sites.map((site) => site.close()));
  fs.rmSync(realisticRoot, { recursive: true, force: true });
}
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => close().then(() => process.exit(0)));
}
console.log(
  "Browser fixtures: http://127.0.0.1:4328/, http://127.0.0.1:4329/vault-repo/, http://notes.localhost:4330/, http://127.0.0.1:4331/workspace-demo/, and http://127.0.0.1:4334/realistic/",
);
