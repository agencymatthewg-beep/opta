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
        // OpenClaw AI Gateway (launchd service — was com.clawdbot.gateway)
        OptaApp(
            id: "ai.openclaw.gateway",
            name: "OpenClaw",
            bundleIdentifier: "ai.openclaw.gateway",
            icon: "brain.head.profile",
            type: .launchdService,
            launchdLabel: "ai.openclaw.gateway",
            processName: "openclaw/dist/index.js"
        ),

        // Regular Apps
        OptaApp(
            id: "com.opta.native",
            name: "Opta macOS",
            bundleIdentifier: "com.opta.native",
            icon: "dial.high"
        ),

        // Opta Local Web dashboard (pnpm start in 1L-Opta-Local/web, localhost:3004)
        OptaApp(
            id: "com.opta.local-web",
            name: "Opta Local",
            bundleIdentifier: "com.opta.local-web",
            icon: "macwindow",
            type: .launchdService,
            launchdLabel: "com.opta.local-web",
            processName: "1L-Opta-Local"
        ),

        // LMX Cloudflare Tunnel (cloudflared → Mono512 inference server)
        OptaApp(
            id: "com.opta.local-lmx-tunnel",
            name: "LMX Tunnel",
            bundleIdentifier: "com.opta.local-lmx-tunnel",
            icon: "antenna.radiowaves.left.and.right",
            type: .launchdService,
            launchdLabel: "com.opta.local-lmx-tunnel",
            processName: "optalocal-lmx"
        ),

        // Phone Bridge (bun, port 3333)
        OptaApp(
            id: "com.opta.phone-bridge",
            name: "Phone Bridge",
            bundleIdentifier: "com.opta.phone-bridge",
            icon: "iphone",
            type: .launchdService,
            launchdLabel: "com.opta.phone-bridge",
            processName: "opta-phone-bridge"
        ),

        // Kimi Proxy (uvicorn, port 4999)
        OptaApp(
            id: "com.opta.kimi-proxy",
            name: "Kimi Proxy",
            bundleIdentifier: "com.opta.kimi-proxy",
            icon: "arrow.left.arrow.right.circle",
            type: .launchdService,
            launchdLabel: "com.opta.kimi-proxy",
            processName: "kimi-proxy"
        ),

        // Opta LM (legacy launchd service — plist path needs updating externally)
        OptaApp(
            id: "com.opta.life-manager",
            name: "Opta LM",
            bundleIdentifier: "com.opta.life-manager",
            icon: "list.bullet.clipboard",
            type: .launchdService,
            launchdLabel: "com.opta.life-manager",
            processName: "opta-life-manager"
        ),
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
