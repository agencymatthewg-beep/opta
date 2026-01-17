// swift-tools-version: 5.9
//
//  Package.swift
//  OptaMenuBar
//
//  Swift package for Tauri plugin providing native macOS MenuBarExtra.
//  Uses FlatBuffers for binary IPC with Rust backend (25Hz data streaming).
//  Created for Opta - Plan 20-08
//

import PackageDescription

let package = Package(
    name: "OptaMenuBar",
    platforms: [
        .macOS(.v13)  // MenuBarExtra API requires macOS 13+
    ],
    products: [
        .library(
            name: "OptaMenuBar",
            type: .dynamic,
            targets: ["OptaMenuBar"]
        ),
        .executable(
            name: "OptaMenuBarApp",
            targets: ["OptaMenuBarApp"]
        )
    ],
    dependencies: [
        // Rive animation runtime for Swift
        .package(url: "https://github.com/rive-app/rive-ios", from: "6.0.0"),
        // Google FlatBuffers for zero-copy IPC
        .package(url: "https://github.com/google/flatbuffers", from: "24.3.25"),
    ],
    targets: [
        // Main library target
        .target(
            name: "OptaMenuBar",
            dependencies: [
                .product(name: "RiveRuntime", package: "rive-ios"),
                .product(name: "FlatBuffers", package: "flatbuffers"),
            ],
            path: "Sources/OptaMenuBar",
            exclude: ["OptaMenuBarApp.swift"],
            resources: [
                .process("../Resources")
            ]
        ),
        // Standalone app target for development/testing
        .executableTarget(
            name: "OptaMenuBarApp",
            dependencies: ["OptaMenuBar"],
            path: "Sources/OptaMenuBar",
            sources: ["OptaMenuBarApp.swift"]
        ),
        // Test target
        .testTarget(
            name: "OptaMenuBarTests",
            dependencies: ["OptaMenuBar"],
            path: "Tests/OptaMenuBarTests"
        ),
    ]
)
