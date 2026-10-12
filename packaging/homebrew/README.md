# Homebrew distribution maintenance

Public tap: https://github.com/usausoft/homebrew-tap.

An unsubmitted official-cask candidate and its eligibility blockers are recorded
in [cask submission readiness](./cask/README.md). The public custom tap is not an
official Homebrew listing; it does not make the bare short name available on a
fresh machine.

Install with `brew install usausoft/tap/lingva`. The initial 0.1.3 formula uses
the original macOS/Linux release archives mirrored publicly in that tap.
Never point a customer formula at private GitHub assets or missing npm archives.

The tap maintains these copies of files from this source repository:

| Source                                  | Public tap destination         |
| --------------------------------------- | ------------------------------ |
| `scripts/render-homebrew-formula.mjs`   | same path                      |
| `scripts/update-homebrew-tap.mjs`       | same path                      |
| `packages/cli/checksums.mjs`            | same path                      |
| `packaging/homebrew/lingva.rb.template` | same path                      |
| `packaging/homebrew/tap/update.yml`     | `.github/workflows/update.yml` |
| `packaging/homebrew/tap/README.md`      | `README.md`                    |

The tap's own `GITHUB_TOKEN` updates `Formula/lingva.rb` daily or on manual dispatch.
It polls the stable npm `latest` tag, skips equal/older versions, validates the
checksum document and availability of all four platform archives, then commits
only a changed formula. Homebrew checks the downloaded archive against its SHA256.
No private-repository credentials are required. Registry propagation failures
leave the current formula intact and fail visibly.

After a complete npm release, dispatch the tap's **Update Lingva formula** workflow
for an immediate update; otherwise wait for the daily poll. Synchronize the files
above when modifying updater behavior. Run `pnpm test:cli-release` locally, then
test installation/upgrade on an available native machine. This is not a substitute
for native release-matrix proof of newly built CLI artifacts.

For an explicitly approved public binary mirror, the renderer accepts an HTTPS
asset base as its third argument:

```sh
node scripts/render-homebrew-formula.mjs RELEASE_DIRECTORY 0.1.3 \
  https://github.com/usausoft/homebrew-tap/releases/download/cli/v0.1.3
```

Verify existing release checksums before publishing mirrored archives; do not
change immutable archives, versions, or tags.
