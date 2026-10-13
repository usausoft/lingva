---
sidebar_position: 10
---

# Native SDK previews

Lingva includes source-level preview clients for Swift, Kotlin, and Flutter.
They all consume the same public locale-bundle contract and implement exact key
lookup, variant selection by ID or metadata, declared-variable interpolation,
schema validation, and last-valid bundle retention. They are not published to
ecosystem registries yet, so use them as local dependencies while the APIs are
verified.

Python is distributed separately through PyPI. Use the dedicated
**[Python guide](./python.md)** for `lingva-sdk`, portable CLI sync, and hosted
delivery.

## Bundle contract {#bundle-contract}

`lingva publish` writes a manifest plus one bundle for every selected locale.
A locale bundle contains the resolved flat messages together with provenance,
variable, and metadata information:

```json
{
  "schemaVersion": 1,
  "projectId": "mobile-app",
  "environment": "dev",
  "locale": "en",
  "defaultLocale": "en",
  "fallbackLocale": "en",
  "generatedAt": "2026-09-25T00:00:00.000Z",
  "keyCount": 1,
  "fallbackKeys": [],
  "messages": {
    "welcome.title": "Welcome, {name}."
  },
  "variants": {
    "welcome.title": [
      { "id": "warm", "text": "Welcome, {name}.", "tone": "warm" },
      { "id": "bold", "text": "Ship it, {name}!", "tone": "direct" }
    ]
  },
  "sources": {
    "welcome.title": "en"
  },
  "variables": {
    "welcome.title": ["name"]
  },
  "entries": [
    {
      "key": "welcome.title",
      "value": "Welcome, {name}.",
      "sourceLocale": "en",
      "fallback": false,
      "variables": ["name"],
      "namespace": "welcome"
    }
  ]
}
```

`schemaVersion` is the compatibility boundary. Preview clients reject versions
they do not understand instead of accepting a potentially incompatible bundle.

Generate local artifacts with:

```bash
pnpm add --save-dev --allow-build=@lingva/cli @lingva/cli
```

For local artifacts, export an endpoint-free project first:

```bash
pnpm lingva export lingva.config.yaml --format json --output .lingva/artifacts/project.json
pnpm lingva publish .lingva/artifacts/project.json \
  --locale en,ru \
  --output-dir .lingva/artifacts/publish
```

Copy the locale bundles into native build resources. Lingva hosted delivery is
authenticated; Swift, Kotlin, and Flutter preview refresh methods currently do
not attach credentials. For live refresh, place an authenticated backend or
edge endpoint in front of Lingva and expose only the bundles the signed-in app
may read.

The export omits endpoints and credentials. Do not add `--api-url` or a hosted
`--config` override when generating local artifacts. Ordinary `publish` against
a config with an endpoint uploads; its output directory is not a dry-run flag.

## Preview packages {#preview-packages}

The source packages live in the repository under:

- `sdks/swift` — Swift Package Manager library named `Lingva`
- `sdks/kotlin` — JVM library in the `dev.lingva` namespace
- `sdks/flutter` — Flutter package named `lingva_flutter`

Each preview exposes a bundle model, a translator, and a store/controller that
only swaps its current state after a new payload has decoded and validated.
The shared fixture in `sdks/fixtures` is used to keep their behavior aligned.

### Swift {#swift}

Add `sdks/swift` as a local Swift package and use the `Lingva` product:

```swift
import Lingva

let store = LingvaBundleStore()
let bundle = try await store.refresh(from: bundleURL)
let title = bundle.translate("welcome.title", variables: ["name": "Yury"])
let boldTitle = bundle.translate(
    "welcome.title",
    variables: ["name": "Yury"],
    variant: .id("bold")
)
```

`refresh(from:)` sends no Lingva credentials by default and expects a successful
HTTP response. Use a customer-controlled authenticated proxy for remote loading;
load packaged bundle data with `load(data:)`. A raw hosted delivery URL that
requires a project key will not work without an authenticated request setup.

### Kotlin {#kotlin}

Include `sdks/kotlin` as a local Gradle build while the package is in preview:

```kotlin
val store = LingvaBundleStore()
val bundle = store.refresh(bundleUri)
val title = bundle.translate("welcome.title", mapOf("name" to "Yury"))
val warmTitle = bundle.translate(
    "welcome.title",
    variant = LingvaVariantSelector.Metadata(mapOf("tone" to "warm")),
)
```

Run the synchronous network call from an IO coroutine or repository layer; the
preview deliberately does not choose an application coroutine scope.
`refresh` does not attach a Lingva key; route live requests through a trusted
backend or ship a validated bundle with the application.

### Flutter {#flutter}

Reference `sdks/flutter` with a path dependency, then own the controller near
the application locale state:

```dart
final lingva = LingvaBundleController();
await lingva.refresh(bundleUri);
final title = lingva.translate(
  'welcome.title',
  values: {'name': 'Yury'},
  variant: const LingvaVariantSelector.id('bold'),
);
```

`LingvaBundleController` is a `ChangeNotifier`; a successful load emits one
notification and a failed load leaves the previous bundle intact.
The preview does not attach Lingva credentials, so hosted refresh requires a
customer-controlled authenticated proxy.

## Reader responsibilities {#reader-responsibilities}

A minimal reader should:

1. decode and validate the bundle before exposing it to the UI
2. look up exact flattened keys in `messages`
3. select variants by ID or metadata and fall back to the first variant
4. replace only variables declared for that message
5. fall back predictably when a key or bundle is unavailable
6. cache remote bundles and preserve the last valid version

Do not embed project-admin keys or publish tokens in a distributable native
application. Current hosted delivery is authenticated; use a read-scoped SDK
key only in a trusted backend or fetch through your own authenticated edge.
Mutations remain server-side operations.

Plural rules, rich messages, signatures, persistent caches, and background
refresh policies are not standardized yet. Keep application-specific lifecycle
and persistence policy outside the preview client until those contracts are
defined.
