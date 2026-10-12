# Lingva for Kotlin (preview)

The Kotlin preview decodes the public Lingva bundle contract and provides exact
key lookup, declared-variable interpolation, synchronous HTTP refresh, and
last-valid-bundle retention. It targets JVM 17 and can be wrapped by the host
application's coroutine or lifecycle layer.

`LingvaDeliveryTarget` resolves hosted bundle URL templates. HTTP refresh is
synchronous so Android callers should execute it on `Dispatchers.IO` and retain
packaged bundles as their offline fallback. The preview does not attach Lingva
credentials; use a packaged bundle or a customer-controlled authenticated
proxy for hosted delivery, never an embedded project key.

Variant selection matches the other Lingva runtimes. Unknown selectors fall
back to the first variant:

```kotlin
bundle.translate("welcome.title", variant = LingvaVariantSelector.Id("bold"))
bundle.translate(
    "welcome.title",
    variant = LingvaVariantSelector.Metadata(mapOf("tone" to "warm")),
)
```

Artifact publication under `dev.lingva` is intentionally deferred until the
API and release policy are stable. `publishToMavenLocal` verifies the sources
jar and POM without configuring or contacting a remote repository.
