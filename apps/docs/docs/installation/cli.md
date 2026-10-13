---
sidebar_position: 10
---

# Customer CLI reference

The Rust `lingva` engine owns all customer commands. `@lingva/cli` (npm) and
`lingva-cli` (Python) install and launch the same engine. `lingva-sdk` is the
Python application runtime, not the CLI installer.

This reference describes CLI `0.1.5` and runtime-only Python SDK
`0.1.5`. Older installed packages may have a smaller command
surface. Check `lingva --version` and `lingva <command> --help`.

## Installation and configuration {#installation-and-configuration}

### Homebrew (macOS and Linux) {#homebrew-macos-and-linux}

```bash
brew install usausoft/tap/lingva
lingva --version
lingva --help
```

The [public tap](https://github.com/usausoft/homebrew-tap) installs the same Rust
engine, including an Apple Silicon binary. The commands below require **0.1.5**
or newer; use `lingva --version` to verify after upgrading.
Update with `brew update && brew upgrade lingva`;
remove with `brew uninstall lingva`.

Homebrew installs the standalone Rust customer CLI, not framework runtimes,
npm's executable JS/TS config bridge. Use portable YAML/JSON
configs. The tap's daily updater follows newer stable npm CLI releases only after
their public archives and checksums are available; it never downgrades the seed.
The initial 0.1.3 archives are hosted publicly in the tap, unchanged from the
original GitHub release. No private GitHub credentials are needed to install.

### npm, Python, or Rust {#npm-python-or-rust}

Choose one installation route:

```bash
pnpm add -D --allow-build=@lingva/cli @lingva/cli@0.1.5
pnpm exec lingva --version

python -m pip install lingva-cli
lingva --version

# Compiles the same executable; requires Rust.
cargo install lingva
```

When migrating Python, upgrade `lingva-sdk` to the runtime-only release first,
then install or force-reinstall `lingva-cli`. Earlier SDK versions owned the
same console script and uninstalling them afterwards could remove it.

Supported prebuilt platforms are macOS arm64/x64, Linux arm64 GNU/x64 musl,
and Windows x64. npm extracts its bundled, checksum-verified engine during
postinstall. The pnpm command above permits only this package's install script.
For an existing installation, run `pnpm approve-builds` and select `@lingva/cli`,
then verify `pnpm exec lingva --version`. Python downloads on first launch,
checks cached integrity on every launch, and can subsequently work offline.
Unsupported platforms fail explicitly; Rust source builds are another route.

`LINGVA_CLI_BINARY` selects an existing executable explicitly. A missing override
is an error, never a fallback. `LINGVA_CLI_VERSION` selects another semantic
engine version; `LINGVA_CLI_ASSET_BASE_URL` selects a trusted archive mirror.
Python also accepts `LINGVA_CLI_CACHE_DIR`. Checksums detect corruption, but do
not establish authenticity if the release channel itself is compromised.

Create one portable `lingva.config.yaml` per project:

```yaml
projectId: my-service
environment: dev
locales: [en, ru]
defaultLocale: en
fallbackLocale: en
translationFiles: .lingva/translations/{locale}.json
metadataFile: .lingva/metadata.json
apiKeyEnv: LINGVA_API_KEY
# For hosted transfer, add your project publish/delivery endpoint:
# apiUrl: https://your-project-api.example
cli:
  validate:
    failOn: error
  validatePolicies:
    release:
      failOn: warning
      maxIssues: 100
  extract:
    failOn: missing
  extractPolicies:
    release:
      failOn: any
  authoring:
    apiUrl: https://your-authoring-api.example
  publish:
    apiUrl: https://your-publish-api.example
  invalidate:
    apiUrl: https://your-publish-api.example
```

`projectId` and `environment` must be non-empty. Locale IDs must be safe
filename/URL segments. Defaults must belong to `locales`; multiple locales
require `{locale}` in `translationFiles`. Paths resolve relative to the config,
not the shell's working directory. Missing locale dictionaries start empty.
Secrets belong in environment variables or saved credentials, not YAML.

Most project commands take an optional first config path, defaulting to
`lingva.config.yaml`. The npm adapter also evaluates a trusted JS/TS config
when explicitly selected or discovered without YAML. It writes a private,
temporary portable document beside that config and removes it after execution.
Only configuration evaluation is JavaScript-owned; command behavior stays Rust.
Executable configs with inline resources support inspection and dry-run checks,
but durable mutations require file-backed `translationFiles` or a portable
JSON/YAML resource owner. The adapter rejects edits to disposable inline JS/TS
snapshots rather than reporting changes that would be lost during cleanup.
The standalone/Python routes reject executable JS/TS configs. Do not keep
equivalent YAML and TypeScript configs in one directory.

Normalized JSON exports can also serve as configs, with `resources` mapping
locale IDs to dictionaries. `apply`, `approve`, `sync`, and ordinary `pull`
update that inline resource owner instead of unused shadow locale files.

## Authentication: `auth` {#authentication-auth}

Hosted commands accept `--api-url` and `--auth-token` overrides. Explicit tokens
take precedence over environment/config keys and stored credentials. Keep tokens
out of logs and shell history; CI should inject masked environment secrets.

```bash
lingva auth login
lingva auth login --platform-url https://stage.lingva.dev --no-browser
lingva auth login --issuer-url "$ISSUER" --client-id "$CLIENT_ID"
lingva auth use-key --api-key "$LINGVA_API_KEY" --project-id my-service
lingva auth status --format json
lingva auth logout
```

Browser login discovers issuer/client settings from the platform and uses PKCE.
`--port` customizes the local callback. `--scope`, `--authorize-url`, and
`--token-url` override provider defaults when necessary.
Credentials are shared across adapters in `~/.lingva/credentials.json` and use
private file permissions on Unix. Expired OAuth credentials refresh when the
provider supplies a refresh token. `use-key` is the non-interactive CI route.

Device login requires an OAuth provider that actually supports device grants;
it does not enable device authorization in your platform:

```bash
lingva auth login --device --device-url "$DEVICE_AUTH_URL" \
  --issuer-url "$ISSUER" --client-id "$CLIENT_ID"
```

## Setup and upgrades: `init`, `update` {#setup-and-upgrades-init-update}

```bash
# Authenticated remote setup, default mode; discovers visible projects.
lingva init --sdk react

# Explicit account-free local setup.
lingva init --mode local --no-auth --sdk python \
  --project-id my-service --locale en,ru

# CI never prompts. Supply all identity/endpoint values explicitly.
lingva init --non-interactive --project-id my-service --locale en,ru \
  --environment stage --api-url "$LINGVA_PUBLISH_API_URL"

# Inspect files before writing; --force explicitly permits replacement.
lingva init --mode local --no-auth --dry-run --format json
lingva init --mode local --no-auth --sdk next --ci github
lingva init --mode local --no-auth --sdk react \
  --config config/lingva.config.yaml --locales-dir locales \
  --provider-file src/i18n/provider.tsx --bundle-url "$BUNDLE_URL"
lingva init --wizard --mode local --no-auth
lingva update --format json
```

`--sdk` accepts `vanilla`, `react`, `next`, `angular`, `vue`, `svelte`,
`python`, `swift`, `kotlin`, and `flutter`; the last three use portable scaffolds
for source-preview runtimes. `--framework` is an alias. `--default-locale`, `--fallback-locale`,
`--translation-files`, and `--platform-url` customize defaults. `--wizard`
requires a terminal and conflicts with `--non-interactive`. Local CI scaffolding
uses the standalone installer and read-only `check` without a platform account.
`--config-file` (alias `--config`) names portable YAML/JSON only. JavaScript
scaffolds generate `.lingva/generated/runtime.ts` and provider adapters, not a
second equivalent `lingva.config.ts` beside the portable owner. Existing trusted
handwritten JS/TS configs remain supported through the npm evaluation bridge.
`update` reports an upgrade command but never installs automatically. npm and
Python adapters identify their installation channel. Python checks PyPI; Cargo
checks crates.io; standalone/npm/Homebrew check the stable npm engine channel.
Use `--channel standalone|npm|python|homebrew|cargo` or
`LINGVA_CLI_INSTALL_CHANNEL` to override detection. Standalone upgrade commands
pin both the installer and binary asset version. Generated Linux CI checks also
pin the generating engine version. Homebrew upgrades still depend on tap availability.

## Local authoring: `sync`, `check`, `validate`, `metadata`, `apply` {#local-authoring-sync-check-validate-metadata-apply}

```bash
lingva sync
lingva sync path/to/lingva.config.yaml --format json
lingva check --format json
lingva validate --fail-on warning --max-issues 50 --format json
lingva validate --policy release
lingva validate projects --glob 'lingva.config.yaml' --fail-on error
lingva validate --only invalid_translation_key,invalid_translation_contract
lingva validate --ignore missing_key_metadata
lingva metadata --dry-run --format json
lingva metadata --check
lingva metadata --status draft --output .lingva/metadata.json
lingva apply --locale ru --input reviewed/ru.json
lingva apply --locale en --input reviewed/en.json --no-sync
```

`sync` follows the default locale's key/variant structure. It preserves existing
translation text, adds missing strings as blank values, and aligns variant IDs
and descriptive metadata. It validates all locale inputs before any write.
File-backed locale batches use a private undo journal and a project-directory
write lock. A failed batch restores previous bytes, including removal of newly
created locale files. The next config load recovers an interrupted batch before
reading translations. Keep `.lingva/translation-transaction.json` gitignored;
do not delete it after a failure. If filesystem access prevents rollback, fix
access and rerun the command. Recovery is local, not a hosted API transaction.
`sync` does not regenerate framework adapters, generated project imports, or
runtime configuration. Update those deliberately when changing locales/identity;
inspect init's dry-run and replacement effects before using `--force`.

`check` is read-only and also fails for structural drift, even if validation's
`--fail-on none` is selected. `validate` is read-only and supports thresholds
`none`, `error`, `warning`, `info`, and `variant-drift`. `--max-issues` limits
display only: it never hides a failure. `--config` selects an alternate project
config containing policy settings. Explicit flags override named policy values.

Validation issue codes are `invalid_translation_key`,
`invalid_translation_contract`, `missing_default_translation`,
`missing_locale_translation`, `translation_contract_mismatch`,
`missing_key_metadata`, `missing_key_description`, `missing_workflow_status`,
`translated_key_missing_translator`, `reviewed_key_missing_reviewer`,
`namespace_mismatch`, `missing_locale_variant`, `extra_locale_variant`, and
`variant_metadata_mismatch`. Use these exact values with `--only`/`--ignore`.

`metadata` scaffolds default-locale keys and preserves existing descriptions,
reviewers, and status. `--check` reports missing metadata with failure status;
`--dry-run` never writes. Its `--output` names the metadata file, not a report.
Statuses are `draft`, `translated`, `reviewed`, and `approved`.

`apply` takes a locale JSON object. Default-locale input patches existing keys
and synchronizes other locales unless `--no-sync`. Other-locale input replaces
that locale's dictionary, then fills missing source keys; include all existing
translations you want to retain. It never deletes namespace subtrees implicitly.

Translation leaves are strings or non-empty arrays of `{id, text}` variants.
Variant IDs are unique. Flattened keys are at most 200 ASCII characters, start
with a letter/digit, use only letters, digits, `.`, `_`, `-`, and never contain
consecutive or trailing dots. Dotted/nested key collisions are errors.

## Reports and generated artifacts {#reports-and-generated-artifacts}

```bash
lingva manifest --format json --output artifacts/manifest.json
lingva bundle --locale ru --format json --output artifacts/ru.bundle.json
lingva bundle --locale en --no-metadata
lingva workflow --format json --output artifacts/workflow.json
lingva types --output src/generated/lingva-types.ts
lingva helpers --output src/generated/lingva-helpers.ts --no-metadata
lingva export --format json --output artifacts/project.json
lingva import artifacts/project.json --output imported.project.json
lingva import resources.json --project imported.project.json \
  --project-id my-service --output merged.project.json
lingva studio --output artifacts/studio.html
```

`manifest` describes keys, locale presence, variables, and metadata. `bundle`
resolves requested locale, fallback locale, then default locale and records
fallback keys. `workflow` reports metadata status and pending translation/review
lists. `types` emits TypeScript locale/key/variable types; `helpers` adds typed
lookup/presence helpers. Their default output is source code, not a JSON wrapper.
`--no-metadata` omits metadata in bundles and generated contracts where relevant.

`export` normalizes resources and project identity into JSON. `import` accepts
that shape or a raw `{locale: dictionary}` resource map, merges supplied
resources with `--project`, validates it, and emits JSON. It does not execute
JavaScript or overwrite source translation files implicitly.

`studio` generates an offline, self-contained HTML locale JSON editor. Open the
file in a browser, edit strings or variant arrays, export a locale, then use
`apply`. Editing the HTML does not save to your repository or hosted project.
It is a JSON editor, not the hosted translation dashboard.

## Static source checks: `extract` {#static-source-checks-extract}

```bash
lingva extract src --format json --output artifacts/usage.json
lingva extract src --project lingva.config.yaml --fail-on missing
lingva extract src --project lingva.config.yaml --policy release
lingva extract src --project lingva.config.yaml --fail-on any \
  --extensions ts,tsx,js,jsx --exclude '**/fixtures/*,**/*.test.ts'
lingva extract src --callee lingva.t,lingva.tSync --fail-on dynamic
```

Extraction parses JS/TS syntax and collects literal first arguments to `t` and
`tSync`, including member calls and static templates. Comments, regex literals,
JSX text, and quoted non-code are ignored. Dynamic arguments appear in
`dynamicCalls` with file/line locations; they are never evaluated into keys.
It does not perform symbol binding. Use `--callee` (or policy `callees`) to select
exact call targets and exclude unrelated `t` helpers. Defaults retain any
`t`/`tSync` receiver. Invalid source syntax is an error.
`node_modules`, `.git`, `.lingva`, `target`, `dist`, and `.next` directories and
symlinks are skipped. Globs support `*` and `?`, not regular expressions.
`--fail-on` is `missing`, `unused`, `dynamic`, `any`, or `none`. `any` includes
dynamic calls. Missing/unused comparisons need `--project`; dynamic checks do not.
`--config` supplies an alternate project config for extraction policy settings.

## Hosted transfer: `pull`, `push`, `publish`, `invalidate` {#hosted-transfer-pull-push-publish-invalidate}

```bash
lingva pull --locale ru --format json
lingva pull --api-url "$DELIVERY_URL" --auth-token "$LINGVA_API_KEY"
lingva push --api-url "$PUBLISH_URL" --auth-token "$LINGVA_API_KEY"
lingva push --locale en,ru --environment stage --invalidate \
  --source repository --reason 'Reviewed release'
lingva publish --local-only --output-dir artifacts/publish --format json
lingva publish --api-url "$PUBLISH_URL" --environment stage --format json
lingva invalidate --api-url "$PUBLISH_URL" --environment stage \
  --source manual --reason 'External deployment'
```

`pull` downloads authored values, excluding fallback-only entries, and uses
`.lingva/remote-state.json` for a three-way merge. It finishes all downloads and
merges before writing. Conflicting local/remote changes fail without writes.
`--output` accepts a destination template containing `{locale}` for multiple
locales. Ordinary pulls update the project's actual resource owner.

`push` publishes selected locales with a stable semantic mutation ID and the
last common hosted revision. A stale write returns HTTP `409`; `--force` removes
that guard and means an intentional overwrite. Identical retries are idempotent.
State advances only after a confirmed publish revision. Keep state gitignored.
`--output-dir` also saves the publish response. `--invalidate` sends invalidation
only after successful publish and state persistence; it is never implicit.

`publish` creates manifest/bundle files with `--output-dir`. Without a configured
endpoint it is offline artifact generation. With `apiUrl`, `cli.publish.apiUrl`,
or `--api-url`, it also publishes through the same revision-guarded owner as
`push`. `invalidate` explicitly signals an external update. Source values are
`repository`, `dashboard`, and `manual`; use the same environment throughout.

`--dry-run` validates and prints artifacts without writing output files or
contacting a hosted endpoint. `--local-only` writes requested artifacts/reports
but never publishes, even with a configured endpoint. These flags are mutually
exclusive. Without either flag, `--output-dir` does not prevent hosted publication.

```bash
lingva publish --dry-run --format json
lingva publish --local-only --output-dir artifacts/plan
```

Directory validation globs select portable YAML/JSON configs only; the npm bridge
does not recursively evaluate every executable config matched inside a directory.

## Hosted review: `drafts`, `approve` {#hosted-review-drafts-approve}

```bash
lingva drafts --api-url "$AUTHORING_URL" --locale ru --status draft \
  --limit 25 --format json
lingva drafts --status all --next-token "$NEXT_TOKEN" --output-dir review
lingva approve --draft review/translation.draft.json --dry-run --format json
lingva approve --draft review/translation.draft.json --no-mark-approved
lingva approve --draft-id "$DRAFT_ID" --api-url "$AUTHORING_URL" \
  --approved-by reviewer@example.com --push --publish-api-url "$PUBLISH_URL" \
  --publish-auth-token "$LINGVA_API_KEY" --invalidate --reason 'Reviewed'
```

`drafts` returns one page; use the returned `nextToken` to request another.
`--include-approved` includes reviewed drafts; `--key` filters one key.
`--limit` is 1–100. Export filenames hash untrusted IDs rather than treating
them as paths. `approve --draft-id` follows pages until it finds the draft and
rejects repeated page tokens. A local draft needs string `locale`, `key`, `value`
and, for variants, `variantId`; optional project/environment identities must match.

`approve` validates scope, locale, key, value, and variant shape before applying.
It rejects namespace replacement. `--dry-run` never applies, marks, or publishes.
`--no-sync` skips schema alignment and cannot be combined with `--push`.
Hosted drafts are marked approved unless `--no-mark-approved`. If that step
fails after applying locally, the error says so and no publish is attempted.
`--push` explicitly publishes afterwards; `--invalidate` requires `--push`.
Authoring and publishing may use separate endpoints/tokens. Retry the failed
step after resolving its error; local application and remote approval are not
a distributed transaction.

## Automation {#automation}

Prefer `--format json` for report commands. `--output` persists the report or
artifact where supported. `--no-summary` suppresses human summary lines, not
artifact content. Invalid flags exit with status 2; command failures and failed
checks exit with status 1; success exits with status 0. Launchers preserve the
engine's status. Network operations use bounded timeouts and return explicit
errors rather than silently switching implementations.
