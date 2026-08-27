import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { randomUUID } from "node:crypto";

const runtime = process.env.CONTAINER_RUNTIME || "docker";
const image = process.env.BRAIN_IMAGE || "brain:source";
const root = path.resolve(".generated", `container-live-${randomUUID()}`);
const vault = path.join(root, "vault");
const note = path.join(vault, "Note.md");
const attachment = path.join(vault, "asset.txt");
const container = `brain-live-${randomUUID()}`;

function snapshot(directory) {
  return fs
    .readdirSync(directory, { recursive: true, encoding: "utf8" })
    .filter((entry) => fs.statSync(path.join(directory, entry)).isFile())
    .sort()
    .map((entry) => [
      entry,
      crypto.createHash("sha256").update(fs.readFileSync(path.join(directory, entry))).digest("hex"),
    ]);
}

async function availablePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitFor(check, message, timeout = 60_000) {
  const deadline = Date.now() + timeout;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error(message);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

function writeVersion(label, asset) {
  fs.writeFileSync(note, `${label}\n\n[Asset](asset.txt)\n`);
  fs.writeFileSync(attachment, `${asset}\n`);
}

fs.mkdirSync(vault, { recursive: true });
writeVersion("Initial container version.", "Initial asset.");
const port = await availablePort();
const child = spawn(
  runtime,
  [
    "run",
    "--rm",
    "--init",
    "--read-only",
    "--name",
    container,
    "--publish",
    `127.0.0.1:${port}:4321`,
    "--mount",
    `type=bind,src=${vault},dst=/vault,readonly`,
    "--tmpfs",
    "/work:rw,mode=1777",
    "--tmpfs",
    "/tmp:rw,mode=1777",
    image,
    "serve",
    "--vault",
    "/vault",
    "--output",
    "/work/site",
    "--host",
    "0.0.0.0",
    "--port",
    "4321",
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let logs = "";
child.stdout.on("data", (chunk) => (logs += String(chunk)));
child.stderr.on("data", (chunk) => (logs += String(chunk)));

try {
  const origin = `http://127.0.0.1:${port}`;
  const noteUrl = `${origin}/notes/note/`;
  const assetUrl = `${origin}/vault-assets/asset.txt`;
  const searchUrl = `${origin}/pagefind/pagefind-entry.json`;
  await waitFor(async () => {
    try {
      return (await fetch(noteUrl)).ok;
    } catch {
      return false;
    }
  }, `Container did not start:\n${logs}`);
  const initialSearch = await (await fetch(searchUrl)).json();

  writeVersion("Updated searchable container phrase.", "Updated asset.");
  const updatedVault = snapshot(vault);
  await waitFor(
    async () =>
      (await (await fetch(noteUrl)).text()).includes("Updated searchable container phrase.") &&
      (await (await fetch(assetUrl)).text()) === "Updated asset.\n" &&
      (await (await fetch(searchUrl)).json()).languages.en.hash !== initialSearch.languages.en.hash,
    `Container did not publish the changed vault and search index:\n${logs}`,
  );
  if (JSON.stringify(snapshot(vault)) !== JSON.stringify(updatedVault)) {
    throw new Error("Container modified the mounted vault.");
  }

  fs.writeFileSync(note, "---\ntype: invalid\n---\nBroken container version.\n");
  const invalidVault = snapshot(vault);
  await waitFor(() => logs.includes("Live rebuild failed:"), `Invalid rebuild was not reported:\n${logs}`);
  if (!(await (await fetch(noteUrl)).text()).includes("Updated searchable container phrase.")) {
    throw new Error("Failed rebuild replaced the last successful container generation.");
  }
  if (JSON.stringify(snapshot(vault)) !== JSON.stringify(invalidVault)) {
    throw new Error("Container modified the invalid mounted vault.");
  }

  writeVersion("Recovered container version.", "Recovered asset.");
  const recoveredVault = snapshot(vault);
  await waitFor(
    async () => (await (await fetch(noteUrl)).text()).includes("Recovered container version."),
    `Container did not recover:\n${logs}`,
  );
  if (JSON.stringify(snapshot(vault)) !== JSON.stringify(recoveredVault)) {
    throw new Error("Container modified the recovered mounted vault.");
  }
} finally {
  spawnSync(runtime, ["stop", "--time", "5", container], { stdio: "ignore" });
  await new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) resolve();
    else child.once("exit", resolve);
  });
  spawnSync(runtime, ["rm", "--force", container], { stdio: "ignore" });
  fs.rmSync(root, { recursive: true, force: true });
}

console.log("Live container smoke test passed.");
