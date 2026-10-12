---
sidebar_position: 1
slug: /
---

# Introduction to Lingva

**Lingva** is language infrastructure for developers.

We are building a localization platform around a simple idea: translations should be treated with the same care as application code. They should be structured, reviewable, portable, and easy to integrate into modern development workflows.

## Philosophy

> **Language infrastructure as code**

Translations are not just static files. They are part of the product surface, part of the release process, and part of team collaboration. Lingva exists to make that explicit.

## What is broken today

Traditional localization workflows usually rely on spreadsheets, scattered JSON files, manual imports, and too much context switching between developers, translators, and product teams.

That creates predictable problems:

- Missing context for translators
- Painful merges and conflicting files
- Silent missing keys in production
- Redeploys for text-only changes
- No single source of truth across environments

## What Lingva aims to provide

Lingva treats translations as a first-class part of your stack:

- **Developer-first runtime** with framework-friendly APIs
- **Type-friendly workflows** for keys and variables
- **Collaboration-ready foundation** for reviews and iteration
- **Self-hostable architecture** with open export paths
- **Performance-minded delivery** with fallback-friendly runtime behavior

## Current MVP

The current repository is focused on the first layer of that vision.

The repository integration surface includes `@lingva/js`, `@lingva/react`, `@lingva/next`, `@lingva/angular`, `@lingva/vue`, `@lingva/svelte`, `@lingva/node`, `@lingva/docusaurus`, `@lingva/electron`, and Python `lingva-sdk`. Source-level Swift, Kotlin, and Flutter clients are previews, not registry releases. React Native, Unity, and Unreal remain planned. This checkout targets unreleased CLI 0.1.4 and runtime-only Python SDK 0.1.5; check the installed version rather than assuming registry packages match source.

Current implemented capabilities include:

- locale-aware translation lookup
- fallback locale resolution
- variable interpolation
- typed project definitions and metadata
- validation and CI reporting
- manifest generation
- TypeScript artifact generation
- generated helper modules
- source key extraction with audit-style reporting, including TypeScript parser support
- translator and reviewer workflow metadata with CLI reporting
- import and export workflows for normalized resource payloads
- backend-agnostic remote loading contract

This gives us a real runtime and tooling foundation while the broader product surface continues to grow.

## How to use Lingva today

The intended workflow is:

1. Install the CLI, then scaffold account-free local mode with `lingva init --mode local --no-auth --sdk vanilla` (choose a framework SDK for its provider)
2. Let Lingva manage `.lingva/translations/{locale}.json` and generated project artifacts
3. Wrap your app with the React or Next provider when applicable
4. Use translated strings in UI components and pages
5. Expand to hosted sync, review, and delivery automation as your product scales

If you want to start hands-on, go to **[Installation](/installation/overview)**.

## Product direction

### Near term

- Solidify framework adapters and integration ergonomics
- Expand extraction and codegen workflows
- Improve type safety for keys and translation variables
- Turn the web app into a hands-on MVP experience

### Longer term

- Harden hosted delivery and provide an operator-supported self-hosted bootstrap
- Extend existing import/export tooling beyond normalized JSON
- Expand implemented memberships, draft review, promotion, and activity workflows
- AI-assisted translation support
- More framework and platform integrations

## Principles

### Developer experience first

The tool should feel natural in day-to-day code, not like a separate system bolted on afterward.

### Zero lock-in

Your translations should remain yours. Open formats and self-hosting are part of the design, not an afterthought.

### Collaboration without chaos

Localization is a team workflow. It needs structure, history, and context.

### AI as an assistant

AI can help with suggestions and quality checks, but product teams stay in control.

## Next steps

- **[Installation](/installation/overview)** to start with the current runtime
- **[Docs Overview](/overview)** for user-facing guides
- **[Roadmap](/roadmap)** for the longer product direction
- **[Progress Checklist](/progress)** to see what is done and what is next

---

Ready to build multilingual software with better defaults? Continue with **[Installation](/installation/overview)**.
