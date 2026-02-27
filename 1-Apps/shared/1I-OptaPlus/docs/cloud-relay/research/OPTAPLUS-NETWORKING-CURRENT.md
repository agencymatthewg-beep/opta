# OptaPlus Current Networking Architecture

*Compiled: 2026-02-14*

---

## File Map

| File | Lines | Purpose |
|------|-------|---------|
| `Shared/Sources/OptaMolt/Networking/OpenClawClient.swift` | 619 | WebSocket client (NWConnection-based) |
| `Shared/Sources/OptaMolt/Networking/ChatViewModel.swift` | ~400 | Bot config model, chat session logic |
| `Shared/Sources/OptaMolt/Networking/SyncCoordinator.swift` | — | Telegram sync (stubbed, TDLibKit absent) |
| `Shared/Sources/OptaMolt/Networking/BotHealth.swift` | — | Health scoring |
| `Shared/Sources/OptaMolt/Storage/SecureStorage.swift` | — | Keychain token storage |

## BotConfig (ChatViewModel.swift:42)

```swift
public struct BotConfig: Identifiable, Codable, Sendable, Hashable {
    public let id: String
    public var name: String
    public var host: String     // e.g. "192.168.188.9" or "127.0.0.1"
    public var port: Int        // e.g. 18793
    public var token: String
    public var emoji: String
    public var sessions: [ChatSession]
    
    public var wsURL: URL? {
        URL(string: "ws://\(host):\(port)")  // Always ws://, never wss://
    }
}
```

### Issues for Remote Access
1. **No `wss://` support in wsURL** — hardcoded `ws://`
2. **No remote URL field** — can only specify host:port (LAN)
3. **No connection mode** — can't switch between LAN/remote
4. **No auto-detect** — no way to probe LAN availability

## OpenClawClient (OpenClawClient.swift)

```swift
public final class OpenClawClient: ObservableObject {
    public let host: String
    public let port: UInt16
    public let token: String?
    public let useTLS: Bool        // ← Exists! But not wired to BotConfig
    public let clientId: String
    
    // Connection uses NWConnection (Network.framework)
    // Origin header: "http://\(host):\(port)" or "https://\(host):\(port)"
}
```

### What Already Works
- ✅ `useTLS` flag exists — can do WSS
- ✅ URL-based initializer exists: `init(url: URL, token: String?, ...)`
- ✅ Origin header adapts to `http`/`https` based on `useTLS`
- ✅ NWConnection supports TLS natively

### What Needs Changing
1. **BotConfig needs `remoteURL: String?`** and `connectionMode` enum
2. **wsURL computed property** needs to handle WSS
3. **ChatViewModel.connect()** needs to select LAN vs remote URL
4. **Origin header** must match the remote hostname when connecting remotely
5. **NetworkEnvironment** probe for LAN detection

## Default Bots (Hardcoded)

```swift
// In ContentView.swift or equivalent
static func defaultBots() -> [BotConfig] {
    return [
        BotConfig(name: "Opta Max", host: "192.168.188.9", port: 18793, token: "8c081eb5...", emoji: "🥷🏿"),
        BotConfig(name: "Mono", host: "192.168.188.11", port: 19001, token: "e5acead9...", emoji: "🟢"),
        // ... etc
    ]
}
```

These need remote URLs added:
```swift
BotConfig(name: "Opta Max", host: "192.168.188.9", port: 18793, 
          token: "8c081eb5...", emoji: "🥷🏿",
          remoteURL: "wss://gateway.optamize.biz")
```

## Protocol v3 Handshake (from OpenClawClient.swift)

```
1. Client opens WebSocket
2. Gateway sends: {"type":"event","event":"connect.challenge","data":{...}}
3. Client sends: {"type":"req","id":1,"method":"connect","params":{
     minProtocol: 3, maxProtocol: 3,
     client: {id: "openclaw-control-ui", mode: "webchat", version: "0.1.0", platform: "iOS/macOS"},
     role: "operator",
     scopes: [...],
     auth: {token: "..."}
   }}
4. Gateway sends: {"type":"res","id":1,"result":{...}}
5. Connection established
```

This handshake works identically over LAN or tunnel — no changes needed.

## Reconnect Logic (OpenClawClient.swift)

Current: Exponential backoff 800ms → 15s, factor 1.7x, ±20% jitter

For remote access, need to add:
- If LAN connection fails → try remote URL before starting backoff
- If remote connection was active and drops → try LAN first (user may have returned home)
- Track which URL was last successful for faster reconnect
