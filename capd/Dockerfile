# syntax=docker/dockerfile:1
ARG BUN_VERSION=1.4.4

FROM oven/bun:${BUN_VERSION}-slim AS base
WORKDIR /usr/src/app

FROM base AS dashboard
COPY capd/package.json capd/bun.lock ./
RUN bun install --frozen-lockfile
COPY capd/vite.config.mjs ./
COPY capd/dashboard dashboard
RUN bun run build

FROM base AS deps
COPY capd/package.json capd/bun.lock ./
RUN bun install --frozen-lockfile --production
RUN apt-get update \
  && apt-get install -y --no-install-recommends binutils \
  && find node_modules -name 'libduckdb.so' -exec strip -s {} +
COPY core/package.json /tmp/capjs-core/package.json
COPY core/src /tmp/capjs-core/src
RUN rm -rf node_modules/capjs-core \
  && mv /tmp/capjs-core node_modules/capjs-core

FROM base AS release
LABEL org.opencontainers.image.source="https://github.com/tiagozip/cap" \
  org.opencontainers.image.url="https://trycap.dev" \
  org.opencontainers.image.title="cap" \
  org.opencontainers.image.description="capd, the Cap server: a lightweight, open-source proof-of-work captcha" \
  org.opencontainers.image.licenses="Apache-2.0"

ENV NODE_ENV=production \
  SERVER_PORT=3000 \
  DATA_DIR=/usr/src/app/data

COPY --chown=bun:bun capd/package.json ./
COPY --from=deps --chown=bun:bun /usr/src/app/node_modules node_modules
COPY --chown=bun:bun capd/src src
COPY --chown=bun:bun capd/public public
COPY --from=dashboard --chown=bun:bun /usr/src/app/public/dist public/dist
RUN mkdir -p data && chown bun:bun data

USER bun
VOLUME ["/usr/src/app/data"]
EXPOSE 3000/tcp

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD ["bun", "-e", "fetch(`http://127.0.0.1:${process.env.SERVER_PORT || 3000}/health`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

ENTRYPOINT ["bun", "run", "./src/index.js"]
