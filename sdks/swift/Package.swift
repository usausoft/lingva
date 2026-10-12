// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "LingvaSwift",
    platforms: [
        .iOS(.v15),
        .macOS(.v12),
        .tvOS(.v15),
        .watchOS(.v8),
    ],
    products: [
        .library(name: "Lingva", targets: ["Lingva"]),
    ],
    targets: [
        .target(name: "Lingva"),
        .testTarget(name: "LingvaTests", dependencies: ["Lingva"]),
    ]
)
