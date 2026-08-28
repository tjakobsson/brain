import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBuildCoordinator, serveLiveSite, waitUntilReady } from "./live-server.mjs";
import { validateGeneratorInputs } from "./generator-safety.mjs";

let root: string;
const children: ReturnType<typeof spawn>[] = [];
const generator = path.resolve("scripts/generator.mjs");

async function availablePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

async function waitFor(check: () => Promise<boolean> | boolean, message: string, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error(message);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "brain-live-"));
});

afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  await Promise.all(
    children.splice(0).map(
      (child) =>
        new Promise<void>((resolve) => {
          if (child.exitCode !== null || child.signalCode !== null) return resolve();
          child.once("exit", () => resolve());
          child.kill("SIGTERM");
        }),
    ),
  );
  fs.rmSync(root, { recursive: true, force: true });
});

describe("live build coordinator", () => {
  it("cancels watcher readiness and removes its listener", async () => {
    const watcher = new EventEmitter();
    const abort = new AbortController();
    const ready = waitUntilReady(watcher, abort.signal);
    expect(watcher.listenerCount("ready")).toBe(1);
    abort.abort();
    await expect(ready).resolves.toBe(false);
    expect(watcher.listenerCount("ready")).toBe(0);
  });

  it("serializes builds and coalesces changes received during generation", async () => {
    const abort = new AbortController();
    const releases: Array<() => void> = [];
    let active = 0;
    let maximum = 0;
    let builds = 0;
    const coordinator = createBuildCoordinator({
      signal: abort.signal,
      settle: 0,
      build: async () => {
        builds += 1;
        active += 1;
        maximum = Math.max(maximum, active);
        await new Promise<void>((resolve) => releases.push(resolve));
        active -= 1;
        return builds;
      },
      onSuccess: () => {},
      onFailure: () => {},
    });

    const starting = coordinator.start();
    await waitFor(() => releases.length === 1, "initial build did not start");
    coordinator.request();
    coordinator.request();
    releases.shift()!();
    await waitFor(() => releases.length === 1, "follow-up build did not start");
    coordinator.request();
    releases.shift()!();
    await waitFor(() => releases.length === 1, "second follow-up build did not start");
    releases.shift()!();
    await starting;

    expect(builds).toBe(3);
    expect(maximum).toBe(1);
    abort.abort();
  });

  it("reports a failed rebuild and continues with the next request", async () => {
    const abort = new AbortController();
    let builds = 0;
    const failures: string[] = [];
    const successes: number[] = [];
    const coordinator = createBuildCoordinator({
      signal: abort.signal,
      settle: 0,
      build: async () => {
        builds += 1;
        if (builds === 2) throw new Error("invalid note");
        return builds;
      },
      onSuccess: (generation: number) => successes.push(generation),
      onFailure: (error: Error) => failures.push(error.message),
    });
    await coordinator.start();
    coordinator.request();
    await waitFor(() => failures.length === 1, "failure was not reported");
    coordinator.request();
    await waitFor(() => successes.length === 2, "recovery did not complete");
    await coordinator.whenIdle();

    expect(failures).toEqual(["invalid note"]);
    expect(successes).toEqual([1, 3]);
    abort.abort();
  });

  it("settles from the most recent change before rebuilding", async () => {
    vi.useFakeTimers();
    const abort = new AbortController();
    let builds = 0;
    const coordinator = createBuildCoordinator({
      signal: abort.signal,
      settle: 250,
      build: async () => ++builds,
      onSuccess: () => {},
      onFailure: () => {},
    });
    await coordinator.start();
    coordinator.request();
    await vi.advanceTimersByTimeAsync(200);
    coordinator.request();
    await vi.advanceTimersByTimeAsync(100);
    expect(builds).toBe(1);
    await vi.advanceTimersByTimeAsync(150);
    await coordinator.whenIdle();
    expect(builds).toBe(2);
    abort.abort();
  });
});

describe("brain serve command", () => {
  it("rebuilds a mounted vault, retains the last success, and recovers", async () => {
    const vault = path.join(root, "vault");
    const output = path.join(root, "site");
    fs.mkdirSync(vault);
    const note = path.join(vault, "Note.md");
    const attachment = path.join(vault, "asset.txt");
    const ignored = path.join(vault, "Ignored.md");
    fs.writeFileSync(attachment, "Asset one.\n");
    fs.writeFileSync(note, "First version.\n\n[Asset](asset.txt)\n");
    fs.writeFileSync(ignored, "Ignored version one.\n");
    const vaultMode = fs.statSync(vault).mode;
    const port = await availablePort();
    const child = spawn(
      process.execPath,
      [
        generator,
        "serve",
        "--vault",
        vault,
        "--output",
        output,
        "--host",
        "127.0.0.1",
        "--port",
        String(port),
        "--exclude",
        "Ignored.md",
      ],
      { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
    );
    children.push(child);
    let logs = "";
    child.stdout.on("data", (chunk) => (logs += String(chunk)));
    child.stderr.on("data", (chunk) => (logs += String(chunk)));
    await waitFor(() => logs.includes("Live server:"), `serve did not start:\n${logs}`);

    const url = `http://127.0.0.1:${port}/notes/note/`;
    const assetUrl = `http://127.0.0.1:${port}/vault-assets/asset.txt`;
    expect(await (await fetch(url)).text()).toContain("First version.");
    expect(await (await fetch(assetUrl)).text()).toBe("Asset one.\n");
    fs.writeFileSync(ignored, "Ignored version two.\n");
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    expect(logs).not.toContain("Live site updated.");
    fs.writeFileSync(note, "Second version.\n\n[Asset](asset.txt)\n");
    await waitFor(
      async () => (await (await fetch(url)).text()).includes("Second version."),
      `valid edit was not served:\n${logs}`,
    );

    fs.writeFileSync(attachment, "Asset two.\n");
    await waitFor(
      async () => (await (await fetch(assetUrl)).text()) === "Asset two.\n",
      `attachment edit was not served:\n${logs}`,
    );
    fs.rmSync(attachment);
    const failuresBeforeDelete = logs.split("Live rebuild failed:").length;
    await waitFor(
      () => logs.split("Live rebuild failed:").length > failuresBeforeDelete,
      "missing attachment did not fail",
    );
    expect(await (await fetch(assetUrl)).text()).toBe("Asset two.\n");
    fs.writeFileSync(attachment, "Asset three.\n");
    await waitFor(
      async () => (await (await fetch(assetUrl)).text()) === "Asset three.\n",
      `attachment recovery was not served:\n${logs}`,
    );

    fs.writeFileSync(note, "---\ntype: invalid\n---\nBroken version.\n");
    const failuresBeforeInvalid = logs.split("Live rebuild failed:").length;
    await waitFor(
      () => logs.split("Live rebuild failed:").length > failuresBeforeInvalid,
      "invalid rebuild was not reported",
    );
    expect(await (await fetch(url)).text()).toContain("Second version.");
    fs.writeFileSync(note, "Recovered version.\n\n[Asset](asset.txt)\n");
    await waitFor(
      async () => (await (await fetch(url)).text()).includes("Recovered version."),
      `recovery was not served:\n${logs}`,
    );

    const renamedAttachment = path.join(vault, "renamed.txt");
    fs.renameSync(attachment, renamedAttachment);
    fs.writeFileSync(note, "Renamed attachment version.\n\n[Asset](renamed.txt)\n");
    await waitFor(
      async () =>
        (await (await fetch(url)).text()).includes("Renamed attachment version.") &&
        (await (await fetch(`http://127.0.0.1:${port}/vault-assets/renamed.txt`)).text()) ===
          "Asset three.\n",
      `attachment rename was not served:\n${logs}`,
    );
    expect((await fetch(assetUrl)).status).toBe(404);

    const added = path.join(vault, "Added.md");
    const renamed = path.join(vault, "Renamed.md");
    fs.writeFileSync(added, "Added note.\n");
    await waitFor(
      async () => (await fetch(`http://127.0.0.1:${port}/notes/added/`)).status === 200,
      `added note was not served:\n${logs}`,
    );
    fs.renameSync(added, renamed);
    await waitFor(
      async () => (await fetch(`http://127.0.0.1:${port}/notes/renamed/`)).status === 200,
      `renamed note was not served:\n${logs}`,
    );
    expect((await fetch(`http://127.0.0.1:${port}/notes/added/`)).status).toBe(404);
    const updatesBeforeDelete = logs.split("Live site updated.").length;
    fs.rmSync(renamed);
    await waitFor(
      () => logs.split("Live site updated.").length > updatesBeforeDelete,
      `deleted note did not rebuild:\n${logs}`,
    );
    expect((await fetch(`http://127.0.0.1:${port}/notes/renamed/`)).status).toBe(404);

    child.kill("SIGTERM");
    await new Promise<void>((resolve) => child.once("exit", () => resolve()));
    expect(fs.readFileSync(note, "utf8")).toBe(
      "Renamed attachment version.\n\n[Asset](renamed.txt)\n",
    );
    expect(fs.readFileSync(renamedAttachment, "utf8")).toBe("Asset three.\n");
    expect(fs.statSync(vault).mode).toBe(vaultMode);
    expect(fs.readdirSync(root).some((entry) => entry.includes(".generation-"))).toBe(false);
  }, 60_000);

  it("updates workspace roots only after successful generations and recovers through the manifest", async () => {
    const workspace = path.join(root, "workspace.json");
    const alpha = path.join(root, "alpha");
    const beta = path.join(root, "beta");
    const gamma = path.join(root, "gamma");
    const missing = path.join(root, "missing");
    for (const directory of [alpha, beta, gamma]) fs.mkdirSync(directory);
    fs.writeFileSync(path.join(alpha, "Alpha.md"), "Alpha one.\n");
    fs.writeFileSync(path.join(beta, "Beta.md"), "Beta one.\n");
    fs.writeFileSync(path.join(gamma, "Gamma.md"), "Gamma one.\n");

    function writeManifest({
      title,
      brains,
      nested = false,
    }: {
      title: string;
      brains: Array<{ id: string; path: string; group?: string }>;
      nested?: boolean;
    }) {
      fs.writeFileSync(
        workspace,
        JSON.stringify({
          version: 1,
          title,
          groups: nested
            ? [
                { id: "all", title: "All" },
                { id: "nested", title: "Nested", parent: "all" },
              ]
            : [{ id: "all", title: "All" }],
          brains: brains.map((brain) => ({
            id: brain.id,
            title: brain.id,
            path: brain.path,
            group: brain.group ?? "all",
          })),
        }),
      );
    }

    writeManifest({
      title: "Initial workspace",
      brains: [
        { id: "alpha", path: alpha },
        { id: "beta", path: beta },
      ],
    });
    const port = await availablePort();
    const inputs = {
      command: "serve",
      mode: "workspace",
      workspace,
      output: path.join(root, "site"),
      site: undefined,
      base: "",
      exclusions: [],
      strictLinks: false,
      host: "127.0.0.1",
      port,
    };
    const abort = new AbortController();
    let builds = 0;
    const errors: string[] = [];
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation((message) => errors.push(String(message)));
    const serving = serveLiveSite({
      inputs,
      signal: abort.signal,
      async buildGeneration() {
        builds += 1;
        const validated = await validateGeneratorInputs(inputs);
        const generation = path.join(root, `.workspace-generation-${builds}`);
        const brainFiles = validated.workspaceDefinition.brains.map((brain) => ({
          id: brain.id,
          files: fs
            .readdirSync(brain.path)
            .filter((name) => name.endsWith(".md"))
            .sort()
            .map((name) => [name, fs.readFileSync(path.join(brain.path, name), "utf8")]),
        }));
        fs.mkdirSync(generation);
        fs.writeFileSync(
          path.join(generation, "index.html"),
          `<html><body>${JSON.stringify({
            title: validated.workspaceDefinition.title,
            groups: validated.workspaceDefinition.groups,
            brains: brainFiles,
          })}</body></html>`,
        );
        return { output: generation, validated };
      },
    });
    const url = `http://127.0.0.1:${port}/`;
    const body = async () => {
      try {
        return await (await fetch(url)).text();
      } catch {
        return "";
      }
    };

    await waitFor(async () => (await body()).includes("Initial workspace"), "workspace did not start");

    fs.writeFileSync(path.join(alpha, "Alpha.md"), "Alpha two.\n");
    await waitFor(async () => (await body()).includes("Alpha two."), "active brain edit did not rebuild");

    fs.writeFileSync(path.join(beta, "Added.md"), "Added note.\n");
    await waitFor(async () => (await body()).includes("Added note."), "added note did not rebuild");
    fs.rmSync(path.join(beta, "Added.md"));
    await waitFor(async () => !(await body()).includes("Added note."), "removed note did not rebuild");

    writeManifest({
      title: "Nested hierarchy",
      nested: true,
      brains: [
        { id: "alpha", path: alpha, group: "nested" },
        { id: "beta", path: beta },
      ],
    });
    await waitFor(async () => (await body()).includes("Nested hierarchy"), "hierarchy edit did not rebuild");

    writeManifest({
      title: "Gamma added",
      brains: [
        { id: "alpha", path: alpha },
        { id: "beta", path: beta },
        { id: "gamma", path: gamma },
      ],
    });
    await waitFor(async () => (await body()).includes("Gamma added"), "brain addition did not rebuild");
    fs.writeFileSync(path.join(gamma, "Gamma.md"), "Gamma two.\n");
    await waitFor(async () => (await body()).includes("Gamma two."), "added brain was not watched");

    writeManifest({
      title: "Alpha removed",
      brains: [
        { id: "beta", path: beta },
        { id: "gamma", path: gamma },
      ],
    });
    await waitFor(async () => (await body()).includes("Alpha removed"), "brain removal did not rebuild");
    await new Promise((resolve) => setTimeout(resolve, 500));
    const buildsAfterRemoval = builds;
    fs.writeFileSync(path.join(alpha, "Alpha.md"), "Alpha should be ignored.\n");
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    expect(builds).toBe(buildsAfterRemoval);

    const lastSuccess = await body();
    fs.writeFileSync(workspace, '{"version": 1,');
    await waitFor(() => errors.some((message) => message.includes("malformed JSON")), "malformed manifest did not fail");
    expect(await body()).toBe(lastSuccess);
    const buildsAfterMalformed = builds;
    fs.writeFileSync(path.join(beta, "Beta.md"), "Beta while malformed.\n");
    await waitFor(() => builds > buildsAfterMalformed, "prior brain roots were not retained after malformed manifest");
    expect(await body()).toBe(lastSuccess);

    writeManifest({
      title: "Recovered once",
      brains: [
        { id: "beta", path: beta },
        { id: "gamma", path: gamma },
      ],
    });
    await waitFor(async () => (await body()).includes("Recovered once"), "malformed manifest did not recover");

    writeManifest({
      title: "Unavailable brain",
      brains: [
        { id: "beta", path: beta },
        { id: "missing", path: missing },
      ],
    });
    await waitFor(() => errors.some((message) => message.includes('Brain "missing"')), "invalid brain root did not fail");
    expect(await body()).toContain("Recovered once");
    const buildsAfterInvalidRoot = builds;
    fs.writeFileSync(path.join(gamma, "Gamma.md"), "Gamma while invalid.\n");
    await waitFor(() => builds > buildsAfterInvalidRoot, "prior watch set was not retained after validation failure");
    expect(await body()).toContain("Recovered once");

    writeManifest({
      title: "Recovered twice",
      brains: [
        { id: "beta", path: beta },
        { id: "gamma", path: gamma },
      ],
    });
    await waitFor(async () => (await body()).includes("Recovered twice"), "valid manifest did not recover");

    const buildsBeforeBurst = builds;
    fs.writeFileSync(path.join(beta, "Beta.md"), "Burst one.\n");
    fs.writeFileSync(path.join(beta, "Beta.md"), "Burst two.\n");
    fs.writeFileSync(path.join(beta, "Beta.md"), "Burst final.\n");
    await waitFor(async () => (await body()).includes("Burst final."), "debounced edit did not rebuild");
    await new Promise((resolve) => setTimeout(resolve, 750));
    expect(builds).toBe(buildsBeforeBurst + 1);

    abort.abort();
    await serving;
    const buildsAfterShutdown = builds;
    fs.writeFileSync(path.join(beta, "Beta.md"), "After shutdown.\n");
    fs.writeFileSync(workspace, '{"version": 1,');
    await new Promise((resolve) => setTimeout(resolve, 750));
    expect(builds).toBe(buildsAfterShutdown);
    expect(fs.readdirSync(root).some((entry) => entry.startsWith(".workspace-generation-"))).toBe(false);
  }, 30_000);

  it("does not listen when initial validation fails", async () => {
    const port = await availablePort();
    const child = spawn(
      process.execPath,
      [
        generator,
        "serve",
        "--vault",
        path.join(root, "missing"),
        "--output",
        path.join(root, "site"),
        "--host",
        "127.0.0.1",
        "--port",
        String(port),
      ],
      { cwd: root, stdio: "ignore" },
    );
    children.push(child);
    const code = await new Promise<number | null>((resolve) => child.once("exit", resolve));
    expect(code).not.toBe(0);
    await expect(fetch(`http://127.0.0.1:${port}/`)).rejects.toThrow();
  });

  it("terminates an active production generation cleanly", async () => {
    const vault = path.join(root, "large-vault");
    fs.mkdirSync(vault);
    for (let index = 0; index < 500; index += 1) {
      fs.writeFileSync(path.join(vault, `Note ${String(index).padStart(3, "0")}.md`), `Note ${index}.\n`);
    }
    const port = await availablePort();
    const child = spawn(
      process.execPath,
      [
        generator,
        "serve",
        "--vault",
        vault,
        "--output",
        path.join(root, "large-site"),
        "--host",
        "127.0.0.1",
        "--port",
        String(port),
      ],
      { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
    );
    children.push(child);
    let logs = "";
    child.stdout.on("data", (chunk) => (logs += String(chunk)));
    child.stderr.on("data", (chunk) => (logs += String(chunk)));
    await waitFor(
      () => logs.includes("Building static entrypoints"),
      `production generation did not start:\n${logs}`,
    );
    child.kill("SIGTERM");
    await new Promise<void>((resolve) => child.once("exit", () => resolve()));

    expect(fs.readdirSync(vault)).toHaveLength(500);
    expect(fs.readdirSync(root).some((entry) => entry.includes(".generation-"))).toBe(false);
  }, 30_000);

  it("does not build when aborted before an injected watcher becomes ready", async () => {
    const watcher = Object.assign(new EventEmitter(), { close: vi.fn(async () => {}) });
    const abort = new AbortController();
    const buildGeneration = vi.fn();
    const serving = serveLiveSite({
      inputs: {
        vault: root,
        exclusions: [],
      },
      signal: abort.signal,
      buildGeneration,
      createWatcher: () => watcher,
    });
    await waitFor(() => watcher.listenerCount("ready") === 1, "watcher readiness was not pending");
    abort.abort();
    await serving;
    expect(buildGeneration).not.toHaveBeenCalled();
    expect(watcher.close).toHaveBeenCalledOnce();
  });

  it("fails when an injected watcher errors before readiness", async () => {
    const watcher = Object.assign(new EventEmitter(), { close: vi.fn(async () => {}) });
    const buildGeneration = vi.fn();
    const serving = serveLiveSite({
      inputs: { vault: root, exclusions: [] },
      signal: new AbortController().signal,
      buildGeneration,
      createWatcher: () => watcher,
    });
    watcher.emit("error", new Error("startup watcher failed"));
    await expect(serving).rejects.toThrow("startup watcher failed");
    expect(buildGeneration).not.toHaveBeenCalled();
    expect(watcher.close).toHaveBeenCalledOnce();
  });

  it("closes the live server and generation after a runtime watcher failure", async () => {
    const watcher = Object.assign(new EventEmitter(), { close: vi.fn(async () => {}) });
    const generation = path.join(root, "injected-generation");
    fs.mkdirSync(generation);
    fs.writeFileSync(path.join(generation, "index.html"), "<html><body>ready</body></html>");
    const port = await availablePort();
    const abort = new AbortController();
    const serving = serveLiveSite({
      inputs: { vault: root, exclusions: [] },
      signal: abort.signal,
      buildGeneration: async () => ({
        output: generation,
        validated: { base: "", host: "127.0.0.1", port },
      }),
      createWatcher: () => watcher,
    });
    watcher.emit("ready");
    await waitFor(async () => {
      try {
        return (await fetch(`http://127.0.0.1:${port}/`)).ok;
      } catch {
        return false;
      }
    }, "injected live server did not start");
    watcher.emit("error", new Error("watcher failed"));
    await expect(serving).rejects.toThrow("watcher failed");
    await expect(fetch(`http://127.0.0.1:${port}/`)).rejects.toThrow();
    expect(fs.existsSync(generation)).toBe(false);
  });

  it("cleans a completed generation when the port is unavailable", async () => {
    const vault = path.join(root, "port-vault");
    fs.mkdirSync(vault);
    fs.writeFileSync(path.join(vault, "Note.md"), "Port conflict.\n");
    const blocker = net.createServer();
    await new Promise<void>((resolve) => blocker.listen(0, "127.0.0.1", resolve));
    const address = blocker.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const child = spawn(
      process.execPath,
      [
        generator,
        "serve",
        "--vault",
        vault,
        "--output",
        path.join(root, "port-site"),
        "--host",
        "127.0.0.1",
        "--port",
        String(port),
      ],
      { cwd: root, stdio: "ignore" },
    );
    children.push(child);
    const code = await new Promise<number | null>((resolve) => child.once("exit", resolve));
    await new Promise<void>((resolve) => blocker.close(() => resolve()));
    expect(code).not.toBe(0);
    expect(fs.readdirSync(root).some((entry) => entry.includes(".generation-"))).toBe(false);
  }, 30_000);
});
