// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MonoUsage",
    platforms: [
        .macOS(.v13)
    ],
    dependencies: [],
    targets: [
        .executableTarget(
            name: "MonoUsage",
            dependencies: [],
            exclude: ["README.md"],
            resources: [
                .process("Resources")
            ]
        ),
    ]
)
