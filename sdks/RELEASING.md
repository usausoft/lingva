# Consumer SDK release gates

Python is published as `lingva-sdk` on PyPI. Release it with a matching
`python-sdk/v<version>` tag after tests and distribution checks pass.
The `publish-python-sdk.yml` workflow uses PyPI trusted publishing in `pypi`.

The npm CLI and independent Python CLI adapter share the Rust engine version.
Their next version is 0.1.5. Release the engine with `cli/v0.1.5` only after
reviewing the source, license, publisher bindings, and platform matrix.
The CLI release workflow verifies five native targets and fresh installations.
Release `python-cli/v0.1.5` only after the matching npm engine archives and
checksums are anonymously available. The Python runtime and CLI adapter have
independent version streams.

Before the repository cutover, preserve existing public release assets and
rebind npm/PyPI trusted publishers to this repository's workflows and
environments. Inspect actual environment protection rules; workflow names
alone do not enforce approval. Verify anonymous installations after publication.

Swift, Kotlin, and Flutter are public source previews in this repository. Their registry releases remain gated on the checks below.
The shared bundle fixture does not establish complete cross-language parity.
Public source availability does not change the existing Lingva licenses.
