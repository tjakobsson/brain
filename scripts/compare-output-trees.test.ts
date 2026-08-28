import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";

const roots: string[] = [];

function text(value: string): Buffer {
  return Buffer.concat([Buffer.from([0x60 + value.length]), Buffer.from(value)]);
}

function pair(name: string, id: number): Buffer {
  return Buffer.concat([Buffer.from([0x82]), text(name), Buffer.from([0x81, id])]);
}

function tree(order: string[]): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brain-output-tree-"));
  roots.push(root);
  fs.mkdirSync(path.join(root, "pagefind", "filter"), { recursive: true });
  fs.mkdirSync(path.join(root, "pagefind", "index"), { recursive: true });
  fs.writeFileSync(path.join(root, "index.html"), "same site");
  fs.writeFileSync(path.join(root, "pagefind", "index", "en_same.pf_index"), "same index");

  const filterStem = order[0] === "design" ? "en_aaaaaaa" : "en_bbbbbbb";
  const filter = Buffer.concat([
    Buffer.from("pagefind_dcd"),
    Buffer.from([0x82]),
    ...order.map((name) => pair(name, name === "design" ? 0 : 1)),
  ]);
  fs.writeFileSync(
    path.join(root, "pagefind", "filter", `${filterStem}.pf_filter`),
    zlib.gzipSync(filter),
  );
  fs.writeFileSync(
    path.join(root, "pagefind", "pagefind.en_deadbeef00.pf_meta"),
    zlib.gzipSync(Buffer.from(`pagefind_dcd:${filterStem}`)),
  );
  fs.writeFileSync(
    path.join(root, "pagefind", "pagefind-entry.json"),
    JSON.stringify({ version: "1", languages: { en: { hash: "en_deadbeef00", wasm: "en", page_count: 2 } } }),
  );
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("generated output comparison", () => {
  it("normalizes Pagefind filter ordering without hiding other differences", () => {
    const first = tree(["design", "engineering"]);
    const second = tree(["engineering", "design"]);
    const compare = (...args: string[]) =>
      spawnSync(process.execPath, ["scripts/compare-output-trees.mjs", ...args], {
        encoding: "utf8",
      });

    expect(compare(first, second).status).not.toBe(0);
    expect(compare("--normalize-pagefind", first, second).status).toBe(0);

    fs.writeFileSync(path.join(second, "index.html"), "different site");
    expect(compare("--normalize-pagefind", first, second).status).not.toBe(0);
  });
});
