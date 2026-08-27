import fs from "node:fs";
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

function watchVault({ vault, exclusions, onChange }) {
  const watcher = watch(vault, {
    ignored: (candidate) => excluded(vault, exclusions, candidate),
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

export async function serveLiveSite({ inputs, signal, buildGeneration, createWatcher = watchVault }) {
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
    vault: inputs.vault,
    exclusions: inputs.exclusions,
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
        const displayHost = generation.validated.host.includes(":")
          ? `[${generation.validated.host}]`
          : generation.validated.host;
        console.log(
          `Live server: http://${displayHost}:${generation.validated.port}${generation.validated.base}/`,
        );
      } else {
        await controller.activate(generation.output);
        controller.reload();
        console.log("Live site updated.");
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
