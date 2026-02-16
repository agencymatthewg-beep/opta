---
scope: Architecture decisions
purpose: Decision log — why each choice was made, what was rejected
version: 0.9.0
updated: 2026-02-15
---

# OptaPlus — DECISIONS.md

> Architecture decision log. Each settled decision: date, choice, rationale, alternatives rejected. Reference this when questioning "why did we do X?"

---

## D01: NWConnection over URLSession (Date: 2025-12-08)

**Decision:** Use `NWConnection` for WebSocket, not URLSession + URLSessionWebSocketTask.

**Rationale:**
- **Origin header support** — Gateway protocol v3 requires Origin header for handshake. URLSession doesn't expose Origin control.
- **Lower-level control** — NWConnection gives frame-by-frame control, needed for protocol v3 reliability.
- **No dependencies** — URLSession is Foundation but adds complexity. NWConnection is Network framework (OS level).
- **Performance** — Slightly faster, no HTTP overhead.

**Alternatives Rejected:**
- **URLSessionWebSocketTask** — No Origin header control, forced HTTP overhead, limited frame access.
- **Starscream (SPM)** — Violates zero-dependencies rule.
- **WebSocket library** — Same dependency issue.

**Implementation:** `Shared/Sources/OptaMolt/Networking/OpenClawClient.swift`

---

## D02: clientId = "openclaw-control-ui" (Date: 2025-12-08)

**Decision:** All OptaPlus connections use fixed clientId "openclaw-control-ui".

**Rationale:**
- **Gateway recognition** — Allows gateway to identify OptaPlus clients for rate limiting, feature flags, analytics.
- **Consistent behavior** — All OptaPlus clients behave identically. Easier to debug.
- **Not variable** — Temptation to randomize or vary is wrong. This is a client identity, not a session token.
- **Security** — clientId is public, not secret. Gateway token is the secret.

**Alternatives Rejected:**
- **Random per-session clientId** — Loses gateway's ability to track OptaPlus usage patterns.
- **User-configurable clientId** — Breaks gateway expectations, adds complexity.
- **Machine-specific clientId** — Adds code complexity for minimal benefit.

**Implementation:** `OpenClawClient.init()` hardcodes `clientId: "openclaw-control-ui"`

---

## D03: Option D Scaffold (Multi-Window + Shared Package) (Date: 2026-02-08)

**Decision:** Use OPIS Option D: Shared Swift Package (OptaMolt) + Platform-Specific UI (macOS/iOS).

**Rationale:**
- **Code reuse** — Data models, networking, storage shared between platforms.
- **Independent UI** — macOS multi-window and iOS gestures require platform-specific code; pure SwiftUI enables this.
- **Flexibility** — Each platform can evolve independently (macOS keyboard shortcuts ≠ iOS swipe).
- **Maintainability** — Clear separation: Shared = models/logic, Platform = UI/gestures.
- **Future-proof** — If we add watchOS, tvOS, can reuse OptaMolt package.

**Alternatives Rejected:**
- **Option A (Monolithic)** — macOS and iOS in one target. Would require UIKit/AppKit wrappers, too complex.
- **Option B (Conditional Compilation)** — `#if os(macOS)` everywhere. Unmaintainable, error-prone.
- **Option C (Separate Apps)** — macOS and iOS are fully separate. Code duplication, hard to sync.
- **Option E (Single Platform)** — macOS only, or iOS only. Loses Telegram replacement goal (iOS) or power tool (macOS).

**File Structure:**
```
Shared/Sources/OptaMolt/  → shared code
macOS/OptaPlusMacOS/      → macOS UI only
iOS/OptaPlusIOS/          → iOS UI only
```

**Reference:** APP.md, SHARED.md

---

## D04: Cinematic Void Theme (Date: 2025-11-10)

**Decision:** Design theme: Cinematic Void (void black #050505, electric violet #8B5CF6, spring physics, glass morphism).

**Rationale:**
- **Premium feel** — Dark theme + glow effects + motion = luxury developer tool.
- **Accessibility** — Dark theme reduces eye strain, works for colorblind users.
- **Consistency** — Matches Raycast, Resend, Lusion (premium tools used by developers).
- **Motion** — Spring physics feels responsive, not sluggish.
- **Distinctiveness** — Not flat design, not neumorphism. Cinematic = memorable.

**Alternatives Rejected:**
- **Light theme** — Harder to read code snippets, clashes with developer aesthetics.
- **Flat design** — Too minimal, loses premium feel.
- **Glassmorphism only** — Without color punch (violet), feels generic.
- **Custom theme engine** — Users want ONE theme, not complexity.

**Implementation:** `Shared/Sources/OptaMolt/DesignSystem/Colors.swift`, `Animations.swift`

**Design Reference:** Resend.com (#1), Raycast (#2), Lusion (#3)

---

## D05: Zero External Dependencies (Date: 2025-12-01)

**Decision:** OptaPlus uses ONLY Foundation + SwiftUI + OS frameworks. Zero external packages (pods, SPM).

**Rationale:**
- **Security** — Fewer dependencies = smaller attack surface. No compromised packages can affect us.
- **App size** — SwiftUI binary is ~5MB, adding packages bloats to 50+MB.
- **Stability** — OS frameworks are battle-tested, updated with every iOS/macOS release.
- **Maintenance** — No version conflicts, no "dependency hell," no breaking changes from package updates.
- **App Store** — Easier review, faster approval.
- **Principle** — Building the best app requires controlling every line of code.

**Alternatives Rejected:**
- **Alamofire for HTTP** — Unnecessary, NWConnection handles WebSocket.
- **RxSwift/Combine** — async/await is native (iOS 13+).
- **Firebase** — Violates privacy (analytics), not needed.
- **Sentry/Crash reporting** — Matthew handles crash logs directly.

**Exception Process:** New dependency REQUIRES Matthew approval + documented rationale.

**Reference:** GUARDRAILS.md (A01)

---

## D06: iCloud Sync (CloudKit) (Date: 2025-12-10)

**Decision:** Chat messages and bot configs sync via CloudKit (private database). Local cache via UserDefaults.

**Rationale:**
- **Encryption** — CloudKit encrypts data end-to-end, users own their data.
- **User control** — Opt-out button in settings, can delete all iCloud data.
- **Offline-first** — Local cache works without network.
- **Sync latency** — 30s propagation between devices acceptable, not instant.
- **No third-party** — Only Apple's servers, matches "no external deps" philosophy.
- **iCloud+ backup** — Automatic backup for free if user pays for iCloud+.

**Alternatives Rejected:**
- **SQLite local only** — No cross-device sync, losing multi-device benefit.
- **REST API to Opta server** — Violates privacy (Matthew's server sees chats), adds infrastructure cost.
- **Firestore/Firebase** — Violates privacy (Google sees data), violates zero-deps rule.
- **Custom sync algorithm** — Too complex, error-prone, unmaintainable.

**Implementation:** `Shared/Sources/OptaMolt/Sync/CloudKitCoordinator.swift`

**Security:** User must enable iCloud login in Settings → [name] → iCloud. App never stores credentials.

---

## D07: Bonjour for LAN Discovery (Date: 2025-12-05)

**Decision:** Support LAN bot discovery via Bonjour/mDNS (`_openclaw._tcp` service).

**Rationale:**
- **Zero-config** — Users on LAN don't need to type IP addresses.
- **Fast** — Bonjour discovery is instant (<100ms).
- **Secure** — Local network, no exposure to internet.
- **Standard** — Works on all Apple devices without special setup.
- **Fallback ready** — Manual IP entry and Cloudflare tunnel as alternatives.

**Alternatives Rejected:**
- **Only manual IP** — Requires users to know their gateway IP, fragile.
- **DNS name entry** — Assumes static DNS, not always available.
- **QR code scan** — Adds friction, users won't use.

**Implementation:** 
- **macOS:** `NSNetServiceBrowser` in `OpenClawClient`
- **iOS:** `NWBrowser` in `OpenClawClient`

---

## D08: Reactions as Bot Commands (Date: 2025-11-15)

**Decision:** Emoji reactions (👍 ❓ 👎 🔄) are NOT decorative. Tapping a reaction sends a command frame to the bot.

**Rationale:**
- **Bot intelligence** — Bots can respond to reactions (proceed, explain, revert, retry).
- **Intuitive** — Users already use reactions in Telegram/Discord for sentiment. Here, they trigger actions.
- **Bandwidth efficient** — Emoji reaction + command is 1 frame vs. typing 50 characters.
- **Mobile-friendly** — One tap on iOS beats typing on a phone.
- **Customizable** — Users can remap reactions in settings.

**Alternatives Rejected:**
- **Decorative reactions (Telegram style)** — Wastes potential, bot can't respond.
- **Slash commands** — Less discoverable, harder to learn.
- **Buttons** — Takes UI space, less elegant.

**Default Mappings:**
- 👍 → `[USER_REACTION: proceed]` → Bot continues with next steps
- ❓ → `[USER_REACTION: explain]` → Bot explains previous message
- 👎 → `[USER_REACTION: revert]` → Bot undoes last action
- 🔄 → `[USER_REACTION: retry]` → Bot regenerates response

**Implementation:** `ChatView.swift` reaction tap handler → `OpenClawClient.sendReaction()`

**Reference:** SHARED.md (Smart Reaction Protocol)

---

## D09: @mention for Cross-Bot Handoff (Date: 2025-12-02)

**Decision:** Typing @BotName in a chat context triggers cross-bot handoff: current context + user message sent to tagged bot.

**Rationale:**
- **Bot collaboration** — Enable one bot to ask another for help without user context-switching.
- **Knowledge sharing** — Pass relevant context between bots (previous analysis, data).
- **Telegram-like** — Users already understand @mentions from social media.
- **Discoverability** — @mention autocomplete shows available bots.

**Alternatives Rejected:**
- **Separate "forward" button** — Adds UI, less discoverable.
- **Manual copy-paste** — Manual, error-prone, slow.
- **Dedicated handoff view** — Overkill, complicates navigation.

**Implementation:** 
1. User types `@BotName` in message input
2. Autocomplete shows available bots
3. On send, OptaPlus:
   - Collects last N messages from current bot
   - Sends to target bot: `[CROSS_BOT_HANDOFF from: {currentBot}] {context}\n\n{user message}`
   - Switches to target bot's chat
4. Target bot receives context, responds

**Reference:** SHARED.md (Smart Reaction Protocol)

---

## D10: No Telegram Login Required (Date: 2025-11-12)

**Decision:** OptaPlus works independently. No Telegram account, no social login, no third-party auth.

**Rationale:**
- **Telegram replacement** — Goal is to replace Telegram, not depend on it.
- **Simplicity** — Single auth method: gateway token (already exists).
- **Privacy** — No third-party tracking, no OAuth leaks.
- **Friction** — Users don't want to create accounts for every app.
- **Gateway-native** — All bots and users already have gateway tokens.

**Alternatives Rejected:**
- **Telegram login** — Defeats purpose of replacement, requires Telegram app.
- **Apple Sign-In** — Adds complexity, not needed.
- **Email/password** — Requires backend auth system.
- **Magic link** — Requires email infrastructure.

**Auth Flow:**
1. User launches app
2. Prompted to enter gateway IP (Bonjour discovery optional)
3. Enter gateway token (copied from Opta CLI or settings)
4. Connected — no account creation needed

**Implementation:** `OnboardingView.swift`, `BotListView.swift`

---

## D11: Multi-Window Architecture (macOS) (Date: 2025-12-15)

**Decision:** macOS supports unlimited chat windows via SwiftUI WindowGroup + openWindow(id:).

**Rationale:**
- **Power user need** — Developers need 3+ bot conversations simultaneously.
- **Native macOS** — Multi-window is standard on Mac (Mail, Xcode, Notes).
- **Window state** — Saved to disk, restored on relaunch.
- **Independent** — Each window has own scroll position, input state.
- **Shared connection** — All windows share single WebSocket to gateway (efficient).

**Alternatives Rejected:**
- **Single window only** — Limits power users, not competitive with Mac tools.
- **Tab-based (iOS style)** — Not native to macOS, awkward.
- **Split-pane** — Limits to 2 bots, less flexible than windows.

**Implementation:** `OptaPlusMacOSApp.swift` with WindowGroup + ForEach(bots)

**Window persistence:** `~/Library/Application Support/OptaPlus/windows.json`

---

## D12: Command Palette ⌘K (macOS) (Date: 2025-12-14)

**Decision:** macOS has command palette (⌘K) for fuzzy-searchable bot actions.

**Rationale:**
- **Discoverability** — Users find commands without hunting menus.
- **Speed** — Keyboard-only workflow, no mouse required.
- **Standard** — Raycast, VS Code, Xcode all use ⌘K, users expect it.
- **Customizable** — Users can add favorite commands for quick access.
- **Search** — 50+ built-in commands, fuzzy search narrows fast.

**Example Commands:**
- "restart opta" → Restart primary bot
- "config edit" → Edit bot settings
- "cron list" → Show all jobs
- "export chat" → Export current conversation

**Alternatives Rejected:**
- **Menu bar only** — Discoverable but slow.
- **Sidebar** — Takes up space, not keyboard-friendly.
- **Shortcuts preference pane** — Discoverable but requires config.

**Implementation:** `CommandPalette.swift` with `MatchRanking` fuzzy search

---

## D13: Keyboard Shortcuts (macOS) (Date: 2025-12-14)

**Decision:** macOS implements 50+ keyboard shortcuts (⌘N, ⌘1-6, ⌘[, ⌘], ⌘K, ⌘R, etc.).

**Rationale:**
- **Keyboard-first design** — macOS power users never touch mouse.
- **Speed** — Keyboard faster than menu hunting or mouse clicks.
- **Consistency** — Standard shortcuts: ⌘N = new, ⌘, = settings, ⌘W = close.
- **Accessibility** — VoiceOver users need keyboard.

**Key Shortcuts:**
| Shortcut | Action |
|----------|--------|
| ⌘N | New chat window |
| ⌘1-6 | Switch to bot 1-6 |
| ⌘[ / ⌘] | Toggle left/right panels |
| ⌘K | Command palette |
| ⌘Enter | Send message |
| ⌘R | Restart bot |
| ⌘, | Settings |
| ⌘D | Dashboard |

**Reference:** `docs/SHORTCUTS.md`, `macOS/PLATFORM.md`

---

## D14: Siri Integration (iOS) (Date: 2025-12-13)

**Decision:** iOS supports App Intents for Siri voice commands.

**Rationale:**
- **Hands-free** — Users can ask Siri while driving, cooking, etc.
- **Natural** — Voice interface more intuitive than typing for quick tasks.
- **Discoverability** — Siri suggests shortcuts based on usage patterns.
- **Competitive** — Telegram doesn't have Siri integration.

**Example Phrases:**
- "Ask Opta to check my calendar"
- "Send to Claude: analyze this code"
- "Create cron job: backup daily at 10pm"

**Implementation:** `iOS/OptaPlusIOS/AppIntents/AskBotIntent.swift` + others

---

## D15: WidgetKit (iOS) (Date: 2025-12-13)

**Decision:** iOS supports lock screen + home screen widgets for bot status and quick actions.

**Rationale:**
- **Glance at status** — See all bot statuses without opening app.
- **Quick access** — Swipe from lock screen to tap bot.
- **Engagement** — Lock screen widgets increase app usage.
- **Competitive** — Telegram doesn't have widgets.

**Widget Types:**
- **Lock screen:** 4 bot status dots (green/red), circular
- **Home screen:** Bot list with last message, quick actions
- **Dynamic Island:** Message notification badge

**Implementation:** `iOS/OptaPlusIOS/Widgets/*.swift`

---

## D16: Live Activities (iOS) (Date: 2025-12-13)

**Decision:** iOS supports Live Activities (lock screen + Dynamic Island) for task progress.

**Rationale:**
- **Real-time progress** — See cron job completion without opening app.
- **Lock screen integration** — ActivityKit provides native lock screen UI.
- **Dynamic Island** — Compact status in Dynamic Island (iPhone 14+).

**Example Activity:**
- Cron job "daily-report" running, 45% complete, 2m remaining

**Implementation:** `iOS/OptaPlusIOS/LiveActivities/*.swift`

---

## D17: Haptic Feedback (iOS) (Date: 2025-12-13)

**Decision:** iOS provides haptic feedback for key interactions (message send, status change, error, reaction).

**Rationale:**
- **Tactile feedback** — Users know action succeeded without visual confirmation.
- **Accessibility** — Helpful for visually impaired users.
- **Premium feel** — Small details make app feel polished.

**Haptic Patterns:**
- Light: Message sent
- Medium: Status change (bot online/offline)
- Heavy: Error, reconnection failed
- Selection: Reaction added
- Notification: Important event

**Implementation:** `iOS/OptaPlusIOS/Managers/HapticManager.swift`

---

## D18: Thumb-Zone Layout (iOS) (Date: 2025-12-12)

**Decision:** iOS UI optimized for one-handed use. Input at bottom, tabs reachable from thumb.

**Rationale:**
- **Mobile-first** — Most users hold phone in one hand.
- **Accessibility** — Reduces hand strain, improves usability.
- **Telegram pattern** — Users familiar with bottom input.

**Layout:**
- Top: Minimal (collapses on scroll)
- Middle: Chat messages (scrollable)
- Bottom: Message input (always visible)
- Bottom tabs: 5 tabs, thumb-reachable

---

## Summary: Why These Decisions Matter

| Decision | Benefit | Trade-off |
|----------|---------|-----------|
| NWConnection | Origin header, low-level control | Slightly more complex than URLSession |
| Zero deps | Security, small binary, stability | Can't use external libraries |
| CloudKit | Privacy, offline-first, sync | 30s latency, requires iCloud |
| Bonjour | Zero-config LAN | Only works on local network |
| Reactions → Commands | Bot intelligence, intuitive | Non-obvious to new users |
| @mention handoff | Bot collaboration | Adds routing complexity |
| No Telegram login | Independent, simpler | Can't leverage Telegram audience |
| Multi-window (macOS) | Power users, competitive | Window state management |
| Command palette | Speed, discoverability | 50+ shortcuts to document |
| Siri (iOS) | Hands-free, competitive | Requires App Intents setup |
| Widgets (iOS) | Quick access, engagement | Widget complexity |
| Haptics (iOS) | Premium feel, feedback | Battery drain, limited effect |

---

## Decisions NOT Made Yet

These are still open:

- **App Store pricing:** Freemium, pro tier, or stay free?
- **Localization:** Support other languages? (Currently English only)
- **Desktop browser app:** Web version via WebAssembly?
- **Watch app:** watchOS support?
- **Android:** Need OptaPlus for Android?

---

## When to Revisit Decisions

**Ask:** "Has the landscape changed? Are we violating this decision?"

Revisit if:
- New iOS/macOS capabilities make old decision obsolete
- Security issue discovered in current approach
- Performance metrics show choice was wrong
- Maintenance burden exceeds benefit
- User feedback suggests better approach

**Process:** Create GitHub issue, discuss with Matthew, document new decision here.

---

## Reference

- **GUARDRAILS.md** — Rules that enforce these decisions
- **APP.md** — Product context for decisions
- **SHARED.md** — Architecture enabled by these decisions

