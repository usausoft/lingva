# Lingva for Swift (preview)

`LingvaSwift` consumes the same versioned locale bundles as the Lingva web
runtimes. It supports exact key lookup, declared-variable interpolation, local
data loading, remote refresh, and last-valid-bundle retention.

Add this directory as a local Swift package, import `Lingva`, then load a
published `*.bundle.json` artifact into `LingvaBundleStore`.

`LingvaDeliveryTarget` resolves the same `{projectId}`, `{environment}`,
`{publishId}`, and `{locale}` placeholders used by the JavaScript SDKs.
`LingvaBundleStore.refresh(from:)` does not attach credentials. Lingva hosted
delivery requires authentication, so use a packaged bundle or a
customer-controlled authenticated proxy. Never embed a project, publish, or
administrative key in an application bundle.

Variant selection matches the other Lingva runtimes. Unknown selectors fall
back to the first variant:

```swift
bundle.translate("welcome.title", variables: ["name": "Yury"], variant: .id("bold"))
bundle.translate("welcome.title", variant: .metadata(["tone": "warm"]))
```

This package is a source-level preview. A registry release and semantic
versioning policy are still required before it is described as production
ready.
