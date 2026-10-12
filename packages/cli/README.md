# `@lingva/cli`

The npm distribution adapter for Lingva's standalone Rust customer CLI. All
23 customer commands execute in the native engine.

This adapter pins engine version **0.1.5**. Check `lingva --version` when
upgrading an older installation; earlier releases expose fewer commands.

```bash
pnpm add -D --allow-build @lingva/cli @lingva/cli
pnpm lingva auth login
pnpm lingva init
```

`init` defaults to hosted remote mode. It uses the saved login, discovers the
user's projects, and asks for a project only when more than one is available.
Select an SDK with `--sdk react|next|angular|vue|svelte|vanilla|python`. Python
gets the portable `lingva.config.yaml`; JavaScript frameworks get their native
bootstrap.

Account-free local setup is explicit:

```bash
pnpm lingva init --mode local --no-auth --sdk python
```

CI never prompts. Authenticate with `lingva auth use-key`, then pass
`--non-interactive` plus the project/API parameters shown in the web setup
guide.

`lingva sync` is intentionally local: it aligns every locale file to the
default-locale key and variant schema without network access or overwriting
existing translations. Use `pull` and `push` for hosted synchronization.

Hosted synchronization uses `.lingva/remote-state.json`. `pull` performs a
three-way merge and refuses same-key conflicts. `push` sends the last pulled
publish revision, so the platform rejects stale writes with HTTP `409`.
Identical retries are idempotent. Use `--force` only for an intentional
last-writer-wins overwrite; the state file stays gitignored.

Run `lingva update` to check stable npm metadata without changing the project.
The npm adapter identifies its installation channel and recommends a pinned
pnpm upgrade. Use `--channel` to override detection for other installation routes.
Generated Linux CI checks pin both installer and engine asset versions.

Run `pnpm lingva --help` for the complete command list.

`pull` and `push` accept explicit `--api-url` and `--auth-token` overrides for
CI. `push --invalidate` performs delivery invalidation only after a confirmed
publish and persisted revision. `init --ci github` generates runtime-free local
checks using the standalone installer.

## Complete customer interface

Use the portable YAML config for examples that must work through standalone,
npm, and Python installations alike:

```bash
# Onboarding and credentials
pnpm lingva auth login
pnpm lingva init --mode local --no-auth --sdk react
pnpm lingva update

# Local editing and verification
pnpm lingva sync
pnpm lingva metadata --check
pnpm lingva check
pnpm lingva validate --fail-on variant-drift
pnpm lingva apply --locale fr --input reviewed-fr.json
pnpm lingva studio --output .lingva/studio.html

# Artifacts and source analysis
pnpm lingva manifest --format json --output .lingva/manifest.json
pnpm lingva bundle --locale en --format json --output .lingva/en.bundle.json
pnpm lingva publish --local-only --output-dir .lingva/artifacts
pnpm lingva publish --dry-run --format json
pnpm lingva workflow --format json
pnpm lingva types --output .lingva/types.ts
pnpm lingva helpers --output .lingva/helpers.ts
pnpm lingva export --output .lingva/export.json
pnpm lingva import imported-resources.json --project lingva.config.yaml --output .lingva/import.json
pnpm lingva extract src --project lingva.config.yaml --fail-on missing

# Hosted collaboration: configure endpoints and credentials first
pnpm lingva pull
pnpm lingva drafts --status draft --limit 20
pnpm lingva approve --draft reviewed-draft.json --dry-run
pnpm lingva push --invalidate
pnpm lingva invalidate --source manual --reason "External translation update"
```

`publish` also uploads when a hosted endpoint is configured. Use `--local-only`
for artifact-only generation or `--dry-run` for a non-writing preview. `check` never
writes and combines schema alignment with translation, variant, metadata, and
workflow validation. Run each command with `--help` for its supported options.

## JavaScript and TypeScript compatibility

The standalone engine accepts portable YAML and JSON, not executable JS/TS
configuration. The npm adapter provides an explicit evaluation bridge for
legacy JS/TS project/config inputs: it executes the input using Node, writes a
temporary portable JSON document beside that input, and passes its path to
Rust. Same-directory placement preserves relative translation and metadata
paths. Temporary files use mode `0600` on Unix and are removed after command
completion, including normal failure paths. A forcibly terminated process may
leave a temporary file behind.

Executable configuration is code execution: only use files you trust. The
bridge does not provide a sandbox, and the parent directory must be writable.
Use `lingva.config.yaml` for language-independent configuration and read-only
project environments. Do not maintain duplicate equivalent YAML and TypeScript
CLI configs. This bridge performs input conversion only; all customer behavior
remains in Rust. There is no hidden TypeScript customer-command fallback.

## Installation and trust boundaries

The package postinstall first uses the matching archive and `SHA256SUMS` bundled
under `assets/`. If those assets are absent, it downloads them from the public,
version-pinned npm CDN (`unpkg`). It verifies SHA-256 before installing the
executable under `vendor/`. The five release targets are macOS ARM64/x64,
Linux ARM64 GNU/x64 musl, and Windows x64.

Checksums provide archive integrity relative to the distributed checksum file,
not independent publisher authentication. The registry, CDN, and any custom
asset mirror remain trusted distribution boundaries. `LINGVA_CLI_BINARY` is an
authoritative operator/test override; a missing override fails rather than
selecting another binary. A missing native engine is an installation error;
migrated customer commands never fall back to their old TypeScript behavior.

Engine version pins are checked against `crates/lingva-cli/Cargo.toml` in CI so
npm cannot silently download a different implementation.

Python distribution separates concerns: `lingva-sdk` provides the translation
runtime and `lingva-cli` launches this same engine. For an older SDK installation
that owns the `lingva` console script, upgrade `lingva-sdk` to 0.1.5 first, then
install `lingva-cli` last. No project, translation, credential, or remote-state
data migration is required.

[Read the installation guide](https://docs.lingva.dev/installation/overview).
