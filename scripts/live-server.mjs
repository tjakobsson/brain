import fs from "node:fs";
import { EventEmitter } from "node:events";
import path from "node:path";
import { watch } from "chokidar";
import { serveStaticSite } from "./static-server.mjs";

const SETTLE_MILLISECONDS = 250;

function delay(milliseconds, signal) {
  if (milliseconds <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(done, milliseconds);
    function done() {
      signal?.removeEventListener("abort", done);
      clearTimeout(timer);
      resolve();
    }
    signal?.addEventListener("abort", done, { once: true });
  });
}

function excluded(vault, exclusions, candidate) {
  const relative = path.relative(vault, candidate).split(path.sep).join("/");
  if (relative === "") return false;
  const segments = relative.split("/");
  if (segments.some((segment) => segment.startsWith("."))) return true;
  if (segments.slice(0, -1).includes("Templates")) return true;
  return exclusions.some(
    (pattern) =>
      path.posix.matchesGlob(relative, pattern) || path.posix.matchesGlob(`${relative}/`, pattern),
  );
}

export function createBuildCoordinator({ build, onSuccess, onFailure, signal, settle = SETTLE_MILLISECONDS }) {
  let changedAt = 0;
  let dirty = false;
  let initialized = false;
  let running = false;
  let idlePromise = Promise.resolve();

  async function attempt(initial) {
    try {
      const generation = await build(signal);
      await onSuccess(generation, initial);
    } catch (error) {
      if (initial) throw error;
      if (!signal.aborted) await onFailure(error);
    }
  }

  async function drain(initial = false) {
    if (running) return idlePromise;
    running = true;
    idlePromise = (async () => {
      try {
        if (initial) await attempt(true);
        while (dirty && !signal.aborted) {
          let remaining = settle - (Date.now() - changedAt);
          while (remaining > 0 && !signal.aborted) {
            await delay(remaining, signal);
            remaining = settle - (Date.now() - changedAt);
          }
          if (signal.aborted) break;
          dirty = false;
          await attempt(false);
        }
      } finally {
        running = false;
        if (dirty && initialized && !signal.aborted) void drain();
      }
    })();
    return idlePromise;
  }

  return {
    async start() {
      await drain(true);
      initialized = true;
      if (dirty && !running && !signal.aborted) void drain();
    },
    request() {
      dirty = true;
      changedAt = Date.now();
      if (initialized && !running && !signal.aborted) void drain();
    },
    whenIdle() {
      return idlePromise;
    },
  };
}

function contains(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function watchEntries(entries, onChange) {
  const watcher = watch(entries.map((entry) => entry.path), {
    ignored: (candidate) => {
      const entry = entries.find((current) => contains(current.path, candidate));
      return entry?.exclusions ? excluded(entry.path, entry.exclusions, candidate) : false;
    },
    ignoreInitial: true,
    usePolling: true,
    interval: 250,
    binaryInterval: 500,
    awaitWriteFinish: {
      stabilityThreshold: 200,
      pollInterval: 100,
    },
  });
  watcher.on("all", onChange);
  return watcher;
}

function rootEntries(validated) {
  return validated.mode === "workspace"
    ? validated.workspaceDefinition.brains.map((brain) => ({
        path: brain.path,
        exclusions: [...brain.effectiveExclusions, ...(validated.exclusions ?? [])],
      }))
    : [{ path: validated.vault, exclusions: validated.exclusions }];
}

function entryKey(entries) {
  return JSON.stringify(entries.map((entry) => [entry.path, entry.exclusions]));
}

export function createInputWatcher({ inputs, onChange }) {
  const events = new EventEmitter();
  const initialEntries =
    inputs.mode === "workspace"
      ? [{ path: inputs.workspace }]
      : [{ path: inputs.vault, exclusions: inputs.exclusions }];
  const persistentWatcher = watchEntries(initialEntries, onChange);
  let activeRootWatcher = inputs.mode === "workspace" ? undefined : persistentWatcher;
  let activeKey = inputs.mode === "workspace" ? undefined : entryKey(initialEntries);
  let closed = false;

  const activeWatcherFailed = (error) => events.emit("error", error);
  persistentWatcher.on("error", activeWatcherFailed);
  persistentWatcher.once("ready", () => events.emit("ready"));

  events.prepare = async (validated, signal) => {
    if (inputs.mode !== "workspace") {
      return { commit() {}, async discard() {} };
    }

    const entries = rootEntries(validated);
    const nextKey = entryKey(entries);
    if (nextKey === activeKey) {
      return { commit() {}, async discard() {} };
    }

    const nextWatcher = watchEntries(entries, () => {
      if (committed) onChange();
      else changedBeforeCommit = true;
    });
    let changedBeforeCommit = false;
    let committed = false;
    let stagedError;
    const failed = new Promise((_, reject) => {
      stagedError = (error) => reject(error);
      nextWatcher.once("error", stagedError);
    });
    let ready;
    try {
      ready = await Promise.race([waitUntilReady(nextWatcher, signal), failed]);
    } catch (error) {
      nextWatcher.removeListener("error", stagedError);
      await nextWatcher.close();
      throw error;
    }
    if (!ready || closed) {
      nextWatcher.removeListener("error", stagedError);
      await nextWatcher.close();
      throw new Error("Live watcher activation aborted.");
    }

    let finished = false;
    return {
      async commit() {
        if (finished) return;
        finished = true;
        const previous = activeRootWatcher;
        activeRootWatcher = nextWatcher;
        activeKey = nextKey;
        committed = true;
        nextWatcher.removeListener("error", stagedError);
        nextWatcher.on("error", activeWatcherFailed);
        if (changedBeforeCommit) onChange();
        if (previous && previous !== persistentWatcher) {
          previous.removeListener("error", activeWatcherFailed);
          try {
            await previous.close();
          } catch (error) {
            activeWatcherFailed(error);
          }
        }
      },
      async discard() {
        if (finished) return;
        finished = true;
        nextWatcher.removeListener("error", stagedError);
        await nextWatcher.close();
      },
    };
  };

  events.close = async () => {
    closed = true;
    const watchers = new Set([persistentWatcher, activeRootWatcher].filter(Boolean));
    for (const watcher of watchers) watcher.removeListener("error", activeWatcherFailed);
    await Promise.all([...watchers].map((watcher) => watcher.close()));
  };
  return events;
}

export function waitUntilReady(watcher, signal) {
  if (signal.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    const ready = () => finish(true);
    const aborted = () => finish(false);
    function finish(value) {
      watcher.removeListener("ready", ready);
      signal.removeEventListener("abort", aborted);
      resolve(value);
    }
    watcher.once("ready", ready);
    signal.addEventListener("abort", aborted, { once: true });
  });
}

function waitForAbort(signal) {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }));
}

export async function serveLiveSite({ inputs, signal, buildGeneration, createWatcher = createInputWatcher }) {
  let controller;
  const generations = new Set();
  const watcherAbort = new AbortController();
  const operationSignal = AbortSignal.any([signal, watcherAbort.signal]);
  let rejectWatcherFailure;
  let watcherError;
  const watcherFailure = new Promise((_, reject) => {
    rejectWatcherFailure = reject;
  });
  const watcher = createWatcher({
    inputs,
    onChange: () => coordinator.request(),
  });
  const watcherFailed = (error) => {
    watcherError = error;
    rejectWatcherFailure(error);
    watcherAbort.abort();
  };
  watcher.on("error", watcherFailed);
  const coordinator = createBuildCoordinator({
    signal: operationSignal,
    build: buildGeneration,
    async onSuccess(generation, initial) {
      generations.add(generation.output);
      let prepared;
      try {
        prepared = await watcher.prepare?.(generation.validated, operationSignal);
        if (initial) {
          controller = await serveStaticSite({
            output: generation.output,
            base: generation.validated.base,
            host: generation.validated.host,
            port: generation.validated.port,
            liveReload: true,
            onRetire(retired) {
              generations.delete(retired);
              fs.rmSync(retired, { recursive: true, force: true });
            },
          });
          await prepared?.commit();
          const displayHost = generation.validated.host.includes(":")
            ? `[${generation.validated.host}]`
            : generation.validated.host;
          console.log(
            `Live server: http://${displayHost}:${generation.validated.port}${generation.validated.base}/`,
          );
        } else {
          await controller.activate(generation.output);
          await prepared?.commit();
          controller.reload();
          console.log("Live site updated.");
        }
      } catch (error) {
        await prepared?.discard();
        generations.delete(generation.output);
        fs.rmSync(generation.output, { recursive: true, force: true });
        throw error;
      }
    },
    onFailure(error) {
      console.error(`Live rebuild failed: ${error instanceof Error ? error.message : String(error)}`);
    },
  });

  try {
    const ready = await Promise.race([waitUntilReady(watcher, operationSignal), watcherFailure]);
    if (!ready) {
      if (watcherError) throw watcherError;
      return;
    }
    await Promise.race([coordinator.start(), watcherFailure]);
    await Promise.race([waitForAbort(signal), watcherFailure]);
  } catch (error) {
    if (!signal.aborted) throw error;
  } finally {
    watcher.removeListener("error", watcherFailed);
    watcherAbort.abort();
    try {
      await Promise.allSettled([watcher.close(), coordinator.whenIdle()]);
      await Promise.allSettled([controller?.close()]);
    } finally {
      for (const generation of generations) {
        fs.rmSync(generation, { recursive: true, force: true });
      }
    }
  }
}
