# ADR 0003: Accept CC-BY-3.0 SPDX data in the generator image

- **Status:** Accepted
- **Date:** 2026-08-27
- **Decided with:** project owner after reviewing the resulting image SBOM

## Context

ADR 0002 approved the package-level license inventory published in the signed
SBOM for the pinned Chainguard Node image. A deeper Syft scan of the completed
generator image also inspected JavaScript packages bundled inside Wolfi's
`npm-12` package. It found `spdx-exceptions@2.5.0` at
`/usr/lib/node_modules/npm/node_modules/spdx-exceptions` with a declared
`CC-BY-3.0` license.

The package is not part of the application's npm dependency tree. It is an
unmodified data package bundled with npm and contains SPDX license-exception
identifiers copied from the SPDX specification. Its package manifest names The
Linux Foundation as author and Kyle E. Mitchell as contributor. The upstream
README attributes the underlying specification to Linux Foundation and its
contributors.

The bundled package contains its manifest and JSON data but omits the upstream
README. The generator image therefore includes a root-level
`THIRD_PARTY_NOTICES.md` with the copyright, attribution, source, and
CC-BY-3.0 license URL.

## Decision

Allow `CC-BY-3.0` only for the unmodified `spdx-exceptions@2.5.0` data package
bundled inside npm in the generator image pinned by ADR 0002. This does not add
CC-BY-3.0 to the general application dependency allowlist.

The distributed image must retain `THIRD_PARTY_NOTICES.md`. A different package
version, use outside the npm data-package role, modification of the data, or a
new Creative Commons license requires another review.

## Rationale

- The project owner explicitly accepted this narrow image-scoped exception.
- The package is factual metadata used by npm's license tooling, not generator
  application code or generated-site content.
- The data is distributed unmodified with clear attribution and a license URL.
- Keeping the notice in the final image addresses the attribution omitted from
  the base image's nested npm package directory.

## Consequences

- Include `THIRD_PARTY_NOTICES.md` in every published generator image.
- Treat absence of the notice or drift from `spdx-exceptions@2.5.0` as a release
  verification failure.
- Continue applying ADR 0001 to libvips and lightningcss and ADR 0002 to Wolfi
  packages and npm's Artistic-2.0 license.
