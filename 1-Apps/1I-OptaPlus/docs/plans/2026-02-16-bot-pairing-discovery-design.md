# Bot Pairing & Discovery System Design

**Date:** 2026-02-16
**Status:** Approved
**Goal:** AirPods-like bot pairing — pair once, connect forever, zero configuration

---

## 1. User Journey

### First Launch (No Bots)
- App opens to Bot Map showing the user's device at center with empty constellation
- Radar scan runs automatically, discovering any LAN gateways via Bonjour
- Discovered bots appear as pulsing nodes — tap to pair with single confirmation
- If no bots found: QR scan button, deep link paste, and manual entry options

### Returning User (Bots Paired)
- App opens, Bot Map shows paired bots as constellation nodes
- Connected bots have green tethers, disconnected have red
- Auto-reconnect runs silently in background — no user action needed
- New bots discovered on the network appear as "new" nodes with reveal animation

### Multi-Device (Second Apple Device)
- iCloud Keychain syncs all pairing tokens automatically
- New device opens app, Bot Map already populated with all paired bots
- Auto-connect begins immediately — zero setup on second device
- If signed into Supabase account: cloud vault provides additional backup

### Non-Apple Device (Future)
- Supabase account required for cross-platform sync
- Sign in on new device, bot pairings download from cloud vault
- Same auto-connect behavior once tokens are available

---

## 2. Bot Map — Constellation View

### Layout
- User's device at center (device emoji + name)
- Paired bots arranged radially around center at varying distances
- Distance represents connection quality/latency (closer = better)
- Disconnected bots drift slightly outward

### Visual Design
- **Connected tether:** Green gradient line with subtle particle flow animation
- **Disconnected tether:** Red dashed line, static
- **Connecting tether:** Amber pulsing line
- **Bot nodes:** Bot emoji (from gateway config) inside a glowing circle
- **Background:** Subtle star field on `optaVoid` (#050505)

### Radar Scan Animation
- Triggered by scan button or pull-to-refresh
- Canvas + TimelineView renders a sweeping arc (3-second rotation)
- Arc is a gradient from `optaPrimary` to transparent
- Newly discovered bots reveal with spring scale animation as the arc passes their position
- Bonjour discovery is instant — the animation is visual theater for perceived thoroughness

### Interaction
- Tap bot node: Shows bot detail sheet (name, status, latency, gateway, actions)
- Long-press: Quick actions (disconnect, forget, reconnect)
- Tap empty space: Dismisses any open sheet

### Cross-Platform
- iOS: Lighter particle effects, optimized for battery
- macOS: Full particle system, richer ambient animation, keyboard shortcuts

---

## 3. Data Architecture

### Core Models

```swift
struct BotNode: Identifiable, Codable {
    let id: String                    // gatewayFingerprint + botId
    let botId: String
    let gatewayFingerprint: String
    var name: String
    var emoji: String
    var gatewayHost: String?          // LAN address
    var gatewayPort: Int?
    var remoteURL: String?            // Cloudflare tunnel URL
    var state: BotConnectionState
    var lastSeen: Date
    var lastLatency: TimeInterval?
    var position: CGPoint?            // Constellation position (computed)
}

enum BotConnectionState: String, Codable {
    case discovered     // Found via Bonjour, not yet paired
    case pairing        // Pairing handshake in progress
    case paired         // Token stored, not currently connected
    case connecting     // WebSocket connecting
    case connected      // Live WebSocket session
    case disconnected   // Was connected, lost connection
    case error          // Pairing or connection failed
}

struct PairingToken: Codable {
    let botId: String
    let gatewayFingerprint: String
    let token: String
    let createdAt: Date
    let deviceId: String              // Which device created this pairing
    var syncedToCloud: Bool
}

struct DeviceIdentity: Codable {
    let deviceId: String              // UUID, generated once, stored in Keychain
    let deviceName: String            // e.g., "Matthew's iPhone"
    let platform: Platform            // .iOS or .macOS
    let lastActive: Date
}
```

### State Machine

```
discovered → pairing → paired → connecting → connected
                ↓                     ↓            ↓
              error              disconnected   disconnected
                                     ↓
                                 connecting (auto-retry)
```

### Storage

| Data | Primary Store | Sync Target |
|------|--------------|-------------|
| Pairing tokens | Keychain (kSecAttrSynchronizable: true) | Supabase bot_pairings (if signed in) |
| Bot metadata | UserDefaults / local JSON | Supabase bot_pairings |
| Device identity | Keychain (non-syncable) | None (device-local) |
| Gateway discovery cache | In-memory | None |

### Supabase Table: `bot_pairings`

```sql
CREATE TABLE bot_pairings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    bot_id TEXT NOT NULL,
    gateway_fingerprint TEXT NOT NULL,
    bot_name TEXT,
    bot_emoji TEXT,
    gateway_host TEXT,
    gateway_port INT,
    remote_url TEXT,
    encrypted_token TEXT NOT NULL,     -- AES-256-GCM encrypted
    device_id TEXT NOT NULL,           -- Which device created this
    paired_at TIMESTAMPTZ DEFAULT now(),
    last_connected TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, bot_id, gateway_fingerprint)
);

-- RLS: Users can only access their own pairings
ALTER TABLE bot_pairings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own pairings"
    ON bot_pairings FOR ALL
    USING (auth.uid() = user_id);
```

---

## 4. Gateway Protocol Changes

### New Methods

**`device.pair`** — Register this device with the gateway
```json
{
    "method": "device.pair",
    "params": {
        "deviceId": "uuid",
        "deviceName": "Matthew's iPhone",
        "platform": "ios",
        "requestedBots": ["bot-1", "bot-2"]  // or "*" for all
    }
}
// Response:
{
    "pairings": [
        { "botId": "bot-1", "token": "...", "name": "Jarvis", "emoji": "🤖" },
        { "botId": "bot-2", "token": "...", "name": "Nova", "emoji": "🌟" }
    ],
    "gatewayFingerprint": "abc123"
}
```

**`device.unpair`** — Remove a device's access to specific bots
```json
{
    "method": "device.unpair",
    "params": {
        "deviceId": "uuid",
        "botIds": ["bot-1"]   // or "*" for all
    }
}
```

**`gateway.discover`** — List available bots without authentication
```json
{
    "method": "gateway.discover",
    "params": {}
}
// Response (no tokens, just metadata):
{
    "gatewayFingerprint": "abc123",
    "gatewayName": "Home Gateway",
    "bots": [
        { "botId": "bot-1", "name": "Jarvis", "emoji": "🤖", "status": "online" }
    ],
    "pairingRequired": true
}
```

### mDNS TXT Records

Gateway advertises via Bonjour `_openclaw._tcp` with TXT records:
```
fp=abc123           // Gateway fingerprint
name=Home Gateway   // Human-readable name
bots=3              // Number of available bots
ver=3               // Protocol version
```

### Trust Model (LAN)

- First connection to a gateway on LAN: app calls `gateway.discover` (unauthenticated)
- User sees bot list, taps "Pair All" or selects specific bots
- App calls `device.pair` — gateway returns tokens
- Subsequent connections use stored tokens (auto-connect)
- LAN presence = implicit trust (same model as AirPlay, HomeKit)

---

## 5. Supabase Sync & Account Layer

### Auth Strategy: Optional Account (Option C)

- App works fully without sign-in (iCloud Keychain handles device sync)
- Sign-in offered as enhancement: "Sign in to back up your bots to the cloud"
- Auth providers: Apple Sign-In, Google Sign-In (matching Opta Life iOS)
- Shared Supabase project: `cytjsmezyldytbmjrolyz.supabase.co`

### Write-Through Cache Pattern

```
[Pair Bot] → Save token to Keychain → If signed in: upsert to Supabase
[App Launch] → Load tokens from Keychain → If signed in: merge with Supabase
[Sign In] → Upload all Keychain tokens to Supabase
[New Device] → iCloud Keychain syncs tokens → If signed in: also pull from Supabase
```

### Merge Strategy

- **Conflict:** Same `botId + gatewayFingerprint` exists locally and in cloud with different tokens
- **Resolution:** Most recent `paired_at` wins. Loser token is discarded.
- **Deletions:** Soft-delete via `is_active = false`. Propagates to other devices on next sync.

### Token Encryption

- Tokens encrypted client-side before upload to Supabase
- Encryption key derived from user's Supabase auth session
- Supabase never sees plaintext tokens
- If user signs out, cloud tokens remain encrypted and inaccessible

### Migration Path

- Existing users with bots configured in `BotConfig` (host/port/token in UserDefaults/Keychain)
- On first launch after update: migrate existing configs to new `BotNode` + `PairingToken` models
- Seamless — no re-pairing needed

---

## 6. Bonjour Scanner & Radar Animation

### BotScanner Architecture

```swift
@MainActor
class BotScanner: ObservableObject {
    @Published var discoveredBots: [DiscoveredGateway] = []
    @Published var isScanning: Bool = false

    private var browser: NWBrowser?

    // Passive mode: always browsing in background
    func startPassiveBrowsing() { ... }

    // Active mode: user-triggered scan with radar animation
    func startActiveScan() { ... }

    func stopScanning() { ... }
}

struct DiscoveredGateway: Identifiable {
    let fingerprint: String
    let name: String
    let host: String
    let port: Int
    let botCount: Int
    let protocolVersion: Int
    var bots: [DiscoveredBot]?  // Populated after gateway.discover call
}
```

### Discovery Flow

1. `NWBrowser` browses for `_openclaw._tcp` service type
2. Each result parsed for TXT records (fingerprint, name, bot count)
3. For each new gateway: TCP connect → `gateway.discover` → get bot list
4. Merge with paired bots list (dedup by `gatewayFingerprint + botId`)
5. Update Bot Map constellation

### Merge Logic

Three bot lists merged into unified constellation:
- **Paired** (from Keychain/Supabase) — always shown, even if not discovered on current network
- **Discovered** (from Bonjour) — shown if not already paired
- **Connected** (active WebSocket) — updates state of paired bots

Deduplication key: `gatewayFingerprint + botId`

### Radar Animation

- `Canvas` renders sweep arc using `TimelineView(.animation)`
- Arc: 120-degree gradient from `optaPrimary` (full opacity) to transparent
- Rotation: 3-second full sweep, spring-eased start/stop
- Bot reveals: When arc passes a newly discovered bot's angle, the bot scales in with `.optaSpring` (response: 0.55, damping: 0.65)
- Ambient: Faint concentric rings pulse outward from center device

### Platform Differences

- **iOS:** Foreground-only scanning (background Bonjour not reliable). Lighter Canvas rendering. `NSLocalNetworkUsageDescription` required in Info.plist.
- **macOS:** Continuous background scanning. Full particle effects on tethers. No permission prompt needed for local network.

### Permission Handling (iOS)

- Local network permission prompt appears on first `NWBrowser` start
- If denied: Bot Map shows "Local scanning unavailable" banner
- Fallback options prominent: QR scan, paste link, manual entry
- Can re-request via Settings deep link

---

## 7. QR Code & Deep Link Fallback Layers

### QR Code Pairing

- Gateway generates QR code containing deep link: `optaplus://pair?host=192.168.1.50&port=3000&fp=abc123&token=xyz`
- Remote gateways: `optaplus://pair?remote=wss://bot.example.trycloudflare.com&fp=abc123&token=xyz`
- iOS uses `DataScannerViewController` (VisionKit) — native, zero dependencies
- macOS uses camera via `AVCaptureSession` or accepts pasted/dragged QR image
- QR codes are time-limited (5 min expiry) with one-time-use tokens
- Gateway admin page shows QR code prominently

### Deep Links

- Custom URL scheme `optaplus://pair?...` registered in both iOS and macOS Info.plist
- SwiftUI `.onOpenURL` handler parses and triggers pairing
- Supports sharing via AirDrop, Messages, or any text channel
- Same payload format as QR (host/remote, fingerprint, token)

### Manual Entry (Last Resort)

- Current onboarding flow preserved but moved to "Advanced" option
- Text fields for host, port, token — unchanged from today
- Shown when user taps "Enter manually" in Bot Map empty state

### Fallback Priority

1. **Bonjour auto-discovery** — seamless, no user action
2. **QR code scan** — one tap to scan, one tap to confirm
3. **Deep link** — tap shared link, one tap to confirm
4. **Clipboard detection** — app detects `optaplus://pair` in clipboard on foreground, offers to pair
5. **Manual entry** — power users, debugging

All methods feed into the same `PairingCoordinator` — identical pairing flow regardless of discovery method.

---

## 8. Error Handling & Edge Cases

### Error Recovery

| Scenario | Behavior |
|----------|----------|
| Gateway goes offline mid-session | Node pulses red, tether animates to disconnected. Auto-reconnect with exponential backoff (800ms to 15s). |
| Token expired/revoked | Gateway returns `NOT_PAIRED`. Stale token removed, bot transitions to `discovered`, single-tap re-pair prompt. |
| Bonjour permission denied (iOS) | Graceful degradation. Banner with QR/deep link/manual fallbacks. No error dialogs. |
| iCloud Keychain disabled | Tokens stay local-only. Supabase covers cross-device if signed in. Gentle nudge to sign in. |
| Supabase offline | Local Keychain authoritative. Sync resumes silently on reconnect. |
| Same bot on LAN and Cloudflare | Dedup by fingerprint + botId. Prefer LAN (lower latency). |
| Bot moved to different gateway | Old pairing shows disconnected. New gateway creates fresh pairing. User can archive old. |
| Multiple users pairing to same bot | Gateway issues separate tokens per device. No conflict. |

---

## 9. Implementation Sequence

### Sprint 1: Data Layer
- `BotNode`, `PairingToken`, `DeviceIdentity` models
- `BotPairingStore` — Keychain CRUD with iCloud sync flag
- Migration from existing `BotConfig` to new models
- Unit tests for storage and migration

### Sprint 2: Scanner
- `BotScanner` wrapping `NWBrowser`
- `gateway.discover` protocol method (client-side)
- Discovery merge logic (paired + discovered + connected)
- Info.plist entries for Bonjour

### Sprint 3: Bot Map UI
- Constellation view with Canvas radar animation
- Spring-animated bot nodes and tethers
- Bot detail sheet on tap
- Empty state with fallback options
- Cross-platform (iOS + macOS)

### Sprint 4: Pairing Flow
- `PairingCoordinator` — unified pairing pipeline
- `device.pair` / `device.unpair` protocol methods (client-side)
- Pairing confirmation sheet
- Auto-connect after pairing

### Sprint 5: Fallbacks
- QR code scanner (VisionKit on iOS, AVCapture on macOS)
- Deep link handler (`optaplus://pair`)
- Clipboard detection
- Manual entry (preserved from current onboarding)

### Sprint 6: Sync Layer
- Supabase `bot_pairings` table + RLS
- `OptaAccountService` sign-in (Apple, Google)
- Write-through cache + merge logic
- Token encryption for cloud storage

Each sprint builds on the previous — no sprint is blocked by a later one.

---

## Design Principles

- **Pair once, connect forever** — tokens persist in iCloud Keychain across devices and app reinstalls
- **Zero-config by default** — Bonjour auto-discovery handles the common case
- **Graceful degradation** — every failure has a fallback, never a dead end
- **Spring physics only** — all animations use `.optaSpring`, `.optaSnap`, `.optaGentle` (A04 rule)
- **No external dependencies** — pure SwiftUI + Foundation + Network + Security
- **Privacy first** — tokens encrypted before cloud upload, RLS on all Supabase tables
