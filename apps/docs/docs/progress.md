---
sidebar_position: 9
---

# Progress Checklist

This page tracks the current Lingva MVP in a checklist form. It should be updated whenever the code or exposed API changes.

Checked items describe implementation in this checkout, not proof that every
package version is published or every hosted feature is deployed. The current
Rust/npm/Python CLI checkpoint is 0.1.4; the runtime-only Python SDK checkpoint
is 0.1.5. These expanded/split releases remain unpublished. Native mobile SDKs
are source previews, not registry packages. See [CLI](/installation/cli) and
[Native Bundles](/installation/native-bundles) for those boundaries.

## Foundation

- [x] Core runtime with locale lookup, fallback behavior, and interpolation
- [x] Nested translation resources in addition to flat dot-path keys
- [x] Typed project contract with metadata support
- [x] React provider and hooks
- [x] Framework-agnostic JavaScript runtime wrapper
- [x] Docs for current `core`, `react`, and `cli` APIs
- [x] Changelog and GitHub delivery templates

## Tooling

- [x] Project validation
- [x] Validation formatting for text and JSON
- [x] CI thresholds for validation
- [x] Project manifest generation
- [x] TypeScript artifact generation
- [x] Generated consumer helpers on top of the current type artifact
- [x] Source key extraction
- [x] File and line references in extraction reports
- [x] CI thresholds for extraction
- [x] Repo-level validation and extraction policies
- [x] Extraction path filters

## Implemented Platform and Tooling

- [x] Rust-owned Tree-sitter extraction for JavaScript/TypeScript literal `t`
      and `tSync` calls, with comments/regex/JSX text excluded; dynamic keys and
      compiler-level symbol resolution are not promised
- [x] Remote sync contract for hosted and self-hosted backends
- [x] Revision-guarded, idempotent push and three-way pull conflict detection
      owned once in Rust and launched by npm and the separate Python CLI adapter
- [x] Variant selection by ID or metadata across TypeScript, Python, Swift,
      Kotlin, and Flutter clients, with shared fixtures and per-SDK tests;
      source previews do not imply complete cross-language parity guarantees
- [x] Import and export workflows
- [x] Reviewer and translator collaboration flows
- [x] HTTP loader helper on top of the remote loading contract
- [x] First-class `lingva.ts` configuration for delivery mode and cache behavior
- [x] Translation delivery modes for `local` bundles and `cdn` bundles
- [x] Local bundle pull workflow for repository-backed delivery
- [x] Invite-only versus open-signup access switching in the web app
- [x] Self-serve signup defaults to the minimal Free-tier customer access model
- [x] Public SDK distribution boundary with a separate SDK license
- [x] Changesets versioning, packed-artifact verification, and npm trusted-publishing workflows
- [x] Python runtime `lingva-sdk` with local/hosted clients; separate
      `lingva-cli` launcher owns portable commands and hosted auth, with distinct
      trusted-publishing workflows and release boundaries
- [x] Server-issued signup provisioning context for invite versus self-serve access
- [x] AWS serverless storage foundation for invites, control-plane state, and bundle delivery
- [x] Hash-based invite token support for the current environment-backed signup flow
- [x] JSDoc and inline documentation pass across key runtime, access, and infrastructure modules
- [x] JSDoc and maintainability comments across key auth/session and public app UI modules
- [x] Internal dev docs migrated to a dedicated Docusaurus site
- [x] Route and access logic partially normalized around shared constants and unit tests
- [x] Browser session storage and multi-session helpers partially normalized around shared constants and unit tests
- [x] Auth/session orchestration partially extracted into unit-tested helper modules
- [x] Admin navigation, role-priority, and sign-in redirect helpers partially normalized around shared route and auth utilities
- [x] Entitlement resolution and app-home content partially centralized around shared helpers and unit tests
- [x] Signup and password-reset validation partially normalized around shared password and error-message helpers
- [x] Sign-in and recovery flows partially normalized around shared auth-form UI primitives
- [x] Signup resend and password-reset API flows partially normalized around a shared client/server auth contract and server-side helper utilities
- [x] Signup stage metadata and option catalogs partially extracted into shared helpers and unit tests to reduce page-level magic strings
- [x] Signup step validation and submission normalization partially extracted into shared helpers and unit tests to reduce page-level orchestration drift
- [x] Signup confirmation-step cooldown and resend behavior partially extracted into shared helpers and unit tests
- [x] Signup provisioning-context loading partially extracted into a shared client-side auth loader and unit tests
- [x] Signup state transitions and selection helpers partially extracted into shared state utilities and unit tests
- [x] Signup request payload building and post-confirmation redirect logic partially extracted into shared helpers and unit tests
- [x] Signup submit/confirm outcome handling partially extracted into shared orchestration helpers and unit tests
- [x] Signup page orchestration largely moved into a dedicated `useSignupFlow` hook to keep the page focused on composition
- [x] Forgot-password flow copy, link-state resolution, and page orchestration partially extracted into shared helpers and a dedicated `useForgotPasswordFlow` hook
- [x] Sign-in query-state resolution and page orchestration partially extracted into shared helpers and a dedicated `useSignInFlow` hook
- [x] Deployment strategy documented for separate `dev`, `stage`, and `prod`
      AWS accounts, with stage-aware naming and account/region guardrails
- [x] AWS infrastructure config defaults, env examples, and dry-run validation partially normalized around a shared deployable config contract
- [x] Stage-aware infrastructure workflows and optional account/region deploy guards added for safer `dev` / `stage` / `prod` operations
- [x] GitHub deployment variable layout documented for isolated stages and
      Production environment-policy support; actual reviewer enforcement must
      be verified in repository settings
- [x] GitHub deployment setup documented as a step-by-step runbook for the current hybrid model
- [x] Stage-aware application build workflow and deployment strategy documented for `web`, `docs`, and `dev`
- [x] Hosting split documented for Vercel web/public docs and AWS backend;
      provisioned resources and usage may incur costs, not a free-tier guarantee
- [x] First hosted AWS access boundary added for signup-context resolution, with web fallback preserved during migration
- [x] Hosted signup-context cutover documented so `web` can switch to AWS endpoint by environment without breaking local fallback
- [x] DynamoDB-backed invite validation added as the primary source for hosted signup-context checks, with env fallback kept for migration
- [x] Server-side post-confirmation role and plan assignment backed by Cognito plus DynamoDB invites
- [x] Internal tooling for creating and revoking DynamoDB-backed invite records
- [x] Bundle generation as a reusable locale delivery artifact
- [x] Publish artifact generation for manifest plus locale bundles
- [x] First hosted publish boundary for persisting manifests and locale bundles to AWS
- [x] First hosted invalidation boundary for current delivery state
- [x] Local verification path for delivery control-plane records and queue payloads
- [x] `@lingva/react` covered by direct package tests
- [x] Nested translation resources supported alongside flat dot-path keys
- [x] `lingva init` defaults to authenticated remote onboarding; explicit
      `--mode local --no-auth` scaffolds account-free local mode with portable
      YAML and generated framework runtime/project artifacts
- [x] `lingva init --framework react` scaffolds an app-level React provider wrapper
- [x] `@lingva/js` and `@lingva/react` now support higher-level runtime setup on top of raw config objects
- [x] `docs` now dogfoods config-first local mode through `apps/docs/.lingva/translations/[locale].json`
- [x] Public web shell now has a polished locale switcher backed by Lingva state
- [x] Local-first config can now stay declarative, with hidden generated project modules under `.lingva/generated`
- [x] The legacy TypeScript operator scaffold can write `.lingva/README.md` for studio and metadata workflows
- [x] `lingva init --ci github` scaffolds a runtime-free local-mode GitHub
      Actions workflow running the portable `lingva check` drift/validation guard
- [x] Native `lingva init --ci github` installs the standalone binary and runs the portable `lingva check` guard without a language runtime
- [x] `lingva sync` aligns non-default locale keys with the default locale without overwriting existing translations
- [x] `lingva sync --check` can enforce locale alignment in CI without mutating files
- [x] `lingva check` now combines local sync drift detection and validation into one CI-safe preflight
- [x] `lingva sync --check` now reports variant drift separately, including missing variants, extra variants, and variant metadata mismatches
- [x] `lingva validate --fail-on variant-drift` can fail CI only when locale variant contracts drift
- [x] `lingva studio` now generates a local editable tree preview for default-locale authoring plus synced locale export in HTML or JSON
- [x] `lingva apply` can safely write exported locale JSON back into the repository and re-sync local state
- [x] Web config can switch to local-remote bundle delivery through `NEXT_PUBLIC_LINGVA_DELIVERY_MODE=local-remote`
- [x] Web remote inline edit route now has local-remote compatible route-level coverage, including server-only token forwarding
- [x] Web now has `verify:local-remote` for env plus smoke verification before local UI testing
- [x] Web now has Playwright browser coverage for local-remote inline editor inspect/save and locale switching behavior
- [x] Translation keys can now use either plain text leaves or typed variant arrays for tone, mood, or intonation-specific copy
- [x] Thin adapter packages now exist for `@lingva/next`, `@lingva/docusaurus`, and `@lingva/electron`
- [x] Distributable package builds now default to protected minified output without emitted runtime source maps
- [x] React apps now have a `LingvaText` component with variant-aware rendering for inline usage without manual `t()` plumbing
- [x] The web app now dogfoods a dev-only inline translation editor that can patch `.lingva/translations/{locale}.json` locally
- [x] Core now owns the shared authoring patch utility used by local inline editing and future remote save flows
- [x] AWS now exposes the first hosted authoring boundary for persisting inline translation draft records into the control plane
- [x] Web inline editing can now switch between local file writes and remote hosted authoring drafts by environment
- [x] Remote authoring is now gated by explicit server enablement, same-origin checks, and server-only credentials
- [x] Local authoring persistence is now gated by explicit enablement, same-origin checks, locale allowlists, and payload limits
- [x] Password-reset preflight now fails closed for configured reCAPTCHA, applies cooldowns, and ships with default web security headers
- [x] Local authoring route tracing excludes web source/test files from production deployment assets
- [x] Admin routes now have a server-visible authorization boundary backed by verified Cognito tokens and signed httpOnly cookies
- [x] Web sign-in now has a BFF/httpOnly-cookie path so primary Cognito tokens are no longer stored in browser localStorage
- [x] BFF auth now has CSRF double-submit protection and an explicit refresh endpoint for rotating httpOnly Cognito cookies
- [x] BFF auth routes now have response-level coverage for cookies, refresh, sign-out, and CSRF behavior
- [x] Amplify client flows now use volatile in-memory storage instead of durable localStorage token persistence
- [x] Signup and signup confirmation now go through BFF routes instead of direct browser-to-Cognito calls
- [x] Password-reset initiation and confirmation now go through BFF routes, removing the web app's Amplify client dependency
- [x] BFF sign-in and signup routes now have lightweight attempt limiting for brute-force and abuse resistance
- [x] AWS infrastructure now includes a dedicated DynamoDB auth rate-limit table for the hosted limiter cutover
- [x] AWS now exposes a hosted auth rate-limit boundary, and web BFF routes can use it without direct DynamoDB credentials
- [x] Password-reset and resend-code routes now share the hosted limiter contract with scoped counters
- [x] Hosted auth limiter payloads and response shapes now have a local verification script
- [x] Hosted auth limiter Lambda source is generated from a tested builder using shared contract constants
- [x] Web BFF hosted limiter calls now use shared `@lingva/core` payload and response helpers
- [x] Web remote authoring now uses shared `@lingva/core` draft payload and response helpers
- [x] Hosted authoring Lambda source is generated from a tested builder using shared core draft limits
- [x] Local e2e verification now links remote draft payloads, publish artifacts, delivery state, and invalidation jobs
- [x] `lingva push` now publishes artifacts and can invalidate hosted delivery in one command
- [x] `lingva approve` can apply hosted draft payloads into local file-backed translations
- [x] `lingva drafts` can list and export hosted authoring drafts for local review and approval
- [x] `lingva approve --draft-id` can approve a hosted draft directly after reviewer selection
- [x] Hosted authoring drafts are marked approved after direct approval and hidden from default review listings
- [x] `lingva approve --push --invalidate` can promote reviewed drafts into hosted delivery in one command
- [x] CLI reviewed-draft `approve --dry-run` plans without local or hosted
      mutation; direct/local browser promotion is a separate path and currently
      publishes even for `mode: plan`
- [x] GitHub Actions can run draft promotion in plan or promote mode with a
      Production environment boundary; required reviewer enforcement is an
      operator setting, not guaranteed by the workflow definition
- [x] Draft promotion workflow writes a GitHub job summary with stage, mode, draft id, and CLI output
- [x] CLI auth can now log in through browser-based OAuth/OIDC PKCE and reuse stored access tokens for hosted commands
- [x] CLI auth refreshes expired stored access tokens when a refresh token is available
- [x] CLI auth supports OAuth device-code login for headless and remote terminal environments
- [x] AWS Cognito infrastructure now provisions a separate CLI OAuth client and optional Hosted UI issuer output for `lingva auth login`
- [x] Infrastructure tooling can print stage-specific CLI auth exports from CloudFormation outputs after deploy
- [x] Hosted CLI docs now show tokenless reviewer commands after `lingva auth login`, with service tokens reserved for CI/dashboard automation
- [x] Hosted authoring and publish endpoints can verify Cognito/OIDC JWT bearer tokens while preserving service-token automation
- [x] Hosted authoring and publish endpoints can verify project-scoped API keys with scoped authoring, delivery, and admin permissions
- [x] Hosted draft listings support `draft`, `approved`, and `all` status filters for review queues
- [x] Hosted draft listings support opaque pagination tokens for dashboard-ready queues
- [x] Web now exposes a server-only `/api/i18n/drafts` proxy for dashboard review queues without leaking authoring tokens
- [x] Admin now has a first hosted draft review queue UI backed by the server-only drafts proxy
- [x] Admin can approve hosted drafts through a server-only BFF route with signed admin-boundary authorization
- [x] Admin can dispatch GitHub draft promotion workflows in plan/promote modes without exposing GitHub tokens client-side
- [x] Draft promotion is wired through GitHub Actions with explicit plan/promote
      modes and Production environment-policy support
- [x] Translation invalidation from dashboard changes now queues hosted delivery refreshes through a server-only BFF route
- [x] Repository sync and invalidation can run through the `Lingva Delivery` GitHub Actions workflow
- [x] Hosted project and environment records now have a shared typed contract for the next dashboard/API slice
- [x] AWS now exposes a hosted project/environment control-plane API boundary
- [x] Admin project inventory now uses the hosted control-plane BFF instead of placeholder data
- [x] Admin project environments can now be listed and upserted through the hosted control-plane BFF
- [x] Admin project setup now includes quick `dev` / `stage` / `prod` environment creation plus SDK/env snippets
- [x] Admin project setup can create one-time SDK API keys and produce safe CLI auth/pull/push commands
- [x] Admin project onboarding checklist now shows setup progress through first push and bundle delivery readiness
- [x] Project onboarding now reads hosted publish history to complete first-push and bundle-delivery steps
- [x] Project onboarding steps now expose inline CTAs for environment setup, SDK key creation, and CLI publish commands
- [x] Project onboarding can dispatch the protected dashboard publish workflow for the selected delivery stage
- [x] Project onboarding now shows the latest protected GitHub delivery workflow run with status and run link
- [x] Hosted invite list/create/revoke APIs now run through typed contracts, server-only BFF auth, and hashed Lambda storage
- [x] Hosted API key list/create/revoke APIs now run through typed contracts, server-only BFF auth, and hashed Lambda storage
- [x] Admin access UI now manages hosted invites through real project-scoped list/create/revoke workflows
- [x] Admin access UI now manages hosted API keys with one-time token display and revoke workflows
- [x] CLI auth can store project-scoped API keys with `lingva auth use-key` and reuse them for hosted authoring/delivery commands
- [x] Simpler hosted CLI onboarding via browser-based `lingva auth login`
- [x] First hosted React starter covering local authoring, CLI auth, hosted push, invalidation, and dashboard invite management
- [x] Runtime delivery loaders now honor memory TTL, background revalidation, and explicit cache-bypass refresh
- [x] Hosted publish history and rollback state now have backend and server-only web API support
- [x] Admin delivery operations now expose stage-scoped history, refresh, and rollback
- [x] Admin delivery operations now expose stage-scoped invalidation history
- [x] Rollback audit records now capture actor, previous publish, target publish, and invalidation link
- [x] Admin delivery operations can now dispatch the `Lingva Delivery` GitHub workflow through a server-only BFF route
- [x] Admin delivery operations can now show recent GitHub delivery workflow run status through the server-only BFF
- [x] Admin delivery workflow runs are now filtered by selected stage and show clearer GitHub run links
- [x] `Lingva Delivery` workflow now supports standard `web`, `docs`, and `dev` app targets plus custom config files
- [x] Delivery workflow now resolves app-scoped publish endpoints and tokens before falling back to stage defaults
- [x] Admin delivery workflow panel now previews app, config file, mode, stage, and credential scope before dispatch
- [x] CI classifies changed inputs and runs relevant dependency/workspace,
      app/docs, web E2E, SDK, and CLI gates; an aggregate result checks required
      groups while eligible unchanged inputs can reuse recent same-ref proofs
- [x] Internal release-readiness docs now define the stage-first deployment and smoke-test gate
- [x] Customer-facing Lingva workspace is now separated from platform admin routes
- [x] First customer translation workspace reads remote authoring drafts through a server-only BFF route
- [x] Customer translation workspace can now edit remote-store values by creating server-side authoring drafts
- [x] Customer translation workspace now supports nested key trees and variant-specific draft editing
- [x] Customer translation workspace can approve drafts and dispatch protected publish workflows without exposing server tokens
- [x] Hosted customer workspace APIs enforce project membership; local/offline
      fallback uses a deployment project allowlist
- [x] Customer project inventory loads owned and actively joined projects
      through a server-only workspace BFF
- [x] Hosted control-plane now supports active/revoked project membership records for customer workspace access
- [x] Customer workspace translation routes now enforce project membership permissions for read, edit, approve, and publish actions
- [x] Customer workspace settings now include project member management for owner/admin users
- [x] Customer workspace UI now surfaces the current project role and disables member-management controls for read/edit-only roles
- [x] Customer workspace member changes now record project-scoped audit events and show recent audit history to owner/admin users
- [x] Customer draft approval and promotion dispatches now record project-scoped audit events
- [x] API key create/revoke and delivery operation dispatches now record project-scoped audit events
- [x] `lingva init` now reports explicit next steps for local, remote, and React-provider onboarding
- [x] All 23 customer commands implemented in one Rust `lingva` engine:
      `auth`, `init`, `update`, `sync`, `check`, `pull`, `push`, `metadata`,
      `apply`, `approve`, `studio`, `drafts`, `validate`, `manifest`, `bundle`,
      `publish`, `invalidate`, `workflow`, `types`, `helpers`, `export`,
      `import`, and `extract`; direct/Cargo/npm/Python distribution paths share
      that owner, and publication of the expanded checkpoint remains pending
- [x] Rust CLI edge coverage now includes credential refresh, malformed configs/leaves, variants, merge conflicts, revisions, idempotency, invalidation, and real-binary filesystem/HTTP behavior
- [x] Public Next.js docs now match the real thin adapter and React-provider integration path
- [x] `@lingva/next` now exposes Next-facing client/provider helpers and `LingvaText`
- [x] `lingva init --framework next` now scaffolds a Next App Router provider wrapper
- [x] First Next.js starter app covers App Router, `@lingva/next`, local translations, and local verification
- [x] Next.js starter includes hosted env verification and a local artifact
      plan using `manifest`/`bundle`; it writes plan files but never calls
      hosted `push` or `publish`
- [x] Next.js starter now includes key metadata so `lingva check` is warning-free
- [x] `lingva metadata` scaffolds missing key metadata from the default locale without overwriting existing entries
- [x] `lingva metadata --check` verifies metadata drift in CI without writing files
- [x] First-class Angular, Vue, and Svelte adapters with reactive state, typed translations, remote loading, tests, and public guides
- [x] Request-scoped Angular SSR, Nuxt, and SvelteKit factories with parallel-request isolation coverage
- [x] Runnable Nuxt and SvelteKit SSR reference applications with request-locale cookies and server-rendered translations
- [x] React, Next.js, and Vue starter examples using current runtime APIs
- [x] Angular and Svelte starter examples using their framework-native adapters
- [x] Shared versioned bundle fixture and source-level Swift, Kotlin, and Flutter clients
- [x] Node request-scoped runtime and framework SSR isolation examples
- [x] Super-admin-only global project/customer/tier/platform-setting mutations,
      separate from internal-console read access and customer project roles
- [x] Persisted admin Email invitations toggle, optional SES delivery, and
      copy-link fallback when sending is disabled or fails
- [x] Backend Free quotas (1 project, 5 members, 3 active API keys, 100 distinct
      translation keys), authoritative key-usage warnings and full-key deletion
- [x] DynamoDB-backed invite validation instead of environment-only invite tokens
- [x] Lambda/API publish flow for hosted bundle delivery
- [x] Lambda/API invalidation flow for hosted bundle delivery
- [x] Hosted bundle manifest persistence for current delivery state
- [x] Remove the temporary DEV-wide access bypass and fail closed outside local development

## Future Integrations

- [ ] `i18next` adapter or compatibility layer
- [ ] `react-intl` adapter or compatibility layer
- [ ] Adapters for other existing localization ecosystems when Lingva runtime contracts are stable enough
- [x] Public npm distribution defaults and provenance-ready release workflow for Lingva SDK packages
