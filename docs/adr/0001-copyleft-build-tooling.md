# ADR 0001: Accept LGPL-3.0 and MPL-2.0 for build-time tooling

- **Status:** Accepted
- **Date:** 2026-08-26
- **Decided with:** project owner after reviewing commercial-service compatibility

## Context

The project dependency policy is permissive-licenses-only, with copyleft requiring
an explicit, recorded exception. A license audit of the dependency tree found two
copyleft packages, both transitive build-time tooling:

| Package | License | Role |
| --- | --- | --- |
| `@img/sharp-libvips-*`, through `sharp` and Astro | LGPL-3.0-or-later | Build-time image optimization |
| `lightningcss` (+ platform binary) | MPL-2.0 | CSS processing inside Astro/Vite |

The project does not import either package directly. Astro brings them into the
dependency tree for image and CSS processing.

## Decision

Allow both packages as dependencies. New copyleft packages still require their own
ADR before being added.

## Rationale

- **Build-time only.** Neither library ships in the site output. `dist/` contains
  no copyleft code. They run unmodified, as separate prebuilt components, during
  `astro build`.
- **Library use as intended.** LGPL permits commercial products to use an
  unmodified library. Its obligations matter if we modify libvips or remove its
  notices. MPL-2.0 applies copyleft at the file level. We do not modify its files.
- **Commercial-service compatibility.** LGPL has no network-use clause. AGPL does,
  and the dependency tree contains no AGPL packages. MPL-2.0 requires modified
  MPL files to stay under MPL. This project does not modify them.
- **Normal ecosystem use.** Astro and Vite use these packages for their standard
  image and CSS pipelines.

## Consequences

- The permissive allowlist also includes `Python-2.0` and `BlueOak-1.0.0`.
  Both are permissive and non-copyleft. They appear through `argparse`,
  `lru-cache`, `sax`, and `common-ancestor-path`.
- Re-run the license audit (`npx license-checker-rseidelsohn --onlyAllow ...` plus
  these two ADR'd exceptions) whenever dependencies change. New copyleft findings
  require a new ADR before merge.
- If the project starts modifying `libvips` or `lightningcss` source, revisit
  this ADR. The decision depends on unmodified use.
