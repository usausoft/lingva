# Native SDKs and Python

This directory contains source-level clients for ecosystems that cannot consume
the `@lingva/*` npm packages directly:

| Directory    | Package identity                             | Local verification                       |
| ------------ | -------------------------------------------- | ---------------------------------------- |
| `swift`      | SwiftPM product `Lingva`                     | `swift test --package-path sdks/swift`   |
| `kotlin`     | JVM namespace `dev.lingva`                   | `gradle -p sdks/kotlin test`             |
| `flutter`    | Dart package `lingva_flutter`                | `cd sdks/flutter && flutter test`        |
| `python`     | PyPI package `lingva-sdk`                    | `cd sdks/python && python -m pytest`     |
| `python-cli` | Separate `lingva-cli` adapter (next release) | `python -m pytest sdks/python-cli/tests` |

All clients use `fixtures/en.bundle.json` to exercise flattened-key lookup,
variant selection, first-variant fallback, interpolation and URL templates.
This shared fixture does not establish complete cross-language parity. Native
previews validate bundle fields and interpolate declared variables. Python
checks the primary schema version, interpolates supplied keyword variables,
and its `last_valid` fallback handles loading failures, not schema rejection
after a successful download. Validate untrusted bundle structure in the
application when stricter guarantees are needed.
Python can attach a read-scoped key in a trusted backend. Swift,
Kotlin, and Flutter currently require packaged bundles or a customer-controlled
authenticated proxy for Lingva hosted delivery.

Swift, Kotlin, and Flutter are source previews. Their registry coordinates,
release automation, persistent cache policy, plural/rich-message behavior, and
platform lifecycle integrations must be stabilized before production release.
Python is an early public package published to PyPI by the
`Publish Python SDK to PyPI` workflow; consumers should pin its version.

See [RELEASING.md](./RELEASING.md) for the remaining native registry safety
gates and the Python release path.

The next Python SDK 0.1.5 removes console-script ownership. The independent
CLI adapter 0.1.5 lives in `python-cli`, has no runtime SDK dependency, and pins
the same Rust engine as npm. These next versions are not yet published.
Upgrade older SDK installations before installing or force-reinstalling the
separate CLI adapter. Application imports remain `from lingva import LingvaClient`.
