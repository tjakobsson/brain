import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { slugify } from "../src/lib/slugify";
import { brainId, noteTitle } from "./stress-vault-content.mjs";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => fs.rmSync(root, { recursive: true, force: true })));

const GRAPH_PAYLOAD_LIMIT = 3 * 1024 * 1024;

describe("stress workspace build", () => {
  it("builds and indexes 2,000 public generated notes across four brains", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "stress-build-"));
    roots.push(root);
    const fixture = path.join(root, "workspace");
    const output = path.join(root, "site");
    const generated = spawnSync(
      process.execPath,
      [path.resolve("scripts/generate-stress-vault.mjs"), "--output", fixture],
      { encoding: "utf8" },
    );
    expect(generated.status, generated.stderr).toBe(0);

    const started = performance.now();
    const build = spawnSync(
      process.execPath,
      [
        path.resolve("scripts/generator.mjs"),
        "build",
        "--workspace",
        path.join(fixture, "workspace.json"),
        "--output",
        output,
        "--site",
        "https://example.com",
        "--base",
        "/stress",
        "--strict-links",
      ],
      { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
    );
    expect(build.status, build.stderr).toBe(0);
    const buildMilliseconds = Math.round(performance.now() - started);

    const graphPath = path.join(output, "graph-data.json");
    const graphPayloadBytes = fs.statSync(graphPath).size;
    const graph = JSON.parse(fs.readFileSync(graphPath, "utf8"));
    const search = JSON.parse(fs.readFileSync(path.join(output, "search-index.json"), "utf8"));
    expect(graph.mode).toBe("workspace");
    expect(graph.brains).toHaveLength(4);
    expect(graph.nodes).toHaveLength(2_000);
    expect(graph.edges.filter((edge: { crossBrain: boolean }) => edge.crossBrain)).toHaveLength(200);
    // Re-baselined when the fixture moved to sentence-length titles and real-length
    // brain ids: 2,710,042 bytes, up from 1,345,085 on the former `Generated note 0001`
    // fixture. Titles and owner ids are most of a graph node, so the ceiling rises with
    // them. A 3 MiB ceiling keeps roughly 14% headroom and still bounds the download.
    expect(graphPayloadBytes).toBeLessThanOrEqual(GRAPH_PAYLOAD_LIMIT);
    expect(search.filter((entry: { kind: string }) => entry.kind === "note")).toHaveLength(2_000);
    expect(fs.existsSync(
      path.join(output, "brains", brainId(0), "notes", slugify(noteTitle(0)), "index.html"),
    )).toBe(true);
    expect(fs.existsSync(path.join(output, "search", "index.html"))).toBe(false);
    expect(fs.existsSync(path.join(output, "brains", brainId(0), "search", "index.html"))).toBe(false);
    expect(fs.existsSync(path.join(output, "pagefind"))).toBe(false);
    console.info(JSON.stringify({ buildMilliseconds, graphPayloadBytes }));
  }, 120_000);
});
