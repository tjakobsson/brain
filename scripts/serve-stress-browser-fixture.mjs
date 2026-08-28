import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serveStaticSite } from "./static-server.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "brain-stress-browser-"));
const fixture = path.join(root, "workspace");
const output = path.join(root, "site");
const port = 4332;

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
run(path.join(projectRoot, "scripts", "generator.mjs"), [
  "build",
  "--workspace",
  path.join(fixture, "workspace.json"),
  "--output",
  output,
  "--site",
  `http://127.0.0.1:${port}`,
  "--base",
  "/stress",
  "--strict-links",
]);

const site = await serveStaticSite({ output, base: "/stress", host: "127.0.0.1", port });
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await site.close();
  fs.rmSync(root, { recursive: true, force: true });
}
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => close().then(() => process.exit(0)));
}
console.log(`Stress browser fixture: http://127.0.0.1:${port}/stress/`);
