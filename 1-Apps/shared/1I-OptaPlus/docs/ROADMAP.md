---
scope: Version roadmap, milestones, features
purpose: Version targets, feature groups, milestones, estimated effort, release dates
version: 0.9.0
updated: 2026-02-15
---

# OptaPlus — ROADMAP.md

> Version roadmap from v0.9 (current) → v1.0 (Telegram replacement) → v2.0 (advanced). Feature groups, milestones, estimated effort.

---

## Current Status

| Aspect | Status |
|--------|--------|
| **Current Version** | 0.9.0 |
| **Release Date** | 2026-02-15 (today) |
| **Platforms** | iOS 17+, macOS 14+ |
| **Core Features** | ✅ Chat, cron CRUD, bot config, reactions, sync |
| **Target Users** | Matthew (primary), friends testing |
| **App Store** | Not yet (will be v1.0) |

---

## v0.9 → v1.0 Path

### v0.9 (Current Release) — 2026-02-15
**Goal:** Feature-complete for single-user testing. All core features working.

**Features:**
- ✅ Chat (text + streaming)
- ✅ Bot management (restart, config edit)
- ✅ Cron jobs (add/edit/delete)
- ✅ iCloud sync (messages + bot config)
- ✅ Smart reactions (👍 ❓ 👎 🔄)
- ✅ @mention handoff
- ✅ Message search + pinning
- ✅ macOS: Multi-window, command palette, keyboard shortcuts
- ✅ iOS: Swipe navigation, bot drawer, basic UI
- ✅ WebSocket stability (reconnection, error handling)
- ⚠️ Missing: Siri, Widgets, Live Activities (iOS)
- ⚠️ Missing: Voice messages (send/receive)
- ⚠️ Missing: Push notifications (iOS)
- ⚠️ Missing: LAN discovery (Bonjour)

**Effort:** 100% (baseline)

**Known Issues:**
- Occasional reconnection delay (< 5s, acceptable)
- CloudKit sync not tested across households
- No offline drafts saved locally

---

### v0.9.1 (Patch) — ETA: 2026-02-28
**Goal:** Bug fixes, stability. v0.9 user feedback incorporated.

**Changes:**
- ✅ Fix WebSocket reconnect logic (network toggle triggers fresh URL resolution via NetworkEnvironment)
- ✅ Fix CloudKit sync conflict (server-timestamp-wins + merge logic in SyncCoordinator)
- ✅ Add offline draft support (DraftStore in OfflineQueue.swift — persists to Application Support)
- ✅ Improve message rendering (code block copy button — added contentShape for hit target)
- ✅ Add connection diagnostics view (ConnectionDiagnosticsView.swift) — macOS only
- ✅ iOS: Fix swipe gesture on iPhone 15 (scrollBounceBehavior + contentMargins on pager)
- ✅ macOS: Fix window restoration (WindowStatePersistence wired into WindowRoot lifecycle)

**Effort:** 15-20 hours

**Testing:** Matthew + 1-2 beta testers

---

### v1.0 (Telegram Replacement) — ETA: 2026-04-01
**Goal:** Feature-parity with Telegram for bot communication. Ready for App Store. Suitable for 5+ users.

**Feature Groups:**

#### Communication (Core)
- ✅ Text chat (from v0.9)
- ✨ Voice messages: Send + TTS playback
  - Effort: 10 hours (audio recording, transcription)
- ✨ Image/file sharing (send + receive)
  - Effort: 8 hours (FilePicker, attachment handling)
- ✨ Link previews (metadata, thumbnail)
  - Effort: 6 hours (URL parsing, caching)

#### Notifications (Critical for v1.0)
- ✨ Push notifications (iOS APNs)
  - Effort: 12 hours (APNs setup, token management, gateway webhook)
- ✨ Local notifications (macOS + iOS)
  - Effort: 4 hours (UserNotifications framework)
- ✨ Smart grouping (last 3 messages = 1 notification)
  - Effort: 3 hours

#### Mobile-First Features (iOS Exclusive)
- ✨ Siri Shortcuts / App Intents
  - Effort: 8 hours (AskBotIntent, SendMessageIntent, CheckStatusIntent)
- ✨ Home screen widgets (bot status, quick actions)
  - Effort: 10 hours (WidgetKit, TimelineProvider, widget refresh)
- ✨ Lock screen widgets (simple status dots)
  - Effort: 6 hours (AccessoryCircular family)
- ✨ Live Activities (task progress on lock screen)
  - Effort: 8 hours (ActivityKit, ActivityAttributes, update flow)
- ✨ Haptic feedback (message, status, reactions)
  - Effort: 3 hours

#### Network & Discovery
- ✨ Bonjour/mDNS LAN discovery
  - Effort: 10 hours (NSNetServiceBrowser on macOS, NWBrowser on iOS)
- ✨ Cloudflare tunnel support (automatic)
  - Effort: 4 hours (URL parsing, TLS handshake)
- ✨ Connection status indicators (all platforms)
  - Effort: 3 hours

#### Accessibility & Polish
- ✨ Keyboard accessibility review (macOS)
  - Effort: 4 hours
- ✨ VoiceOver testing (iOS)
  - Effort: 4 hours
- ✨ High contrast mode support
  - Effort: 2 hours
- ✨ Reduced motion support
  - Effort: 2 hours
- ✨ Export chat (Markdown, JSON, plaintext)
  - Effort: 6 hours

#### Testing & QA
- ✨ UI automation tests (macOS + iOS)
  - Effort: 15 hours
- ✨ Performance profiling (memory, battery, latency)
  - Effort: 8 hours
- ✨ Manual QA on 3+ devices
  - Effort: 10 hours

#### App Store Preparation
- ✨ Xcode project configuration (signing, provisioning)
  - Effort: 4 hours
- ✨ Screenshots + app preview video
  - Effort: 6 hours
- ✨ Privacy policy + terms
  - Effort: 3 hours
- ✨ App Store submission + review
  - Effort: 2 hours (submit, respond to feedback)

**Total Effort:** ~150-180 hours (6 weeks for 1 developer, 40 hrs/week)

**Release Criteria:**
- [ ] All features tested on iOS 17+, macOS 14+
- [ ] All features tested on 3+ device combinations
- [ ] No crashes in 1-week usage
- [ ] Memory < limits (iOS 250MB, macOS 800MB)
- [ ] Latency < 1s for message echo
- [ ] Offline-first: works without network
- [ ] iCloud sync stable
- [ ] Push notifications reliable (95%+ delivery)
- [ ] App Store submission approved

---

### v1.1 (Polish) — ETA: 2026-06-01
**Goal:** User feedback incorporated. Bug fixes. Performance. Broadcast to friends.

**Changes:**
- 🐛 Fix reported bugs from v1.0
- ✨ Chat message reactions (react to any message, not just bot responses)
- ✨ Message threading (reply-to with quote)
- ✨ User preferences UI overhaul (easier settings)
- ✨ Bot avatar support (custom images per bot)
- ✨ Message timestamp options (show/hide, relative vs absolute)
- ✨ Dark/light theme toggle (currently dark-only)
- ✨ Performance optimization (scroll, memory, startup)
- ✨ Accessibility improvements (based on testing)

**Testing:** 5-10 beta testers

**Effort:** 60-80 hours

---

## v2.0+ (Long-Term Vision) — ETA: 2026-10-01+

### v2.0 (Advanced Features)

**Larger features that don't block v1.0:**

#### Bot Collaboration
- ✨ Bot-to-bot messaging (bots asking each other for help)
- ✨ Session sharing (share conversation snapshot with another user)
- ✨ Collaborative sessions (multiple users in same chat)
- Effort: 30 hours

#### Analytics & History
- ✨ Chat analytics (messages per bot, response times)
- ✨ Advanced search (filter by date, sender, content type)
- ✨ Conversation export + import
- Effort: 20 hours

#### Advanced Session Management
- ✨ Session isolation (sandbox mode, separate state)
- ✨ Session snapshots (save state, restore later)
- ✨ Multi-device session sync
- Effort: 20 hours

#### Integration Ecosystem
- ✨ Third-party app integrations (Slack, Discord, Teams relay)
- ✨ Webhook triggers (cron → external service)
- ✨ Custom reaction handlers (user-defined commands)
- Effort: 40 hours

#### Advanced Automation
- ✨ Workflow builder (visual editor for multi-step jobs)
- ✨ Conditional logic (if/else in cron)
- ✨ Variables & templates
- Effort: 40 hours

#### macOS Exclusive
- ✨ Floating status window (always-on-top, minimal)
- ✨ Floating console (output viewer)
- ✨ Menu bar integrations (more commands)
- Effort: 15 hours

#### iOS Exclusive
- ✨ Watch app (basic chat, notifications)
- ✨ App Clips (quick message without full app)
- Effort: 30 hours

#### Platform Expansion
- ✨ Web app (React/Next.js, same backend)
- ✨ Android app (if demand exists)
- Effort: 80+ hours (separate effort)

**Total for v2.0:** 200+ hours (distributed across 2-3 releases)

---

## Effort Breakdown

| Phase | Hours | Duration | % Complete |
|-------|-------|----------|-----------|
| v0.9 (current) | 100 | Done | 100% |
| v0.9.1 (patch) | 15-20 | 2 weeks | 0% |
| v1.0 (Telegram replacement) | 150-180 | 6 weeks | 0% |
| v1.1 (polish) | 60-80 | 3 weeks | 0% |
| v2.0 (advanced) | 200+ | 8+ weeks | 0% |
| **Total** | **~525-600** | **~20 weeks** | **~17%** |

---

## Priority Matrix

### Must-Have (Blocks v1.0)
1. Push notifications (iOS)
2. Siri Shortcuts (iOS)
3. Home screen widgets (iOS)
4. Bonjour discovery
5. Export chat
6. Connection status
7. QA testing

### Should-Have (v1.0, Nice-to-Have)
1. Voice messages
2. Image/file sharing
3. Link previews
4. Live Activities
5. Haptic feedback
6. Lock screen widgets

### Nice-to-Have (v1.1+)
1. Reduced motion accessibility
2. High contrast mode
3. Message threading
4. Bot avatars
5. Advanced search
6. Chat analytics

---

## Risk & Dependencies

### Critical Path
```
v0.9 ──→ (Push + Siri) ──→ (Widgets) ──→ (Testing) ──→ v1.0
         (4 weeks)        (3 weeks)    (2 weeks)
```

### Blockers
- **APNs setup delay:** Could push v1.0 by 2 weeks if slow
- **App Store review:** Could add 1-2 weeks
- **Device testing:** Need multiple devices (handle now)
- **User feedback loop:** v0.9.1 might reveal v1.0 issues

### Mitigation
- Start APNs setup immediately (separate from coding)
- Build on multiple devices (simulator + real devices)
- Beta test early (v0.9 → v0.9.1 → v1.0)

---

## Release Cadence

| Version | Date | Gap |
|---------|------|-----|
| v0.9.0 | 2026-02-15 | Today (baseline release) |
| v0.9.1 | 2026-02-28 | 2 weeks |
| v1.0.0 | 2026-04-01 | 5 weeks |
| v1.1.0 | 2026-06-01 | 8 weeks |
| v2.0.0 | 2026-10-01+ | 16+ weeks |

**Pattern:** Major release every ~8 weeks, patch every ~2 weeks.

---

## Success Metrics

### v1.0 Success
- [ ] Matthew uses OptaPlus instead of Telegram for 100% of bot comms
- [ ] All 7+ bots accessible from both iOS + macOS
- [ ] Push notifications reliable (95%+ delivery)
- [ ] Message latency < 1s average
- [ ] Zero crashes per week
- [ ] iCloud sync propagates within 30s
- [ ] App launches in < 2s
- [ ] Friends can run OptaPlus without help

### v1.1 Success
- [ ] 5-10 beta testers actively using
- [ ] Bug report rate < 1 per week
- [ ] User satisfaction high (qualitative feedback)
- [ ] Performance targets met consistently

### v2.0 Success
- [ ] 20+ users on OptaPlus
- [ ] 80% of Telegram bot comms moved to OptaPlus
- [ ] Bot-to-bot collaboration features used
- [ ] Advanced sessions / workflows adopted

---

## Notes for the Future

### Known Limitations (Current)
- No video calls (out of scope)
- No typing indicators (not critical for bots)
- No read receipts (not needed for bot comms)
- No file size limits defined yet
- No rate limiting on user-to-bot messages
- No message editing post-send (future: v2.0)

### Decisions Made
- **Focus iOS first:** It's the Telegram replacement target. macOS is secondary.
- **Don't rush v1.0:** Better to delay than launch broken.
- **Beta test thoroughly:** Avoid App Store rejection.
- **Stay simple:** No unnecessary features; every feature must have a clear purpose.

### Questions to Revisit
- **How much disk space?** Chat history grows over time. Need cleanup policy?
- **International?** Localization is v2.0+. English only for v1.0.
- **Free vs Paid?** Decision deferred. Likely free v1.0, revisit later.
- **User accounts?** Currently gateway token-based. Stay that way for v1.0.

---

## Reference

- **APP.md** — Product vision, success metrics
- **DECISIONS.md** — Architecture choices that affect roadmap
- **WORKFLOWS.md** — How to execute the roadmap (build, test, deploy)

