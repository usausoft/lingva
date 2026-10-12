import Foundation
import XCTest
@testable import Lingva

final class LingvaTests: XCTestCase {
    func testResolvesHostedDeliveryURL() throws {
        let target = LingvaDeliveryTarget(
            urlTemplate: "https://delivery.example.test/{projectId}/{environment}/{publishId}/{locale}.bundle.json",
            projectId: "demo",
            environment: "production",
            publishId: "latest"
        )

        XCTAssertEqual(
            try target.url(locale: "ru").absoluteString,
            "https://delivery.example.test/demo/production/latest/ru.bundle.json"
        )
    }

    func testRejectsAnUnresolvedHostedDeliveryPlaceholder() {
        let target = LingvaDeliveryTarget(
            urlTemplate: "https://delivery.example.test/{projectId}/{locale}.bundle.json"
        )

        XCTAssertThrowsError(try target.url(locale: "en")) { error in
            XCTAssertEqual(error as? LingvaError, .missingDeliveryPlaceholder("projectId"))
        }
    }

    private func fixtureData() throws -> Data {
        let fixture = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("fixtures/en.bundle.json")
        return try Data(contentsOf: fixture)
    }

    func testDecodesSharedContractFixture() throws {
        let bundle = try JSONDecoder().decode(LingvaBundle.self, from: fixtureData())

        XCTAssertEqual(bundle.projectId, "native-demo")
        XCTAssertEqual(bundle.translate("welcome.title", variables: ["name": "Yury"]), "Welcome, Yury.")
        XCTAssertEqual(
            bundle.translate("welcome.title", variables: ["name": "Yury"], variant: .id("bold")),
            "Ship it, Yury!"
        )
        XCTAssertEqual(
            bundle.translate("welcome.title", variables: ["name": "Yury"], variant: .metadata(["tone": "warm"])),
            "Welcome, Yury."
        )
        XCTAssertEqual(
            bundle.translate("welcome.title", variables: ["name": "Yury"], variant: .id("unknown")),
            "Welcome, Yury."
        )
        XCTAssertEqual(bundle.translate("missing.key"), "missing.key")
        XCTAssertEqual(bundle.translate("missing.key", fallback: "Missing"), "Missing")
    }

    func testRejectsAnUnsupportedSchema() throws {
        let incompatible = String(decoding: try fixtureData(), as: UTF8.self)
            .replacingOccurrences(of: "\"schemaVersion\": 1", with: "\"schemaVersion\": 2")

        XCTAssertThrowsError(try JSONDecoder().decode(LingvaBundle.self, from: Data(incompatible.utf8))) { error in
            XCTAssertEqual(error as? LingvaError, .unsupportedSchemaVersion(2))
        }
    }

    func testStorePreservesLastValidBundle() async throws {
        let store = LingvaBundleStore()
        let valid = try await store.load(data: fixtureData())
        let invalid = Data("{}".utf8)

        do {
            _ = try await store.load(data: invalid)
            XCTFail("Expected invalid bundle data to fail.")
        } catch {
            // A failed candidate must not replace the last validated bundle.
        }
        let current = await store.current
        XCTAssertEqual(current, valid)
    }
}
