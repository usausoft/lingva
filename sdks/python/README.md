# lingva — Python SDK

Python client for the [Lingva](https://lingva.dev) localization platform.

**Requires Python 3.9+.** `lingva-sdk` provides the Python translation runtime.
The separate `lingva-cli` distribution installs the `lingva` command and
launches Lingva's standalone Rust engine. Command behavior is not implemented
in Python.

SDK version 0.1.5 is runtime-only; the separate CLI targets engine 0.1.4.
Previously released SDK versions bundled the CLI launcher, so their installation
behavior differs from the separation described here.

If the separate CLI's pinned binary cannot be installed, the command fails with
an actionable error; it never falls back to Python command logic. CI verifies
the CLI pin against the Rust crate version.

> This is an early release using the shared bundle fixture. It does not have
> complete validation/interpolation parity with native previews; see
> [SDK scope](../README.md). Pin the package version while integrating it.

---

## Install from PyPI

```bash
python -m pip install lingva-sdk
python -m pip install "lingva-sdk[http]"   # adds httpx for async delivery
python -m pip install lingva-cli          # separate Rust CLI launcher
```

When migrating an older SDK installation, upgrade the SDK
first and reinstall the CLI last:

```bash
python -m pip install --upgrade "lingva-sdk==0.1.5"
python -m pip install --force-reinstall "lingva-cli==0.1.4"
```

The older SDK's uninstall step can remove its former `lingva` console script;
installing the CLI last restores the new owner. Translation files, portable
configuration, credentials, and remote state require no data migration.

For development from the monorepo root, use `python -m pip install -e
"sdks/python[dev]"` for the runtime and `python -m pip install -e
"sdks/python-cli[dev]"` for the separate CLI adapter.

## CLI

Python does not have a separate `lingva-python` interface. Installing
`lingva-cli` provides the same self-contained executable used by every adapter:

```bash
lingva init --mode local --no-auth --sdk python --project-id my-service --locale en,ru
lingva sync
lingva check
lingva pull
lingva push
lingva --help
lingva --version
```

The first CLI launch downloads and checksum-verifies the pinned binary and
therefore needs network access. Prewarm it with `lingva --version` before using
an offline environment. Subsequent local `init --mode local --no-auth`, `sync`,
and `check` need no Lingva account or platform network access. Hosted `pull` and
`push` still need their configured endpoint and credentials; they cannot run
against an account-free project without configuring hosted delivery first.

Use explicit hosted overrides in CI when needed:

```bash
lingva pull --api-url "$LINGVA_PUBLISH_API_URL" --auth-token "$LINGVA_API_KEY"
lingva push --api-url "$LINGVA_PUBLISH_API_URL" --auth-token "$LINGVA_API_KEY" --invalidate
```

The config argument is optional for `sync`, `check`, `pull`, and `push`. They load
`lingva.config.yaml` from the current project root by default. The portable
contract is intentionally ecosystem-neutral:

```yaml
projectId: my-service
environment: stage
locales:
  - en
  - ru
defaultLocale: en
fallbackLocale: en
translationFiles: .lingva/translations/{locale}.json
apiUrl: https://your-publish-api.lambda-url.eu-west-1.on.aws
apiKeyEnv: LINGVA_API_KEY
```

`sync` adds blank missing keys and variant slots without overwriting existing
translations. `check` combines that comparison with translation, variant,
metadata, and workflow validation without writing; a failed policy exits with
status 1. `pull` updates local locale files from the current
hosted bundles. `push` publishes the local files. Set the project API key in
`LINGVA_API_KEY`; CI may instead set `LINGVA_PUBLISH_API_TOKEN`. Never commit
either value.

`pull` uses `.lingva/remote-state.json` for a three-way merge. It preserves
independent local edits and fails without writing when the same key changed
locally and remotely. `push` uses that hosted revision as an optimistic lock;
stale pushes receive HTTP `409`. The state file is gitignored. A first push is
safe against an existing hosted project, and `--force` is reserved for an
intentional overwrite. Identical retries are idempotent.

Runtime variants match the JavaScript selector model:

```python
client.t("marketing.hero.title", variant="bold", name="Yury")
client.t("marketing.hero.title", variant={"tone": "warm"}, name="Yury")
```

For a developer workstation, store a project key once instead of exporting it
for every command:

```bash
lingva auth use-key --api-key "$LINGVA_API_KEY" --project-id my-service
lingva auth status
lingva pull
```

Use `lingva auth login` when the project setup page provides browser OAuth
settings. Every installation adapter launches the same CLI and uses
`~/.lingva/credentials.json`. Run `lingva auth logout` to remove it.

Run `lingva update` to check the stable standalone engine version on crates.io
without changing the environment. When newer, it prints the binary installer
command; it does not upgrade PyPI packages.

### CI-triggered repository sync

`lingva pull` is deliberately non-interactive, so a pipeline can use it as the
sync hook. For GitHub Actions, accept both manual and external dispatches:

```yaml
name: Pull Lingva translations

on:
  workflow_dispatch:
  repository_dispatch:
    types: [lingva-translations-updated]

permissions:
  contents: write
  pull-requests: write

jobs:
  pull:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-python@v6
        with:
          python-version: '3.13'
      - run: python -m pip install lingva-sdk lingva-cli
      - run: lingva pull
        env:
          LINGVA_API_KEY: ${{ secrets.LINGVA_API_KEY }}
      - run: |
          git diff --quiet && exit 0
          git config user.name "lingva-bot"
          git config user.email "lingva-bot@users.noreply.github.com"
          branch="lingva/translations-${{ github.run_id }}"
          git switch -c "$branch"
          git add .lingva/translations
          git commit -m "chore(i18n): sync Lingva translations"
          git push --set-upstream origin "$branch"
          gh pr create --fill --base "${{ github.event.repository.default_branch }}"
        env:
          GH_TOKEN: ${{ github.token }}
```

Lingva's hook is the stable CLI command and exit behavior; the repository's
branch and review policy stays under the customer's control.

---

## Quickstart

### Load repository translations from `lingva.config.yaml`

```python
from lingva import LingvaClient

client = LingvaClient.from_config(locale="en")

print(client.t("actions.continue"))           # Continue
print(client.t("welcome.title", name="Alice")) # Welcome, Alice.
```

`from_config` reads the raw JSON files created by `lingva init`, builds the
same schema-versioned bundle in memory, and applies the configured fallback
locale. Local mode needs no Lingva account, API URL, project key, or network
access. Use `config_file="path/to/lingva.config.yaml"` when the config is not in
the process working directory.

### Load a prebuilt local bundle file

```python
from lingva import LingvaClient

client = LingvaClient.from_file("artifacts/en.bundle.json")
```

### Load from CDN (async)

```python
import asyncio
import os

from lingva import LingvaClient, LingvaDeliveryTarget

target = LingvaDeliveryTarget(
    base_url="https://your-project-publish-api.example",
    project_id="my-project",
    environment="production",
    api_key=os.environ["LINGVA_API_KEY"],
)

async def main():
    client = await LingvaClient.from_url(target, locale="fr", fallback_locale="en")
    print(client.t("welcome.title", name="Alice"))

asyncio.run(main())
```

### Load from CDN (synchronous)

```python
import os

from lingva import LingvaClient, LingvaDeliveryTarget

target = LingvaDeliveryTarget(
    base_url="https://your-project-publish-api.example",
    project_id="my-project",
    environment="production",
    api_key=os.environ["LINGVA_API_KEY"],
)

client = LingvaClient.from_url_sync(target, locale="fr", fallback_locale="en")
print(client.t("welcome.title", name="Alice"))
```

---

## API

### `LingvaClient`

| Method / Property                                      | Description                                            |
| ------------------------------------------------------ | ------------------------------------------------------ |
| `LingvaClient.from_bundle(bundle)`                     | Create from a parsed dict                              |
| `LingvaClient.from_config(locale, *, config_file=...)` | Build from repository translation files                |
| `LingvaClient.from_file(path, *, fallback_path=None)`  | Load from filesystem                                   |
| `LingvaClient.from_url_sync(target, locale, ...)`      | Synchronous HTTP fetch                                 |
| `await LingvaClient.from_url(target, locale, ...)`     | Async HTTP fetch (requires `lingva-sdk[http]`)         |
| `.t(key, **variables)`                                 | Translate a key with optional `{varname}` substitution |
| `.has(key)`                                            | Check if a key exists                                  |
| `.locale`                                              | Active locale string                                   |
| `.fallback_locale`                                     | Fallback locale string or `None`                       |
| `.bundle()`                                            | Raw bundle dict (for last-valid caching)               |

### `LingvaDeliveryTarget`

```python
import os

target = LingvaDeliveryTarget(
    base_url="https://your-project-publish-api.example",
    project_id="my-project",
    environment="production",          # default
    api_key=os.environ["LINGVA_API_KEY"],
)
target.resolve("fr")
# -> "https://your-project-publish-api.example/bundles/my-project/production/latest/fr.bundle.json"
```

---

## Bundle schema

The SDK reads schemaVersion 1 bundles. Variables use `{varname}` syntax. Unknown variables pass through unchanged.

```json
{
  "schemaVersion": 1,
  "locale": "en",
  "fallbackLocale": "en",
  "fallbackKeys": [],
  "messages": {
    "actions.continue": "Continue",
    "welcome.title": "Welcome, {name}."
  }
}
```
