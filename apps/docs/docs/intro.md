---
sidebar_position: 1
slug: /
---

# Introduction to Lingva

Lingva provides translation runtimes, a customer CLI, and portable translation resources. Start locally without an account, then connect hosted delivery when your application needs it.

<span id="what-is-broken-today" />
<span id="what-lingva-aims-to-provide" />
<span id="current-mvp" />
<span id="collaboration-without-chaos" />

## What you can use today {#what-you-can-use-today}

- JavaScript translation lookup, locale fallback, interpolation, typed keys, and variants.
- React, Next.js, Angular, Vue, and Svelte integrations.
- Node, Electron, and Docusaurus runtime adapters.
- Python `lingva-sdk` for local and authenticated hosted translation loading.
- One Rust CLI engine with npm and Python installation adapters.
- Validation, extraction, import/export, generated types, manifests, and bundles.
- Hosted pull/push, draft review, publication, and delivery refresh through customer commands.

Swift, Kotlin, and Flutter clients are source previews. Their ecosystem registry releases remain planned. See [Native bundles](/installation/native-bundles).

The npm and Python CLI adapters are released as `0.1.5`. Guides describe this checkout; use `lingva --version` to check your installed CLI.

<span id="how-to-use-lingva-today" />
<span id="developer-experience-first" />

## Start with local delivery {#start-with-local-delivery}

1. [Install the CLI](/installation/overview).
2. Run `lingva init --mode local --no-auth --sdk vanilla`, or select the SDK for your framework.
3. Edit `.lingva/translations/{locale}.json` and run `lingva sync`.
4. Use the generated integration in your application.
5. Run `lingva check` in CI to catch validation errors and generated-file drift.

Local delivery uses repository resources and needs no hosted credentials. [Configuration](/installation/configuration) explains how local and remote sources differ.

<span id="philosophy" />
<span id="principles" />
<span id="zero-lock-in" />

## Portable resources {#portable-resources}

Translation JSON and generated bundles remain part of your application's delivery workflow. You can import existing resources, export translations, and choose local or hosted loading.

Public SDKs and customer tooling are available under their applicable Lingva licenses. Hosted services are a separate product. An operator-supported self-hosted bootstrap is still planned.

<span id="product-direction" />
<span id="near-term" />
<span id="longer-term" />
<span id="ai-as-an-assistant" />
<span id="next-steps" />

## Find the right guide {#find-the-right-guide}

- [Documentation overview](/overview): choose a task and integration.
- [CLI reference](/installation/cli): customer commands and automation.
- [Customer workspace](/workspace): hosted projects, review, and delivery workflows.
- [Progress checklist](/progress): implemented public capabilities.
- [Roadmap](/roadmap): planned work and distribution boundaries.
