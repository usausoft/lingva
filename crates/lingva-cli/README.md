# Lingva CLI engine

The crates.io package is named `lingva`. This crate is the single implementation
of Lingva's customer CLI. It builds the
standalone `lingva` executable used by direct downloads, Homebrew, npm, and
PyPI. Language packages may locate and launch this binary, but must not
reimplement CLI behavior.

Engine version **0.1.4** provides the complete command surface below. Verify
`lingva --version` when upgrading an older installation.

## Customer command surface

Customer commands execute in Rust:

- `lingva auth login|sso|use-key|status|logout`
- `lingva init`
- `lingva update`
- `lingva sync|check`
- `lingva pull|push`
- `lingva metadata|apply|approve|studio|drafts|validate`
- `lingva manifest|bundle|publish|invalidate|workflow`
- `lingva types|helpers|export|import|extract`

Install the published crate (requires Rust):

```bash
cargo install lingva
```

macOS/Linux customers can install the checksummed engine without Rust:

```bash
brew install usausoft/tap/lingva
lingva --version
```

The public tap initially mirrored the original 0.1.3 archives unchanged.
Its daily updater follows newer
stable npm releases after their public archives/checksums are available.

For customers without a Rust toolchain, the release distribution supports
standalone installers, Homebrew, the npm `@lingva/cli` adapter, and the separate
PyPI `lingva-cli` adapter. These routes launch the same pinned binary. The npm
package is the public archive channel; a private GitHub release is not a
customer download source.

The Python `lingva-sdk` package supplies the translation runtime, not the CLI.
When upgrading an installation where the SDK supplied the `lingva` console
script, upgrade `lingva-sdk` to 0.1.5 first, then install `lingva-cli`. Installing
the CLI last prevents the older SDK's uninstall step from removing the shared
console script. Project files and credentials require no data migration.

## Configuration and examples

Use `lingva.config.yaml` as the portable command contract. JSON is also
supported. The standalone Rust executable rejects executable JavaScript and
TypeScript configurations; it does not evaluate application code. The npm
adapter offers an explicit compatibility bridge for those files, described in
the [npm README](../../packages/cli/README.md).

Onboarding and authentication:

```bash
lingva auth login
lingva auth status
lingva init --sdk python
lingva update
# Account-free alternative:
lingva init --mode local --no-auth --sdk python
```

Local translation editing and verification:

```bash
lingva sync
lingva metadata --check
lingva check
lingva validate --fail-on variant-drift
lingva apply --locale fr --input reviewed-fr.json
lingva studio --output .lingva/studio.html
```

Artifacts and source analysis:

```bash
lingva manifest --format json --output .lingva/manifest.json
lingva bundle --locale en --format json --output .lingva/en.bundle.json
lingva publish --local-only --output-dir .lingva/artifacts
lingva publish --dry-run --format json
lingva workflow --format json
lingva types --output .lingva/types.ts
lingva helpers --output .lingva/helpers.ts
lingva export --output .lingva/export.json
lingva import imported-resources.json --project lingva.config.yaml --output .lingva/import.json
lingva extract src --project lingva.config.yaml --fail-on missing
```

Hosted collaboration requires configured project endpoints and credentials:

```bash
lingva pull
lingva drafts --status draft --limit 20
lingva approve --draft reviewed-draft.json --dry-run
lingva push --invalidate
lingva invalidate --source manual --reason "External translation update"
```

`publish` writes artifacts and uploads when a hosted publish endpoint is
configured; it is not an inherently offline command. Run each command with
`--help` for its flags and required inputs. `auth login --device` requires a
provider that supports OAuth device authorization.
Use `--local-only` to export without hosted mutation and `--dry-run` to preview
without output writes. Update checks preserve the installation channel; override
with `--channel` when needed. Extraction reports dynamic calls and supports exact
`--callee` selectors to exclude unrelated translation-like helpers.

## Behavioral guarantees

- `init` defaults to authenticated remote mode; account-free setup requires
  `--mode local --no-auth` explicitly.
- `sync` is local-only and preserves translated strings. Variant IDs and
  metadata align to the default locale while translated variant text survives.
- `check` never writes and combines local schema alignment with translation,
  variant, metadata, and workflow validation. Validation thresholds and issue
  filters control policy failures.
- `pull` completes all selected three-way merges before writing, preventing
  partial updates on conflict.
- File-backed translation batches use a durable undo journal and write lock.
  Failed batches roll back; config loading recovers interrupted batches.
- `push` uses the last common revision and a semantic SHA-256 mutation ID;
  `--force` deliberately removes the optimistic guard.
- `push --invalidate` invalidates delivery only after successful publication
  and revision persistence. An invalidation failure does not undo publication.
- explicit command tokens override environment, config, and stored credentials.
- text output is for people; `--format json` is the automation contract.

The npm adapter may evaluate legacy JS/TS inputs and pass
portable JSON to Rust, but it does not implement customer command behavior.
Migrated customer commands never fall back to TypeScript or Python.

Release archives cover macOS ARM64/x64, Linux ARM64 GNU/x64 musl, and Windows
x64. Adapters verify SHA-256 against the distributed checksum file. This proves
archive integrity relative to that file, not independent publisher authenticity;
the registry/CDN and any configured asset mirror remain trust boundaries.

## Business organization SSO

Sign in to your native platform account first, then verify the organization:

```bash
lingva auth login
lingva auth sso --organization-id org_example
```

The browser asks you to confirm SSO using the same native account. The CLI polls
for verification of its existing access token; it stores no provider token and
creates no membership. Accept the organization's invitation separately. Use
`--no-browser` to open the displayed URL manually and `--platform-url` for another
platform origin. The default timeout is 600 seconds. Token refresh requires fresh
SSO verification. Project API keys remain separate credentials for unattended
project operations and do not represent organization user sessions.
