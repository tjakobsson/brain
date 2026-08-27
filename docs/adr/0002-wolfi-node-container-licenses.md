# ADR 0002: Accept Wolfi Node licenses for the generator image

- **Status:** Accepted
- **Date:** 2026-08-27
- **Decided with:** project owner after reviewing the signed image SBOM and public image tracks

## Context

The generator will be distributed as a non-root OCI build tool based on the
public Chainguard Node image. The repository normally accepts only its listed
permissive licenses, and ADR 0001 covers only libvips and lightningcss in the
JavaScript dependency tree. Wolfi runtime packages introduce additional
copyleft license expressions, while npm and node-gyp use Artistic-2.0.

On 2026-08-27, the public `latest` tag resolved to this signed multi-platform
image:

| Object | Digest |
| --- | --- |
| OCI index | `sha256:3cf2a28e10607bd6758a4e56fbd5580ab9d041f2126e4e79ae50af29f9317f54` |
| `linux/amd64` manifest | `sha256:1aea2610fda34783809f9cd71262d68e3b0111d35002bcf9fc8c2837427b45cc` |
| `linux/arm64` manifest | `sha256:e6a0456c553de5c060ee94208aeb0ff9a8eb9f7433a8651bdc2bb1d20e7af0e3` |

The image was created on 2026-08-25 and contains Node `26.7.0-r0`. Node 26 was
the Current release line, and upstream `26.8.1` was available when this decision
was made. No security-specific fix was identified in that patch difference,
and the image's reported glibc findings were either disputed or did not apply
to its installed glibc 2.44. The digest must nevertheless be refreshed and
re-audited before release acceptance rather than treating this inspection as a
permanent claim that the image is vulnerability-free.

Public Node 24 LTS tags were listed in Chainguard's catalog but were not
anonymously pullable. The project owner chose the signed public Node 26 image
instead of requiring private catalog access or waiting for a tag refresh.

The signed SPDX 2.3 SBOMs contain the same 27 installed APK package records on
both architectures. These are the records outside the repository allowlist:

| Package | License expression |
| --- | --- |
| `busybox` | GPL-2.0-only |
| `ca-certificates-bundle`, `zlib` | MPL-2.0 AND MIT |
| `glibc-2.44`, `glibc-2.44-locale-posix`, `ld-linux-2.44`, `libcrypt1-2.44` | LGPL-2.1-or-later |
| `libev` | BSD-2-Clause OR GPL-2.0-or-later |
| `libgcc`, `libstdc++` | GPL-3.0-or-later WITH GCC-exception-3.1 |
| `libxcrypt` | GPL-2.0-or-later AND LGPL-2.1-or-later |
| `node-gyp`, `npm-12` | Artistic-2.0 |

The exact additional license expressions are therefore Artistic-2.0,
GPL-2.0-only, LGPL-2.1-or-later, MPL-2.0, and GPL-2.0-or-later or
GPL-3.0-or-later where an alternative license or runtime exception applies.
The SBOM reports `NOASSERTION` for package copyright text, so release compliance
must retain and inspect package license and notice files rather than relying on
the SBOM for attribution.

## Decision

Allow the unmodified packages and license expressions above only in the pinned
Wolfi/Chainguard Node stages and the distributed generator build-tool image.
Artistic-2.0 is accepted within the same boundary for npm and node-gyp. This ADR
does not add these licenses to the general application dependency allowlist.

Container definitions must pin the inspected OCI index by digest. A different
digest, variant, or added Wolfi package requires a fresh signed-SBOM comparison.
Any new package or license expression outside this inventory requires explicit
approval before the image reference is updated.

## Rationale

- The container is a build tool that converts caller-owned Markdown into a
  static site; these packages are not copied into generated site output.
- The packages remain unmodified and separately identifiable. LGPL libraries
  are dynamically linked, GCC runtime packages carry the GCC runtime exception,
  and `libev` offers the allowed BSD-2-Clause alternative.
- Chainguard publishes verifiable signatures, SPDX SBOM attestations, and SLSA
  provenance for both selected platforms.
- Pinning the index digest makes the approved inventory stable and lets CI
  detect an intentional base-image update before release.

## Consequences

- Keep image package licenses and notices available in the distributed image
  and release materials.
- Verify image signatures and both platform SBOM attestations during base-image
  updates and release checks.
- Compare every replacement digest's package and license inventory with this
  ADR. License drift blocks the update until it is covered by policy or another
  accepted ADR.
- Re-pin to the latest suitable signed, security-patched public image before the
  first release and record the resulting digest in both automation surfaces.
- ADR 0001 continues to govern libvips and lightningcss copied with the
  generator's JavaScript dependencies. Unrelated dependencies do not inherit
  this exception.

## Verification record

The index digest was resolved from the registry's OCI Distribution API. Cosign
verification used certificate identity
`https://github.com/chainguard-images/images/.github/workflows/release.yaml@refs/heads/main`
and issuer `https://token.actions.githubusercontent.com`. The index, both
platform manifests, SPDX attestations, SLSA provenance, certificate chains, and
transparency-log inclusion verified successfully.

The authoritative image metadata and SBOM are published at:

- <https://images.chainguard.dev/directory/image/node/versions>
- <https://images.chainguard.dev/directory/image/node/sbom>
- <https://images.chainguard.dev/directory/image/node/provenance>
