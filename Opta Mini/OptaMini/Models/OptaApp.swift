import Foundation
import AppKit

/// Type of Opta ecosystem component
enum OptaAppType {
    case app           // Regular macOS app (bundleIdentifier-based)
    case launchdService // launchd-managed service (label-based)
}

/// Represents an app or service in the Opta ecosystem
struct OptaApp: Identifiable, Hashable {
    let id: String
    let name: String
    let bundleIdentifier: String
    let icon: String  // SF Symbol name
    let type: OptaAppType
    let launchdLabel: String?  // For launchd services
    let processName: String?   // For checking if service is running
    
    init(
        id: String,
        name: String,
        bundleIdentifier: String,
        icon: String,
        type: OptaAppType = .app,
        launchdLabel: String? = nil,
        processName: String? = nil
    ) {
        self.id = id
        self.name = name
        self.bundleIdentifier = bundleIdentifier
        self.icon = icon
        self.type = type
        self.launchdLabel = launchdLabel
        self.processName = processName
    }

    /// URL to the app bundle (for launching regular apps)
    var appURL: URL? {
        guard type == .app else { return nil }
        return NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundleIdentifier)
    }
    
    /// Path to launchd plist (for services)
    var launchdPlistPath: String? {
        guard type == .launchdService, let label = launchdLabel else { return nil }
        return "\(NSHomeDirectory())/Library/LaunchAgents/\(label).plist"
    }

    /// All apps and services in the Opta ecosystem
    static let allApps: [OptaApp] = [
        // AI Copilot (launchd service)
        OptaApp(
            id: "com.clawdbot.gateway",
            name: "Opta AI",
            bundleIdentifier: "com.clawdbot.gateway",
            icon: "brain.head.profile",
            type: .launchdService,
            launchdLabel: "com.clawdbot.gateway",
            processName: "clawdbot-gateway"
        ),
        
        // Regular Apps
        OptaApp(
            id: "com.opta.native",
            name: "Opta macOS",
            bundleIdentifier: "com.opta.native",
            icon: "dial.high"
        ),
        // Life Manager (launchd service - Next.js dashboard)
        OptaApp(
            id: "com.opta.life-manager",
            name: "Opta LM",
            bundleIdentifier: "com.opta.life-manager",
            icon: "list.bullet.clipboard",
            type: .launchdService,
            launchdLabel: "com.opta.life-manager",
            processName: "opta-life-manager"
        )
    ]
    
    /// Just the regular apps (excluding services)
    static var regularApps: [OptaApp] {
        allApps.filter { $0.type == .app }
    }
    
    /// Just the launchd services
    static var services: [OptaApp] {
        allApps.filter { $0.type == .launchdService }
    }
}
