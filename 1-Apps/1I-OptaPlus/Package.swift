// swift-tools-version: 5.9

// Package.swift
// OptaPlus — Cross-platform design system & productivity UI kit
//
// A Swift Package containing two libraries:
//   - OptaPlus: Design tokens, colors, typography, and shared utilities
//   - OptaMolt: Chat UI component library (markdown rendering, code blocks, charts)
//
// Platforms: iOS 17+, macOS 14+
// No external dependencies — pure SwiftUI + system frameworks (Charts)

import PackageDescription

let package = Package(
    name: "OptaPlus",

    platforms: [
        .iOS(.v17),
        .macOS(.v14),
    ],

    // MARK: - Products

    products: [
        // Design system: tokens, colors, typography, spacing
        .library(
            name: "OptaPlus",
            targets: ["OptaPlus"]
        ),
        // Chat UI components: message bubbles, code blocks, markdown, charts
        .library(
            name: "OptaMolt",
            targets: ["OptaMolt"]
        ),
    ],

    // MARK: - Dependencies

    dependencies: [
        // TDLibKit temporarily removed — version 4.0.0 doesn't exist
        // TODO: Re-add when Telegram sync is ready with correct version
        // .package(url: "https://github.com/Swiftgram/TDLibKit", from: "4.0.0"),
    ],

    // MARK: - Targets

    targets: [
        // Design system target — shared tokens and utilities
        .target(
            name: "OptaPlus",
            path: "Shared/Sources/OptaPlus",
            exclude: ["README.md"]
        ),

        // Chat UI component library — depends on OptaPlus for shared design tokens
        .target(
            name: "OptaMolt",
            dependencies: [
                "OptaPlus",
            ],
            path: "Shared/Sources/OptaMolt",
            exclude: ["README.md"]
        ),

        // Design system tests
        .testTarget(
            name: "OptaPlusTests",
            dependencies: ["OptaPlus"],
            path: "Shared/Tests/OptaPlusTests",
            exclude: ["README.md"]
        ),

        // Chat component tests
        .testTarget(
            name: "OptaMoltTests",
            dependencies: ["OptaMolt"],
            path: "Shared/Tests/OptaMoltTests",
            exclude: ["README.md"]
        ),
    ]
)
