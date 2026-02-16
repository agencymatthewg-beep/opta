// OptaLogger.swift — Drop-in structured logging for all Opta Swift apps.
//
// Uses Apple's os.log Logger API (iOS 14+ / macOS 11+) for:
//   - Xcode Console filtering by category
//   - Automatic log level controls (debug stripped in release)
//   - Privacy-aware string interpolation
//   - Near-zero overhead when logs are disabled
//
// Usage:
//   OptaLog.network.info("Connected to \(host)")
//   OptaLog.sync.error("Sync failed: \(error)")
//   OptaLog.auth.debug("Token refreshed for user \(userId, privacy: .private)")
//
// Copy this file into any Opta Swift app. No dependencies required.

import os.log

enum OptaLog {

    // MARK: - Subsystem

    /// Bundle identifier as subsystem (falls back to "biz.optamize.opta")
    private static let subsystem = Bundle.main.bundleIdentifier ?? "biz.optamize.opta"

    // MARK: - Category Loggers

    /// Networking, WebSocket, API calls
    static let network = Logger(subsystem: subsystem, category: "network")

    /// Sync operations (calendar, reminders, Todoist, Telegram)
    static let sync = Logger(subsystem: subsystem, category: "sync")

    /// Authentication and authorization
    static let auth = Logger(subsystem: subsystem, category: "auth")

    /// AI/LLM interactions (prompts, responses, routing)
    static let ai = Logger(subsystem: subsystem, category: "ai")

    /// UI lifecycle and navigation
    static let ui = Logger(subsystem: subsystem, category: "ui")

    /// Data persistence (UserDefaults, Keychain, CoreData, cache)
    static let storage = Logger(subsystem: subsystem, category: "storage")

    /// Background tasks and scheduling
    static let background = Logger(subsystem: subsystem, category: "background")

    /// General app lifecycle
    static let app = Logger(subsystem: subsystem, category: "app")
}
