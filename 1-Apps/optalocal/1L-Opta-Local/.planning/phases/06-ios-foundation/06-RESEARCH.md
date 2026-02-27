# Phase 6 Research: iOS Foundation

> Zero-config LAN connection via Bonjour and native SwiftUI streaming chat

## Summary

Phase 6 introduces iOS-native patterns across four domains: Bonjour discovery (NWBrowser), secure credential storage (Keychain via Valet), streaming chat (URLSession.bytes), and SwiftUI architecture (@Observable). All domains have mature, stable APIs targeting iOS 17+. No exotic libraries needed — the standard stack is native frameworks + one small dependency (Valet for Keychain ergonomics).

Key finding: The LMX server must advertise a `_opta-lmx._tcp` Bonjour service (Python `zeroconf` library) for iOS auto-discovery. This is a prerequisite that may need a plan in Phase 6.

## Standard Stack

| Domain | Recommended | Alternative | Avoid |
|--------|------------|-------------|-------|
| **Service Discovery** | `NWBrowser` (Network.framework) | — | `NetServiceBrowser` (deprecated), manual IP scanning |
| **Credential Storage** | Square Valet v5.x | Raw `SecItem` API | KeychainAccess (stale since 2021), KeychainSwift (82 issues) |
| **Streaming HTTP** | `URLSession.bytes` + `.lines` | mattt/EventSource (if full SSE spec needed) | Alamofire streaming, raw socket |
| **Architecture** | `@Observable` + `@MainActor` + MVVM | — | `ObservableObject`/`@Published` (legacy), VIPER (over-engineered) |
| **Navigation** | `NavigationStack` + route enum | — | `NavigationView` (deprecated) |
| **Icons** | SF Symbols | — | Lucide (web only) |
| **Animation** | SwiftUI spring physics | — | UIKit animations |

### Dependency Budget

| Package | Purpose | Size | Justification |
|---------|---------|------|---------------|
| **Valet** (Square) | Keychain wrapper | ~50KB | Eliminates raw CFDictionary pain, corporate-backed, 4.1k stars, last commit Feb 2026 |

Everything else is native Apple frameworks — zero additional dependencies for networking, discovery, or streaming.

## Architecture Patterns

### App Architecture: Modern MVVM with @Observable

```
App Layer          @main App struct, root @Observable state, .environment() injection
   │
ViewModel Layer    @Observable @MainActor classes (one per feature/screen)
   │
Service Layer      Protocol-based services (LMXClient, BonjourBrowser, KeychainStore)
   │
Model Layer        Plain structs (Codable, Identifiable, Hashable)
```

### Feature File Structure

```
OptaLocal/
├── App/
│   ├── OptaLocalApp.swift              # @main, environment injection
│   └── NavigationCoordinator.swift     # Route enum + NavigationPath
├── Features/
│   ├── Discovery/
│   │   ├── DiscoveryView.swift         # Server picker + manual entry
│   │   ├── DiscoveryViewModel.swift    # @Observable, wraps LMXServiceBrowser
│   │   └── Components/
│   │       └── ServerRow.swift
│   ├── Chat/
│   │   ├── ChatView.swift
│   │   ├── ChatViewModel.swift         # @Observable, streaming state
│   │   └── Components/
│   │       ├── MessageBubble.swift
│   │       └── ChatInput.swift
│   └── Settings/
│       ├── SettingsView.swift
│       └── SettingsViewModel.swift
├── Services/
│   ├── LMXServiceBrowser.swift         # @Observable, NWBrowser wrapper
│   ├── LMXClient.swift                 # URLSession.bytes streaming
│   ├── SecretsManager.swift            # @Observable, Valet wrapper
│   └── ConnectionManager.swift         # LAN/WAN state machine
├── Models/
│   ├── LMXTypes.swift                  # ChatMessage, Model, etc.
│   ├── AppError.swift                  # Typed error enum
│   └── LoadingState.swift              # Generic loading state enum
├── SharedUI/
│   ├── GlassModifier.swift
│   └── OptaColors.swift                # Asset catalog references
└── Extensions/
    └── Date+Extensions.swift
```

### Bonjour Discovery Pattern

**Server side (Opta-LMX):** Must advertise `_opta-lmx._tcp` via Python `zeroconf`:

```python
from zeroconf import ServiceInfo, Zeroconf
import socket

info = ServiceInfo(
    "_opta-lmx._tcp.local.",
    "Mono512._opta-lmx._tcp.local.",
    addresses=[socket.inet_aton("192.168.188.11")],
    port=1234,
    properties={"version": "1.0", "models": "3"},
)
zeroconf = Zeroconf()
zeroconf.register_service(info)
```

**Client side (iOS):** NWBrowser with probe-based resolution:

1. Browse for `_opta-lmx._tcp` via `NWBrowser`
2. On selection: create probe `NWConnection` to extract IP:port from `currentPath.remoteEndpoint`
3. Construct base URL for `URLSession` API calls
4. Store resolved URL + admin key in Keychain via Valet

### Streaming Chat Pattern

```swift
// AsyncThrowingStream wraps URLSession.bytes.lines
func streamTokens(messages: [ChatMessage], model: String) -> AsyncThrowingStream<String, Error> {
    AsyncThrowingStream { continuation in
        let task = Task {
            let (stream, response) = try await session.bytes(for: request)
            for try await line in stream.lines {
                guard line.hasPrefix("data: ") else { continue }
                let payload = String(line.dropFirst(6))
                guard payload != "[DONE]" else { break }
                if let token = decodeChunkToken(payload) {
                    continuation.yield(token)
                }
            }
            continuation.finish()
        }
        continuation.onTermination = { _ in task.cancel() }
    }
}
```

### Keychain Integration Pattern

```swift
@Observable
final class SecretsManager {
    private let valet = Valet.valet(
        with: Identifier(nonEmpty: "com.optamize.opta-local")!,
        accessibility: .whenUnlocked
    )

    private(set) var adminKey: String?

    init() { adminKey = try? valet.string(forKey: "admin_key") }

    func setAdminKey(_ key: String) throws {
        try valet.setString(key, forKey: "admin_key")
        adminKey = key
    }
}
```

## Don't Hand-Roll

| What | Use Instead |
|------|-------------|
| mDNS/DNS-SD protocol parsing | `NWBrowser` — handles multicast, caching, conflict resolution |
| IP scanning / port scanning | `NWBrowser` — event-driven discovery (Apple rejects manual scans) |
| Keychain CFDictionary queries | Valet — type-safe upsert, access groups, Secure Enclave built-in |
| SSE line buffering | `URLSession.AsyncBytes.lines` — auto-buffers until newline |
| SSE reconnection for chat | Not needed — each chat completion is one request; retry the whole call |
| Observable property tracking | `@Observable` macro — fine-grained automatic tracking |
| Navigation state management | `NavigationStack` + `NavigationPath` — type-safe, programmatic |
| TXT record parsing | `NWTXTRecord.getEntry(for:)` — framework handles encoding |

## Common Pitfalls

### Bonjour / NWBrowser
1. **Cannot restart a cancelled NWBrowser** — must create a new instance after `cancel()`
2. **Set handlers BEFORE calling `start()`** — or miss initial `.ready` and early results
3. **Don't eagerly resolve all services** — only resolve on selection (Apple "major faux pas")
4. **Info.plist keys are mandatory**: `NSBonjourServices` array with `_opta-lmx._tcp` AND `NSLocalNetworkUsageDescription` string — without these, browse silently returns zero results
5. **Simulator doesn't show permission dialog** — Local Network permission can only be tested on device
6. **PolicyDenied error detection** — check `error.debugDescription.contains("PolicyDenied")` in `.waiting` state
7. **Stale results after network change** — cancel and recreate browser on foreground resume

### Keychain
1. **Keychain persists across app installs** — deleting app does NOT clear items
2. **errSecDuplicateItem on re-save** — always implement upsert (Valet handles this)
3. **Keychain Sharing doesn't work in Simulator** — test access groups on device only
4. **`whenUnlocked` items unavailable after reboot** until first unlock — use `afterFirstUnlock` for background work

### Streaming
1. **`timeoutIntervalForRequest` default is 60s** — raise to 120s+ for LLM inference (first token can take >60s with large context)
2. **`.lines` strips newline but NOT `data: ` prefix** — must strip manually
3. **`[DONE]` is not valid JSON** — check before decoding
4. **iOS suspends apps during background** — stream cancelled ~5s after backgrounding; use `beginBackgroundTask` for ~30s extension
5. **`@MainActor` streaming methods block main actor** — use `Task.detached` or `nonisolated`

### @Observable / SwiftUI
1. **Observation does NOT track properties read inside closures** — read into local variable in body scope first
2. **@Observable requires classes** — structs don't work
3. **@State re-runs initializers** but uses first instance — keep init lightweight
4. **No Combine operators** — debounce/throttle must be manual `Task.sleep` + cancellation
5. **Swift 6 strict concurrency** — all @Observable ViewModels touching UI state need `@MainActor`
6. **@Bindable needed when model is NOT in @State** — for form bindings on passed-in models

## Code Examples

### NWBrowser → IP:port Resolution (for URLSession)

```swift
func resolveEndpoint(_ endpoint: NWEndpoint) async throws -> (host: String, port: UInt16) {
    try await withCheckedThrowingContinuation { continuation in
        let connection = NWConnection(to: endpoint, using: .tcp)
        connection.stateUpdateHandler = { state in
            switch state {
            case .ready:
                if case .hostPort(let host, let port) = connection.currentPath?.remoteEndpoint {
                    let hostString: String
                    switch host {
                    case .ipv4(let addr): hostString = "\(addr)"
                    case .ipv6(let addr): hostString = "\(addr)"
                    case .name(let name, _): hostString = name
                    @unknown default: hostString = "\(host)"
                    }
                    connection.cancel()
                    continuation.resume(returning: (hostString, port.rawValue))
                }
            case .failed(let error):
                connection.cancel()
                continuation.resume(throwing: error)
            default: break
            }
        }
        connection.start(queue: .main)
    }
}
```

### @Observable ViewModel with Async Loading

```swift
@Observable
@MainActor
final class ChatViewModel {
    var messages: [ChatMessage] = []
    var streamingText = ""
    var isStreaming = false
    var error: AppError?

    private let client: LMXClient
    private var streamTask: Task<Void, Never>?

    init(client: LMXClient) { self.client = client }

    func send(_ content: String, model: String) {
        messages.append(ChatMessage(role: .user, content: content))
        streamTask?.cancel()
        streamTask = Task {
            isStreaming = true
            streamingText = ""
            defer { isStreaming = false }
            do {
                for try await token in client.streamTokens(messages: messages, model: model) {
                    streamingText += token
                }
                messages.append(ChatMessage(role: .assistant, content: streamingText))
                streamingText = ""
            } catch is CancellationError {
                // Expected
            } catch {
                self.error = .wrap(error)
            }
        }
    }

    func cancelStream() { streamTask?.cancel() }
}
```

### Valet with Biometric Option

```swift
// Standard storage (no biometric prompt on read)
let apiValet = Valet.valet(
    with: Identifier(nonEmpty: "com.optamize.opta-local")!,
    accessibility: .whenUnlocked
)

// High-security display (Face ID prompt on read)
let secureValet = SecureEnclaveValet.valet(
    with: Identifier(nonEmpty: "com.optamize.opta-local.secure")!,
    accessControl: .userPresence
)
```

### NavigationStack + Route Enum

```swift
enum AppRoute: Hashable {
    case chat
    case settings
    case discovery
}

@Observable
@MainActor
final class NavigationCoordinator {
    var path = NavigationPath()
    func navigate(to route: AppRoute) { path.append(route) }
    func popToRoot() { path.removeLast(path.count) }
}
```

## LMX Server Prerequisite

**The LMX server must advertise a Bonjour service for iOS discovery to work.** This requires:

1. Add `zeroconf` Python dependency to Opta-LMX
2. On startup: register `_opta-lmx._tcp` service with TXT record (version, loaded model count, server name)
3. On shutdown: unregister service

This should be a task in Phase 6 Plan 1 (or a prerequisite plan). Without it, the iOS Bonjour browser will find nothing.

## Sources

### Bonjour / NWBrowser
- [NWBrowser — Apple Developer Documentation](https://developer.apple.com/documentation/network/nwbrowser)
- [Support local network privacy — WWDC 2020](https://developer.apple.com/videos/play/wwdc2020/10110/)
- [Advances in Networking, Part 2 — WWDC 2019](https://developer.apple.com/videos/play/wwdc2019/713/)
- [Get IP & Port from NWBrowser — Apple Developer Forums](https://developer.apple.com/forums/thread/122638)
- [NSNetServiceBrowser deprecated — Apple Developer Forums](https://developer.apple.com/forums/thread/683640)
- [NWBrowser stale results — Apple Developer Forums](https://developer.apple.com/forums/thread/733411)

### Keychain
- [Keychain Services — Apple Developer Documentation](https://developer.apple.com/documentation/security/keychain-services)
- [SecItem Fundamentals — Apple Developer Forums (Quinn)](https://developer.apple.com/forums/thread/724023)
- [Valet (Square) — GitHub](https://github.com/square/Valet) — v5.0.1, Feb 2026
- [Valet SecureEnclaveValet — Square](https://github.com/square/Valet#secure-enclave)

### URLSession Streaming
- [URLSession.AsyncBytes — Apple Developer Documentation](https://developer.apple.com/documentation/foundation/urlsession/asyncbytes)
- [Use async/await with URLSession — WWDC21](https://developer.apple.com/videos/play/wwdc2021/10095/)
- [Task cancellation propagates to URLSessionTasks — Swift Forums](https://forums.swift.org/t/does-task-cancellation-propagate-to-urlsessiontasks/65041)
- [Streaming messages from ChatGPT using Swift AsyncSequence — Zach Waugh](https://zachwaugh.com/posts/streaming-messages-chatgpt-swift-asyncsequence)
- [mattt/EventSource — GitHub](https://github.com/mattt/EventSource)

### SwiftUI / @Observable
- [Migrating from ObservableObject to @Observable — Apple](https://developer.apple.com/documentation/SwiftUI/Migrating-from-the-observable-object-protocol-to-the-observable-macro)
- [@Observable in SwiftUI Explained — Donny Wals](https://www.donnywals.com/comparing-observable-to-observableobjects/)
- [SwiftUI @Observable Not a Drop-In Replacement — Jesse Squires](https://www.jessesquires.com/blog/2024/09/09/swift-observable-macro/)
- [Clean Architecture for SwiftUI — Alexey Naumov](https://nalexn.github.io/clean-architecture-swiftui/)
- [Unit Test the Observation Framework — Jacob's Tech Tavern](https://blog.jacobstechtavern.com/p/unit-test-the-observation-framework)

---
*Researched: 2026-02-18 | Domains: 4 | Sources: 30+ | Agent-parallel execution*
