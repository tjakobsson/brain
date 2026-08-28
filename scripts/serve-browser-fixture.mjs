import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serveStaticSite } from "./static-server.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vault = path.join(root, "examples", "demo-vault");
const workspace = path.join(root, "examples", "demo-workspace", "workspace.json");
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
];

function runNode(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

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

await Promise.all(
  deployments.map((deployment) =>
    serveStaticSite({
      output: deployment.output,
      base: deployment.base,
      host: "127.0.0.1",
      port: deployment.port,
    }),
  ),
);
console.log(
  "Browser fixtures: http://127.0.0.1:4328/, http://127.0.0.1:4329/vault-repo/, http://notes.localhost:4330/, and http://127.0.0.1:4331/workspace-demo/",
);
