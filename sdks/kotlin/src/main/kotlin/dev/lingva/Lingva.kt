package dev.lingva

import java.net.HttpURLConnection
import java.net.URI
import kotlinx.serialization.Serializable
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json

public object LingvaBundleContract {
    public const val SCHEMA_VERSION: Int = 1
}

private object LingvaVariantFields {
    const val ID: String = "id"
    const val TEXT: String = "text"
    const val TONE: String = "tone"
    const val MOOD: String = "mood"
    const val INTONATION: String = "intonation"
    const val LABEL: String = "label"
    const val CONTEXT: String = "context"
}

public sealed class LingvaException(message: String) : RuntimeException(message) {
    public class InvalidDeliveryUri(public val value: String) : LingvaException("Invalid Lingva delivery URI: $value")
    public class InvalidHttpStatus(public val status: Int) : LingvaException("Unexpected HTTP status: $status")
    public class MissingDeliveryPlaceholder(public val placeholder: String) :
        LingvaException("Missing Lingva delivery placeholder value: $placeholder")
    public class UnsupportedSchemaVersion(public val version: Int) :
        LingvaException("Unsupported Lingva bundle schema: $version")
}

/** Resolves a Lingva delivery URL template without attaching credentials. */
public data class LingvaDeliveryTarget(
    val uriTemplate: String,
    val projectId: String? = null,
    val environment: String? = null,
    val publishId: String? = null,
) {
    public fun uri(locale: String): URI {
        val values = mapOf(
            DeliveryPlaceholder.ENVIRONMENT to environment,
            DeliveryPlaceholder.LOCALE to locale,
            DeliveryPlaceholder.PROJECT_ID to projectId,
            DeliveryPlaceholder.PUBLISH_ID to publishId,
        )
        val resolved = DeliveryPlaceholder.entries.fold(uriTemplate) { uri, placeholder ->
            if (!uri.contains(placeholder.token)) return@fold uri
            val value = values[placeholder].takeUnless { it.isNullOrEmpty() }
                ?: throw LingvaException.MissingDeliveryPlaceholder(placeholder.wireName)
            uri.replace(placeholder.token, value)
        }
        val uri = runCatching { URI(resolved) }
            .getOrElse { throw LingvaException.InvalidDeliveryUri(resolved) }
        if (!uri.isAbsolute || uri.host == null) {
            throw LingvaException.InvalidDeliveryUri(resolved)
        }
        return uri
    }

    private enum class DeliveryPlaceholder(public val wireName: String) {
        ENVIRONMENT("environment"),
        LOCALE("locale"),
        PROJECT_ID("projectId"),
        PUBLISH_ID("publishId");

        val token: String = "{$wireName}"
    }
}

@Serializable
public data class LingvaBundleEntry(
    val key: String,
    val value: String,
    val sourceLocale: String,
    val fallback: Boolean,
    val variables: List<String>,
    val namespace: String? = null,
)

@Serializable
public data class LingvaMessageVariant(
    val id: String,
    val text: String,
    val tone: String? = null,
    val mood: String? = null,
    val intonation: String? = null,
    val label: String? = null,
    val context: String? = null,
) {
    internal fun matches(metadata: Map<String, String>): Boolean {
        val fields = mapOf(
            LingvaVariantFields.ID to id,
            LingvaVariantFields.TEXT to text,
            LingvaVariantFields.TONE to tone,
            LingvaVariantFields.MOOD to mood,
            LingvaVariantFields.INTONATION to intonation,
            LingvaVariantFields.LABEL to label,
            LingvaVariantFields.CONTEXT to context,
        )
        return metadata.all { (field, value) -> fields[field] == value }
    }
}

public sealed interface LingvaVariantSelector {
    public data class Id(val value: String) : LingvaVariantSelector
    public data class Metadata(val values: Map<String, String>) : LingvaVariantSelector
}

@Serializable
public data class LingvaBundle(
    val schemaVersion: Int,
    val projectId: String? = null,
    val environment: String? = null,
    val locale: String,
    val defaultLocale: String,
    val fallbackLocale: String? = null,
    val generatedAt: String,
    val keyCount: Int,
    val fallbackKeys: List<String>,
    val messages: Map<String, String>,
    val sources: Map<String, String>,
    val variables: Map<String, List<String>>,
    val variants: Map<String, List<LingvaMessageVariant>> = emptyMap(),
    val entries: List<LingvaBundleEntry>,
) {
    public fun translate(
        key: String,
        values: Map<String, String> = emptyMap(),
        fallback: String? = null,
        variant: LingvaVariantSelector? = null,
    ): String {
        var message = messages[key] ?: return fallback ?: key
        variants[key]?.takeIf { it.isNotEmpty() }?.let { candidates ->
            val selected = when (variant) {
                is LingvaVariantSelector.Id -> candidates.firstOrNull { it.id == variant.value }
                is LingvaVariantSelector.Metadata -> candidates.firstOrNull { it.matches(variant.values) }
                null -> candidates.first()
            }
            message = (selected ?: candidates.first()).text
        }
        return variables[key].orEmpty().fold(message) { resolved, variable ->
            values[variable]?.let { resolved.replace("{$variable}", it) } ?: resolved
        }
    }
}

public class LingvaBundleStore(
    initialBundle: LingvaBundle? = null,
    private val json: Json = Json { ignoreUnknownKeys = true },
) {
    public var current: LingvaBundle? = initialBundle
        private set

    public fun load(payload: String): LingvaBundle {
        val candidate = json.decodeFromString<LingvaBundle>(payload)
        if (candidate.schemaVersion != LingvaBundleContract.SCHEMA_VERSION) {
            throw LingvaException.UnsupportedSchemaVersion(candidate.schemaVersion)
        }
        current = candidate
        return candidate
    }

    public fun refresh(uri: URI): LingvaBundle {
        val connection = uri.toURL().openConnection() as HttpURLConnection
        return try {
            connection.requestMethod = HTTP_GET
            val status = connection.responseCode
            if (status !in HTTP_SUCCESS_RANGE) {
                throw LingvaException.InvalidHttpStatus(status)
            }
            load(connection.inputStream.bufferedReader().use { it.readText() })
        } finally {
            connection.disconnect()
        }
    }

    private companion object {
        private const val HTTP_GET = "GET"
        private val HTTP_SUCCESS_RANGE = 200..299
    }
}
