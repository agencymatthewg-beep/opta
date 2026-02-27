# Claude Code Context — OptaPlus Cloud Relay Implementation

*Read this first. It tells you everything you need to know.*

---

## What You're Building

Adding remote access to OptaPlus (a native macOS + iOS chat client for OpenClaw AI bots). Currently the app only works on LAN via `ws://`. We're adding `wss://` support through Cloudflare Tunnel so the app works from anywhere — exactly like Telegram.

## Project Location

```
~/Synced/Opta/1-Apps/1I-OptaPlus/
```

## Plans & Research (READ THESE FIRST)

| Priority | File | What It Contains |
|----------|------|-----------------|
| 🔴 1st | `docs/cloud-relay/plans/MASTER-PLAN.md` | Full architecture, all phases, dependency graph |
| 🔴 2nd | `docs/cloud-relay/plans/SUB-PLAN-C-SWIFT.md` | **YOUR MAIN TASK** — exact Swift code changes needed |
| 🟡 3rd | `docs/cloud-relay/research/OPTAPLUS-NETWORKING-CURRENT.md` | Current networking layer analysis |
| 🟡 4th | `docs/cloud-relay/research/GATEWAY-COMPATIBILITY.md` | How gateway handles tunnel traffic |
| 🟢 5th | `docs/cloud-relay/research/CLOUDFLARE-TUNNEL-RESEARCH.md` | Tunnel architecture (background) |

## Key Files to Modify

| File | Lines | Change |
|------|-------|--------|
| `Shared/Sources/OptaMolt/Networking/ChatViewModel.swift` | ~400 | BotConfig model: add `remoteURL`, `connectionMode` |
| `Shared/Sources/OptaMolt/Networking/OpenClawClient.swift` | 619 | WSS support, dynamic Origin header |
| `Shared/Sources/OptaMolt/Networking/NetworkEnvironment.swift` | NEW | LAN detection probe |
| `macOS/OptaPlusMacOS/SettingsViews.swift` | — | Remote URL field in settings |
| `macOS/OptaPlusMacOS/ContentView.swift` | — | Connection indicator, default bots |
| `iOS/OptaPlusIOS/SettingsView.swift` | — | Remote URL field |
| `iOS/OptaPlusIOS/ContentView.swift` | — | Connection indicator, default bots |

## Critical Technical Details

### OpenClaw Gateway Protocol
- Transport: WebSocket (text frames, JSON)
- Frame types: `"req"` (client→gw), `"res"` (gw→client), `"event"` (gw→client)
- Handshake: Gateway sends `connect.challenge` → client sends `connect` request
- ClientId: `"openclaw-control-ui"` with `mode: "webchat"` (required for auth bypass)
- ConnectParams has `additionalProperties: false` — NO extra fields allowed

### Origin Header Rules
- Gateway checks `Origin` header via `checkBrowserOrigin()`
- Exact string match via `.includes()` against `allowedOrigins` config
- When connecting remotely: `Origin: https://gateway.optamize.biz` (matches allowedOrigins)
- When connecting LAN: `Origin: http://192.168.188.9:18793` (already in allowedOrigins)

### NWConnection (Network.framework)
- The client uses `NWConnection`, NOT `URLSessionWebSocketTask`
- `useTLS: Bool` flag already exists but BotConfig doesn't expose it
- For WSS: use `NWParameters(tls: NWProtocolTLS.Options())` with WebSocket protocol
- TLS options handle certificate validation automatically for public CAs (Cloudflare)

### Default Bot Tokens
- Opta Max: `8c081eb5c0769f34ec0fedde6e6ddd5f5299fb946b91b1ed` (port 18793)
- Mono: `e5acead966cc3922795eaea658612d9c47e4b7fa87563729` (port 19001)
- Others: tokens not yet retrieved

### Remote URLs (Cloudflare Tunnel)
- Opta Max: `wss://gateway.optamize.biz`
- Mono: `wss://mono.optamize.biz`
- Opta512: `wss://opta512.optamize.biz`
- Floda: `wss://floda.optamize.biz`
- Saturday: `wss://saturday.optamize.biz`
- YJ: `wss://yj.optamize.biz`

## Build Commands

```bash
# macOS
xcodebuild -project macOS/OptaPlusMacOS.xcodeproj -scheme OptaPlusMacOS -configuration Debug build

# iOS (Simulator)
xcodebuild -project iOS/OptaPlusIOS.xcodeproj -scheme OptaPlusIOS -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build

# Quick build + run (macOS)
./scripts/build-run.sh
```

## Constraints

1. **Pure SwiftUI** — no external dependencies (TDLibKit is commented out)
2. **iOS 17+ / macOS 14+** — can use latest APIs
3. **Shared package (OptaMolt)** — networking code shared between macOS and iOS
4. **Codable migration** — existing users have saved BotConfigs without remoteURL, must not crash
5. **Platform-aware** — `#if os(iOS)` vs `#if os(macOS)` where needed
6. **Connection mode default: `.auto`** — always try LAN first for best latency

## What "Done" Looks Like

1. ✅ Both apps build clean (zero warnings ideal)
2. ✅ BotConfig has `remoteURL: String?` and `connectionMode: ConnectionMode`
3. ✅ OpenClawClient supports `wss://` URLs with proper TLS
4. ✅ Origin header matches the connection URL (LAN or remote)
5. ✅ NetworkEnvironment probes LAN with 200ms timeout
6. ✅ Auto mode: tries LAN → falls back to remote seamlessly
7. ✅ Settings UI shows Remote URL field and Connection Mode picker
8. ✅ Default bots pre-configured with remote URLs
9. ✅ Connection indicator shows 🌐 Remote or 📶 LAN
10. ✅ Git committed with meaningful message
