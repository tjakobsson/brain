# Releasing Brain

Stable releases promote a tested candidate image. They do not rebuild it.

## Prepare the candidate

1. Update `CHANGELOG.md`, package metadata, dependencies, base-image records, and public documentation.
2. Run the complete verification suite from `README.md`.
3. Commit and push the final image source.
4. Wait for the Candidate image workflow, then record its source commit and OCI digest in `release/candidate.json`.
5. Run `node scripts/release-check.mjs --write --verify-remote` and commit the candidate metadata and immutable digest pins.
6. Verify Generator Action parity and Release dry run pass for the recorded candidate.
7. Rerun verification and `node scripts/release-check.mjs --verify-remote --require-unreleased` from the clean candidate-pin commit.

## Publish

1. Create the immutable annotated tag `vX.Y.Z` at the verified release commit and push it.
2. Wait for the Release workflow. It validates the candidate, attaches exact, minor, maintained-major, and `latest` OCI aliases to the recorded digest, creates the GitHub Release, and moves the maintained Git major tag.
3. Verify every OCI alias resolves to `release/candidate.json`'s digest and both the exact and maintained-major Action references build the public fixtures.
4. Confirm the release notes identify the release commit, image source commit, OCI digest, SBOM, provenance, and compatibility major.

Exact `vX.Y.Z` Git and OCI tags are immutable. Only the matching maintained major reference moves for compatible releases.
