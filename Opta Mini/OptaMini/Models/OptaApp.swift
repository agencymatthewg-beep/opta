import Foundation
import AppKit

/// Represents an app in the Opta ecosystem
struct OptaApp: Identifiable, Hashable {
    let id: String
    let name: String
    let bundleIdentifier: String
    let icon: String  // SF Symbol name

    /// URL to the app bundle (for launching)
    var appURL: URL? {
        NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundleIdentifier)
    }

    /// All apps in the Opta ecosystem
    static let allApps: [OptaApp] = [
        OptaApp(
            id: "com.opta.OptaNative",
            name: "Opta MacOS",
            bundleIdentifier: "com.opta.OptaNative",
            icon: "dial.high"
        ),
        OptaApp(
            id: "com.opta.OptaLM",
            name: "Opta LM",
            bundleIdentifier: "com.opta.OptaLM",
            icon: "brain"
        ),
        OptaApp(
            id: "com.opta.OptaScan",
            name: "Opta Scan",
            bundleIdentifier: "com.opta.OptaScan",
            icon: "viewfinder"
        )
    ]
}
