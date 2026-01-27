# contributing

## development setup

- you need to have the latest version of [Bun](https://bun.com/) installed for building the widget, server, standalone, solver and docs, and Rust for WASM

- zed is the recommended IDE for working on Cap, but VSCode also works well.

- for writing docs, make sure to place them inside of `docs/guide` and make sure to update the sidebar in `docs/.vitepress/config.mjs`.

run `bun install` in each Bun package you want to work on to install dependencies.

## tips

- we recommend [Biome](https://biomejs.dev/) for formatting and linting. please fix all errors and warnings before submitting a PR

- [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/) are preferred