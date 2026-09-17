FROM oven/bun:1.4.0-slim AS base
WORKDIR /usr/src/app

FROM base AS install
RUN mkdir -p /temp/dev/standalone
COPY standalone/package.json standalone/bun.lock /temp/dev/standalone/
RUN cd /temp/dev/standalone && bun install

FROM base AS prod
RUN mkdir -p /temp/prod/standalone
COPY standalone/package.json standalone/bun.lock /temp/prod/standalone/
RUN cd /temp/prod/standalone && bun install --production

FROM base AS prerelease
COPY --from=install /temp/dev/standalone/node_modules node_modules
COPY standalone/. .

FROM base AS release
COPY --from=prod /temp/prod/standalone/node_modules node_modules
COPY --from=prerelease /usr/src/app .
WORKDIR /usr/src/app
RUN mkdir -p data && chown bun:bun data

EXPOSE 3000/tcp

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD bun -e "fetch('http://127.0.0.1:' + (process.env.SERVER_PORT || 3000) + '/readyz').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

USER bun

ENTRYPOINT [ "bun", "run", "./src/index.js" ]
