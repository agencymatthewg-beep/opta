# Gateway Compatibility Analysis — Cloud Relay

*Compiled: 2026-02-14*

---

## Current Gateway State

```json
{
  "gateway": {
    "port": 18793,
    "mode": "local",
    "bind": "lan",
    "auth": { "mode": "token", "token": "8c081eb5c0769f34ec0fedde6e6ddd5f5299fb946b91b1ed" },
    "controlUi": {
      "allowedOrigins": [
        "http://192.168.188.9:18793",
        "http://127.0.0.1:18793",
        "http://localhost:18793",
        "http://192.168.188.9",
        "http://127.0.0.1",
        "http://localhost"
      ],
      "allowInsecureAuth": true,
      "dangerouslyDisableDeviceAuth": true
    },
    "tailscale": { "mode": "off" }
  }
}
```

## Required Config Changes

### Minimal Patch (for tunnel to work)

```json
{
  "gateway": {
    "trustedProxies": ["127.0.0.1"],
    "controlUi": {
      "allowedOrigins": [
        "http://192.168.188.9:18793",
        "http://127.0.0.1:18793",
        "http://localhost:18793",
        "http://192.168.188.9",
        "http://127.0.0.1",
        "http://localhost",
        "https://gateway.optamize.biz"
      ]
    }
  }
}
```

### Why Each Change

1. **`trustedProxies: ["127.0.0.1"]`** — cloudflared runs on localhost, gateway needs to trust its X-Forwarded-For headers for proper client IP detection
2. **`allowedOrigins` += `"https://gateway.optamize.biz"`** — OptaPlus will send `Origin: https://gateway.optamize.biz` when connecting remotely

### What Does NOT Need to Change

- **`bind: "lan"`** — Stays as-is. cloudflared reaches gateway via LAN (same machine)
- **`auth.mode: "token"`** — Stays. Token auth works over tunnel
- **`dangerouslyDisableDeviceAuth: true`** — Stays. Still using `openclaw-control-ui` clientId
- **`port: 18793`** — Stays. cloudflared routes to this port

## Protocol Flow (Remote via Tunnel)

```
1. OptaPlus opens wss://gateway.optamize.biz
2. Cloudflare edge terminates TLS
3. Cloudflare routes through tunnel to cloudflared on MacBook
4. cloudflared connects to http://localhost:18793 (or http://192.168.188.9:18793)
5. HTTP Upgrade: websocket → Gateway accepts
6. Gateway sees:
   - Remote addr: 127.0.0.1 (cloudflared)
   - X-Forwarded-For: <real client IP>
   - Host: gateway.optamize.biz
   - Origin: https://gateway.optamize.biz
7. Origin check: allowedOrigins.includes("https://gateway.optamize.biz") → PASS
8. Auth check: token in connect params → PASS
9. WebSocket established. Protocol v3 handshake proceeds normally.
```

## OptaPlus Client Changes Required

### BotConfig Model Update

Current:
```swift
public struct BotConfig: Identifiable, Codable, Sendable, Hashable {
    public var host: String      // "192.168.188.9"
    public var port: Int         // 18793
    public var token: String
    // wsURL computed: ws://host:port
}
```

Needed:
```swift
public struct BotConfig: Identifiable, Codable, Sendable, Hashable {
    public var host: String           // LAN: "192.168.188.9"
    public var port: Int              // 18793
    public var token: String
    public var remoteURL: String?     // "wss://gateway.optamize.biz"
    public var connectionMode: ConnectionMode  // .auto, .lan, .remote
    
    public enum ConnectionMode: String, Codable, Sendable {
        case auto    // Try LAN first, fall back to remote
        case lan     // Force LAN only
        case remote  // Force remote only
    }
    
    public var activeURL: URL? {
        switch connectionMode {
        case .remote:
            return remoteURL.flatMap(URL.init)
        case .lan:
            return URL(string: "ws://\(host):\(port)")
        case .auto:
            // Determined at runtime by NetworkEnvironment
            return nil
        }
    }
}
```

### OpenClawClient Changes

1. **Support `wss://` URLs** — already partially there (useTLS flag)
2. **Origin header**: Set `Origin: https://gateway.optamize.biz` when connecting remotely
3. **Auto-detect**: Ping LAN address first (100ms timeout), fall back to remote URL
4. **Reconnect logic**: If LAN fails mid-connection, try remote URL

### NetworkEnvironment (New)

```swift
/// Detects whether we're on the same LAN as the gateway
class NetworkEnvironment: ObservableObject {
    @Published var isOnLAN: Bool = false
    
    func probe(lanHost: String, port: Int) async -> Bool {
        // Quick TCP probe to LAN address (100ms timeout)
        // Returns true if reachable
    }
}
```

## Mac Studio Bots (Multi-Gateway)

For bots on Mac Studio (192.168.188.11):

### Option A: Route through MacBook tunnel (simplest)
- cloudflared on MacBook has ingress rules for each subdomain
- Routes to Mac Studio LAN IPs: `http://192.168.188.11:19000-19005`
- **Pro**: Single tunnel, single point of management
- **Con**: MacBook must be on for Mac Studio bots to be reachable remotely

### Option B: Separate tunnel on Mac Studio
- Install cloudflared on Mac Studio
- Runs its own tunnel with its own ingress rules
- **Pro**: Mac Studio bots accessible even when MacBook is off
- **Con**: Two tunnels to manage, need cloudflared on Mac Studio

### Recommendation: Start with Option A, add Option B later if needed

The Mac Studio is always-on anyway, and the MacBook is Matthew's daily driver (usually on when he's awake). For overnight, bots are accessible via Telegram regardless.

## DNS Records Needed

All records point to the same tunnel (CNAME):

| Record | Type | Value | Proxied |
|--------|------|-------|---------|
| `gateway` | CNAME | `<TUNNEL_UUID>.cfargotunnel.com` | ✅ Orange |
| `mono` | CNAME | `<TUNNEL_UUID>.cfargotunnel.com` | ✅ Orange |
| `opta512` | CNAME | `<TUNNEL_UUID>.cfargotunnel.com` | ✅ Orange |
| `floda` | CNAME | `<TUNNEL_UUID>.cfargotunnel.com` | ✅ Orange |
| `saturday` | CNAME | `<TUNNEL_UUID>.cfargotunnel.com` | ✅ Orange |
| `yj` | CNAME | `<TUNNEL_UUID>.cfargotunnel.com` | ✅ Orange |

Cloudflared automatically creates these DNS records when you run:
```bash
cloudflared tunnel route dns optaplus gateway.optamize.biz
```
