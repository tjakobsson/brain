import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  BRAIN_IDS,
  composedWorkspaceLabel,
  noteTitle,
  TITLE_CAPACITY,
} from "./stress-vault-content.mjs";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => fs.rmSync(root, { recursive: true, force: true })));

// Reference distribution from a real published vault, recorded in the change's
// design notes: titles min 7, median 37, max 60 characters, and a longest brain
// id of 37. The fixture has to sit at or above that to stress label geometry
// rather than merely match it.
const REFERENCE = { titleMedian: 37, titleMax: 60, brainId: 37 };

function lengths(values: readonly string[]): { min: number; median: number; max: number } {
  const sorted = values.map((value) => value.length).sort((a, b) => a - b);
  return { min: sorted[0]!, median: sorted[Math.floor(sorted.length / 2)]!, max: sorted.at(-1)! };
}

describe("stress vault content", () => {
  it("composes sentence-length titles at or above the reference distribution", () => {
    const titles = Array.from({ length: 500 }, (_, index) => noteTitle(index));
    const distribution = lengths(titles);
    expect(distribution.median).toBeGreaterThanOrEqual(REFERENCE.titleMedian);
    expect(distribution.max).toBeGreaterThanOrEqual(REFERENCE.titleMax);
    // Sentence-length, not paragraph-length: a fixture far above the reference
    // would stress a width no real vault produces.
    expect(distribution.max).toBeLessThanOrEqual(REFERENCE.titleMax * 1.5);
    expect(distribution.min).toBeGreaterThan(REFERENCE.titleMedian / 2);
    console.info(JSON.stringify({ titles: distribution }));
  });

  it("gives every note in a brain a distinct title", () => {
    const titles = Array.from({ length: 500 }, (_, index) => noteTitle(index));
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("refuses an index beyond the distinct titles it can compose", () => {
    expect(() => noteTitle(TITLE_CAPACITY)).toThrow(/distinct titles/);
  });

  it("names brains at the length a real workspace reaches", () => {
    expect(BRAIN_IDS).toHaveLength(4);
    expect(new Set(BRAIN_IDS).size).toBe(BRAIN_IDS.length);
    expect(Math.max(...BRAIN_IDS.map((id) => id.length))).toBeGreaterThanOrEqual(REFERENCE.brainId);
    for (const id of BRAIN_IDS) expect(id).toMatch(/^[a-z][a-z-]*[a-z]$/);
  });

  it("composes a workspace label whose owner rivals its title", () => {
    const labels = Array.from({ length: 500 }, (_, index) => composedWorkspaceLabel(0, index));
    const distribution = lengths(labels);
    const owner = composedWorkspaceLabel(0, 0).length - noteTitle(0).length;
    // Owner plus status marker was measured at roughly half a real workspace
    // label. A fixture that cannot reproduce that cannot fail on it.
    expect(owner).toBeGreaterThan(REFERENCE.titleMedian);
    expect(distribution.max).toBeGreaterThan(120);
    console.info(JSON.stringify({ labels: distribution, ownerWidth: owner }));
  });

  it("regenerates a vault whose filenames carry those titles", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "stress-content-"));
    roots.push(root);
    const fixture = path.join(root, "workspace");
    const generated = spawnSync(
      process.execPath,
      [
        path.resolve("scripts/generate-stress-vault.mjs"),
        "--output",
        fixture,
        "--notes-per-brain",
        "100",
      ],
      { encoding: "utf8" },
    );
    expect(generated.status, generated.stderr).toBe(0);

    const manifest = JSON.parse(fs.readFileSync(path.join(fixture, "workspace.json"), "utf8"));
    expect(manifest.brains.map((brain: { id: string }) => brain.id)).toEqual([...BRAIN_IDS]);

    const brainRoot = path.join(fixture, "brains", BRAIN_IDS[0]!);
    const files = fs
      .readdirSync(brainRoot, { recursive: true, encoding: "utf8" })
      .filter((entry) => entry.endsWith(".md"))
      .map((entry) => path.basename(entry, ".md"));
    expect(files).toHaveLength(100);
    expect(new Set(files).size).toBe(files.length);
    const distribution = lengths(files);
    expect(distribution.median).toBeGreaterThanOrEqual(REFERENCE.titleMedian);
    expect(distribution.max).toBeGreaterThanOrEqual(REFERENCE.titleMax);
  }, 60_000);
});
