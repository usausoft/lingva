# Lingva Homebrew tap

Install the standalone customer CLI on macOS or Linux:

```sh
brew install usausoft/tap/lingva
lingva --version
lingva --help
```

Update with `brew update && brew upgrade lingva`. Remove with `brew uninstall lingva`.
This installs the Rust customer CLI, not JavaScript runtimes
operator tools. Use the npm adapter when executable JavaScript/TypeScript config
evaluation is required. Check the installed version's command help; the newest
source features may not yet be published.

The initial formula can use checksummed archives hosted in this public tap's
GitHub release. The daily update workflow follows newer stable `@lingva/cli`
releases using their public archives and release checksums. It never downgrades
the formula or copies unrelated source. A failed update leaves the
existing formula unchanged. Maintainers can run **Update Lingva formula** manually
after a CLI release. No private-repository token or paid macOS CI runner is needed.

Source of truth for updater files: `usausoft/lingva`, under `packaging/homebrew`,
`scripts/{render-homebrew-formula,update-homebrew-tap}.mjs`, and
`packages/cli/checksums.mjs`. Keep those files synchronized when changing updater behavior.
