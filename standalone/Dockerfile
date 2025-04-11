FROM oven/bun:1 AS base
WORKDIR /usr/src/app

FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

FROM base AS prod
RUN mkdir -p /temp/prod
COPY package.json bun.lock /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

FROM base AS release
COPY --from=prod /temp/prod/node_modules node_modules
COPY --from=prerelease /usr/src/app .
WORKDIR /usr/src/app

EXPOSE 3000/tcp

USER bun

ENTRYPOINT [ "bun", "run", "./src/index.js" ]