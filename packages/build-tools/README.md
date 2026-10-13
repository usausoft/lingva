# Lingva build tools

Shared package build lock, package-local tsdown launcher, and production source-map removal. Both Lingva repositories consume the same release. `LINGVA_DEV_BUILD=true` enables developer source maps; production builds remove map files and references.

Run `lingva-build` from a package directory. Import `defineLingvaPackageBuildConfig` from `@lingva/build-tools/config` for tsdown configuration.

Tooling versions are released separately from SDK Changesets. Publish verified package tarballs explicitly; SDK releases do not attempt to republish these configuration packages.
