import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const runtime = process.env.CONTAINER_RUNTIME || "docker";
const image = process.env.BRAIN_IMAGE || "brain:source";
const fixture = path.resolve("examples/demo-workspace");
const root = path.resolve(".generated", `container-workspace-${randomUUID()}`);
const output = path.join(root, "output");
const work = path.join(root, "work");
const tmp = path.join(root, "tmp");

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

function run(args, message) {
  const result = spawnSync(runtime, args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${message}:\n${result.stdout}${result.stderr}`);
  }
  return result;
}

function mounts(outputDirectory, workDirectory, tmpDirectory) {
  return [
    "--mount",
    `type=bind,src=${path.join(fixture, "workspace.json")},dst=/workspace/workspace.json,readonly`,
    "--mount",
    `type=bind,src=${path.join(fixture, "brains", "engineering")},dst=/workspace/brains/engineering,readonly`,
    "--mount",
    `type=bind,src=${path.join(fixture, "brains", "design")},dst=/workspace/brains/design,readonly`,
    "--mount",
    `type=bind,src=${path.join(fixture, "brains", "research")},dst=/workspace/brains/research,readonly`,
    "--mount",
    `type=bind,src=${outputDirectory},dst=/output`,
    "--mount",
    `type=bind,src=${workDirectory},dst=/work`,
    "--mount",
    `type=bind,src=${tmpDirectory},dst=/tmp`,
  ];
}

fs.mkdirSync(output, { recursive: true });
fs.mkdirSync(work, { recursive: true });
fs.mkdirSync(tmp, { recursive: true });
const originalFixture = snapshot(fixture);

try {
  const invalidManifest = path.join(root, "unavailable-workspace.json");
  fs.writeFileSync(
    invalidManifest,
    JSON.stringify({
      version: 1,
      title: "Unavailable mount",
      brains: [{ id: "missing-brain", title: "Missing brain", path: "/workspace/brains/not-mounted" }],
    }),
  );
  const unavailable = spawnSync(
    runtime,
    [
      "run",
      "--rm",
      "--read-only",
      "--network",
      "none",
      "--user",
      `${process.getuid()}:${process.getgid()}`,
      "--mount",
      `type=bind,src=${invalidManifest},dst=/workspace-invalid.json,readonly`,
      ...mounts(output, work, tmp),
      image,
      "build",
      "--workspace",
      "/workspace-invalid.json",
      "--output",
      "/output/unavailable",
    ],
    { encoding: "utf8" },
  );
  const unavailableLogs = `${unavailable.stdout}${unavailable.stderr}`;
  if (unavailable.status === 0 || !unavailableLogs.includes('Brain "missing-brain"') || !unavailableLogs.includes("not-mounted")) {
    throw new Error(`Unavailable workspace mount did not identify its brain and path:\n${unavailableLogs}`);
  }

  run(
    [
      "run",
      "--rm",
      "--read-only",
      "--network",
      "none",
      "--user",
      `${process.getuid()}:${process.getgid()}`,
      ...mounts(output, work, tmp),
      image,
      "build",
      "--workspace",
      "/workspace/workspace.json",
      "--output",
      "/output/site",
    ],
    "Network-disabled workspace container build failed",
  );
  if (!fs.existsSync(path.join(output, "site", "index.html"))) {
    throw new Error("Workspace container build did not produce index.html.");
  }
  if (!fs.existsSync(path.join(output, "site", "search-index.json"))) {
    throw new Error("Workspace container build did not produce the quick-switcher index.");
  }
  if (
    fs.existsSync(path.join(output, "site", "search", "index.html")) ||
    fs.existsSync(path.join(output, "site", "brains", "engineering", "search", "index.html")) ||
    fs.existsSync(path.join(output, "site", "pagefind"))
  ) {
    throw new Error("Workspace container build produced a removed Search or Pagefind output.");
  }
  if (JSON.stringify(snapshot(fixture)) !== JSON.stringify(originalFixture)) {
    throw new Error("Workspace container build modified an input.");
  }

  const previewOutput = path.join(root, "preview-output");
  const previewWork = path.join(root, "preview-work");
  const previewTmp = path.join(root, "preview-tmp");
  fs.mkdirSync(previewOutput);
  fs.mkdirSync(previewWork);
  fs.mkdirSync(previewTmp);
  const container = `brain-workspace-preview-${randomUUID()}`;
  const child = spawn(
    runtime,
    [
      "run",
      "--rm",
      "--init",
      "--read-only",
      "--network",
      "none",
      "--name",
      container,
      "--user",
      `${process.getuid()}:${process.getgid()}`,
      ...mounts(previewOutput, previewWork, previewTmp),
      image,
      "preview",
      "--workspace",
      "/workspace/workspace.json",
      "--output",
      "/output/site",
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
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      const response = spawnSync(
        runtime,
        [
          "exec",
          container,
          "/usr/bin/node",
          "-e",
          "fetch('http://127.0.0.1:4321/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))",
        ],
        { stdio: "ignore" },
      );
      if (response.status === 0) break;
      if (child.exitCode !== null) throw new Error(`Workspace preview exited early:\n${logs}`);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    const finalProbe = spawnSync(
      runtime,
      [
        "exec",
        container,
        "/usr/bin/node",
        "-e",
        "fetch('http://127.0.0.1:4321/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))",
      ],
      { stdio: "ignore" },
    );
    if (finalProbe.status !== 0) throw new Error(`Network-disabled workspace preview did not respond:\n${logs}`);
    if (JSON.stringify(snapshot(fixture)) !== JSON.stringify(originalFixture)) {
      throw new Error("Workspace container preview modified an input.");
    }
  } finally {
    spawnSync(runtime, ["stop", "--time", "5", container], { stdio: "ignore" });
    await new Promise((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) resolve();
      else child.once("exit", resolve);
    });
    spawnSync(runtime, ["rm", "--force", container], { stdio: "ignore" });
  }
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

console.log("Workspace container build and preview smoke test passed.");
