---
scope: Development practices, workflows
purpose: Development workflows, build scripts, testing, git conventions, feature/bot addition
version: 0.9.0
updated: 2026-02-15
---

# OptaPlus — WORKFLOWS.md

> Development workflows, build & test procedures, git conventions, how to add features and bots. Day-to-day developer processes.

---

## 1. Local Setup

### Prerequisites
- **macOS 14+** (Sonoma or later)
- **Xcode 15+** (with command line tools)
- **Swift 5.9+** (included with Xcode)
- **Git** (`git --version` should work)
- **OpenClaw Gateway** (running locally, `openclaw gateway status`)

### First-Time Setup

```bash
# Clone repository (or already have Synced)
cd ~/Synced/Opta/1-Apps/1I-OptaPlus

# Open iOS project
open iOS/OptaPlusIOS.xcodeproj

# Open macOS project
open macOS/OptaPlusMacOS.xcodeproj

# Or: Verify Shared package builds
cd Shared
swift build
```

### Build Settings
Both projects share:
- **Swift Version:** 5.9+
- **iOS Deployment Target:** 17.0
- **macOS Deployment Target:** 14.0
- **Code Sign Identity:** Apple Development (auto)

---

## 2. Build & Run Workflows

### iOS (Simulator)

```bash
cd ~/Synced/Opta/1-Apps/1I-OptaPlus

# Open in Xcode
open iOS/OptaPlusIOS.xcodeproj

# Build
⌘B

# Run (select simulator)
⌘R

# Select device/simulator: ⌘⇧K
# Device options: iPhone 16 Pro, iPhone 15, iPad Pro, etc.
```

### macOS (Native)

```bash
# Open in Xcode
open macOS/OptaPlusMacOS.xcodeproj

# Build
⌘B

# Run
⌘R

# Multi-window testing
⌘N (new window in running app)
```

### Shared Package (Isolated)

```bash
cd ~/Synced/Opta/1-Apps/1I-OptaPlus/Shared

# Build shared package
swift build

# Run tests
swift test

# Run specific test
swift test --filter MarkdownContentTests
```

### Build Script (Optional: `scripts/build-run.sh`)

```bash
#!/bin/bash
# Automated build for both platforms

PLATFORM=${1:-ios}  # ios or macos

cd ~/Synced/Opta/1-Apps/1I-OptaPlus

if [ "$PLATFORM" = "ios" ]; then
    echo "Building iOS..."
    xcodebuild -project iOS/OptaPlusIOS.xcodeproj \
               -scheme OptaPlusIOS \
               -configuration Debug \
               -derivedDataPath .build
    echo "✅ iOS built. Run with ⌘R in Xcode."
elif [ "$PLATFORM" = "macos" ]; then
    echo "Building macOS..."
    xcodebuild -project macOS/OptaPlusMacOS.xcodeproj \
               -scheme OptaPlusMacOS \
               -configuration Debug \
               -derivedDataPath .build
    echo "✅ macOS built. Run with ⌘R in Xcode."
else
    echo "Usage: build-run.sh [ios|macos]"
fi
```

---

## 3. Testing Workflow

### Unit Tests (Shared)

```swift
// File: Shared/Tests/OptaMoltTests/MessageModelTests.swift
import XCTest
@testable import OptaMolt

final class MessageModelTests: XCTestCase {
    func testMessageCodable() throws {
        let msg = ChatMessage(
            id: "1",
            botId: UUID(),
            role: .user,
            content: "Hello",
            timestamp: Date()
        )
        
        let encoded = try JSONEncoder().encode(msg)
        let decoded = try JSONDecoder().decode(ChatMessage.self, from: encoded)
        
        XCTAssertEqual(msg.id, decoded.id)
        XCTAssertEqual(msg.content, decoded.content)
    }
}
```

**Run:**
```bash
swift test --filter MessageModelTests
```

### UI Tests (Xcode)

```swift
// File: iOS/OptaPlusIOSTests/ChatViewTests.swift
import XCTest

final class ChatViewUITests: XCTestCase {
    func testMessageSendFlow() throws {
        let app = XCUIApplication()
        app.launch()
        
        // Tap message input
        let textInput = app.textFields["message-input"]
        textInput.tap()
        textInput.typeText("Hello bot")
        
        // Tap send
        let sendButton = app.buttons["send-message"]
        sendButton.tap()
        
        // Verify message appears
        let messageLabel = app.staticTexts["Hello bot"]
        XCTAssertTrue(messageLabel.waitForExistence(timeout: 5))
    }
}
```

**Run:** Product > Test (⌘U)

### Manual Testing Checklist

Before every release, manually test:

**Connectivity:**
- [ ] Connect to local gateway (LAN)
- [ ] Connect to manual IP
- [ ] Connect via Cloudflare tunnel
- [ ] Disconnect WiFi, reconnect → auto-reconnect works
- [ ] Restart gateway → OptaPlus reconnects

**Chat:**
- [ ] Send text message → appears immediately
- [ ] Receive streaming response → incremental text display
- [ ] Receive thinking view → toggles correctly
- [ ] Markdown renders (bold, code, lists)
- [ ] Code block has copy button
- [ ] Scroll up in history → loads older messages

**Bots:**
- [ ] Switch bots (iOS: swipe, macOS: ⌘1-6)
- [ ] Each bot has independent message history
- [ ] Status dot updates (online → offline → online)
- [ ] Restart bot → status flickers, reconnects

**Reactions:**
- [ ] Tap 👍 → sends proceed command
- [ ] Tap ❓ → sends explain command
- [ ] All 4 default reactions work
- [ ] Bot responds to reaction (when implemented)

**Cron Jobs:**
- [ ] Create job → appears in list
- [ ] Edit job → changes persist
- [ ] Delete job → gone from list
- [ ] Execute now → runs immediately, shows progress

**iCloud Sync (Requires 2 devices):**
- [ ] Send message on device A
- [ ] Wait 30s
- [ ] Check device B → message appears
- [ ] Edit bot config on A
- [ ] Wait 10s
- [ ] Check B → config updated

**Settings:**
- [ ] Add bot → appears in list
- [ ] Remove bot → gone from list
- [ ] Change notification setting → takes effect
- [ ] Theme change → applies immediately

**Performance:**
- [ ] Startup time < 2s
- [ ] Scroll 100+ messages at 60fps
- [ ] Memory < 250MB (iOS), < 800MB (macOS)
- [ ] No crashes after 1 hour of use

### Performance Profiling

```
Xcode > Product > Profile > [Scheme]
Select: Memory, CPU, Energy, System Trace
Run for 5 minutes
Look for: memory spikes, high CPU, battery drain
```

---

## 4. Git Workflow

### Branch Naming

```
feature/<feature-name>       # New feature
bugfix/<bug-description>     # Bug fix
refactor/<change-area>       # Code cleanup
docs/<doc-name>              # Documentation
perf/<optimization-name>     # Performance work
```

### Examples
```bash
git checkout -b feature/siri-shortcuts
git checkout -b bugfix/websocket-reconnect
git checkout -b docs/keyboard-shortcuts
git checkout -b perf/message-scroll-optimization
```

### Commit Message Format

```
[scope] Title: Description

Optional longer explanation.

Fixes #123 (if issue)
Relates to #456 (if related)

---
Scope: iOS | macOS | shared | docs | ci
Type: feat | fix | refactor | docs | perf | test
```

### Examples
```
[iOS] feat: Add Siri shortcuts for bot commands

- Implement AskBotIntent
- Add SendMessageIntent
- Support voice queries
- Tested on iPhone 16 Pro, iOS 17.1

Fixes #89

---

[macOS] fix: Fix command palette search (fuzzy matching)

Previous: Exact match only
New: Fuzzy matching for command discovery

Matches Raycast behavior.

---

[shared] perf: Optimize message rendering (60fps scroll)

Use List instead of VStack for message cells.
Measure: Before 45fps, after 60fps constant.

Relates to #45
```

### Pull Request Workflow

```
1. Create feature branch
   git checkout -b feature/xyz

2. Make commits
   git commit -m "[scope] type: message"

3. Push to remote
   git push origin feature/xyz

4. Open PR on GitHub/GitLab
   Title: [scope] Feature: description
   Body: What changed? Why? Testing?

5. Code review
   - Check architecture (GUARDRAILS.md)
   - Check tests (section 3)
   - Check performance (PLATFORM.md)
   - Check code style (CLAUDE.md)

6. Approval & merge
   git checkout develop
   git merge feature/xyz
   git push origin develop

7. Delete branch
   git branch -d feature/xyz
   git push origin -d feature/xyz
```

### Branching Model

```
main (production)
  ↑
  └── v1.0 release branch
       ↓
develop (staging)
  ↑
  ├─ feature/siri
  ├─ feature/widgets
  ├─ bugfix/reconnect
  └─ docs/shortcuts
```

---

## 5. How to Add a Feature

### Step 1: Design & Plan
```
1. Create issue: "Feature: [name]"
2. Add to ROADMAP.md (which version?)
3. Estimate effort (hours)
4. Identify data model changes (if any)
5. Check GUARDRAILS.md for conflicts
6. Discuss with Matthew if major
```

### Step 2: Create Feature Branch
```bash
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name
```

### Step 3: Modify Data Models (If Needed)
```swift
// File: Shared/Sources/OptaMolt/Models/ChatMessage.swift
// Or: Create new file in same directory

// Example: Add voice message support
struct ChatMessage: Identifiable, Codable {
    let id: String
    // ... existing fields ...
    var voiceUrl: URL?          // NEW
    var voiceDuration: TimeInterval?  // NEW
}
```

### Step 4: Update Shared Code (OptaMolt)
```swift
// Add networking method
// File: Shared/Sources/OptaMolt/Networking/OpenClawClient.swift

func sendVoiceMessage(_ data: Data, to bot: Bot) async throws {
    let frame = GatewayFrame(
        req: "chat.send",
        params: [
            "session": sessionKey,
            "voiceData": data.base64EncodedString()
        ]
    )
    let response = try await sendAndWait(frame)
    return try response.decode(to: ChatMessage.self)
}
```

### Step 5: Implement Platform UI

**iOS:**
```swift
// File: iOS/OptaPlusIOS/Views/VoiceMessageButton.swift

struct VoiceMessageButton: View {
    @State var isRecording = false
    @State var recordingData: Data?
    
    var body: some View {
        Button(action: toggleRecording) {
            Image(systemName: isRecording ? "mic.fill" : "mic")
        }
        .foregroundColor(isRecording ? .red : .optaPrimary)
    }
    
    func toggleRecording() {
        if isRecording {
            stopRecording()
        } else {
            startRecording()
        }
    }
}
```

**macOS:**
```swift
// File: macOS/OptaPlusMacOS/VoiceMessageButton.swift

// Similar pattern, could share some logic
```

### Step 6: Add Tests

```swift
// File: Shared/Tests/OptaMoltTests/VoiceMessageTests.swift

func testVoiceMessageCodable() throws {
    let msg = ChatMessage(
        id: "1",
        voiceUrl: URL(string: "file:///tmp/voice.m4a"),
        voiceDuration: 5.2
    )
    
    let encoded = try JSONEncoder().encode(msg)
    let decoded = try JSONDecoder().decode(ChatMessage.self, from: encoded)
    XCTAssertEqual(msg.voiceUrl, decoded.voiceUrl)
}
```

### Step 7: Update Documentation

```markdown
# File: docs/DECISIONS.md
## D19: Voice Messages (Date: 2026-03-15)

**Decision:** Support voice message send/receive in OptaPlus.

**Rationale:** Hands-free communication, faster than typing...
```

### Step 8: Test Thoroughly
```
1. Build on both iOS + macOS
2. Test on simulator + real device
3. Run unit tests: swift test
4. Manual test (checklist in section 3)
5. Check memory + performance
6. Review code against GUARDRAILS.md
```

### Step 9: Commit & Push
```bash
git add .
git commit -m "[iOS] feat: Add voice messages

- Record audio via microphone
- Send to bot as voice data
- Display voice playback button
- TTS playback on receive

Relates to #67"

git push origin feature/your-feature-name
```

### Step 10: PR & Code Review
```
1. Open PR on GitHub
2. Assign to Matthew (or team)
3. Address review feedback
4. Approve + merge to develop
5. Delete feature branch
```

### Step 11: Update CHANGELOG.md
```markdown
## [0.10.0] - 2026-03-20

### Added
- Voice messages: send audio via microphone, receive with TTS playback (iOS + macOS)
- Voice message playback controls (play, pause, scrub)
- Voice recording indicator UI

### Fixed
- WebSocket reconnect delay on network toggle
```

---

## 6. How to Add a Bot

### Prerequisites
- New bot must live on a port (e.g., 19010)
- Must implement OpenClaw Gateway Protocol v3
- Must respond to `connect`, `chat.send`, `chat.history`, etc.

### Step 1: Create Bot in Opta CLI
```bash
opta bot create \
  --name my-research-bot \
  --port 19010 \
  --model gpt-4 \
  --skills file,web,code
```

Bot boots, connects to gateway on 19010.

### Step 2: Verify in OptaPlus
```
1. Launch OptaPlus (or already running)
2. OptaPlus polls gateway every 30s
3. New bot appears in bot list automatically
4. User can select bot, start chatting
5. If bot doesn't appear, try "Refresh" or restart OptaPlus
```

### Step 3: Configure Bot (Optional)
```
In OptaPlus settings:
1. Bot List → My-Research-Bot → [gear icon]
2. Edit: Model, temperature, skills, notification settings
3. Save → Updates gateway config

Or via API:
POST http://gateway:18793/config
{
  "botId": "my-research-bot",
  "model": "gpt-4-turbo",
  "temperature": 0.8,
  "skills": ["file", "web"]
}
```

### Step 4: Test Communication
```
1. Open chat with new bot
2. Send test message: "Hello"
3. Bot should respond
4. Check latency, streaming, thinking view
5. Test reactions (👍 ❓ etc.)
6. Test cron job creation
7. Test bot restart from OptaPlus
```

### Step 5: Update Documentation
```markdown
# File: docs/ECOSYSTEM.md

| Port | Bot Name | Purpose | Status |
|------|----------|---------|--------|
| ... | ... | ... | ... |
| 19010 | My-Research-Bot | Research assistance | Active |
```

---

## 7. Clauding Workflow (Using Claude Code)

### Before Each Session

1. **Read context files** (takes 5 min)
   - APP.md (if first time)
   - SHARED.md (if data model changes)
   - `<platform>/PLATFORM.md` (target platform)
   - `<platform>/CLAUDE.md` (coding rules)
   - GUARDRAILS.md (safety rules)

2. **Check issue / feature description**
   - What's the goal?
   - What's in scope?
   - What constraints apply?

### During Coding Session

1. **Plan first** — Write todo.md with steps
2. **Implement shared code first** — Shared/Sources/OptaMolt/
3. **Then platform UI** — iOS or macOS
4. **Tests alongside** — No big gap between implementation & tests
5. **Reference existing code** — Don't invent new patterns

### Example: Add a Feature with Claude Code

```markdown
# Task: Add Voice Messages

## Context Files to Read
1. APP.md (5 min) — Understand product
2. SHARED.md (10 min) — Data models
3. iOS/PLATFORM.md (5 min) — Voice features
4. iOS/CLAUDE.md (10 min) — Code patterns

## Execution Plan (todo.md)
- [ ] 1. Update ChatMessage model (voice fields)
- [ ] 2. Add sendVoiceMessage() to OpenClawClient
- [ ] 3. Implement iOS voice recording UI
- [ ] 4. Add voice playback in message bubble
- [ ] 5. Write unit tests
- [ ] 6. Manual testing on device
- [ ] 7. Update docs/ROADMAP.md

## Safety Checks
- ✅ Zero external dependencies (using AVAudioRecorder)
- ✅ No hardcoded tokens or secrets
- ✅ Gateway protocol v3 maintained
- ✅ Offline-first (cache locally, sync to CloudKit)
```

---

## 8. Deployment Workflow

### Staging (Internal Testing)

```
1. Merge feature to develop
2. Build for testing:
   - iOS: Select simulator or real device
   - macOS: Run on local machine
3. Manual testing (section 3 checklist)
4. Fix bugs, repeat
```

### Release (App Store)

**Before release:**
```
1. Version bump in Xcode
   Target > Build Settings > Version
   Marketing Version: 1.0.0
   Build: 123

2. Update docs
   - CHANGELOG.md
   - Update docs/ROADMAP.md (checked boxes)
   - Update version in PLATFORM.md frontmatter

3. Create release branch
   git checkout -b release/v1.0.0
   git push origin release/v1.0.0

4. Tag release
   git tag -a v1.0.0 -m "OptaPlus v1.0.0 release"
   git push origin v1.0.0
```

**Build for App Store:**
```
Xcode:
1. Product > Archive
2. Select recent archive
3. Validate App
4. Distribute App
5. Choose: App Store Connect
6. Select signing credentials
7. Upload
```

**Monitor App Store Review:**
```
1. Check email for status updates
2. Respond to review feedback immediately
3. Once approved, release to users
4. Monitor crash reports (TestFlight beta)
5. Prepare patch if needed
```

---

## 9. Debug & Troubleshooting

### WebSocket Issues

```swift
// Enable detailed logging
class OpenClawClient {
    func sendFrame(_ frame: GatewayFrame) {
        print("[WS] Sending: \(frame.req)")
        // ... send ...
    }
    
    func didReceiveFrame(_ frame: GatewayFrame) {
        print("[WS] Received: \(frame.req ?? frame.event ?? "unknown")")
        // ... handle ...
    }
}

// Check in debug output
[WS] Sending: connect
[WS] Received: connect (response)
[WS] Received: chat.delta (event)
```

### Memory Leaks

```bash
# Xcode Instruments
Product > Profile > Allocations
Look for: Growing memory without release
Fix: Remove strong reference cycles (delegate, observer)
```

### Crashes

```bash
# Check crash log
~/Library/Logs/DiagnosticMessages/
or
Xcode > Windows > Devices and Simulators
→ Select device → View Device Logs
```

### Slow Startup

```bash
# Measure startup time
Product > Profile > System Trace
Look for: Slow operations on main thread
Async: Heavy loading, CloudKit sync, etc.
```

---

## 10. Checklist Before Merging

```
- [ ] Code builds without warnings
- [ ] All tests pass (swift test)
- [ ] No new dependencies added
- [ ] No hardcoded colors (use design tokens)
- [ ] No UIKit/AppKit wrappers
- [ ] Gateway token never logged
- [ ] Keyboard shortcuts documented (macOS)
- [ ] Accessibility labels added (iOS)
- [ ] Memory usage acceptable
- [ ] Code reviewed against CLAUDE.md checklist
- [ ] Manual testing passed (section 3)
- [ ] Documentation updated (docs/, CHANGELOG.md)
- [ ] Feature branch deleted
```

---

## 11. Release Checklist

Before every release (v0.9.1, v1.0, v1.1, etc.):

```
QA:
- [ ] Tested on iOS 17, iOS 18 (current + latest)
- [ ] Tested on macOS 14, macOS 15 (current + latest)
- [ ] Tested on 3+ physical devices
- [ ] Crash test: 1 hour continuous use
- [ ] Memory profile: < limits (iOS 250MB, macOS 800MB)
- [ ] Performance: latency < 1s, scroll 60fps

Documentation:
- [ ] CHANGELOG.md updated
- [ ] VERSION number bumped
- [ ] README.md reflects current state
- [ ] docs/ROADMAP.md updated (feature complete)
- [ ] GUARDRAILS.md reviewed (no violations)

App Store (v1.0+):
- [ ] Screenshots taken (5.5" display)
- [ ] App preview video (optional but recommended)
- [ ] Privacy policy updated + linked
- [ ] Keywords & category reviewed
- [ ] Rating form (PEGI/ESRB)

Build:
- [ ] Clean build (⌘⇧K, then ⌘B)
- [ ] No build warnings
- [ ] Code signing correct
- [ ] Provisioning profiles valid
- [ ] Archive successful
- [ ] Notarized (macOS) if distributing outside App Store

Final:
- [ ] Reviewed by Matthew
- [ ] Final approval for release
- [ ] Submit to App Store (if applicable)
- [ ] Tag release: git tag v1.0.0
- [ ] Announce release
```

---

## 12. Common Tasks Quick Reference

| Task | Command |
|------|---------|
| Open iOS project | `open iOS/OptaPlusIOS.xcodeproj` |
| Open macOS project | `open macOS/OptaPlusMacOS.xcodeproj` |
| Build shared package | `cd Shared && swift build` |
| Run shared tests | `swift test` |
| Build iOS (Xcode) | ⌘B |
| Run iOS (Xcode) | ⌘R |
| Test iOS (Xcode) | ⌘U |
| Build macOS (Xcode) | ⌘B |
| Run macOS (Xcode) | ⌘R |
| Clean build | ⌘⇧K |
| Show build folder | ⌘⇧C |
| Create feature branch | `git checkout -b feature/name` |
| Commit | `git commit -m "[scope] type: msg"` |
| Push | `git push origin feature/name` |
| Create PR | Open GitHub / GitLab in browser |

---

## Reference

- **GUARDRAILS.md** — Safety rules before shipping
- **CLAUDE.md** (both platforms) — Coding conventions
- **PLATFORM.md** (both platforms) — Feature specifications
- **ROADMAP.md** — What to build next

