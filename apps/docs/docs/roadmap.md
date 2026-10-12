---
sidebar_position: 10
---

# Roadmap

This roadmap is intentionally broader than the progress checklist. The checklist
tracks what is already done. This page tracks where Lingva is heading over the
next product phases.

## Current phase: strengthen the platform core

- [x] Typed runtime for locale lookup, fallback behavior, and interpolation
- [x] Typed project contract with metadata and workflow state
- [x] React integration layer
- [x] Validation, extraction, manifests, helpers, and generated type artifacts
- [x] Delivery configuration for local and hosted bundle sources
- [x] Local pull workflow for repository-backed bundle delivery
- [x] Bundle generation as a reusable runtime delivery artifact
- [x] Hosted publish flow for versioned locale bundles
- [x] Hosted invalidation flow for current delivery state
- [x] Config-first local onboarding with `lingva init`, `lingva sync`, and `lingva check`
- [x] Standalone Rust CLI published as crates.io package `lingva`, with
      runtime-free installers and thin npm/PyPI launchers
- [x] Conflict-safe hosted pull/push, optimistic revisions, semantic
      idempotency, and optional post-publish invalidation in the standalone CLI
- [x] Translation invalidation after dashboard changes
- [x] Repository-driven refresh and invalidation workflows
- [x] First hosted React starter for local-to-hosted delivery
- [x] React, Next.js, and Vue starter applications
- [x] Smoother first-run onboarding for local mode

## Next phase: productize delivery and collaboration

- [x] Hosted bundle manifest service
- [x] First hosted draft review queue and approval surface
- [x] Typed project and environment contract for hosted control-plane state
- [x] Hosted project and environment API boundary
- [x] Admin project inventory backed by the hosted control-plane BFF
- [x] Admin environment management backed by the hosted control-plane BFF
- [x] Hosted invite list/create/revoke API boundary
- [x] Dashboard-driven invite and access workflows
- [x] Publish history and rollback support
- [x] First delivery operations dashboard for history, refresh, and rollback
- [x] Invalidation history in delivery operations
- [x] Rollback audit trail in delivery operations
- [x] Delivery workflow dispatch from admin operations for plan and publish runs
- [x] Recent workflow status after admin-triggered delivery runs
- [x] Stage-aware workflow run filtering and GitHub run links
- [x] Multi-app delivery workflow targets for `web`, `docs`, `dev`, and custom configs
- [x] App-scoped hosted publish endpoint and token fallback wiring
- [x] Admin dispatch preview for app, config, mode, stage, and credential scope
- [x] Richer delivery workflow diagnostics from job summaries and artifacts
- [x] Environment-aware publish targets for `dev`, `stage`, and `prod`
- [x] Runtime memory TTL and background refresh policies
- [ ] Framework-level eager preload recipes
- [x] Review queues for translators and reviewers with draft and approval states
- [ ] Comment and context workflows around keys
- [x] Import/export pipelines for legacy JSON translation sets
- [x] Documented migration path from file-based localization to Lingva delivery
- [ ] Usage analytics for missing keys, fallback frequency, and bundle freshness

## Platform expansion

- [ ] `i18next` compatibility layer
- [ ] `react-intl` compatibility layer
- [ ] Additional adapters for existing localization ecosystems
- [ ] Better Next.js server-first patterns
- [x] First-class Angular, Vue, and Svelte adapters and framework-native guides
- [x] Versioned native bundle contract with Swift, Kotlin, and Flutter source previews
- [x] Python translation runtime and authenticated hosted loading
- [x] Separate Python CLI adapter implemented for all Rust customer commands
- [ ] Publish CLI 0.1.4 and runtime-only Python SDK 0.1.5; older releases bundle a CLI launcher
- [ ] Publish and stabilize the Swift, Kotlin, and Flutter packages in their ecosystem registries
- [x] First local-mode CI recipe through `lingva init --ci github`
- [ ] Broader CI recipes for monorepos and multi-app workspaces
- [ ] Bundle signing and stronger hosted artifact controls
- [ ] Self-hosted control-plane documentation and bootstrap flow

## Commercial and operational maturity

- [x] Hosted access provisioning API foundation for invite management
- [x] Admin workflows for project, environment, and invite management
- [x] Hosted API key management API foundation
- [x] Admin workflow for project-scoped API key creation and revocation
- [x] Hosted endpoint authorization for project-scoped API keys
- [x] CLI onboarding for stored project-scoped API keys
- [x] Public SDK package boundary with minified, source-map-free artifacts
- [x] Changesets versioning and npm trusted-publishing workflow
- [ ] Complete the first coordinated public npm release and verify provenance
- [x] Stage-first deployment, secrets, rollback, and release runbooks
- [x] Hosted auth route rate-limit boundary
- [ ] Full plan-aware capability enforcement beyond the current backend-enforced
      Free quotas, including the 100-distinct-translation-key project limit
- [x] Dedicated AWS accounts for dev, stage, and prod infrastructure
- [ ] Verify deployed isolation, rollback and access protections before each release

## Longer-term product bets

- [x] First in-context editing workflow for Lingva-wrapped React text
- [ ] Production-ready in-context editing workflow across hosted review states
- [ ] AI-assisted translation suggestions with human review gates
- [ ] More advanced content-quality checks
- [x] Project-scoped activity history and audit reporting
- [ ] Bots and automation surfaces for review and publish workflows

The details will keep changing, but the direction is stable: Lingva should make
translation delivery, validation, and collaboration feel like a first-class
part of modern product development.
