# Phase 7: File & Image Sharing

**Launch:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1I-OptaPlus && claude --dangerously-skip-permissions`
**Paste:** `Proceed with the plan located at: /Users/matthewbyrden/Synced/Opta/1-Apps/1I-OptaPlus/tasks/plans/phase-07-file-sharing.md`

---

<context>
Read these files:
1. `CLAUDE.md` — Coding rules
2. `Shared/Sources/OptaMolt/Networking/OpenClawClient.swift` — chatSend already supports `attachments: [ChatSendAttachment]?`
3. `Shared/Sources/OptaMolt/Networking/OpenClawProtocol.swift` — ChatSendAttachment has: filename, mimeType, data (base64)
4. `Shared/Sources/OptaMolt/Chat/MessageBubble.swift` — Current message rendering
5. `macOS/OptaPlusMacOS/ContentView.swift` — macOS chat input area
6. `iOS/OptaPlusIOS/Views/ChatInputBar.swift` — iOS chat input

KEY DISCOVERY: The protocol layer ALREADY supports attachments via `ChatSendAttachment` (base64-encoded). The gateway's `chat.send` accepts an `attachments` array. We just need UI to:
1. Pick/capture files
2. Encode to base64
3. Pass to existing chatSend method
4. Render received attachments in message bubbles
</context>

<instructions>
### 1. Shared: Attachment Model & Utilities (OptaMolt)

Create `Shared/Sources/OptaMolt/Chat/AttachmentManager.swift`:

```swift
import Foundation
#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif
import UniformTypeIdentifiers

public final class AttachmentManager: ObservableObject, @unchecked Sendable {
    @Published public var pendingAttachments: [PendingAttachment] = []
    
    public struct PendingAttachment: Identifiable {
        public let id = UUID()
        public let filename: String
        public let mimeType: String
        public let data: Data
        public let thumbnail: Image?   // Preview for images
        public var sizeString: String { ByteCountFormatter.string(fromByteCount: Int64(data.count), countStyle: .file) }
    }
    
    public func addFile(url: URL) throws { ... }
    public func addImage(_ image: PlatformImage) { ... }
    public func remove(_ id: UUID) { ... }
    public func toAttachments() -> [ChatSendAttachment] { ... }  // Convert to protocol type
    public func clear() { pendingAttachments = [] }
}
```

Utility: MIME type detection from UTType, base64 encoding, thumbnail generation for images.

**Size limit:** 10MB per file (base64 inflates ~33%, gateway WS frame limit). Show error if exceeded.

### 2. macOS: Drag & Drop + Paste + Button

**ContentView.swift / ChatTextInput.swift changes:**

1. **Paste support:** `.onPasteCommand` — detect image on pasteboard, add to AttachmentManager
2. **Drag & drop:** `.onDrop(of: [.fileURL, .image])` on the chat area — add to pending
3. **Attach button:** 📎 button next to send → opens `NSOpenPanel` (multiple selection, images + documents)
4. **Preview strip:** Below text input, show thumbnails of pending attachments with ✕ to remove
5. **Send:** When sending, pass `attachmentManager.toAttachments()` to `chatSend()`

### 3. iOS: Photo Picker + Document Picker + Camera

**ChatInputBar.swift changes:**

1. **Attach button:** 📎 button → action sheet: "Photo Library" / "Take Photo" / "Choose File"
2. **Photo Library:** `PhotosPicker` (PhotosUI framework) — multi-select images
3. **Camera:** `ImagePicker` wrapping UIImagePickerController with .camera source
4. **Documents:** `.fileImporter(isPresented:allowedContentTypes:)` for PDFs, text files
5. **Preview strip:** Horizontal scroll of thumbnails above input bar
6. **Send:** Same as macOS — pass attachments array

### 4. Receiving Attachments in Message Bubbles

**MessageBubble.swift changes:**

Check if incoming messages have attachments (the gateway sends them in chat events). Render:

1. **Images:** Inline preview with tap-to-fullscreen (AsyncImage or decoded base64)
2. **Documents:** File icon + filename + size badge, tap to share/save
3. **Audio:** Waveform placeholder (will be used by voice messages later)

Parse attachments from gateway response — check the `chat` event payload for `attachments` or `media` fields.

### 5. Both Platforms: Clipboard Image Paste

Allow pasting screenshots (⌘V on macOS, paste on iOS):
- Detect image data on clipboard
- Auto-add to pending attachments
- Show preview immediately
</instructions>

<constraints>
- Pure SwiftUI — use PhotosPicker (not UIImagePickerController where possible on iOS 17+)
- For macOS NSOpenPanel: use SwiftUI `.fileImporter()` instead where possible
- Base64 encoding must happen off main thread (`.task {}` or `Task.detached`)
- Max 10MB per attachment, max 5 attachments per message
- Zero external dependencies (no Kingfisher, no SDWebImage)
- Image thumbnails: max 200x200 for preview strip, full size on tap
- Spring physics for preview strip appear/dismiss
</constraints>

<output>
Test checklist:
1. macOS: Drag image onto chat → appears in preview → send → bot receives image
2. macOS: ⌘V paste screenshot → appears in preview → send
3. macOS: 📎 button → file picker → select PDF → send
4. iOS: 📎 → Photo Library → select 2 images → send → bot receives both
5. iOS: 📎 → Take Photo → capture → send
6. iOS: 📎 → Choose File → select PDF → send
7. Received image in bot reply → renders inline, tap to fullscreen
8. Attachment > 10MB → error message shown
9. Both platforms build with 0 errors

When completely finished, run:
```bash
openclaw system event --text "Done: Phase 7 — File & image sharing on both platforms" --mode now
```
</output>
