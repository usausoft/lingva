---
sidebar_position: 9
---

# Progress Checklist

This checklist tracks public SDK and customer CLI capabilities. Source support
and publication are separate: see [CLI](/installation/cli) and
[Native Bundles](/installation/native-bundles) for installation and distribution
boundaries.

## Runtime and SDKs

- [x] Locale lookup, fallback, interpolation, nested keys, and typed variants
- [x] Local and authenticated hosted bundle loading
- [x] Memory TTL, background revalidation, and explicit cache refresh
- [x] React, Next.js, Angular, Vue, Svelte, Docusaurus, and Electron adapters
- [x] Request-scoped Node, Angular SSR, Nuxt, and SvelteKit integration examples
- [x] Python translation runtime with local and hosted clients
- [x] Versioned bundle fixtures and Swift, Kotlin, and Flutter source clients
- [x] Shared translation-key and portable bundle contracts

## Customer CLI

- [x] One Rust engine for all customer commands, with npm and Python launchers
- [x] Local onboarding and generated framework integration
- [x] Validation, extraction, metadata, manifests, bundles, types, and helpers
- [x] Translation import, export, sync, and CI drift checks
- [x] Conflict-safe hosted pull/push with revision checks and idempotency
- [x] Hosted draft listing, review, approval, publishing, and invalidation
- [x] Browser OAuth login, stored credentials, and token refresh
- [x] Device login when supported by the selected OAuth provider
- [x] Project-scoped API key authentication
- [x] Local studio preview and safe application of exported translations
- [x] Local-mode GitHub Actions scaffolding

## Public distribution

- [x] Lingva licenses preserved for public source and packages
- [x] Protected JavaScript builds without runtime source maps
- [x] Packed-artifact and customer CLI adapter verification
- [x] Public SDK release workflows and separate CLI installation adapters
- [x] Runnable local examples without hosted credentials
- [ ] Publish and stabilize native SDKs in their ecosystem registries

## Future integrations

- [ ] `i18next` compatibility layer
- [ ] `react-intl` compatibility layer
- [ ] Additional localization integrations as runtime contracts stabilize
