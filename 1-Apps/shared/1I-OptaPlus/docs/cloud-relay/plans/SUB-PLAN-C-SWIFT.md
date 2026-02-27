# SUB-PLAN C: OptaPlus Swift Code Changes

*For: swift-agent (Claude Code)*
*Estimated: 45 minutes*
*No prerequisites — can start immediately*
*Project: `~/Synced/Opta/1-Apps/1I-OptaPlus/`*

---

## Overview

Add remote access support to OptaPlus so the app can connect to bots via `wss://gateway.optamize.biz` when not on the home LAN. The app should auto-detect whether it's on LAN and use the faster direct connection when available.

## File Changes

### C1: BotConfig Model Update
**File:** `Shared/Sources/OptaMolt/Networking/ChatViewModel.swift`

Add to `BotConfig`:

```swift
public struct BotConfig: Identifiable, Codable, Sendable, Hashable {
    public let id: String
    public var name: String
    public var host: String           // LAN host: "192.168.188.9"
    public var port: Int              // LAN port: 18793
    public var token: String
    public var emoji: String
    public var sessions: [ChatSession]
    
    // NEW: Remote access
    public var remoteURL: String?     // e.g. "wss://gateway.optamize.biz"
    public var connectionMode: ConnectionMode
    
    public enum ConnectionMode: String, Codable, Sendable, Hashable {
        case auto     // Try LAN first (200ms probe), fall back to remote
        case lan      // Force LAN only (current behavior)
        case remote   // Force remote only
    }
    
    // UPDATED: Support both ws:// and wss://
    public var lanURL: URL? {
        URL(string: "ws://\(host):\(port)")
    }
    
    public var remoteAccessURL: URL? {
        remoteURL.flatMap { URL(string: $0) }
    }
    
    // UPDATED init
    public init(
        id: String = UUID().uuidString,
        name: String,
        host: String = "127.0.0.1",
        port: Int,
        token: String,
        emoji: String = "🤖",
        sessionKey: String = "main",
        remoteURL: String? = nil,
        connectionMode: ConnectionMode = .auto
    ) {
        self.id = id
        self.name = name
        self.host = host
        self.port = port
        self.token = token
        self.emoji = emoji
        self.sessions = [ChatSession.defaultSynced(botName: name)]
        self.remoteURL = remoteURL
        self.connectionMode = connectionMode
    }
}
```

**Migration note:** Existing `BotConfig` in UserDefaults won't have `remoteURL` or `connectionMode`. Make them optional with defaults in `Codable` conformance:
```swift
enum CodingKeys: String, CodingKey {
    case id, name, host, port, token, emoji, sessions, remoteURL, connectionMode
}

public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    // ... decode existing fields ...
    remoteURL = try container.decodeIfPresent(String.self, forKey: .remoteURL)
    connectionMode = try container.decodeIfPresent(ConnectionMode.self, forKey: .connectionMode) ?? .auto
}
```

### C2: OpenClawClient WSS Support
**File:** `Shared/Sources/OptaMolt/Networking/OpenClawClient.swift`

The client already has `useTLS: Bool`. Changes needed:

1. **URL-based connection**: When `remoteURL` is provided, use it directly
2. **Origin header**: Must match the remote hostname when connecting remotely
3. **Host header**: cloudflared uses this for routing; must match the ingress rule hostname

```swift
// Add a URL-based connect method
public func connect(to url: URL, token: String?) {
    let host = url.host ?? "127.0.0.1"
    let port = UInt16(url.port ?? (url.scheme == "wss" ? 443 : 18793))
    let useTLS = url.scheme == "wss"
    
    // Origin must match the full URL origin (scheme + host + port)
    // For wss://gateway.optamize.biz → Origin: https://gateway.optamize.biz
    let origin: String
    if useTLS {
        origin = "https://\(host)" + (url.port.map { ":\($0)" } ?? "")
    } else {
        origin = "http://\(host):\(port)"
    }
    
    // ... create NWConnection with TLS parameters if needed
}
```

**Important NWConnection TLS setup:**
```swift
if useTLS {
    let tlsOptions = NWProtocolTLS.Options()
    let wsOptions = NWProtocolWebSocket.Options()
    wsOptions.autoReplyPing = true
    
    let params = NWParameters(tls: tlsOptions)
    params.defaultProtocolStack.applicationProtocols.insert(wsOptions, at: 0)
    
    // For wss:// with standard port 443, use host-only endpoint
    let endpoint = NWEndpoint.hostPort(host: NWEndpoint.Host(host), port: NWEndpoint.Port(rawValue: port)!)
    connection = NWConnection(to: endpoint, using: params)
}
```

### C3: NetworkEnvironment (New File)
**File:** `Shared/Sources/OptaMolt/Networking/NetworkEnvironment.swift` (NEW)

```swift
import Foundation
import Network
import Combine

/// Detects whether we're on the same LAN as a gateway.
/// Used for auto-mode: prefer LAN when available, fall back to remote.
@MainActor
public final class NetworkEnvironment: ObservableObject {
    
    @Published public var isOnLAN: Bool = false
    @Published public var connectionType: ConnectionType = .unknown
    
    public enum ConnectionType: String, Sendable {
        case lan      // Same LAN as gateway
        case remote   // Connected via remote URL
        case unknown  // Not yet determined
    }
    
    private let monitor = NWPathMonitor()
    
    public init() {
        startMonitoring()
    }
    
    /// Quick TCP probe to check if LAN host is reachable (200ms timeout)
    public func probeLAN(host: String, port: Int) async -> Bool {
        return await withCheckedContinuation { continuation in
            let endpoint = NWEndpoint.hostPort(
                host: NWEndpoint.Host(host),
                port: NWEndpoint.Port(rawValue: UInt16(port))!
            )
            let connection = NWConnection(to: endpoint, using: .tcp)
            var resumed = false
            
            connection.stateUpdateHandler = { state in
                guard !resumed else { return }
                switch state {
                case .ready:
                    resumed = true
                    connection.cancel()
                    continuation.resume(returning: true)
                case .failed, .cancelled:
                    resumed = true
                    continuation.resume(returning: false)
                default:
                    break
                }
            }
            
            connection.start(queue: .global())
            
            // 200ms timeout
            DispatchQueue.global().asyncAfter(deadline: .now() + 0.2) {
                guard !resumed else { return }
                resumed = true
                connection.cancel()
                continuation.resume(returning: false)
            }
        }
    }
    
    /// Determine the best URL for a bot config
    public func resolveURL(for config: BotConfig) async -> URL? {
        switch config.connectionMode {
        case .lan:
            return config.lanURL
        case .remote:
            return config.remoteAccessURL
        case .auto:
            // Try LAN first
            if await probeLAN(host: config.host, port: config.port) {
                isOnLAN = true
                connectionType = .lan
                return config.lanURL
            }
            // Fall back to remote
            if let remote = config.remoteAccessURL {
                isOnLAN = false
                connectionType = .remote
                return remote
            }
            // No remote URL configured, try LAN anyway
            return config.lanURL
        }
    }
    
    private func startMonitoring() {
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                // Network changed — re-probe on next connection attempt
                self?.connectionType = .unknown
            }
        }
        monitor.start(queue: .global())
    }
}
```

### C4: ChatViewModel Smart Connection
**File:** `Shared/Sources/OptaMolt/Networking/ChatViewModel.swift`

Update the `connect()` method to use `NetworkEnvironment`:

```swift
@MainActor
public final class ChatViewModel: ObservableObject {
    // ... existing properties ...
    
    private let networkEnv: NetworkEnvironment
    @Published public var connectionRoute: NetworkEnvironment.ConnectionType = .unknown
    
    public init(botConfig: BotConfig, syncCoordinator: SyncCoordinator? = nil, networkEnv: NetworkEnvironment = NetworkEnvironment()) {
        self.networkEnv = networkEnv
        // ... existing init ...
    }
    
    public func connect() {
        Task {
            guard let url = await networkEnv.resolveURL(for: botConfig) else {
                // No URL available
                return
            }
            connectionRoute = networkEnv.connectionType
            
            let useTLS = url.scheme == "wss"
            client = OpenClawClient(url: url, token: botConfig.token, useTLS: useTLS)
            client?.connect()
            // ... existing observation setup ...
        }
    }
}
```

### C5: Settings UI — Remote URL Field
**File (macOS):** `macOS/OptaPlusMacOS/SettingsViews.swift`
**File (iOS):** `iOS/OptaPlusIOS/SettingsView.swift`

Add to bot editing form:

```swift
Section("Remote Access") {
    TextField("Remote URL", text: $bot.remoteURL.bound(""))
        .textFieldStyle(.roundedBorder)
        .font(.system(.body, design: .monospaced))
        .help("e.g. wss://gateway.optamize.biz")
    
    Picker("Connection Mode", selection: $bot.connectionMode) {
        Text("Auto (LAN preferred)").tag(BotConfig.ConnectionMode.auto)
        Text("LAN Only").tag(BotConfig.ConnectionMode.lan)
        Text("Remote Only").tag(BotConfig.ConnectionMode.remote)
    }
    .pickerStyle(.segmented)
}
```

### C6: Default Bot Configs
**File (macOS):** `macOS/OptaPlusMacOS/ContentView.swift`
**File (iOS):** `iOS/OptaPlusIOS/ContentView.swift`

Update `addDefaultBots()`:

```swift
static func defaultBots() -> [BotConfig] {
    [
        BotConfig(name: "Opta Max", host: "192.168.188.9", port: 18793,
                  token: "8c081eb5c0769f34ec0fedde6e6ddd5f5299fb946b91b1ed",
                  emoji: "🥷🏿", remoteURL: "wss://gateway.optamize.biz"),
        BotConfig(name: "Mono", host: "192.168.188.11", port: 19001,
                  token: "e5acead966cc3922795eaea658612d9c47e4b7fa87563729",
                  emoji: "🟢", remoteURL: "wss://mono.optamize.biz"),
        BotConfig(name: "Opta512", host: "192.168.188.11", port: 19000,
                  token: "", emoji: "🟣",
                  remoteURL: "wss://opta512.optamize.biz"),
        BotConfig(name: "Floda", host: "192.168.188.11", port: 19002,
                  token: "", emoji: "🧪",
                  remoteURL: "wss://floda.optamize.biz"),
        BotConfig(name: "Saturday", host: "192.168.188.11", port: 19003,
                  token: "", emoji: "🔵",
                  remoteURL: "wss://saturday.optamize.biz"),
        BotConfig(name: "YJ", host: "192.168.188.11", port: 19005,
                  token: "", emoji: "⚡",
                  remoteURL: "wss://yj.optamize.biz"),
    ]
}
```

### C7: Connection Status Indicator
**File (macOS):** `macOS/OptaPlusMacOS/ContentView.swift`

Add a small indicator showing LAN vs Remote:

```swift
// In the chat header or status bar
HStack(spacing: 4) {
    Circle()
        .fill(viewModel.state == .connected ? Color.green : Color.red)
        .frame(width: 8, height: 8)
    
    if viewModel.connectionRoute == .remote {
        Image(systemName: "globe")
            .font(.caption2)
            .foregroundStyle(.secondary)
        Text("Remote")
            .font(.caption2)
            .foregroundStyle(.secondary)
    } else if viewModel.connectionRoute == .lan {
        Image(systemName: "wifi")
            .font(.caption2)
            .foregroundStyle(.secondary)
        Text("LAN")
            .font(.caption2)
            .foregroundStyle(.secondary)
    }
}
```

### C8: Build Verification

```bash
# macOS build
cd ~/Synced/Opta/1-Apps/1I-OptaPlus
xcodebuild -project macOS/OptaPlusMacOS.xcodeproj -scheme OptaPlusMacOS -configuration Debug build 2>&1 | tail -5

# iOS build
xcodebuild -project iOS/OptaPlusIOS.xcodeproj -scheme OptaPlusIOS -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build 2>&1 | tail -5
```

## New Files to Create

1. `Shared/Sources/OptaMolt/Networking/NetworkEnvironment.swift`

## Files to Add to Xcode Projects

Both `macOS/OptaPlusMacOS.xcodeproj` and `iOS/OptaPlusIOS.xcodeproj` need:
- `NetworkEnvironment.swift` added to targets

Since it's in the Shared package (OptaMolt), it should be automatically available via the package dependency.

## Testing Notes

- **LAN test**: Connect with WiFi on home network → should use `ws://192.168.188.9:18793`
- **Remote test**: Turn off WiFi, use cellular → should use `wss://gateway.optamize.biz`
- **Auto-detect test**: Start on cellular, connect to WiFi mid-session → should reconnect via LAN
- **Failover test**: Disconnect WiFi while connected → should reconnect via remote URL

## Codable Migration

When adding `remoteURL` and `connectionMode` to BotConfig, existing users' saved bots (in UserDefaults) won't have these fields. The `Codable` implementation must handle missing fields gracefully:

```swift
public init(from decoder: Decoder) throws {
    // ... existing decode ...
    self.remoteURL = try container.decodeIfPresent(String.self, forKey: .remoteURL)
    self.connectionMode = try container.decodeIfPresent(ConnectionMode.self, forKey: .connectionMode) ?? .auto
}
```

This ensures the app doesn't crash when loading old configs.
