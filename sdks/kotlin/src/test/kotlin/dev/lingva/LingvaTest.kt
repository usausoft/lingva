package dev.lingva

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class LingvaTest {
    private fun fixture(): String = checkNotNull(javaClass.getResource("/en.bundle.json")) {
        "Native bundle fixture was not packaged as a Kotlin test resource."
    }.readText()

    @Test
    fun `resolves hosted delivery uri`() {
        val target = LingvaDeliveryTarget(
            uriTemplate = "https://delivery.example.test/{projectId}/{environment}/{publishId}/{locale}.bundle.json",
            projectId = "demo",
            environment = "production",
            publishId = "latest",
        )

        assertEquals(
            "https://delivery.example.test/demo/production/latest/ru.bundle.json",
            target.uri("ru").toString(),
        )
    }

    @Test
    fun `rejects an unresolved hosted delivery placeholder`() {
        val target = LingvaDeliveryTarget("https://delivery.example.test/{projectId}/{locale}.bundle.json")

        val error = assertFailsWith<LingvaException.MissingDeliveryPlaceholder> { target.uri("en") }
        assertEquals("projectId", error.placeholder)
    }

    @Test
    fun `decodes and translates the shared fixture`() {
        val bundle = LingvaBundleStore().load(fixture())

        assertEquals("native-demo", bundle.projectId)
        assertEquals("Welcome, Yury.", bundle.translate("welcome.title", mapOf("name" to "Yury")))
        assertEquals(
            "Ship it, Yury!",
            bundle.translate(
                "welcome.title",
                mapOf("name" to "Yury"),
                variant = LingvaVariantSelector.Id("bold"),
            ),
        )
        assertEquals(
            "Welcome, Yury.",
            bundle.translate(
                "welcome.title",
                mapOf("name" to "Yury"),
                variant = LingvaVariantSelector.Metadata(mapOf("tone" to "warm")),
            ),
        )
        assertEquals(
            "Welcome, Yury.",
            bundle.translate(
                "welcome.title",
                mapOf("name" to "Yury"),
                variant = LingvaVariantSelector.Id("unknown"),
            ),
        )
        assertEquals("missing.key", bundle.translate("missing.key"))
    }

    @Test
    fun `preserves the last valid bundle after invalid input`() {
        val store = LingvaBundleStore()
        val valid = store.load(fixture())

        assertFailsWith<Exception> { store.load("{}") }
        assertEquals(valid, store.current)
    }

    @Test
    fun `rejects unsupported schemas`() {
        val incompatible = fixture().replace("\"schemaVersion\": 1", "\"schemaVersion\": 2")

        assertFailsWith<LingvaException.UnsupportedSchemaVersion> { LingvaBundleStore().load(incompatible) }
    }
}
