import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

/// Constants shared with the public JSON artifact contract.
public enum LingvaBundleContract {
    public static let schemaVersion = 1
}

private enum LingvaVariantField {
    static let id = "id"
    static let text = "text"
    static let tone = "tone"
    static let mood = "mood"
    static let intonation = "intonation"
    static let label = "label"
    static let context = "context"
}

public enum LingvaError: Error, Equatable {
    case invalidDeliveryURL(String)
    case invalidHTTPStatus(Int)
    case missingDeliveryPlaceholder(String)
    case unsupportedSchemaVersion(Int)
}

/// Resolves a delivery URL template without attaching credentials.
public struct LingvaDeliveryTarget: Equatable, Sendable {
    private enum Placeholder: String, CaseIterable {
        case environment
        case locale
        case projectId
        case publishId

        var token: String { "{\(rawValue)}" }
    }

    public let urlTemplate: String
    public let projectId: String?
    public let environment: String?
    public let publishId: String?

    public init(
        urlTemplate: String,
        projectId: String? = nil,
        environment: String? = nil,
        publishId: String? = nil
    ) {
        self.urlTemplate = urlTemplate
        self.projectId = projectId
        self.environment = environment
        self.publishId = publishId
    }

    public func url(locale: String) throws -> URL {
        let optionalValues: [(Placeholder, String?)] = [
            (.environment, environment),
            (.locale, locale),
            (.projectId, projectId),
            (.publishId, publishId),
        ]
        let values = Dictionary(
            uniqueKeysWithValues: optionalValues.compactMap { placeholder, value in
                value.map { (placeholder, $0) }
            }
        )
        let resolved = try Placeholder.allCases.reduce(urlTemplate) { url, placeholder in
            guard url.contains(placeholder.token) else { return url }
            guard let value = values[placeholder], !value.isEmpty else {
                throw LingvaError.missingDeliveryPlaceholder(placeholder.rawValue)
            }
            return url.replacingOccurrences(of: placeholder.token, with: value)
        }
        guard let url = URL(string: resolved), url.scheme != nil, url.host != nil else {
            throw LingvaError.invalidDeliveryURL(resolved)
        }
        return url
    }
}

public struct LingvaBundleEntry: Decodable, Equatable, Sendable {
    public let key: String
    public let value: String
    public let sourceLocale: String
    public let fallback: Bool
    public let variables: [String]
    public let namespace: String?
}

public struct LingvaMessageVariant: Decodable, Equatable, Sendable {
    public let id: String
    public let text: String
    public let tone: String?
    public let mood: String?
    public let intonation: String?
    public let label: String?
    public let context: String?

    fileprivate func matches(_ metadata: [String: String]) -> Bool {
        let fields = [
            LingvaVariantField.id: id,
            LingvaVariantField.text: text,
            LingvaVariantField.tone: tone,
            LingvaVariantField.mood: mood,
            LingvaVariantField.intonation: intonation,
            LingvaVariantField.label: label,
            LingvaVariantField.context: context,
        ]
        return metadata.allSatisfy { fields[$0.key] == $0.value }
    }
}

public enum LingvaVariantSelector: Equatable, Sendable {
    case id(String)
    case metadata([String: String])
}

/// A validated snapshot of one locale's public Lingva delivery artifact.
public struct LingvaBundle: Decodable, Equatable, Sendable {
    private enum CodingKeys: String, CodingKey {
        case defaultLocale
        case entries
        case environment
        case fallbackKeys
        case fallbackLocale
        case generatedAt
        case keyCount
        case locale
        case messages
        case projectId
        case schemaVersion
        case sources
        case variables
        case variants
    }

    public let schemaVersion: Int
    public let projectId: String?
    public let environment: String?
    public let locale: String
    public let defaultLocale: String
    public let fallbackLocale: String?
    public let generatedAt: String
    public let keyCount: Int
    public let fallbackKeys: [String]
    public let messages: [String: String]
    public let sources: [String: String]
    public let variables: [String: [String]]
    public let variants: [String: [LingvaMessageVariant]]
    public let entries: [LingvaBundleEntry]

    public init(
        schemaVersion: Int = LingvaBundleContract.schemaVersion,
        projectId: String? = nil,
        environment: String? = nil,
        locale: String,
        defaultLocale: String,
        fallbackLocale: String? = nil,
        generatedAt: String,
        fallbackKeys: [String] = [],
        messages: [String: String],
        sources: [String: String],
        variables: [String: [String]],
        variants: [String: [LingvaMessageVariant]] = [:],
        entries: [LingvaBundleEntry]
    ) throws {
        guard schemaVersion == LingvaBundleContract.schemaVersion else {
            throw LingvaError.unsupportedSchemaVersion(schemaVersion)
        }

        self.schemaVersion = schemaVersion
        self.projectId = projectId
        self.environment = environment
        self.locale = locale
        self.defaultLocale = defaultLocale
        self.fallbackLocale = fallbackLocale
        self.generatedAt = generatedAt
        keyCount = messages.count
        self.fallbackKeys = fallbackKeys
        self.messages = messages
        self.sources = sources
        self.variables = variables
        self.variants = variants
        self.entries = entries
    }

    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        let schemaVersion = try values.decode(Int.self, forKey: .schemaVersion)
        guard schemaVersion == LingvaBundleContract.schemaVersion else {
            throw LingvaError.unsupportedSchemaVersion(schemaVersion)
        }

        self.schemaVersion = schemaVersion
        projectId = try values.decodeIfPresent(String.self, forKey: .projectId)
        environment = try values.decodeIfPresent(String.self, forKey: .environment)
        locale = try values.decode(String.self, forKey: .locale)
        defaultLocale = try values.decode(String.self, forKey: .defaultLocale)
        fallbackLocale = try values.decodeIfPresent(String.self, forKey: .fallbackLocale)
        generatedAt = try values.decode(String.self, forKey: .generatedAt)
        keyCount = try values.decode(Int.self, forKey: .keyCount)
        fallbackKeys = try values.decode([String].self, forKey: .fallbackKeys)
        messages = try values.decode([String: String].self, forKey: .messages)
        sources = try values.decode([String: String].self, forKey: .sources)
        variables = try values.decode([String: [String]].self, forKey: .variables)
        variants = try values.decodeIfPresent([String: [LingvaMessageVariant]].self, forKey: .variants) ?? [:]
        entries = try values.decode([LingvaBundleEntry].self, forKey: .entries)
    }

    /// Resolves an exact flattened key and interpolates only variables declared by the bundle.
    public func translate(
        _ key: String,
        variables values: [String: String] = [:],
        fallback: String? = nil,
        variant: LingvaVariantSelector? = nil
    ) -> String {
        guard var message = messages[key] else {
            return fallback ?? key
        }

        if let candidates = variants[key], !candidates.isEmpty {
            let selected: LingvaMessageVariant?
            switch variant {
            case let .id(id):
                selected = candidates.first { $0.id == id }
            case let .metadata(metadata):
                selected = candidates.first { $0.matches(metadata) }
            case nil:
                selected = candidates.first
            }
            message = (selected ?? candidates[0]).text
        }

        return (variables[key] ?? []).reduce(message) { resolved, variable in
            guard let value = values[variable] else { return resolved }
            return resolved.replacingOccurrences(of: "{\(variable)}", with: value)
        }
    }
}

/// Holds the last valid bundle so a failed refresh never destroys usable copy.
public actor LingvaBundleStore {
    public private(set) var current: LingvaBundle?

    public init(bundle: LingvaBundle? = nil) {
        current = bundle
    }

    @discardableResult
    public func load(data: Data, decoder: JSONDecoder = JSONDecoder()) throws -> LingvaBundle {
        let bundle = try decoder.decode(LingvaBundle.self, from: data)
        current = bundle
        return bundle
    }

    @discardableResult
    public func refresh(
        from url: URL,
        session: URLSession = .shared,
        decoder: JSONDecoder = JSONDecoder()
    ) async throws -> LingvaBundle {
        let (data, response) = try await session.data(from: url)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            throw LingvaError.invalidHTTPStatus(status)
        }
        return try load(data: data, decoder: decoder)
    }
}
