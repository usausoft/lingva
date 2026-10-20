# Temporary npm release credential

Use this recovery only while npm's immutable-subject OIDC token exchange is
unavailable. OIDC remains configured. The presence of the **Production environment**
secret `NPM_RELEASE_TOKEN` enables the temporary fallback in the SDK and CLI release
jobs. Removing that secret restores OIDC. Never store this credential in repository
files, Actions variables, chat, or a repository-wide secret.

A maintainer must create and submit the credential themselves:

1. In npm account settings, create a granular token named `lingva-release-recovery`.
   Set expiration to one day (or the shortest supported period). Grant package
   **Read and write (publish and stage)** access only to `@lingva/core`, `@lingva/js`,
   `@lingva/react`, `@lingva/next`, `@lingva/angular`, `@lingva/vue`, `@lingva/svelte`,
   `@lingva/docusaurus`, `@lingva/electron`, `@lingva/node`, and `@lingva/cli`.
   Grant no organization-management permission. Enable publish-time 2FA bypass for
   unattended CI; keep account and package 2FA settings unchanged.
2. Paste the token directly into GitHub → usausoft/lingva → Settings → Environments
   → Production → Environment secrets as `NPM_RELEASE_TOKEN`. Do not send it to an
   assistant or commit it. Credentials appear only in authentication/publication
   step environments, after quality and native gates.
3. Merge the reviewed recovery workflow. Create a new immutable
   `sdk-recovery-v0.2.0` tag on that main revision, then dispatch `release.yml` from
   that tag with `release_tag=v0.2.0`. The flat recovery tag fits the existing `*`
   Production tag policy. The original SDK tag must never move.
4. Confirm all ten SDK 0.2.0 versions are anonymously readable with provenance.
   A staged version is not a completed release; approve any npm staged entries in
   npm's authenticated UI, then retry the guarded workflow.
5. Tag the reviewed CLI revision as `cli/v0.1.6` only after the SDKs are public.
   All five native engine tests, fresh npm/wheel installation proofs, checksums,
   provenance, and anonymous asset checks remain mandatory.
6. After registry verification, remove the GitHub environment secret and revoke
   the npm token in account settings. Check both are gone. Do not delete OIDC trust
   entries or relax Production deployment rules.

Validation for workflow changes:

```bash
node --test scripts/release-auth.test.mjs
pnpm run test:cli-release
```

Public package availability, not a successful publish command alone, determines
completion. An expired or rejected token must fail the release; do not fall back
to another credential or remove provenance requirements.
