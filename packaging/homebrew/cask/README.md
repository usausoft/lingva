# Official Homebrew cask submission readiness

`lingva.rb` is a local, unsubmitted candidate for `Homebrew/homebrew-cask`.
It is not an official listing and must not be advertised as enabling
`brew install lingva` on a fresh machine. It points at existing 0.1.3 macOS
archives only to make the draft inspectable; replace its version/checksums/URLs
with a compliant release before submission.

## Findings on 2026-10-11

- The arm64 binary has an ad-hoc signature and no Developer ID team identity.
- `spctl --assess --type execute --verbose=4` rejects the installed binary.
- The local keychain reports zero valid code-signing identities. This does not
  establish whether the owner has an Apple Developer account or credentials elsewhere.
- The canonical source repository is private and exposes no public adoption metrics.
- The public distribution tap was created on 2026-10-11 with zero stars/forks/watchers.
- Searching open and closed official cask PRs found no Lingva submission; recheck
  token availability and prior submissions immediately before opening a PR.

Homebrew requires assessable macOS artifacts to pass Gatekeeper without security
bypasses. Its shared policy normally requires public interest beyond the author
and excludes repositories younger than 30 days. For an owner self-submission,
the usual GitHub thresholds are 90 forks, 90 watchers, or 225 stars. Equivalent
independent adoption evidence and cask-specific exceptions can be considered;
neither a newly created tap nor fabricated/inflated metrics establishes eligibility.

## Required next steps

1. Obtain a usable Developer ID signing identity and notarization access from the
   owner. Do not print/export private keys or disable Gatekeeper.
2. Produce a new immutable signed/notarized release. Signing changes the binary
   bytes: do not replace 0.1.3 archives or silently change their checksums.
3. Test Gatekeeper acceptance and installation on every architecture declared by
   the cask. The M4 check is not Intel compatibility proof.
4. Publicly endorse the download channel from the product homepage/docs and
   provide genuine independent usage/notability evidence, or request a justified
   maintainer exception when evidence exists.
5. Update this candidate, run Homebrew style/online/new-cask audits and installation
   checks, then submit `Casks/l/lingva.rb` to `Homebrew/homebrew-cask` with honest
   verification results and upstream ownership disclosure.
6. Wait for maintainer acceptance before documenting the bare install command.

The existing custom tap stays usable with `brew install usausoft/tap/lingva`.
This readiness work does not uninstall or replace its formula.

References: [cask acceptance](https://docs.brew.sh/Acceptable-Casks),
[shared acceptance policy](https://docs.brew.sh/Package-Acceptance-Policy),
[cask cookbook](https://docs.brew.sh/Cask-Cookbook), and
[submission process](https://docs.brew.sh/How-To-Open-a-Homebrew-Pull-Request).
