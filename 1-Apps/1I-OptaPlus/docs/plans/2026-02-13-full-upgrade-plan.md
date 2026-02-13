# OptaPlus Full Upgrade Plan
**Date:** 2026-02-13
**Author:** Claude (Opus 4.6)
**Status:** DRAFT — awaiting Matthew's approval before implementation

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Part A: Bidirectional Telegram Sync](#part-a-bidirectional-telegram-sync)
3. [Part B: UX Improvements](#part-b-ux-improvements)
4. [Architecture Diagrams](#architecture-diagrams)
5. [Dependency Graph](#dependency-graph)
6. [Implementation Order](#implementation-order)
7. [Risk Assessment](#risk-assessment)
8. [Alternatives Considered](#alternatives-considered)

---

## Executive Summary

This plan covers two major feature areas for OptaPlus:

| Area | Components | Est. Hours | Risk |
|------|-----------|-----------|------|
| **A: Telegram Sync** | TDLib auth, send, receive, dedup | 28–36h | HIGH |
| **B1: Shift+Return** | Key modifier handling | 2–3h | LOW |
| **B2: Selectable Text** | Text selection in bubbles | 2–3h | LOW |
| **B3: File Attachments** | Picker, preview, send, display | 14–18h | MEDIUM |
| **B4: Text Alignment** | Setting + layout modes | 3–4h | LOW |
| **Total** | | **49–64h** | |

---

## Part A: Bidirectional Telegram Sync

### A.1 Current Architecture

```
                    ┌─────────────────────┐
                    │   OpenClaw Gateway   │
                    │  192.168.188.167     │
                    │      :18793          │
                    └──────┬──────────────┘
                           │
                    WebSocket (JSON frames)
                           │
                    ┌──────▼──────────────┐
                    │    OptaPlus macOS    │
                    │   OpenClawClient     │
                    │   ChatViewModel      │
                    └─────────────────────┘
```

Messages flow: User types → `ChatViewModel.send()` → `OpenClawClient.chatSend()` → Gateway → Bot processes → `chat.delta`/`chat.final` events → back to OptaPlus.

The `SessionMode.synced` mode already passes `deliver: true` to the gateway, which tells OpenClaw to forward to external channels (including Telegram). **Bot replies already go to Telegram** via the gateway's delivery system. What's missing:

1. **User messages from OptaPlus don't appear in Telegram** (they're sent to gateway, not TG)
2. **Messages sent directly in Telegram don't appear in OptaPlus**

### A.2 Target Architecture

```
                         ┌─────────────────────┐
                         │   OpenClaw Gateway   │
                         │   192.168.188.167    │
                         │       :18793         │
                         └───┬───────────┬──────┘
                             │           │
                    WebSocket│           │ Bot API
                    (events) │           │ (replies)
                             │           │
  ┌──────────────────────────▼───┐   ┌──▼──────────────┐
  │         OptaPlus macOS       │   │   Telegram Bot   │
  │                              │   │   @Opta_Bot      │
  │  ┌────────────────────────┐  │   └──┬───────────────┘
  │  │   OpenClawClient       │  │      │
  │  │   (existing WebSocket) │  │      │ Bot API
  │  └────────────────────────┘  │      │
  │                              │   ┌──▼──────────────┐
  │  ┌────────────────────────┐  │   │  Telegram Cloud  │
  │  │   TelegramSyncManager  │◄─┼───┤  (MTProto)      │
  │  │   (NEW — TDLib client) │──┼──►│                  │
  │  └────────────────────────┘  │   └──────────────────┘
  │                              │
  │  ┌────────────────────────┐  │
  │  │   SyncCoordinator      │  │    Deduplication
  │  │   (NEW — message       │  │    + ID mapping
  │  │    routing & dedup)    │  │    + offline queue
  │  └────────────────────────┘  │
  │                              │
  │  ┌────────────────────────┐  │
  │  │   ChatViewModel        │  │
  │  │   (modified)           │  │
  │  └────────────────────────┘  │
  └──────────────────────────────┘
```

### A.3 Component Breakdown

#### A.3.1 TelegramSyncManager (NEW)
**File:** `Shared/Sources/OptaMolt/Networking/TelegramSyncManager.swift`
**Dependency:** [Swiftgram/TDLibKit](https://github.com/Swiftgram/TDLibKit) via SPM
**Est. Hours:** 12–16h

**Responsibilities:**
- Initialize TDLib client via `TDLibClientManager`
- Handle full authentication flow (phone → code → 2FA → ready)
- Persist auth session via TDLib's internal database (stored in app sandbox)
- Send messages to @Opta_Bot chat as the authenticated user
- Receive all incoming messages from the bot chat
- Expose `@Published` state: `.unauthenticated`, `.awaitingCode`, `.awaitingPassword`, `.ready`

**Authentication Flow:**
```
App Launch
    │
    ▼
TDLibClientManager.createClient()
    │
    ▼
setTdlibParameters(
    apiId: <Telegram API ID>,
    apiHash: <Telegram API Hash>,
    databaseDirectory: appSandbox/tdlib,
    useSecretChats: false,
    systemLanguageCode: "en",
    deviceModel: "Mac" / "iPhone",
    applicationVersion: appVersion
)
    │
    ▼
Check authorizationState via update handler
    │
    ├─► .waitPhoneNumber → UI: show phone input
    │       User enters phone → setAuthenticationPhoneNumber()
    │
    ├─► .waitCode → UI: show code input
    │       User enters code → checkAuthenticationCode()
    │
    ├─► .waitPassword → UI: show 2FA password input
    │       User enters password → checkAuthenticationPassword()
    │
    └─► .ready → Telegram authenticated!
            Find @Opta_Bot chat → store chatId
            Start monitoring updates
```

**Session Persistence:**
- TDLib persists auth state in its database directory automatically
- On relaunch, `authorizationState` will be `.ready` if session is valid
- Store `databaseDirectory` in app container: `FileManager.default.urls(for: .applicationSupportDirectory, ...)/tdlib/`
- API credentials stored in Keychain via `Security` framework

**Key Methods:**
```swift
class TelegramSyncManager: ObservableObject {
    @Published var authState: TelegramAuthState = .uninitialized
    @Published var isReady: Bool = false

    private var clientManager: TDLibClientManager?
    private var client: TDLibClient?
    private var botChatId: Int64?

    func initialize() async
    func setPhoneNumber(_ phone: String) async throws
    func submitCode(_ code: String) async throws
    func submitPassword(_ password: String) async throws
    func sendMessage(_ text: String) async throws -> Int64  // returns TG message ID
    func disconnect() async

    // Callback for incoming messages
    var onBotMessage: ((TelegramIncomingMessage) -> Void)?
    var onUserMessageDelivered: ((Int64) -> Void)?  // message ID confirmed
}
```

**Complexity Notes:**
- TDLibKit downloads ~300MB XCFramework binary — first build will be slow
- TDLib's internal SQLite database handles encryption, session persistence
- Must handle `updateAuthorizationState` in the update handler loop
- Bot chat discovery: `searchPublicChat(username: "Opta_Bot")` → get `chatId`

#### A.3.2 SyncCoordinator (NEW)
**File:** `Shared/Sources/OptaMolt/Networking/SyncCoordinator.swift`
**Est. Hours:** 8–10h

**Responsibilities:**
- Route outgoing messages to both gateway AND Telegram
- Deduplicate incoming messages (same content arriving via WebSocket + TDLib)
- Maintain message ID mapping (gateway idempotencyKey ↔ Telegram messageId)
- Handle offline queue when one channel is disconnected
- Track message source for UI indicators

**Deduplication Strategy:**

The core challenge: When a user sends from OptaPlus, the message goes to the gateway AND TDLib. The gateway may echo it back, and TDLib will confirm delivery. Bot replies come via both channels too.

```
Message Origin Detection:
┌─────────────────────────────────────────────────────┐
│                                                     │
│  User sends from OptaPlus:                          │
│    1. Gateway gets it → shows in chat immediately   │
│    2. TDLib sends to TG → bot receives in TG        │
│    3. Gateway may echo → IGNORE (already shown)     │
│    4. TDLib confirms → Update status indicator       │
│                                                     │
│  User sends from Telegram:                          │
│    1. TDLib receives update → show with "via TG"    │
│    2. Gateway may echo → IGNORE (dedup by content   │
│       hash + timestamp window)                      │
│                                                     │
│  Bot replies:                                       │
│    1. Gateway sends chat.final → show in chat       │
│    2. TDLib receives bot message → IGNORE (dedup)   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Dedup Algorithm:**
```
For each incoming message:
  1. Compute fingerprint = SHA256(sender + content_prefix_100chars + timestamp_rounded_to_5s)
  2. Check fingerprint against seen_messages (LRU cache, 500 entries, 60s TTL)
  3. If fingerprint exists → discard (duplicate)
  4. If new → process and add to cache
```

**ID Mapping Table:**
```swift
struct MessageMapping: Codable {
    let localId: String           // UUID from ChatMessage
    let gatewayKey: String?       // idempotencyKey from OpenClaw
    let telegramId: Int64?        // Telegram message_id
    let source: MessageSource     // .optaplus, .telegram, .bot
    let timestamp: Date
}

enum MessageSource: String, Codable {
    case optaplus    // sent from this app
    case telegram    // received via TDLib (sent from TG client)
    case bot         // bot reply
}
```

**Offline Queue:**
```swift
struct QueuedMessage: Codable {
    let id: UUID
    let text: String
    let targetChannels: Set<Channel>  // .gateway, .telegram
    let createdAt: Date
    let retryCount: Int
}
```
- Persisted to UserDefaults (JSON array, max 100 messages)
- Drained on reconnect in FIFO order
- Retry with exponential backoff (1s, 2s, 4s, max 30s)
- Drop after 24h or 10 retries

#### A.3.3 ChatViewModel Modifications
**File:** `Shared/Sources/OptaMolt/Networking/ChatViewModel.swift`
**Est. Hours:** 4–6h

**Changes Required:**

1. **Add `SyncCoordinator` dependency:**
```swift
private var syncCoordinator: SyncCoordinator?

// In send():
func send(_ text: String) async {
    // Existing gateway send
    let gatewayKey = try await client.chatSend(...)

    // NEW: Also send via Telegram if synced mode
    if activeSession?.mode == .synced, let sync = syncCoordinator {
        sync.sendViaTelegram(text, gatewayKey: gatewayKey)
    }
}
```

2. **Add Telegram message handler:**
```swift
// Called by SyncCoordinator when TG message arrives
func handleTelegramMessage(_ msg: TelegramIncomingMessage) {
    guard syncCoordinator?.shouldProcess(msg) == true else { return }

    let chatMsg = ChatMessage(
        id: UUID().uuidString,
        content: msg.text,
        sender: msg.isBot ? .bot(name: "Opta") : .user,
        timestamp: msg.date,
        status: .delivered
    )
    messages.append(chatMsg)
}
```

3. **Add source indicator to ChatMessage:**
```swift
// In Models.swift
public struct ChatMessage {
    // ... existing fields
    public var source: MessageSource?  // NEW: nil for legacy messages
}
```

#### A.3.4 UI: Telegram Auth View (NEW)
**File:** `macOS/OptaPlusMacOS/TelegramAuthView.swift`
**Est. Hours:** 3–4h

SwiftUI view in Settings for Telegram authentication:

```
┌─────────────────────────────────────┐
│  Telegram Sync                      │
│                                     │
│  Status: ● Connected as +61...      │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ Phone: +61 4XX XXX XXX     │    │  ◄─ Step 1
│  └─────────────────────────────┘    │
│  [Send Code]                        │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ Code: XXXXX                │    │  ◄─ Step 2
│  └─────────────────────────────┘    │
│  [Verify]                           │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ 2FA Password: ••••••       │    │  ◄─ Step 3 (if enabled)
│  └─────────────────────────────┘    │
│  [Submit]                           │
│                                     │
│  [Disconnect Telegram]              │
└─────────────────────────────────────┘
```

States flow: Disconnected → Phone Input → Code Input → (Optional) Password → Connected

#### A.3.5 UI: "via Telegram" Indicator
**File:** `Shared/Sources/OptaMolt/Chat/MessageBubble.swift`
**Est. Hours:** 1h

Add source badge to messages received from Telegram:

```swift
// Inside MessageBubble, below timestamp
if message.source == .telegram {
    HStack(spacing: 3) {
        Image(systemName: "paperplane.fill")
            .font(.system(size: 8))
        Text("via Telegram")
            .font(.system(size: 9, weight: .medium))
    }
    .foregroundStyle(Color.optaTextMuted)
}
```

### A.4 Build System Changes

**Package.swift additions:**
```swift
dependencies: [
    .package(url: "https://github.com/Swiftgram/TDLibKit", from: "1.5.2"),
],
targets: [
    .target(
        name: "OptaMolt",
        dependencies: [
            "OptaPlus",
            .product(name: "TDLibKit", package: "TDLibKit"),
        ]
    ),
]
```

**Impact:**
- Binary size increase: ~30–50MB (TDLib XCFramework)
- First `swift build`: ~5min (downloading 300MB binary)
- Subsequent builds: no impact (binary cached)
- iOS target also gets TDLib (supports iOS 13+)

### A.5 Telegram API Credentials

**Required:** A Telegram API application (api_id + api_hash) from https://my.telegram.org

**Storage:**
- `api_id` and `api_hash` → compiled into the app (these are per-app, not secrets)
- User auth session → TDLib's SQLite database (encrypted, in app sandbox)
- No Keychain needed for TDLib session (it manages its own persistence)

**Matthew's Telegram User ID:** 7799095654
**Bot:** @Opta_Bot

---

## Part B: UX Improvements

### B1: Shift+Return for Newlines

**Est. Hours:** 2–3h
**Risk:** LOW
**Files to modify:**
- `macOS/OptaPlusMacOS/ContentView.swift` (ChatInputBar section, ~line 949–1058)

#### Current Behavior
```swift
TextField("Message…", text: $text, axis: .vertical)
    .lineLimit(1...6)
    .onSubmit { if hasText { triggerSend() } }
```

SwiftUI `TextField` with `.vertical` axis treats Return as submit (via `.onSubmit`). There is **no way** to intercept Shift+Return in a standard SwiftUI TextField — the `.onSubmit` fires for all Return presses regardless of modifiers.

#### Solution: Replace TextField with TextEditor + Custom Key Handling

**Approach A (Recommended): NSViewRepresentable wrapper**

Wrap `NSTextView` to get full key event control:

```swift
struct ChatTextInput: NSViewRepresentable {
    @Binding var text: String
    var onSend: () -> Void

    func makeNSView(context: Context) -> NSScrollView {
        let scrollView = NSTextView.scrollableTextView()
        let textView = scrollView.documentView as! NSTextView
        textView.delegate = context.coordinator
        textView.font = .systemFont(ofSize: 14)
        textView.textColor = NSColor(Color.optaTextPrimary)
        textView.backgroundColor = .clear
        textView.isRichText = false
        textView.drawsBackground = false
        textView.textContainerInset = NSSize(width: 0, height: 4)
        return scrollView
    }

    class Coordinator: NSObject, NSTextViewDelegate {
        var parent: ChatTextInput

        func textView(_ textView: NSTextView, doCommandBy selector: Selector) -> Bool {
            if selector == #selector(NSResponder.insertNewline(_:)) {
                if NSEvent.modifierFlags.contains(.shift) {
                    textView.insertNewlineIgnoringFieldEditor(nil)
                    return true  // handled — newline inserted
                } else {
                    parent.onSend()
                    return true  // handled — send message
                }
            }
            return false
        }
    }
}
```

**Approach B (Simpler but limited): TextEditor with onKeyPress**

For macOS 14+ / iOS 17+, SwiftUI supports `.onKeyPress`:

```swift
TextEditor(text: $text)
    .onKeyPress(.return) {
        if NSEvent.modifierFlags.contains(.shift) {
            return .ignored  // let system insert newline
        }
        triggerSend()
        return .handled
    }
```

**This may not work reliably** because TextEditor's built-in Return behavior can conflict.

**iOS Handling:**

On iOS, hardware keyboards can use the same approach. For the on-screen keyboard:
- Return key already inserts a newline in TextEditor
- Add a dedicated Send button (already exists)
- No Shift+Return needed on touchscreen

**Recommendation:** Use **Approach A** (NSViewRepresentable) for macOS. For iOS, keep TextEditor with send button — the Return key behavior is naturally "newline" on iOS virtual keyboard.

#### Changes Required

1. Create `ChatTextInput.swift` (NSViewRepresentable, ~80 lines)
2. Replace `TextField(...)` in ChatInputBar with `ChatTextInput(...)`
3. Forward `@FocusState` to the NSTextView (via `makeFirstResponder`)
4. Preserve auto-growing behavior (observe text height, cap at 6 lines)
5. Style to match existing: `.textFieldStyle(.plain)`, optaTextPrimary, 14pt

### B2: Selectable & Copyable Text in Chat Bubbles

**Est. Hours:** 2–3h
**Risk:** LOW
**Files to modify:**
- `Shared/Sources/OptaMolt/Chat/MessageBubble.swift`
- `Shared/Sources/OptaMolt/Chat/MarkdownContent.swift`
- `Shared/Sources/OptaMolt/Chat/CodeBlockView.swift`

#### Current Behavior

`MarkdownContent` renders `Text(AttributedString(markdown:...))` which is **not selectable by default** in SwiftUI. The `Text` view ignores `.textSelection(.enabled)` in some configurations.

#### Solution

**Step 1: Enable text selection on the message content**

```swift
// In MessageBubble body, wrap content:
MarkdownContent(text: message.content)
    .textSelection(.enabled)  // macOS 13+ / iOS 16.4+
```

This enables native text selection with drag-to-select on macOS and long-press on iOS.

**Step 2: Add copy button to each message bubble**

```swift
// In MessageBubble, add context menu
.contextMenu {
    Button {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(message.content, forType: .string)
    } label: {
        Label("Copy Message", systemImage: "doc.on.doc")
    }

    Button {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(message.content, forType: .string)
    } label: {
        Label("Copy as Markdown", systemImage: "text.quote")
    }
}
```

**Step 3: Code block copy button**

Already partially exists in `CodeBlockView`. Ensure the copy button works:

```swift
// In CodeBlockView header
Button {
    #if os(macOS)
    NSPasteboard.general.clearContents()
    NSPasteboard.general.setString(code, forType: .string)
    #else
    UIPasteboard.general.string = code
    #endif
} label: {
    Image(systemName: "doc.on.doc")
}
```

**Step 4: Ensure selection works across full bubble width**

The current `MessageBubble` constrains width to 65%/75% of parent. Text selection must work within these bounds:

```swift
// Ensure the Text view fills the bubble width
MarkdownContent(text: message.content)
    .textSelection(.enabled)
    .frame(maxWidth: .infinity, alignment: .leading)
```

#### Platform Differences
- **macOS:** Click-drag to select, Cmd+C to copy
- **iOS:** Long-press to select, tap "Copy" in context menu
- Both: Context menu (right-click / long-press) for "Copy Message"

### B3: File & Image Attachments

**Est. Hours:** 14–18h
**Risk:** MEDIUM
**Files to modify/create:**
- `Shared/Sources/OptaMolt/Chat/Models.swift` (attachment model)
- `Shared/Sources/OptaMolt/Chat/AttachmentPicker.swift` (NEW)
- `Shared/Sources/OptaMolt/Chat/AttachmentPreview.swift` (NEW)
- `Shared/Sources/OptaMolt/Chat/InlineAttachmentView.swift` (NEW)
- `Shared/Sources/OptaMolt/Networking/OpenClawClient.swift` (binary upload)
- `Shared/Sources/OptaMolt/Chat/MessageBubble.swift` (inline display)
- `macOS/OptaPlusMacOS/ContentView.swift` (input bar + drop zone)

#### B3.1 Data Model

```swift
// In Models.swift
public struct ChatAttachment: Identifiable, Equatable, Sendable {
    public let id: String
    public let filename: String
    public let mimeType: String
    public let sizeBytes: Int
    public let data: Data           // Raw file data
    public let thumbnail: Data?     // JPEG thumbnail for preview (max 200x200)

    public var isImage: Bool { mimeType.hasPrefix("image/") }
    public var isVideo: Bool { mimeType.hasPrefix("video/") }
    public var isAudio: Bool { mimeType.hasPrefix("audio/") }
    public var formattedSize: String { ByteCountFormatter.string(fromByteCount: Int64(sizeBytes), countStyle: .file) }
}

// Extend ChatMessage:
public struct ChatMessage {
    // ... existing fields
    public var attachments: [ChatAttachment]  // NEW, default []
}
```

#### B3.2 AttachmentPicker (NEW)

**File:** `Shared/Sources/OptaMolt/Chat/AttachmentPicker.swift` (~150 lines)

```swift
struct AttachmentPicker: View {
    @Binding var selectedAttachments: [ChatAttachment]
    @State private var showImagePicker = false
    @State private var showFilePicker = false

    var body: some View {
        Menu {
            Button("Photo Library", systemImage: "photo.on.rectangle") {
                showImagePicker = true
            }
            Button("Document", systemImage: "doc") {
                showFilePicker = true
            }
            Button("Camera", systemImage: "camera") {
                // iOS only
            }
        } label: {
            Image(systemName: "paperclip")
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(Color.optaTextSecondary)
        }
        #if os(macOS)
        .fileImporter(
            isPresented: $showFilePicker,
            allowedContentTypes: [.image, .pdf, .plainText, .data],
            allowsMultipleSelection: true
        ) { result in
            handleFileSelection(result)
        }
        #else
        .photosPicker(isPresented: $showImagePicker, selection: $imageSelection)
        .fileImporter(isPresented: $showFilePicker, ...)
        #endif
    }
}
```

**Supported types:**
| Type | Extensions | Max Size | Preview |
|------|-----------|----------|---------|
| Images | jpg, png, gif, webp, heic | 10MB | Thumbnail |
| Documents | pdf, txt, md, json | 5MB | Icon + name |
| Video | mp4, mov | 50MB | Thumbnail + duration |
| Audio | mp3, m4a, wav | 20MB | Waveform icon |

#### B3.3 AttachmentPreview (NEW)

**File:** `Shared/Sources/OptaMolt/Chat/AttachmentPreview.swift` (~100 lines)

Thumbnails shown above the input bar before sending:

```
┌─────────────────────────────────────────────┐
│ ┌─────┐ ┌─────┐ ┌──────────────────┐       │
│ │ IMG │ │ IMG │ │ 📄 report.pdf    │       │
│ │ ✕   │ │ ✕   │ │    245 KB    ✕   │       │
│ └─────┘ └─────┘ └──────────────────┘       │
├─────────────────────────────────────────────┤
│ 📎 │ Message…                    │ ▲ Send  │
└─────────────────────────────────────────────┘
```

- Image attachments: 60x60 rounded thumbnails
- Document attachments: icon + filename + size
- Each has an ✕ button to remove
- Horizontal scroll if >3 attachments

#### B3.4 Drag & Drop (macOS)

**File:** `macOS/OptaPlusMacOS/ContentView.swift`

```swift
// On the ChatContainerView or the entire window:
.onDrop(of: [.image, .pdf, .fileURL], isTargeted: $isDragTarget) { providers in
    for provider in providers {
        provider.loadFileRepresentation(for: .data) { url, error in
            guard let url else { return }
            let data = try? Data(contentsOf: url)
            let attachment = ChatAttachment(
                filename: url.lastPathComponent,
                mimeType: UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream",
                data: data ?? Data()
            )
            selectedAttachments.append(attachment)
        }
    }
    return true
}

// Visual indicator when dragging:
.overlay {
    if isDragTarget {
        RoundedRectangle(cornerRadius: 16)
            .stroke(Color.optaPrimary, lineWidth: 2)
            .background(.ultraThinMaterial.opacity(0.3))
            .overlay {
                VStack {
                    Image(systemName: "arrow.down.doc")
                        .font(.system(size: 32))
                    Text("Drop files here")
                }
                .foregroundStyle(Color.optaPrimary)
            }
    }
}
```

#### B3.5 Sending Attachments via WebSocket

**File:** `Shared/Sources/OptaMolt/Networking/OpenClawClient.swift`

The OpenClaw gateway protocol needs to support file uploads. Two approaches:

**Approach A: Base64 in JSON frame (simple, size-limited)**
```json
{
    "method": "chat.send",
    "params": {
        "session_key": "main",
        "message": "Check this out",
        "attachments": [
            {
                "filename": "photo.jpg",
                "mime_type": "image/jpeg",
                "data": "<base64-encoded>"
            }
        ]
    }
}
```

**Approach B: Multipart HTTP upload to gateway REST endpoint (for large files)**
```
POST http://192.168.188.167:18793/upload
Content-Type: multipart/form-data
```

**Recommendation:** Start with **Approach A** (base64). Gateway likely needs modification to support either approach — this is a gateway-side dependency. For files >5MB, implement Approach B later.

**IMPORTANT: Gateway protocol discovery needed.** Before implementation, verify what the OpenClaw gateway actually supports for file uploads. This may require changes on the gateway side.

#### B3.6 Displaying Attachments in Chat Bubbles

**File:** `Shared/Sources/OptaMolt/Chat/MessageBubble.swift`

```swift
// Inside MessageBubble, after MarkdownContent:
if !message.attachments.isEmpty {
    VStack(spacing: 8) {
        ForEach(message.attachments) { attachment in
            InlineAttachmentView(attachment: attachment)
        }
    }
}
```

**InlineAttachmentView renders:**
- **Images:** Rounded rectangle, max 300px wide, tap to open full-size
- **PDFs:** Icon + filename + "Open" button
- **Videos:** Thumbnail + play button overlay
- **Audio:** Mini player (play/pause + waveform)

#### B3.7 Paste Support

Intercept paste in the text input to detect images:

```swift
// In ChatTextInput (NSViewRepresentable):
override func paste(_ sender: Any?) {
    if let image = NSPasteboard.general.readObjects(forClasses: [NSImage.self])?.first as? NSImage {
        let data = image.tiffRepresentation
        let attachment = ChatAttachment(filename: "pasted-image.png", ...)
        parent.onAttachmentPasted(attachment)
    } else {
        super.paste(sender)  // normal text paste
    }
}
```

### B4: Text Alignment Customization

**Est. Hours:** 3–4h
**Risk:** LOW
**Files to modify:**
- `Shared/Sources/OptaMolt/Chat/MessageBubble.swift`
- `Shared/Sources/OptaMolt/Chat/MarkdownContent.swift`
- `macOS/OptaPlusMacOS/ContentView.swift` (settings)

#### Current Issue

Messages are centered as bubbles (both user and bot bubbles float in the center, not left/right aligned). But **within** each bubble, text fills left-to-right. The user wants text to grow symmetrically from the center of the bubble.

#### Text Alignment Modes

```swift
// New enum
public enum MessageTextAlignment: String, CaseIterable, Codable {
    case centeredExpanding  // text centered within bubble, grows outward
    case leftAligned        // standard LTR (current)
    case rightAligned       // RTL or preference
}
```

**Storage:**
```swift
@AppStorage("messageTextAlignment") var textAlignment: MessageTextAlignment = .centeredExpanding
```

#### Implementation

**Centered Expanding:**
```swift
// In MessageBubble:
MarkdownContent(text: message.content)
    .multilineTextAlignment(
        switch textAlignment {
        case .centeredExpanding: .center
        case .leftAligned: .leading
        case .rightAligned: .trailing
        }
    )
    .frame(maxWidth: maxBubbleWidth)
```

The `.multilineTextAlignment(.center)` modifier makes text center within its frame. Combined with the existing bubble width calculation that sizes based on content, this creates the "centered expanding" effect — short messages center in a small bubble, long messages fill the bubble width.

**Settings UI:**
```swift
// In SettingsView or inline in ContentView
Picker("Text Alignment", selection: $textAlignment) {
    Label("Centered", systemImage: "text.aligncenter")
        .tag(MessageTextAlignment.centeredExpanding)
    Label("Left", systemImage: "text.alignleft")
        .tag(MessageTextAlignment.leftAligned)
    Label("Right", systemImage: "text.alignright")
        .tag(MessageTextAlignment.rightAligned)
}
.pickerStyle(.segmented)
```

#### Bubble Width Adjustment for Centered Mode

Currently, bubble width is calculated based on content length. For centered-expanding to look good, the bubble should shrink-wrap more tightly:

```swift
// Current: maxWidth is 65%/75% of parent
// For centered mode: Use .fixedSize(horizontal: false, vertical: true)
// to let the bubble shrink to content width

if textAlignment == .centeredExpanding {
    content
        .fixedSize(horizontal: false, vertical: true)
        .frame(maxWidth: maxBubbleWidth)
} else {
    content
        .frame(maxWidth: maxBubbleWidth, alignment: textAlignment.frameAlignment)
}
```

---

## Architecture Diagrams

### Full Message Flow (Post-Upgrade)

```
┌──────────────────────────────────────────────────────────────────┐
│                        OptaPlus macOS                            │
│                                                                  │
│  ┌─────────────┐   ┌──────────────────┐   ┌──────────────────┐  │
│  │ ChatInputBar│──►│  ChatViewModel   │──►│ SyncCoordinator  │  │
│  │ + Attach btn│   │  .send()         │   │                  │  │
│  │ + Drag/Drop │   │  .handleEvent()  │   │  Dedup engine    │  │
│  └─────────────┘   │  .handleTGMsg()  │   │  ID mapping      │  │
│        │           └────────┬─────────┘   │  Offline queue   │  │
│        │                    │             └───────┬──────────┘  │
│        ▼                    │                     │              │
│  ┌─────────────┐           │              ┌──────▼──────────┐  │
│  │ Attachment   │           │              │                 │  │
│  │ Preview      │           │         ┌────┤  OpenClawClient │  │
│  └─────────────┘           │         │    │  (WebSocket)    │  │
│                            │         │    └─────────────────┘  │
│  ┌─────────────┐           │         │                         │
│  │ MessageList  │◄──────────┘         │    ┌─────────────────┐  │
│  │ + Bubbles    │                    │    │ TelegramSync    │  │
│  │ + Selection  │                    │    │ Manager (TDLib) │  │
│  │ + Inline     │                    │    └────────┬────────┘  │
│  │   Attach     │                    │             │            │
│  └─────────────┘                    │             │            │
│                                      │             │            │
└──────────────────────────────────────┼─────────────┼────────────┘
                                       │             │
                              WebSocket│             │ MTProto
                                       │             │
                              ┌────────▼─────┐  ┌───▼────────────┐
                              │  OpenClaw    │  │  Telegram      │
                              │  Gateway     │  │  Cloud          │
                              │  :18793      │  │                │
                              └──────┬───────┘  └───┬────────────┘
                                     │              │
                                     │   Bot API    │
                                     └──────┬───────┘
                                            │
                                     ┌──────▼───────┐
                                     │  @Opta_Bot   │
                                     └──────────────┘
```

### File Structure After Changes

```
Shared/Sources/OptaMolt/
├── Chat/
│   ├── Models.swift                    ◄─ ADD: ChatAttachment, MessageSource, MessageTextAlignment
│   ├── MessageBubble.swift             ◄─ MOD: source indicator, inline attachments, text alignment
│   ├── MarkdownContent.swift           ◄─ MOD: text selection support
│   ├── CodeBlockView.swift             ◄─ MOD: copy button fix
│   ├── AttachmentPicker.swift          ◄─ NEW
│   ├── AttachmentPreview.swift         ◄─ NEW
│   └── InlineAttachmentView.swift      ◄─ NEW
│
├── Networking/
│   ├── ChatViewModel.swift             ◄─ MOD: SyncCoordinator integration
│   ├── OpenClawClient.swift            ◄─ MOD: attachment upload support
│   ├── OpenClawProtocol.swift          (unchanged)
│   ├── TelegramSyncManager.swift       ◄─ NEW
│   └── SyncCoordinator.swift           ◄─ NEW
│
└── DesignSystem/                       (unchanged)

macOS/OptaPlusMacOS/
├── OptaPlusMacOSApp.swift              ◄─ MOD: TelegramSyncManager initialization
├── ContentView.swift                   ◄─ MOD: ChatTextInput, drag/drop, settings
├── ChatTextInput.swift                 ◄─ NEW (NSViewRepresentable)
└── TelegramAuthView.swift              ◄─ NEW
```

---

## Dependency Graph

```
                    ┌──────────────────┐
                    │  Package.swift   │
                    │  + TDLibKit dep  │
                    └────────┬─────────┘
                             │ blocks everything
                             ▼
                    ┌──────────────────┐
                    │ B1: Shift+Return │──────────────────┐
                    │ ChatTextInput    │                  │
                    └──────────────────┘                  │
                                                         │
┌──────────────────┐                    ┌────────────────▼────┐
│ B2: Selectable   │                    │ B3: Attachments     │
│ Text (standalone)│                    │ (needs ChatTextInput│
└──────────────────┘                    │  for paste support) │
                                        └─────────────────────┘
┌──────────────────┐
│ B4: Alignment    │
│ (standalone)     │
└──────────────────┘

┌──────────────────┐   ┌────────────────────┐   ┌──────────────────┐
│ A.3.1 TDLib      │──►│ A.3.2 SyncCoord    │──►│ A.3.3 ViewModel  │
│ TelegramSync     │   │ (needs TDLib +     │   │ modifications    │
│ Manager          │   │  OpenClaw working) │   │ (needs SyncCoord)│
└──────────────────┘   └────────────────────┘   └──────────────────┘
         │                                               │
         ▼                                               ▼
┌──────────────────┐                    ┌──────────────────────────┐
│ A.3.4 Auth UI    │                    │ A.3.5 "via TG" indicator │
│ (needs TDLib)    │                    │ (needs ViewModel mods)   │
└──────────────────┘                    └──────────────────────────┘
```

**Key dependency:** TDLibKit in Package.swift must land first. All Part A work depends on it.
**No cross-dependency:** Part B items are independent of Part A (except B3 paste benefits from B1's ChatTextInput).

---

## Implementation Order

### Phase 1: Quick Wins (B1, B2, B4) — 7–10h
*Zero dependencies, immediate user-facing improvements*

| Order | Component | Hours | Depends On |
|-------|-----------|-------|------------|
| 1.1 | **B4: Text Alignment** — add `MessageTextAlignment` enum, `@AppStorage`, modify `MessageBubble` and `MarkdownContent` | 3–4h | Nothing |
| 1.2 | **B2: Selectable Text** — add `.textSelection(.enabled)`, context menus, code block copy | 2–3h | Nothing |
| 1.3 | **B1: Shift+Return** — create `ChatTextInput` (NSViewRepresentable), replace TextField | 2–3h | Nothing |

### Phase 2: Attachments (B3) — 14–18h
*Depends on B1's ChatTextInput for paste support*

| Order | Component | Hours | Depends On |
|-------|-----------|-------|------------|
| 2.1 | **B3.1: Data model** — `ChatAttachment`, extend `ChatMessage` | 1h | Nothing |
| 2.2 | **B3.2: AttachmentPicker** — menu button, file importer, photos picker | 3–4h | 2.1 |
| 2.3 | **B3.3: AttachmentPreview** — thumbnail strip above input | 2–3h | 2.1 |
| 2.4 | **B3.4: Drag & Drop** — `onDrop` modifier on chat view | 2h | 2.1 |
| 2.5 | **B3.5: Send via WebSocket** — base64 encoding, protocol extension | 2–3h | 2.1 + gateway support |
| 2.6 | **B3.6: Inline display** — `InlineAttachmentView` in bubbles | 2–3h | 2.1 |
| 2.7 | **B3.7: Paste support** — image paste interception | 1–2h | 1.3 (ChatTextInput) |

### Phase 3: Telegram Sync (Part A) — 28–36h
*Most complex, highest risk, requires external dependency*

| Order | Component | Hours | Depends On |
|-------|-----------|-------|------------|
| 3.0 | **Package.swift** — add TDLibKit dependency | 0.5h | Nothing |
| 3.1 | **A.3.1: TelegramSyncManager** — TDLib init, auth flow, send/receive | 12–16h | 3.0 |
| 3.2 | **A.3.4: TelegramAuthView** — SwiftUI auth UI in Settings | 3–4h | 3.1 |
| 3.3 | **A.3.2: SyncCoordinator** — dedup engine, ID mapping, offline queue | 8–10h | 3.1 |
| 3.4 | **A.3.3: ChatViewModel mods** — integrate SyncCoordinator | 4–6h | 3.3 |
| 3.5 | **A.3.5: "via Telegram" badge** — source indicator in bubbles | 1h | 3.4 |

---

## Risk Assessment

### HIGH Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| **TDLibKit binary compatibility** — TDLib XCFramework may not build on latest Xcode/macOS | Blocks all Telegram work | Pin to known-good release (1.5.2). Test build early. Have fallback to `tdlib-spm` package. |
| **TDLib auth complexity** — 2FA, flood waits, session expiry edge cases | Auth flow breaks or user gets locked out | Implement comprehensive error handling. Show raw TDLib error messages. Add "Reset Session" button. |
| **Deduplication accuracy** — content-hash + timestamp window may miss or false-positive | Duplicate messages or missing messages | Start with conservative 5s window. Add manual "refresh" button. Log all dedup decisions for debugging. |
| **Gateway attachment protocol** — OpenClaw may not support file uploads in current version | Attachment send is dead-on-arrival | Verify gateway capabilities BEFORE building. May need gateway-side changes. Start with display-only. |

### MEDIUM Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Binary size increase** — TDLib adds ~30-50MB | App bundle significantly larger | Acceptable for macOS. For iOS, consider making Telegram sync optional (feature flag). |
| **NSViewRepresentable complexity** — text input wrapping is notoriously finicky | Keyboard shortcuts, focus, IME may break | Extensive testing. Keep fallback to TextEditor. Test CJK input. |
| **Offline queue reliability** — UserDefaults may lose queued messages | Messages lost during app crash | Consider using FileManager for queue persistence. Keep queue small (<100). |

### LOW Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Text selection conflicts** — `.textSelection(.enabled)` may interfere with scroll gestures | Hard to scroll on iOS | Test on device. `.textSelection(.enabled)` is well-supported on macOS 13+/iOS 16.4+. |
| **Text alignment visual issues** — centered text may look odd with code blocks | Aesthetic issue | Only apply alignment to plain text paragraphs, not code blocks or tables. |

---

## Alternatives Considered

### Telegram Integration

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **TDLibKit (chosen)** | Full Telegram client, SPM native, async/await, session persistence | Large binary (~300MB download), complex auth | **Best option** — only way to send AS the user |
| **Telegram Bot API only** | Simple HTTP, no binary dependency | Can't send as user, only as bot | Doesn't solve the problem |
| **Pyrogram/Telethon bridge** | Python ecosystem, well-documented | Requires Python runtime, adds IPC complexity | Over-engineered for this use case |
| **Gateway-side integration** | All logic server-side, thin client | Requires gateway modifications, less control | Could complement TDLib, not replace |
| **MTProto from scratch** | No dependency | Months of work, protocol is complex | Not viable |

### Text Input

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **NSViewRepresentable (chosen)** | Full key event control, proper IME | Platform-specific code | **Best for macOS** |
| **TextEditor + onKeyPress** | Pure SwiftUI | Unreliable Return key interception | Fallback option |
| **SwiftUI TextField (current)** | Simple | Can't differentiate Shift+Return | Status quo (broken) |

### File Uploads

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Base64 in JSON (chosen first)** | Simple, no gateway changes needed | Size limited (~5MB practical), 33% overhead | **Start here** |
| **Multipart HTTP** | Efficient for large files | Requires REST endpoint on gateway | Phase 2 upgrade |
| **Chunked WebSocket binary** | Streaming support | Complex protocol, both sides need changes | Over-engineered |

---

## Pre-Implementation Checklist

Before starting any work:

- [ ] **Verify TDLibKit builds** — `swift build` with TDLibKit dependency on current Xcode
- [ ] **Get Telegram API credentials** — Register app at https://my.telegram.org
- [ ] **Verify gateway attachment support** — Check if OpenClaw accepts file uploads
- [ ] **Test TDLib auth flow** — Standalone proof-of-concept before integrating
- [ ] **Confirm @Opta_Bot chat discovery** — Ensure `searchPublicChat("Opta_Bot")` works
- [ ] **Back up current working state** — Git commit before any changes

---

## Estimated Total

| Phase | Hours | Calendar Days (3h/day) |
|-------|-------|----------------------|
| Phase 1: Quick Wins | 7–10h | 3–4 days |
| Phase 2: Attachments | 14–18h | 5–6 days |
| Phase 3: Telegram Sync | 28–36h | 10–12 days |
| **Total** | **49–64h** | **~18–22 working days** |

---

*Plan generated 2026-02-13. Review and approve before implementation begins.*
