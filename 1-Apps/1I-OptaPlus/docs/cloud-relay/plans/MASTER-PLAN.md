# OptaPlus Cloud Relay — Master Implementation Plan

*Created: 2026-02-14*
*Status: READY FOR EXECUTION*

---

## Goal

Make OptaPlus work **exactly like Telegram** — open the app from anywhere with internet, connect to your bots, no VPN/proxy/network config needed. Uses Cloudflare Tunnel with `gateway.optamize.biz` as the public endpoint.

## Architecture

```
┌─────────────┐    wss://gateway.optamize.biz    ┌──────────────┐
│  OptaPlus   │ ─────────────────────────────────│  Cloudflare  │
│  (anywhere) │         TLS (auto-cert)           │    Edge      │
└─────────────┘                                   └──────┬───────┘
                                                         │ Tunnel (outbound, encrypted)
                                                  ┌──────┴───────┐
                                                  │  cloudflared  │
                                                  │  (MacBook)    │
                                                  └──────┬───────┘
                                                         │ http://localhost:18793
                                                  ┌──────┴───────┐         ┌──────────────┐
                                                  │  Opta Max    │         │  Mac Studio  │
                                                  │  Gateway     │         │  Bots        │
                                                  └──────────────┘         │  :19000-19005│
                                                                           └──────────────┘
```

## Phases (3 parallel workstreams)

### Phase A: Infrastructure (Cloudflare Tunnel Setup)
**Agent: infra-agent** | **Estimated: 15 min** | **Blocks: B, C**

1. [A1] Authenticate cloudflared with Cloudflare (`cloudflared tunnel login`)
2. [A2] Create tunnel named `optaplus`
3. [A3] Write config.yml with ingress rules for all 7 bots
4. [A4] Create DNS CNAME records (gateway, mono, opta512, floda, saturday, yj)
5. [A5] Test tunnel connectivity: `cloudflared tunnel run optaplus`
6. [A6] Install as macOS launchd service (persistent, auto-start)
7. [A7] Verify WebSocket handshake works through tunnel (wscat test)

### Phase B: Gateway Config (OpenClaw Changes)
**Agent: gateway-agent** | **Estimated: 5 min** | **Can start immediately, independent**

1. [B1] Patch gateway config:
   - Add `trustedProxies: ["127.0.0.1"]`
   - Add `"https://gateway.optamize.biz"` to `allowedOrigins`
   - Add `"https://mono.optamize.biz"` etc. for each bot subdomain
2. [B2] Restart gateway
3. [B3] Verify gateway accepts connections with new Origin header

### Phase C: OptaPlus App Changes (Swift Code)
**Agent: swift-agent** | **Estimated: 45 min** | **Can start immediately, independent**

1. [C1] **BotConfig model update** — Add `remoteURL`, `connectionMode`, `useTLS` fields
2. [C2] **OpenClawClient update** — Support WSS URLs, dynamic Origin header
3. [C3] **NetworkEnvironment** — LAN detection probe (TCP ping with 200ms timeout)
4. [C4] **Smart connection logic** — Auto mode: try LAN → fall back to remote
5. [C5] **Settings UI** — Remote URL field, connection mode picker per bot
6. [C6] **Default bot configs** — Pre-fill `remoteURL` for all bots
7. [C7] **Connection status indicator** — Show LAN vs Remote in UI
8. [C8] **Build verification** — Both macOS and iOS build clean

### Phase D: Integration Testing
**Agent: main (Opta Max)** | **After A + B + C complete**

1. [D1] macOS app → LAN connection still works
2. [D2] macOS app → Remote URL (wss://gateway.optamize.biz) works
3. [D3] macOS app → Auto-detect mode works (LAN preferred)
4. [D4] iOS app → Remote URL works from cellular
5. [D5] Reconnect: disconnect WiFi → app reconnects via remote
6. [D6] All 7 bots accessible via subdomains

---

## Sub-Plan Details

### SUB-PLAN-A: Infrastructure Setup
See: `plans/SUB-PLAN-A-INFRASTRUCTURE.md`

### SUB-PLAN-B: Gateway Configuration  
See: `plans/SUB-PLAN-B-GATEWAY.md`

### SUB-PLAN-C: OptaPlus Swift Changes
See: `plans/SUB-PLAN-C-SWIFT.md`

---

## Dependency Graph

```
A1 → A2 → A3 → A4 → A5 → A6 → A7
                                  ↘
B1 → B2 → B3 ─────────────────────→ D1 → D2 → D3 → D4 → D5 → D6
                                  ↗
C1 → C2 → C3 → C4 → C5 → C6 → C7 → C8
```

**Parallel execution:**
- Phase B starts immediately (no deps)
- Phase C starts immediately (no deps)
- Phase A requires Matthew to authenticate cloudflared (browser login)
- Phase D waits for all three to complete

## Files Modified

### Gateway Config
- `~/.openclaw/openclaw.json` — trustedProxies + allowedOrigins

### Cloudflare
- `~/.cloudflared/config.yml` — Tunnel config
- `~/.cloudflared/<UUID>.json` — Credentials (auto-generated)

### OptaPlus Swift
- `Shared/Sources/OptaMolt/Networking/ChatViewModel.swift` — BotConfig model
- `Shared/Sources/OptaMolt/Networking/OpenClawClient.swift` — WSS support, Origin
- `Shared/Sources/OptaMolt/Networking/NetworkEnvironment.swift` — NEW: LAN detection
- `macOS/OptaPlusMacOS/SettingsViews.swift` — Remote URL field
- `macOS/OptaPlusMacOS/ContentView.swift` — Connection indicator, defaults
- `iOS/OptaPlusIOS/SettingsView.swift` — Remote URL field
- `iOS/OptaPlusIOS/ContentView.swift` — Connection indicator

## Success Criteria

1. ✅ Open OptaPlus on iPhone connected to cellular (not WiFi)
2. ✅ Connect to Opta Max via `wss://gateway.optamize.biz`
3. ✅ Send message, receive streaming response
4. ✅ Same experience as Telegram — no VPN, no config
5. ✅ When on home WiFi, automatically uses faster LAN connection
6. ✅ All bots accessible via their subdomain
7. ✅ Tunnel persists across reboots (launchd service)

## Cost

**$0/month** — Cloudflare Tunnel free tier, no bandwidth limits, 100K concurrent WS connections.

## Research Files

- `research/CLOUDFLARE-TUNNEL-RESEARCH.md` — Tunnel architecture, limits, config
- `research/GATEWAY-COMPATIBILITY.md` — Gateway config analysis, protocol flow
- `research/OPTAPLUS-NETWORKING-CURRENT.md` — Current Swift networking layer analysis
