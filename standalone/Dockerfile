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
LABEL org.opencontainers.image.source="https://github.com/tiagozip/cap" \
  org.opencontainers.image.url="https://github.com/tiagozip/cap" \
  org.opencontainers.image.title="cap" \
  org.opencontainers.image.description="Cap standalone server: a lightweight, open-source proof-of-work captcha" \
  org.opencontainers.image.licenses="Apache-2.0"
COPY --from=prod /temp/prod/standalone/node_modules node_modules
COPY --from=prerelease /usr/src/app .
WORKDIR /usr/src/app
RUN mkdir -p data && chown bun:bun data

EXPOSE 3000/tcp

USER bun

ENTRYPOINT [ "bun", "run", "./src/index.js" ]
