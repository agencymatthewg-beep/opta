# Phase 13: App Store Preparation

**Launch:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1I-OptaPlus && claude --dangerously-skip-permissions`
**Paste:** `Proceed with the plan located at: /Users/matthewbyrden/Synced/Opta/1-Apps/1I-OptaPlus/tasks/plans/phase-13-app-store.md`

**Depends on:** All previous phases (5-12) should be complete.

---

<context>
Read these files:
1. `CLAUDE.md` — Coding rules
2. `APP.md` — Product identity, pricing (free v1.0)
3. `DESIGN-BRIEF.md` — Visual identity, Cinematic Void theme
4. `macOS/OptaPlusMacOS.xcodeproj/project.pbxproj` — macOS project
5. `iOS/OptaPlusIOS.xcodeproj/project.pbxproj` — iOS project

App Store requirements:
- Bundle ID, version, build number
- App icons (all sizes)
- Screenshots
- Privacy policy URL
- App description and keywords
- Entitlements and capabilities
</context>

<instructions>
### 1. Xcode Project Configuration

**Both targets:**
- Bundle ID: `com.opta.plus.macos` / `com.opta.plus.ios`
- Display name: "OptaPlus"
- Version: `1.0.0`
- Build: `1`
- Deployment target: macOS 14.0 / iOS 17.0
- Category: Productivity (macOS), Utilities (iOS)

**Entitlements (macOS):**
```xml
<key>com.apple.security.network.client</key><true/>
<key>com.apple.security.files.user-selected.read-write</key><true/>
<key>com.apple.security.device.audio-input</key><true/>
```

**Entitlements (iOS):**
```xml
<key>NSMicrophoneUsageDescription</key>
<string>OptaPlus uses the microphone to record voice messages for your AI bots.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>OptaPlus accesses your photo library to share images with your AI bots.</string>
<key>NSCameraUsageDescription</key>
<string>OptaPlus uses the camera to capture images to share with your AI bots.</string>
```

### 2. App Icon

Generate app icon set from the Opta "O" ring logo with orange glow:

Create `AppIcon.appiconset` for both targets:
- macOS: 16, 32, 64, 128, 256, 512, 1024 (each @1x and @2x)
- iOS: 60@2x, 60@3x, 76@2x, 83.5@2x, 1024

**If no icon assets exist yet:** Create a placeholder using SF Symbols:
- Background: `#050505` (Cinematic Void black)
- Foreground: Orange (#F97316) "O" shape or `bolt.fill` symbol
- This is a PLACEHOLDER — Matthew will provide final artwork

### 3. Launch Screen

**iOS:** Create `LaunchScreen.storyboard` or SwiftUI launch:
- Background: `#050505`
- Center: OptaPlus logo (or "O" glyph)
- Subtle violet glow animation (if SwiftUI launch)

**macOS:** The existing LoadingSplash.swift should serve as launch experience.

### 4. Privacy Policy

Create `docs/PRIVACY-POLICY.md` (will be hosted at optamize.biz/privacy):

```markdown
# OptaPlus Privacy Policy

**Effective:** [date]

OptaPlus connects to OpenClaw gateways that YOU control. 

## Data Collection
- OptaPlus does NOT collect any personal data
- All messages are sent directly to your self-hosted gateway
- No analytics, no tracking, no telemetry
- Voice recordings are sent only to your gateway, never stored by us
- Images/files are sent only to your gateway

## Data Storage
- Message history is cached locally on your device
- Gateway connection details (host, port, token) are stored in your device keychain
- No data is sent to Opta Operations or any third party

## Contact
matthew@optamize.biz
```

### 5. App Store Metadata

Create `docs/APP-STORE.md`:

```markdown
# App Store Listing

## Name
OptaPlus

## Subtitle
AI Bot Chat Client

## Description
OptaPlus is a native chat client for OpenClaw AI bots. Connect to your self-hosted AI assistants with a beautiful, fast interface designed for power users.

Features:
• Chat with multiple AI bots simultaneously
• Multi-window support (macOS)
• Smart reactions — react to messages with bot commands
• File & image sharing
• Voice messages
• Message search across all conversations
• Bot management — change models, view health, restart
• Cron job creation and management
• Offline message queuing
• Cross-bot @mention handoff
• Beautiful markdown rendering with syntax highlighting

Built for Apple Silicon. Zero tracking. Your data stays on your devices.

## Keywords
AI, chat, bot, assistant, OpenClaw, automation, productivity

## Category
macOS: Productivity
iOS: Utilities

## Price
Free

## Privacy URL
https://optamize.biz/privacy
```

### 6. Build Verification

Final checks before submission:
1. `xcodebuild -scheme OptaPlusMacOS -configuration Release build` — must succeed
2. `xcodebuild -scheme OptaPlusIOS -configuration Release -sdk iphoneos build` — must succeed
3. No warnings (treat warnings as errors)
4. Test on macOS 14 + iOS 17 minimum targets
5. Archive builds for both platforms

### 7. Screenshots (Placeholder Instructions)

Create `docs/SCREENSHOTS.md` with instructions for capturing:
- macOS: 1 main chat, 1 multi-window, 1 bot management, 1 automations, 1 search
- iOS: 1 chat, 1 dashboard, 1 automations, 1 settings, 1 bot management

Note which screens to capture — Matthew will take actual screenshots.
</instructions>

<constraints>
- Must pass App Store review guidelines
- Privacy policy is REQUIRED
- No private APIs
- All entitlements must be justified
- Icon must not be blank/placeholder for submission (but OK for now)
- Both platforms must archive successfully
- Minimum deployment: macOS 14.0, iOS 17.0
</constraints>

<output>
Deliverables:
1. Xcode projects configured (bundle ID, version, entitlements)
2. Info.plist usage descriptions (mic, photos, camera)
3. Placeholder app icons in asset catalogs
4. docs/PRIVACY-POLICY.md
5. docs/APP-STORE.md
6. docs/SCREENSHOTS.md
7. Both platforms build Release with 0 errors, 0 warnings

When completely finished, run:
```bash
openclaw system event --text "Done: Phase 13 — App Store preparation complete for both platforms" --mode now
```
</output>
