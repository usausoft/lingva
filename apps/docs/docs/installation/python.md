---
sidebar_position: 9
---

# Python

[`lingva-sdk`](https://pypi.org/project/lingva-sdk/) provides Lingva's Python
translation runtime for backend services, workers, and applications. The
separate `lingva-cli` package provides repository translation commands by
launching the shared Rust engine. Both support Python 3.9 and newer.

The two packages have separate responsibilities:

- `lingva-cli`: a thin launcher for the standalone Rust `lingva` command
- `lingva-sdk`: `LingvaClient` for reading validated locale bundles in Python code

Runtime-only SDK 0.1.5 and CLI 0.1.4 have independent installation and release
lifecycles. Earlier SDK versions bundled a CLI launcher; upgrade those first
before installing the independent CLI.

## Install

Install the runtime and the optional async HTTP client:

```bash
python -m pip install "lingva-sdk[http]"
python -m pip install lingva-cli
```

Use `python -m pip install lingva-sdk` when synchronous delivery is sufficient.
Pin a compatible version in production because the Python SDK is still an early
release:

```text
lingva-sdk[http]==0.1.5
lingva-cli==0.1.4
```

If upgrading an older SDK installation that owns the `lingva` console script, upgrade the SDK
first and reinstall the CLI last:

```bash
python -m pip install --upgrade "lingva-sdk[http]==0.1.5"
python -m pip install --force-reinstall "lingva-cli==0.1.4"
```

This order prevents the older SDK's uninstall step from removing the new CLI's
console script. Configuration, translations, credentials, and remote state need
no data migration.

The separate CLI console script downloads and checksum-verifies a version-pinned
Rust binary on its first launch, which requires network access. Run
`lingva --version` to prewarm the executable before offline use. Subsequent local
commands need no platform connection. The CLI never falls back to Python command
logic. Set `LINGVA_CLI_BINARY` only in development/tests when intentionally
exercising a locally built engine. Checksum verification provides integrity
relative to the downloaded checksum file; the distribution source remains a
trust boundary.

See the [complete CLI reference](./cli.md) for all 23 customer commands,
supported options, artifact generation, source extraction, and edge cases.

## Create the portable project config

Run the CLI from the root of the consumer repository. Hosted remote mode is the
default and requires one browser login:

```bash
lingva auth login
lingva init --sdk python
```

If the account has one project it is selected automatically. With several
projects, choose from the terminal or pass `--project-id`. Lingva fills the
project ID, locales, environment, and API URL from the platform.

This creates `lingva.config.yaml` and locale files under
`.lingva/translations/`. The YAML file is the same portable CLI contract used
by JavaScript and CI integrations:

```yaml
projectId: my-service
environment: dev
locales:
  - en
  - ru
defaultLocale: en
fallbackLocale: en
translationFiles: .lingva/translations/{locale}.json
apiUrl: https://your-lingva-api.example
apiKeyEnv: LINGVA_API_KEY
```

For fully local delivery, opt out of platform auth explicitly. No Lingva
account or project key is required. After the executable has been installed or
prewarmed, local operation also needs no network access:

```bash
lingva init --sdk python --mode local --no-auth
```

```yaml
projectId: my-service
environment: dev
locales:
  - en
  - ru
defaultLocale: en
fallbackLocale: en
translationFiles: .lingva/translations/{locale}.json
```

## Authenticate hosted commands

Local `sync` and `check` need no account. For hosted `pull` and `push`, copy the
project API key or browser-login values from **Consumer application setup** in
the Lingva project page. Store a project key once with:

```bash
lingva auth use-key --api-key "$LINGVA_API_KEY" --project-id my-service
lingva auth status
```

Browser OAuth discovers the correct environment-specific issuer and client:

```bash
lingva auth login
# Stage: lingva auth login --platform-url https://stage.lingva.dev
```

The credential is stored with restricted permissions in
`~/.lingva/credentials.json`. It is shared by every CLI installation adapter and is used
only when an explicit token or configured environment key is absent. Run
`lingva auth logout` to remove it. Use `lingva --help` for all commands and
`lingva --version` when reporting a support issue.

Run `lingva update` through the Python adapter to check the stable `lingva-cli`
version on PyPI. It reports a pinned Python-package upgrade command without
performing the upgrade. `--channel` overrides the detected installation route.

Load those repository translations directly in the application:

```python
from lingva import LingvaClient

client = LingvaClient.from_config(locale="ru")
print(client.t("welcome.title", name="Yury"))
```

Variant keys use the same selector contract as the JavaScript runtimes. Select
by variant ID or metadata; an unknown selector falls back to the first variant:

```python
print(client.t("marketing.hero.title", variant="bold", name="Yury"))
print(client.t("marketing.hero.title", variant={"tone": "warm"}, name="Yury"))
```

`from_config` reads the files created by `lingva init`, creates the validated
runtime bundle in memory, and applies `fallbackLocale`. Pass
`config_file="path/to/lingva.config.yaml"` only when the process does not run
from the repository root.

The config argument is optional for `sync`, `check`, `pull`, and `push`. Each
command looks for `lingva.config.yaml` in the current project root by default.

## Keep repository translations aligned

Use `sync` after adding keys to the default locale. Existing translations are
never overwritten:

```bash
lingva sync
```

`sync` never calls the Lingva platform. It only aligns local locale files and
variant shapes. `pull` downloads hosted translations; `push` uploads local
translations.

Synchronization preserves translated variant text while aligning IDs and
metadata (`tone`, `mood`, `intonation`, `label`, and `context`) with the default
locale. Duplicate IDs and invalid non-text leaves fail validation.

Hosted transfer is conflict-safe. `pull` performs a three-way merge using the
last hosted snapshot in `.lingva/remote-state.json`. Independent local and
hosted key changes merge. A key changed on both sides stops the command without
overwriting the local file. `push` sends the last pulled publish revision. The
platform returns HTTP `409` when somebody published after that revision.

The state file is machine-local and gitignored. A first push expects an empty
hosted project. If the project already has a publish, the push is rejected until
you run `lingva pull`. Use `lingva push --force` only for an intentional
last-writer-wins recovery. Repeating the same successful push is idempotent.

Use command-line overrides when CI injects values instead of writing them to
the config:

```bash
lingva pull --api-url "$LINGVA_PUBLISH_API_URL" --auth-token "$LINGVA_API_KEY"
lingva push --api-url "$LINGVA_PUBLISH_API_URL" --auth-token "$LINGVA_API_KEY" --invalidate
```

Use the non-mutating check in CI:

```bash
lingva check
```

The command combines schema alignment with translation, variant, metadata, and
workflow validation. It exits with a non-zero status when alignment drifts or
its configured validation policy fails, including invalid translation keys.
See [Configuration](./configuration.md#translation-key-contract)
for the naming rules.

Python and the Rust engine enforce the shared 200-character portable
key contract: ASCII letters, digits, dots, underscores, and hyphens; a letter
or digit first; no trailing or consecutive dots. Nested keys flatten to this
same contract, and colliding dotted/nested paths are invalid.

## Connect a hosted project

Open the Lingva project and expand **Consumer application setup**:

1. select **Python** as the integration target
2. create a project SDK key and copy its one-time value
3. copy the API URL, project ID, environment, and generated bundle target
4. store the key in `LINGVA_API_KEY`; never commit it

The project page generates values for the selected environment. Their ownership
is explicit:

| Value            | Where to get it                                          |
| ---------------- | -------------------------------------------------------- |
| `projectId`      | Project header or generated `lingva.config.yaml` snippet |
| `environment`    | Project delivery environment selector                    |
| `apiUrl`         | Python setup guide in **Consumer application setup**     |
| `LINGVA_API_KEY` | One-time token shown after creating a project SDK key    |

Pull the current hosted translations into the repository:

```bash
export LINGVA_API_KEY='<project-sdk-key>'
lingva pull
```

Publish local translation files when the key has write permission:

```bash
lingva check
lingva push
```

Use a read-scoped key for application delivery and a separately scoped write
key for CI publishing. Keys belong in the customer backend or CI secret store,
not in browser or mobile bundles.

## Load hosted translations in Python

```python
import asyncio
import os

from lingva import LingvaClient, LingvaDeliveryTarget

target = LingvaDeliveryTarget(
    base_url="https://your-lingva-api.example",
    project_id="my-service",
    environment="dev",
    api_key=os.environ["LINGVA_API_KEY"],
)


async def main() -> None:
    client = await LingvaClient.from_url(
        target,
        locale="ru",
        fallback_locale="en",
    )
    print(client.t("welcome.title", name="Yury"))


asyncio.run(main())
```

For synchronous services, use `LingvaClient.from_url_sync(...)`. Both loaders
validate the bundle before exposing it and keep key lookup and interpolation
behavior aligned with the other Lingva runtimes.

## GitHub Actions pull hook

The CLI is non-interactive and can update repository translations after a
manual or external dispatch:

```yaml
name: Pull Lingva translations

on:
  workflow_dispatch:
  repository_dispatch:
    types: [lingva-translations-updated]

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
```

Add the repository's normal branch or pull-request automation after `lingva
pull`. Lingva intentionally does not choose a customer's merge policy.

## Verify the setup

```bash
lingva check
python -c "import lingva; print('Lingva Python SDK ready')"
```

See the [CLI reference](./cli.md), [Configuration](./configuration.md) for the full portable YAML contract, and
[Native SDK previews](./native-bundles.md) for Swift, Kotlin, and Flutter.
