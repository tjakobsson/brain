FROM cgr.dev/chainguard/node:latest@sha256:d6ca8dfc9d0a8f369cd86c0bb6a8f9e4b304b3bb12aaf8fd26bd1352e6b6efc1 AS dependencies

WORKDIR /app
COPY --chown=65532:65532 package.json package-lock.json ./
RUN ["/usr/bin/npm", "ci", "--omit=dev"]

FROM cgr.dev/chainguard/node:latest@sha256:d6ca8dfc9d0a8f369cd86c0bb6a8f9e4b304b3bb12aaf8fd26bd1352e6b6efc1

ENV ASTRO_TELEMETRY_DISABLED=1 \
    BRAIN_WORK=/work \
    HOME=/work/home \
    NODE_ENV=production \
    TMPDIR=/tmp \
    XDG_CACHE_HOME=/work/cache
WORKDIR /app
RUN ["/usr/bin/node", "-e", "require('node:fs').symlinkSync('/work/astro-types', '/app/.astro')"]
COPY --from=dependencies --chown=65532:65532 /app/node_modules ./node_modules
COPY --chown=65532:65532 package.json package-lock.json astro.config.ts tsconfig.json LICENSE THIRD_PARTY_NOTICES.md ./
COPY --chown=65532:65532 examples/demo-vault ./examples/demo-vault
COPY --chown=65532:65532 public ./public
COPY --chown=65532:65532 scripts/generator.mjs scripts/generator-inputs.mjs scripts/generator-safety.mjs scripts/live-server.mjs scripts/static-server.mjs ./scripts/
COPY --chown=65532:65532 src ./src

USER 65532:65532
EXPOSE 4321
ENTRYPOINT ["/usr/bin/node", "/app/scripts/generator.mjs"]
CMD ["--help"]
