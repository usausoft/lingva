# lingva-cli

Python installation adapter for the standalone Rust Lingva CLI. Requires Python
3.9 or newer and a supported native platform. This package has no runtime SDK
dependency and never implements or falls back to Python command logic.

This adapter pins CLI engine 0.1.4. Earlier `lingva-sdk` releases owned the console
script; upgrade to runtime-only SDK 0.1.5 before installing this adapter. For
development, use the editable installation below or a locally built wheel with
a verified engine override.

```bash
python -m pip install lingva-cli
lingva --version
lingva init --mode local --no-auth --sdk python --project-id my-service --locale en,ru
lingva sync
lingva check
lingva bundle --locale en --format json --output artifacts/en.bundle.json
```

Install `lingva-sdk` separately for application translation APIs:

```bash
python -m pip install "lingva-sdk[http]"
```

The launcher downloads the exact engine version from the public npm binary
channel, verifies its archive checksum, and stages its executable atomically.
It checks cached executable integrity before every launch. Concurrent installs
share a per-platform lock; interrupted installs cannot be reused as valid binaries.

Supported targets: macOS arm64/x64, Linux arm64 GNU/x64 musl, Windows x64.
Unsupported targets fail explicitly. Arguments and engine exit status are preserved.
The adapter sets `LINGVA_CLI_INSTALL_CHANNEL=python` unless explicitly overridden;
`lingva update` checks PyPI and recommends a pinned Python-package upgrade.
All 23 customer commands belong to Rust, including `publish --dry-run`,
`publish --local-only`, and extraction diagnostics. Executable JS/TS configs still
require the npm adapter; portable YAML/JSON behavior is identical across adapters.

The first launch requires network access. Offline users can prewarm the cache or
set `LINGVA_CLI_BINARY` to an already verified standalone engine. Other operator
overrides are `LINGVA_CLI_CACHE_DIR`, `LINGVA_CLI_VERSION` (semantic version), and
`LINGVA_CLI_ASSET_BASE_URL`. Overriding the asset channel changes the checksum
trust boundary; use a trusted mirror only. Checksums protect artifact integrity,
not authenticity against compromise of the release channel.

## Migration from lingva-sdk

Earlier SDK releases also owned the `lingva` console script. Upgrade the SDK
before installing the separate CLI so the old distribution cannot overwrite or
remove the new console script:

```bash
python -m pip install --upgrade lingva-sdk
python -m pip install --upgrade --force-reinstall lingva-cli
```

Application imports remain `from lingva import LingvaClient`. No project data,
credentials, or remote-state conversion is required. Old version-only binary
caches are not trusted; the new cache includes engine version and platform.

Development (from repository root):

```bash
python -m pip install -e "sdks/python-cli[dev]"
python -m pytest sdks/python-cli/tests
```
