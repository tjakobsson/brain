import { describe, expect, it } from "vitest";
import {
  createNotFoundResult,
  resolveNotFoundContext,
  stableNotFoundHash,
  type NotFoundInput,
  type NotFoundSearchCandidate,
} from "./not-found";

const brains = [
  { id: "research", title: "Research" },
  { id: "engineering", title: "Engineering" },
  { id: "design", title: "Design" },
] as const;

const candidates: readonly NotFoundSearchCandidate[] = [
  {
    title: "Design systems",
    route: "/brains/design/notes/design-systems",
    kind: "note",
    tags: ["systems", "design"],
    brainId: "design",
    brainTitle: "Design",
    brainAccent: "#333333",
  },
  {
    title: "Research methods",
    route: "/brains/research/notes/research-methods",
    kind: "note",
    tags: ["methods"],
    brainId: "research",
    brainTitle: "Research",
    brainAccent: "#111111",
  },
  {
    title: "Fault budgets",
    route: "/brains/engineering/notes/fault-budgets",
    kind: "note",
    tags: ["reliability"],
    brainId: "engineering",
    brainTitle: "Engineering",
    brainAccent: "#222222",
  },
];

function input(overrides: Partial<NotFoundInput> = {}): NotFoundInput {
  return {
    deploymentBase: "/brain-site",
    pathname: "/brain-site/missing",
    search: "",
    brains,
    mode: "workspace",
    candidates,
    ...overrides,
  };
}

const ignoredQueries = [
  "?brains=engineering,design",
  "?brains=engineering",
  "?brains=missing",
  "?brains=research&brains=design",
  "?other=value&brains=engineering",
];

describe("resolveNotFoundContext", () => {
  it("recovers to the Brain graph beneath a namespaced Brain path", () => {
    expect(
      resolveNotFoundContext(
        input({ pathname: "/brain-site/brains/engineering/notes/missing" }),
      ),
    ).toEqual({
      source: "brain-path",
      brainIds: ["engineering"],
      recoveryRoute: "/brains/engineering",
      recoveryHref: "/brain-site/brains/engineering",
    });
  });

  it("recovers to the full workspace graph outside any Brain path", () => {
    expect(resolveNotFoundContext(input())).toEqual({
      source: "unscoped",
      brainIds: [],
      recoveryRoute: "/",
      recoveryHref: "/brain-site/",
    });
    expect(
      resolveNotFoundContext(input({ deploymentBase: "/brain-site/", pathname: "/brain-site/tags/missing" })),
    ).toEqual({
      source: "unscoped",
      brainIds: [],
      recoveryRoute: "/",
      recoveryHref: "/brain-site/",
    });
  });

  it.each(ignoredQueries)("ignores %s outside any Brain path", (search) => {
    expect(resolveNotFoundContext(input({ search }))).toEqual({
      source: "unscoped",
      brainIds: [],
      recoveryRoute: "/",
      recoveryHref: "/brain-site/",
    });
  });

  it.each(ignoredQueries)("recovers from the path alone when %s is present", (search) => {
    expect(
      resolveNotFoundContext(
        input({ pathname: "/brain-site/brains/engineering/notes/missing", search }),
      ),
    ).toEqual({
      source: "brain-path",
      brainIds: ["engineering"],
      recoveryRoute: "/brains/engineering",
      recoveryHref: "/brain-site/brains/engineering",
    });
  });

  it("strips a root or subpath base only at a path-segment boundary", () => {
    expect(
      resolveNotFoundContext(
        input({
          deploymentBase: "/",
          pathname: "/brains/design/missing",
        }),
      ),
    ).toMatchObject({ source: "brain-path", brainIds: ["design"] });

    expect(
      resolveNotFoundContext(
        input({
          deploymentBase: "/brain",
          pathname: "/brain-site/brains/design/missing",
        }),
      ),
    ).toEqual({
      source: "unscoped",
      brainIds: [],
      recoveryRoute: "/",
      recoveryHref: "/brain/",
    });
  });

  it.each([
    "/brain-site/brains/missing/notes/nope",
    "/brain-site/brains//notes/nope",
    "/brain-site/brains/engineeringish/notes/nope",
    "/brain-site/archive/brains/engineering/notes/nope",
    "/brain-site/brains/%65ngineering/notes/nope",
    "/brain-site/brains/engineering%2Fdesign/notes/nope",
  ])("does not infer unknown or malformed path context from %s", (pathname) => {
    expect(resolveNotFoundContext(input({ pathname }))).toEqual({
      source: "unscoped",
      brainIds: [],
      recoveryRoute: "/",
      recoveryHref: "/brain-site/",
    });
  });

  it("keeps vault mode unscoped regardless of workspace-looking inputs", () => {
    expect(
      resolveNotFoundContext(
        input({
          mode: "vault",
          pathname: "/brain-site/brains/engineering/missing",
          search: "?brains=research,design",
        }),
      ),
    ).toEqual({
      source: "unscoped",
      brainIds: [],
      recoveryRoute: "/",
      recoveryHref: "/brain-site/",
    });
  });
});

describe("createNotFoundResult", () => {
  it("recommends across the whole workspace and ignores non-note and unknown-owner entries", () => {
    const tag: NotFoundSearchCandidate = {
      ...candidates[0],
      title: "#systems",
      route: "/brains/design/tags/systems",
      kind: "tag",
    };
    const unknown: NotFoundSearchCandidate = {
      ...candidates[0],
      title: "Unknown owner",
      route: "/brains/missing/notes/unknown",
      brainId: "missing",
      brainTitle: "Missing",
    };
    const result = createNotFoundResult(input({ candidates: [tag, unknown, ...candidates] }));

    expect(result.context.source).toBe("unscoped");
    expect(result.candidates.map(({ brainId }) => brainId)).toEqual([
      "design",
      "engineering",
      "research",
    ]);
    expect(result.recommendation?.href).toMatch(/^\/brain-site\/brains\/(design|engineering|research)\//);
  });

  it("ignores a brains query and never reflects it in recovery links", () => {
    const result = createNotFoundResult(input({ search: "?brains=engineering,design" }));

    expect(result.context).toEqual({
      source: "unscoped",
      brainIds: [],
      recoveryRoute: "/",
      recoveryHref: "/brain-site/",
    });
    expect(result.candidates.map(({ brainId }) => brainId)).toEqual([
      "design",
      "engineering",
      "research",
    ]);
    expect(result.recommendation?.href).not.toMatch(/[?#]/);
    expect(result.context.recoveryHref).not.toMatch(/[?#]/);
  });

  it("scopes recommendations to the Brain named by the path, ignoring query values", () => {
    const result = createNotFoundResult(
      input({
        pathname: "/brain-site/brains/engineering/notes/missing",
        search: "?brains=research,design",
      }),
    );

    expect(result.context.source).toBe("brain-path");
    expect(result.candidates).toEqual([candidates[2]]);
    expect(result.recommendation).toMatchObject({
      candidate: candidates[2],
      href: "/brain-site/brains/engineering/notes/fault-budgets",
      hasAnother: false,
    });
  });

  it("orders and chooses candidates independently of input order", () => {
    const forward = createNotFoundResult(input());
    const reverse = createNotFoundResult(input({ candidates: [...candidates].reverse() }));

    expect(forward.candidates).toEqual(reverse.candidates);
    expect(forward.recommendation).toEqual(reverse.recommendation);
    expect(createNotFoundResult(input()).recommendation).toEqual(forward.recommendation);
  });

  it("advances deterministically through every candidate and wraps to the initial note", () => {
    const results = [0, 1, 2, 3].map((advance) => createNotFoundResult(input(), advance));
    const indexes = results.map((result) => result.recommendation?.index);

    expect(new Set(indexes.slice(0, 3)).size).toBe(3);
    expect(indexes[3]).toBe(indexes[0]);
    expect(results.every((result) => result.recommendation?.hasAnother)).toBe(true);
  });

  it("normalizes negative and oversized advance values", () => {
    expect(createNotFoundResult(input(), -1).recommendation).toEqual(
      createNotFoundResult(input(), candidates.length - 1).recommendation,
    );
    expect(createNotFoundResult(input(), candidates.length + 1).recommendation).toEqual(
      createNotFoundResult(input(), 1).recommendation,
    );
  });

  it("returns no recommendation when the path Brain has no note candidates", () => {
    expect(
      createNotFoundResult(
        input({
          pathname: "/brain-site/brains/design/notes/missing",
          candidates: candidates.filter(({ brainId }) => brainId !== "design"),
        }),
      ),
    ).toMatchObject({ candidates: [], recommendation: null });
  });

  it("uses all note candidates in vault mode", () => {
    const unknownOwner = {
      ...candidates[0],
      route: "/notes/local" as const,
      brainId: "local",
      brainTitle: "Brain",
    };
    const result = createNotFoundResult(
      input({ mode: "vault", brains: [], candidates: [unknownOwner] }),
    );

    expect(result.candidates).toEqual([unknownOwner]);
    expect(result.recommendation).toMatchObject({
      candidate: unknownOwner,
      href: "/brain-site/notes/local",
      hasAnother: false,
    });
  });
});

describe("stableNotFoundHash", () => {
  it("returns a stable unsigned hash", () => {
    expect(stableNotFoundHash("/missing\n?brains=research")).toBe(3_117_865_390);
    expect(stableNotFoundHash("/missing\n?brains=research")).toBe(
      stableNotFoundHash("/missing\n?brains=research"),
    );
  });
});
