# OptaPlus macOS — Master Improvement Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform OptaPlus macOS from a solid chat client into a modular, extensible AI command center with 17 new features — all designed for easy changeability without major consequences.

**Architecture Principle:** Every feature is a self-contained, removable module. Delete a folder + remove one registration line = feature gone, zero side effects.

**Generated:** 2026-02-17 by Opta + Atpo analysis (4 parallel agents, ~27,000 lines of codebase analyzed)

---

## What Was Delivered

### Module Files Written (9,443 lines total)

| Module | Lines | Location |
|--------|-------|----------|
| SplitPaneChatModule | 841 | `macOS/OptaPlusMacOS/Modules/SplitPaneChatModule.swift` |
| ConversationBranchingModule | 788 | `macOS/OptaPlusMacOS/Modules/ConversationBranchingModule.swift` |
| MessageThreadingModule | 505 | `macOS/OptaPlusMacOS/Modules/MessageThreadingModule.swift` |
| AnalyticsDashboardModule | 794 | `macOS/OptaPlusMacOS/Modules/AnalyticsDashboardModule.swift` |
| ThemeCreatorModule | 1,045 | `macOS/OptaPlusMacOS/Modules/ThemeCreatorModule.swift` |
| SmartContextPanelModule | 1,027 | `macOS/OptaPlusMacOS/Modules/SmartContextPanelModule.swift` |
| SemanticSearchModule | 928 | `macOS/OptaPlusMacOS/Modules/SemanticSearchModule.swift` |
| ChoreographyModule | 1,049 | `macOS/OptaPlusMacOS/Modules/ChoreographyModule.swift` |
| ScreenContextModule | 788 | `macOS/OptaPlusMacOS/Modules/ScreenContextModule.swift` |
| SoundscapeModule | 810 | `macOS/OptaPlusMacOS/Modules/SoundscapeModule.swift` |
| WidgetModule | 868 | `macOS/OptaPlusMacOS/Modules/WidgetModule.swift` |

### Designs (Not Yet Written)

These 6 modules were fully designed with production Swift code in the agent output but need to be written to disk:

| Module | Purpose | Agent Output |
|--------|---------|-------------|
| OnboardingModule | 5-step first-launch wizard | UX agent |
| FocusModule | macOS Focus mode integration | UX agent |
| TransitionModule | Animated view transitions | UX agent |
| DragDropModule | Enhanced file drop handling | UX agent |
| BotColorModule | Dynamic per-bot accent colors | UX agent |
| QuickReplyModule | Notification reply routing | UX agent |

---

## Critical Bugs Found (Fix Before Anything Else)

### BUG-1: SplitDivider Cursor Leak (Critical)
- **File:** `Modules/SplitPaneChatModule.swift`
- **Problem:** `NSCursor.push()` on hover enter, but `NSCursor.pop()` only on hover exit. If view is destroyed while hovered, cursor stack leaks permanently.
- **Fix:** Add `.onDisappear { NSCursor.pop() }` to SplitDivider

### BUG-2: MessageThreadingModule Broken Bot Lookup (Critical)
- **File:** `Modules/MessageThreadingModule.swift`, lines 386-392
- **Problem:** `message.sender.botId` always returns `nil` (private extension at lines 451-458). Thread replies silently fail to send.
- **Fix:** Pass `botId` through the view hierarchy instead of computing from MessageSender

### BUG-3: Keyboard Shortcut Collision (High)
- **Conflict:** ConversationBranchingModule (`Cmd+Shift+F` for fork) vs SemanticSearchModule (`Cmd+Shift+F` for search)
- **Fix:** Remap branching fork to `Cmd+Opt+F`

### BUG-4: Notification.Name Global Collisions (High)
- **Problem:** All modules extend `Notification.Name` in global namespace. Risk of silent notification misrouting.
- **Fix:** Namespace all names: `.module_splitpane_toggle` instead of `.toggleSplitPane`

---

## Architecture: The Module System

### Core Principle: Delete-Safe Modules

Every module follows this contract:

```
TO ADD:
  1. Drop .swift file in Modules/
  2. Add one registration line in AppDelegate or ContentView
  3. Module discovers its slot and registers views/shortcuts

TO REMOVE:
  1. Delete the .swift file (or folder)
  2. Remove the registration line
  3. App compiles and runs unchanged
```

### Proposed OptaPlusModule Protocol

```swift
protocol OptaPlusModule {
    static var id: String { get }
    static var name: String { get }
    static var icon: String { get }
    static var keyboardShortcut: (KeyEquivalent, EventModifiers)? { get }
    static func activate(appState: AppState)
    static func deactivate()
    static func cleanup()  // Remove all persisted data
}
```

### Navigation Wiring

Currently `DetailMode` only has 6 cases. All 11 modules are written but **NOT wired into navigation**. The highest-impact next step is extending `ContentView.swift`:

```swift
enum DetailMode: String, CaseIterable {
    // Existing
    case chat, dashboard, automations, botWeb, debug, botMap
    // New modules
    case splitPane, choreography, analytics, themeCreator
    case smartContext, semanticSearch, branching, threading
    case screenContext, soundscape
}
```

---

## Module Registry — Complete Feature Map

### F1. Split-Pane Chat (841 lines) ✅ Written
**Purpose:** Talk to 2+ bots simultaneously in configurable layouts
- Layouts: side-by-side, top-bottom, quad grid
- Each pane is an independent ChatViewModel
- "Linked mode" sends same message to all visible bots
- Persistent layout per window
- Shortcuts: `⌘⇧1-4` focus pane, `⌘⇧=` add, `⌘⇧-` remove

### F2. Conversation Branching (788 lines) ✅ Written
**Purpose:** Fork conversations into alternate timelines
- `ConversationTree` with `BranchNode` (parent, children, messages)
- Branch point UI on message hover (fork icon)
- Branch navigator minimap
- Merge branches: combine insights from two branches
- Copy-on-write for memory efficiency

### F3. Message Threading (505 lines) ✅ Written
**Purpose:** Slack-style reply threads
- Uses existing `ChatMessage.replyTo` field
- Inline expansion below parent message
- Thread reply composer with scoped input
- Thread indicator badge showing reply count
- Thread state is ephemeral (per-session)

### F4. Analytics Dashboard (794 lines) ✅ Written
**Purpose:** Bot performance metrics over time
- Swift Charts: line (latency), bar (volume), area (errors), gauge (uptime)
- Time ranges: 1h, 24h, 7d, 30d, custom
- Per-bot and aggregate views
- Anomaly highlighting (amber/red spikes)
- `MetricsCollector` protocol for pluggable data sources

### F5. Theme Creator (1,045 lines) ✅ Written
**Purpose:** Users create custom themes beyond 3 built-in
- Live preview panel + color pickers
- Editable tokens: background, surface, primary, accent, text
- Font selection from installed system fonts
- Import/export JSON theme files
- Starts from existing theme as template

### F6. Smart Context Panel (1,027 lines) ✅ Written
**Purpose:** Live view of what the bot "sees"
- Token count / context window usage bar
- Files in context with token estimates
- Drag-and-drop to inject/remove context items
- Visual diff showing changes between turns
- Context snapshots for comparison
- Search within context

### F7. Semantic Search (928 lines) ✅ Written
**Purpose:** Meaning-based search across all conversations
- NLEmbedding for on-device embeddings (zero dependencies)
- TF-IDF with cosine similarity fallback
- Incremental indexing on message arrival
- Cross-bot results with bot emoji prefix
- Background re-indexing on app launch

### F8. Bot Choreography (1,049 lines) ✅ Written
**Purpose:** Chain bots into automated pipelines
- Pipeline model: steps with `{{input}}` templates
- Visual editor: horizontal flow with connected nodes
- Sequential/parallel execution engine
- Pre-built templates: Code Review, Research, Creative
- Scheduling via existing cron system
- Run history with timing and outputs

### F9. Screen Context (788 lines) ✅ Written
**Purpose:** Share screen with bot for visual context
- Capture modes: full screen, window, region, clipboard
- ScreenCaptureKit (macOS 13+) for efficient capture
- Privacy: redaction zones, pause on password fields, session-only (never persists)
- Diff detection: only send if >15% pixel change
- Indicator light when sharing is active

### F10. Soundscape (810 lines) ✅ Written
**Purpose:** Audio layer responding to bot activity
- Procedural sine wave synthesis (no audio file dependencies)
- Categories: UI feedback, ambient thinking, task completion
- AVAudioEngine for mixing/spatial
- Per-category volume sliders
- Sound packs: Minimal, Ambient, Silent
- Respects system sound preferences

### F11. Widget Data Provider (868 lines) ✅ Written
**Purpose:** macOS desktop widgets for bot status
- Widget types: Bot Status (small), Message Feed (medium), Quick Send (small), Health Dashboard (large)
- App Group container for shared data
- Deep links: `optaplus://bot/{id}`, `optaplus://send/{id}/{msg}`
- Timeline updates every 5 minutes + on significant events

### U1. Onboarding Wizard — Designed (Not Written)
**Purpose:** First-launch guided experience
- 5 steps: Welcome → Scan → Pair → First Message → Discover
- RadarScanView integration for gateway scanning
- Skip option + re-trigger from Settings
- Spring-animated step transitions

### U2. Focus Filters — Designed (Not Written)
**Purpose:** macOS Focus mode integration
- Map Focus modes to bot visibility
- Auto-suppress notifications in DND
- Auto-connect work bots during Work focus

### U3. Animated Transitions — Designed (Not Written)
**Purpose:** Spring transitions between detail modes
- Horizontal slide, depth push, crossfade, morph
- Direction-aware (tracks previous mode)
- Reduce motion accessibility support

### U4. Drag-and-Drop Enhancement — Designed (Not Written)
**Purpose:** Enhanced file drop with preview
- Full-view glass overlay on drag
- Multi-file batch with carousel preview
- Size limit indicators
- MIME type detection for 20+ extensions

### U5. Dynamic Bot Colors — Designed (Not Written)
**Purpose:** Per-bot accent colors
- djb2 hash auto-assignment from 9 neon palette
- Manual override via color picker in BotProfileSheet
- Applies to: sidebar, chat bubbles, dashboard cards, constellation nodes

### U6. Quick Reply from Notifications — Designed (Not Written)
**Purpose:** Reply directly from notification banners
- UNTextInputNotificationAction routing
- Automatic bot reconnection if disconnected
- Markdown stripping for clean previews
- Thread grouping by bot

---

## Implementation Phases

### Phase 0: Fix Critical Bugs (30 minutes)
1. Fix SplitDivider cursor leak
2. Fix MessageThreadingModule broken bot lookup
3. Resolve keyboard shortcut collision (⌘⇧F → ⌘⌥F for branching)
4. Namespace Notification.Name extensions

### Phase 1: Wire Modules Into App (2-3 hours)
1. Extend `DetailMode` enum with new module cases
2. Add notification listeners in ContentView for module toggles
3. Add module entries to Command Palette
4. Add keyboard shortcuts to cheat sheet
5. Add module entries to sidebar navigation

### Phase 2: Write Remaining 6 Modules (1-2 days)
1. OnboardingModule.swift
2. FocusModule.swift
3. TransitionModule.swift
4. DragDropModule.swift
5. BotColorModule.swift
6. QuickReplyModule.swift

### Phase 3: Formalize Module System (1 day)
1. Create `OptaPlusModule` protocol
2. Module registry with enable/disable
3. Module settings panel in Preferences
4. Typed event bus replacing NotificationCenter

### Phase 4: Clean Up Dead Code (30 minutes)
1. Delete TelegramAuthView.swift (dead behind `#if canImport(TDLibKit)`)
2. Assess and potentially delete BotWebView.swift (iOS equivalent already deleted)

### Phase 5: Architecture Decomposition (2-3 days)
1. Split ContentView.swift (2,235→6 files, each <300 lines)
2. Split ChatViewModel.swift (1,082→4 focused VMs)
3. Move CronJobItem to shared module (eliminate iOS/macOS duplication)
4. Unified storage abstraction

### Phase 6: Test Infrastructure (1-2 days)
1. Fix hanging xctest issue
2. Unit tests for protocol encoding/decoding
3. Unit tests for markdown parsing
4. Module contract tests (notification names, lifecycle)

---

## Design System Compliance

All modules follow these rules:
- **Animations:** Spring physics only (`.optaSpring`, `.optaSnap`, `.optaGentle`, `.optaPulse`)
- **Colors:** Design tokens only (`optaVoid`, `optaSurface`, `optaPrimary`, etc.)
- **Typography:** Sora font with 10-level type scale
- **Glass effects:** `.ultraThinMaterial` with subtle highlights
- **Dependencies:** Zero external — pure SwiftUI + Foundation
- **Accessibility:** Reduce motion support, VoiceOver labels
- **Concurrency:** `@MainActor` for UI state, `Sendable` for data models

---

## Changeability Matrix

How each module can be changed or removed without consequence:

| Module | Remove = | Change Scope = |
|--------|----------|----------------|
| Split-Pane | Delete file + remove notification | Single file, self-contained |
| Branching | Delete file + revert context menu | Single file, tree data orphans |
| Threading | Delete file + unwrap ThreadedMessageView | Single file, replyTo field ignored |
| Analytics | Delete file + remove detail mode | Single file + metrics history |
| Theme Creator | Delete file + revert Settings section | Single file, custom themes ignored |
| Smart Context | Delete file + revert context panel | Single file, pinned keys orphan |
| Semantic Search | Delete file + revert search | Single file + embedding cache files |
| Choreography | Delete file + remove detail mode | Single file + pipeline JSON files |
| Screen Context | Delete file + remove capture button | Single file, no persistent data |
| Soundscape | Delete file + remove Settings section | Single file, no persistent data |
| Widget | Delete extension target | Separate target, app unaffected |
| Onboarding | Delete file + remove overlay | Single file + UserDefaults flag |
| Focus Filters | Delete file + remove filter | Single file, all bots visible |
| Transitions | Delete file + unwrap container | Single file, views switch instantly |
| Drag-Drop | Delete file + revert handler | Single file, existing handler remains |
| Bot Colors | Delete file + revert function | Single file, all bots use violet |
| Quick Reply | Delete file + remove registration | Single file, notifications still arrive |

---

## TL;DR

**11 production Swift module files written** (9,443 lines) + **6 more fully designed**. The modules cover: split-pane chat, conversation branching, threading, analytics, custom themes, smart context, semantic search, bot choreography, screen sharing, soundscapes, widgets, onboarding, focus integration, animated transitions, drag-drop, bot colors, and quick reply.

**4 critical bugs found** in the newly written modules (cursor leak, broken thread send, shortcut collision, notification namespace risk).

**Core architectural insight:** All modules exist as files but are NOT wired into ContentView's navigation. Phase 1 (wiring) is the highest-impact next step — 2-3 hours to make all 11 modules reachable from the UI.

**Changeability:** Every module follows the "delete folder + remove one line = feature gone" contract. The user can freely experiment, swap, modify, or remove any feature without touching other code.
