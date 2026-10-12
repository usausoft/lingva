# Lingva

Lingva consumer SDKs, standalone CLI, examples, and public documentation. This is a pnpm + Turborepo monorepo. Public source remains licensed under the applicable Lingva license; see LICENSE-SCOPE.md.

## Development

Use Node.js 24 and pnpm 12.8.1. Run `pnpm install --frozen-lockfile`, `pnpm build:packages`, and `pnpm verify:packages`. Run `pnpm dev:consumer` for the autonomous Next.js starter or `pnpm dev:docs` for public documentation.

The standalone Rust engine owns customer command behavior. Run `cargo test --workspace --locked` and `pnpm verify:cli-adapters`. npm and Python adapters install its checksummed binary.

Native Swift, Kotlin, and Flutter SDKs are source previews. Python packages are published to PyPI.

## Releases

Keep package names and immutable published versions. SDKs use Changesets and `v*` tags. CLI releases use `cli/v*`; Python packages use `python-sdk/v*` and `python-cli/v*` tags. The next CLI/adapters version is 0.1.5.

