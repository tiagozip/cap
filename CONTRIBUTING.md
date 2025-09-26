# Contributing

Thanks for your interest in contributing to Cap!

## Ways to help

- Report bugs by opening issues.
- Suggest features with clear use cases.
- Improve docs or add examples.
- Submit pull requests.

## Development setup

**Notes**:

- You need to have the latest release version of [Bun](https://bun.com/) installed. For WASM, Rust is also required.

- VSCode is the recommended IDE for working on Cap.

- Put new docs in `docs/guide` and make sure to update the sidebar in `docs/.vitepress/config.mjs`, not scattered in subfolders.

Run `bun install` in each package you want to work on.

## Guidelines

- Formatting uses [Biome](https://biomejs.dev/). Make sure there are no warnings or errors before submitting a PR.

- Keep PRs small and focused.

- We prefer conventional commits, but they are not enforced. See [here](https://www.conventionalcommits.org/en/v1.0.0/) for reference.

- Avoid excessive duplication of code or code comments.

- No AI-generated code please! AI autocomplete is fine, but not fully AI code. If you submit AI-generated code without making it clear, it may be rejected.

- Don't edit type files directly, they're auto-generated from JSDoc comments.

- For optimizations, please always publish a benchmark of the before/after difference before submitting a PR, ideally including your device specs. RAM/CPU usage is also appreciated.

Maintainers may reject PRs at their discretion if they don't follow these guidelines or don't align with the project's goals.

Please also read our [code of conduct](CODE_OF_CONDUCT.md).
