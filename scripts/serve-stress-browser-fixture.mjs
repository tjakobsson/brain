import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serveStaticSite } from "./static-server.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "brain-stress-browser-"));
const fixture = path.join(root, "workspace");
// The stress suite loads the full workspace graph as the default page for both
// the public demo workspace and a synthetic 2,000-note workspace.
const deployments = [
  {
    workspace: path.join(projectRoot, "examples", "demo-workspace", "workspace.json"),
    output: path.join(root, "demo-site"),
    base: "/stress-demo",
    port: 4333,
    strict: false,
  },
  {
    workspace: path.join(fixture, "workspace.json"),
    output: path.join(root, "site"),
    base: "/stress",
    port: 4332,
    strict: true,
  },
];

function run(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  });
  if (result.status !== 0) {
    process.stderr.write(`Stress fixture command failed (${result.signal ?? result.status ?? result.error}):\n`);
    process.stderr.write(result.stdout.slice(-10_000));
    process.stderr.write(result.stderr);
    fs.rmSync(root, { recursive: true, force: true });
    process.exit(result.status ?? 1);
  }
}

run(path.join(projectRoot, "scripts", "generate-stress-vault.mjs"), ["--output", fixture]);
for (const deployment of deployments) {
  run(path.join(projectRoot, "scripts", "generator.mjs"), [
    "build",
    "--workspace",
    deployment.workspace,
    "--output",
    deployment.output,
    "--site",
    `http://127.0.0.1:${deployment.port}`,
    "--base",
    deployment.base,
    ...(deployment.strict ? ["--strict-links"] : []),
  ]);
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
  fs.rmSync(root, { recursive: true, force: true });
}
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => close().then(() => process.exit(0)));
}
console.log(
  `Stress browser fixtures: ${deployments.map((deployment) => `http://127.0.0.1:${deployment.port}${deployment.base}/`).join(" and ")}`,
);
