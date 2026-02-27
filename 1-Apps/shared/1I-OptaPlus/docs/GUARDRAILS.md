---
scope: Safety, compliance, rules
purpose: Non-negotiable rules for OptaPlus development
version: 0.9.0
updated: 2026-02-15
---

# OptaPlus — GUARDRAILS.md

> Non-negotiable rules. Safety rules, compliance, architecture constraints. Read before every coding session. These are hard stops — not suggestions.

---

## 1. CRITICAL Rules (C01-C06) — From RULES-GLOBAL.md

These are universal across all Opta bots. **NEVER violate.**

| ID | Rule | Enforcement | OptaPlus Context |
|----|------|-------------|------------------|
| **C01** | No data exfiltration — Never send private data (keys, tokens, personal info) to external services | Hard block | Don't log gateway tokens, don't send chat history to analytics, don't dump user data |
| **C02** | No destructive commands without confirmation | Hard block | Deletion of cron jobs, clearing chat, factory reset require explicit user confirmation |
| **C03** | No external posts without approval | Hard block | Push notifications only to user's own devices, no automatic social sharing |
| **C04** | No self-modification of safety rules | Hard block | Cannot modify GUARDRAILS.md, RULES-GLOBAL.md, or compliance system |
| **C05** | No bypassing authentication | Hard block | Gateway token required for all bot connections, cannot use default/fallback tokens |
| **C06** | No executing untrusted code | Hard block | Scripts from ClawHub or user must be reviewed before execution |

**On violation:** STOP immediately. Do not complete the action. Escalate to Matthew.

---

## 2. OptaPlus-Specific Guardrails

### Architecture Constraints

#### A01: Zero External Dependencies
- **Rule:** Absolutely NO external packages (pods, SPM packages beyond Foundation)
- **Why:** Reduce attack surface, improve app stability, minimize bloat
- **Enforcement:** Build fails if any external dep is added
- **Exception:** Only Foundation, SwiftUI, Network (NWConnection), ActivityKit, WidgetKit, AppIntents — OS frameworks only
- **Allowed for testing:** XCTest only

#### A02: No UIKit or AppKit Wrappers
- **macOS:** Pure SwiftUI. No `NSView`, `NSViewController`, `NSWindow` in view code
- **iOS:** Pure SwiftUI. No `UIViewController`, `UIView`, `UINavigationController`
- **Exception:** System frameworks only (NotificationCenter, UIImpactFeedbackGenerator for haptics, UNUserNotificationCenter)
- **Why:** Consistency, maintainability, future SwiftUI improvements
- **Enforcement:** Code review blocks any UIKit/AppKit wrappers

#### A03: NWConnection Only (Not URLSession)
- **Rule:** Use `NWConnection` for WebSocket, NOT URLSession or any HTTP client library
- **Why:** Lower-level control, Origin header support, protocol v3 implementation
- **Where:** `Shared/Sources/OptaMolt/Networking/OpenClawClient.swift`
- **Reference existing:** Check current implementation for pattern

#### A04: Spring Physics Only for Motion
- **Rule:** All animations MUST use `.spring()`. Never use `.easeInOut`, duration-based timing, or linear
- **Tokens:** `.optaSpring` (0.55, 0.78), `.optaSnap` (0.35, 0.85), `.optaGentle` (0.8, 0.72)
- **Why:** Physical, responsive feel; matches design language
- **Exception:** Accessibility reduce-motion setting disables all animations
- **Enforcement:** Design review blocks ease-based animations

#### A05: Design Token Usage Required
- **Rule:** All colors, fonts, spacing must come from design system tokens
- **Never:** Hardcoded colors, font sizes without design tokens
- **Location:** `Shared/Sources/OptaMolt/DesignSystem/Colors.swift`, `Typography.swift`
- **Example:** Use `Color.optaPrimary`, not `Color(red: 0.545, green: 0.361, blue: 0.957)`
- **Enforcement:** Design review rejects hardcoded colors

### Network & Gateway Rules

#### N01: Gateway Token Never Logged
- **Rule:** Never print, log, or expose gateway token in any form (debug, error messages, pasteboard)
- **Why:** Token is authentication; if leaked, bots are compromised
- **Implementation:** Sanitize all logging that touches bot.token
- **Example:** ❌ `print("Connecting to \(bot.host):\(bot.port) with token \(bot.token)")`
- **Instead:** ✅ `print("Connecting to \(bot.host):\(bot.port)")`

#### N02: clientId "openclaw-control-ui"
- **Rule:** Always use clientId "openclaw-control-ui" when connecting to gateway
- **Where:** OpenClawClient initialization, connect frame
- **Why:** Gateway uses this to identify OptaPlus for rate limiting, feature flags
- **Hardcoded:** This is correct, not variable

#### N03: WebSocket Protocol v3
- **Rule:** Implement Protocol v3 frames exactly: `req`, `res`, `event` with proper JSON structure
- **Reference:** `Shared/Sources/OptaMolt/Networking/GatewayFrame.swift` (check existing)
- **Why:** Gateway expects v3, future-proof, consistent with Opta infrastructure

#### N04: Bonjour Discovery (LAN)
- **Rule:** Support LAN discovery via Bonjour/mDNS (`_openclaw._tcp`)
- **Why:** Low-latency local connections, works without external gateway
- **Implementation:** macOS uses NSNetServiceBrowser, iOS uses NWBrowser
- **Fallback:** Manual IP entry and Cloudflare tunnel as fallback

### Data & Sync Rules

#### D01: iCloud Sync via CloudKit (Production)
- **Rule:** Chat messages and bot configs sync via CloudKit (private database)
- **Why:** Secure, encrypted, user owns data, works offline
- **Implementation:** `Shared/Sources/OptaMolt/Sync/CloudKitCoordinator.swift`
- **Opt-out:** Users can disable iCloud sync in settings
- **Never:** Send to any cloud service except CloudKit

#### D02: Local Cache via UserDefaults
- **Rule:** Fast local access (bot list, preferences) via UserDefaults
- **Sync:** Periodically sync UserDefaults to CloudKit for redundancy
- **Conflict:** Server (CloudKit) is source of truth for messages

#### D03: Session Keys NOT Synced
- **Rule:** WebSocket session keys are device-specific, never synced
- **Why:** Security — each device has independent authentication
- **Implementation:** Generate new session key on each connection

### Feature & Behavior Rules

#### F01: Reactions as Bot Commands
- **Rule:** Reactions (👍 ❓ 👎 🔄) are not decorative — they send commands to bots
- **Implementation:** Reaction tap → send `[USER_REACTION: proceed]` frame to bot
- **Configurable:** User can customize reaction→action mapping in settings
- **Why:** Bots understand reactions, can respond intelligently

#### F02: @mention Cross-Bot Handoff
- **Rule:** @BotName in chat sends context and current message to tagged bot
- **Implementation:** Collect last N messages, send `[CROSS_BOT_HANDOFF from: {currentBot}]` frame
- **Security:** Both bots must be in user's bot list
- **Why:** Enable bot collaboration, knowledge sharing

#### F03: No Telegram Account Required
- **Rule:** OptaPlus works independently — no Telegram login needed
- **Why:** Telegram replacement, own authentication via gateway token
- **Never:** Require Telegram or any third-party social login

### Compliance Rules

#### C01-C06: Universal (See Section 1)

#### CP01: No Platform-Specific Secrets
- **Rule:** Secrets (tokens, API keys) managed per-platform if needed, never exposed in code
- **iOS:** Use Keychain for sensitive data
- **macOS:** Use Keychain for sensitive data
- **Never:** Hardcoded secrets, environment variables in bundled code

#### CP02: User Privacy First
- **Rule:** Chat history is user data — never sell, share, or analyze without explicit consent
- **Transparency:** Privacy policy available in settings (link to Opta Privacy Policy)
- **Deletion:** "Clear history" fully removes messages, not just hidden
- **Analytics:** No analytics, no crash reporting to third parties

---

## 3. Code Review Checklist

**Every PR must pass:**

### Architecture
- [ ] No new external dependencies
- [ ] No UIKit/AppKit wrappers (macOS/iOS respectively)
- [ ] All hardcoded colors are replaced with design tokens
- [ ] All animations use spring physics
- [ ] Gateway token never logged or exposed

### Networking
- [ ] Uses NWConnection, not URLSession
- [ ] clientId is "openclaw-control-ui"
- [ ] Protocol v3 frames implemented correctly
- [ ] Reconnection logic uses exponential backoff (800ms base, 1.7x, 15s cap)

### Data & Sync
- [ ] New data models sync via CloudKit
- [ ] iCloud opt-out works correctly
- [ ] Session keys are NOT synced
- [ ] MessageStore cache is updated

### Features
- [ ] Reactions are command handlers, not decorative
- [ ] @mentions work cross-bot
- [ ] No Telegram login required
- [ ] All features work offline (with cached data)

### Compliance & Safety
- [ ] No C01-C06 violations
- [ ] Destructive actions require user confirmation
- [ ] Push notifications opt-in (APNs)
- [ ] Privacy policy accessible
- [ ] Keyboard shortcuts documented (macOS)
- [ ] Accessibility labels on all interactive elements (iOS)

### Performance
- [ ] Memory < 250MB (iOS) or < 800MB (macOS)
- [ ] No synchronous operations on main thread
- [ ] Scroll/swipe smooth (60fps)
- [ ] App launch < 2s

### Testing
- [ ] Unit tests pass (models, logic)
- [ ] UI tests pass (navigation, core flows)
- [ ] Manual testing on target OS versions (iOS 17+, macOS 14+)

---

## 4. Dependency Management

### Allowed Packages

#### OS Frameworks (Always OK)
- Foundation
- SwiftUI
- Network (NWConnection)
- ActivityKit
- WidgetKit
- AppIntents
- UserNotifications
- Keychain / SecureEnc Enclave
- CloudKit
- Combine (if needed, avoid in favor of async/await)

#### Testing Only
- XCTest

#### Explicitly Forbidden
- Alamofire
- URLSession (for WebSocket)
- Firebase
- Sentry
- Mixpanel
- Any analytics library
- Any HTTP client other than NWConnection
- Crypto libraries (use CryptoKit from Foundation)

### Adding a New Dependency

**Process:**
1. Create GitHub issue: "Consider adding [package]: [reason]"
2. Matthew reviews and approves (or rejects)
3. If approved, add to Package.swift with exact version
4. Update GUARDRAILS.md (this file)
5. Merge with explicit commit message: "Add dependency: [package] for [reason]"

**Rationale:** Zero-dependency rule is strict. Every exception must be approved.

---

## 5. Security Checklist

Before every release:

- [ ] No hardcoded secrets (tokens, API keys, passwords)
- [ ] Gateway token handling is correct (never logged)
- [ ] WebSocket uses TLS (if over internet, not LAN)
- [ ] Keychain used for sensitive data (iOS/macOS)
- [ ] CloudKit privacy rules reviewed
- [ ] Session keys are ephemeral (not persisted)
- [ ] User can delete all their data (clear history)
- [ ] Push notification tokens are not logged
- [ ] No tracking or analytics
- [ ] Build is clean (no debug symbols leaked)

---

## 6. Performance Guardrails

| Metric | macOS Target | iOS Target | Enforcement |
|--------|--------------|------------|-------------|
| Memory | < 800MB | < 250MB | Instruments check every release |
| Startup | < 2s | < 2s | Manual timing on target hardware |
| Message scroll | 60fps constant | 60fps constant | XCTest performance tests |
| Tab switch | Smooth | Smooth | Manual testing |
| Bot switch | N/A | < 300ms swipe | Visual testing |
| iCloud sync | < 30s | < 30s | Integration test |
| Widget update | N/A | < 5 min | WidgetKit refresh policy |
| Siri response | N/A | < 2s | Manual Siri testing |

---

## 7. Accessibility Guardrails

- [ ] All interactive elements have VoiceOver labels
- [ ] Color contrast meets WCAG AA (4.5:1 for text)
- [ ] App supports "Reduce Motion" system setting (no spring animations)
- [ ] Dynamic Type scaling works (text views respect system size)
- [ ] Keyboard navigation works on macOS
- [ ] No flashing or bright animations (seizure safety)

---

## 8. Versioning & Release

### Version Format: `MAJOR.MINOR.PATCH`

- **MAJOR:** Breaking changes to gateway protocol or bot compatibility
- **MINOR:** New features (multi-window, Siri, widgets)
- **PATCH:** Bug fixes, performance improvements

### Release Checklist

- [ ] All code review items pass
- [ ] All tests pass (unit, UI, integration)
- [ ] No C01-C06 violations
- [ ] Performance targets met
- [ ] Changelog updated
- [ ] App Store screenshots updated (if needed)
- [ ] Privacy policy current
- [ ] All new strings localized (if applicable)
- [ ] Version number bumped in Xcode project

---

## 9. When You're Unsure

**Ask these questions before shipping:**

1. Does this use an external dependency? → **STOP**, get approval
2. Does this expose the gateway token? → **STOP**, sanitize
3. Is this destructive without confirmation? → **STOP**, add confirmation dialog
4. Does this break a C01-C06 rule? → **STOP**, refactor
5. Is this a hardcoded color? → **STOP**, use design tokens
6. Is this duration-based motion? → **STOP**, use spring physics
7. Could this leak user data? → **STOP**, review privacy

If any answer is "yes," pause. Don't ship. Discuss with Matthew.

---

## 10. Update This Document When

- [ ] A new architectural constraint is settled
- [ ] A dependency is approved or forbidden
- [ ] A security issue is discovered and mitigated
- [ ] A compliance rule changes
- [ ] Performance targets change
- [ ] A C01-C06 rule is clarified

---

## 📚 Reference

- **RULES-GLOBAL.md** — Universal compliance for all bots
- **DECISIONS.md** — Why each of these rules exists
- **macOS/CLAUDE.md** — Code review checklist for macOS
- **iOS/CLAUDE.md** — Code review checklist for iOS
- **SHARED.md** — Design system, data models

