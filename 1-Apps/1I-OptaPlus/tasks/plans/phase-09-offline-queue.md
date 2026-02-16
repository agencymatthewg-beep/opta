# Phase 9: Offline Message Queue

**Launch:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1I-OptaPlus && claude --dangerously-skip-permissions`
**Paste:** `Proceed with the plan located at: /Users/matthewbyrden/Synced/Opta/1-Apps/1I-OptaPlus/tasks/plans/phase-09-offline-queue.md`

---

<context>
Read these files:
1. `CLAUDE.md` — Coding rules
2. `Shared/Sources/OptaMolt/Networking/OpenClawClient.swift` — WebSocket connection, chatSend
3. `Shared/Sources/OptaMolt/Networking/ChatViewModel.swift` — Message sending logic
4. `Shared/Sources/OptaMolt/Networking/BotHealth.swift` — Connection state tracking

Currently: if the gateway is unreachable, messages fail silently or show an error. The user has to manually retry. This phase adds a queue that holds messages and sends them when reconnected.
</context>

<instructions>
### 1. MessageQueue (Shared/OptaMolt)

Create `Shared/Sources/OptaMolt/Networking/MessageQueue.swift`:

```swift
public actor MessageQueue {
    public struct QueuedMessage: Codable, Identifiable {
        public let id: UUID
        public let sessionKey: String
        public let message: String
        public let attachments: [ChatSendAttachment]?
        public let queuedAt: Date
        public var attempts: Int = 0
        public var lastError: String?
    }
    
    private var queue: [QueuedMessage] = []
    private let maxRetries = 3
    private let persistPath: URL  // ~/Library/Application Support/OptaPlus/message-queue.json
    
    public func enqueue(_ msg: QueuedMessage)
    public func dequeueAll() -> [QueuedMessage]
    public func remove(id: UUID)
    public var count: Int { queue.count }
    public var isEmpty: Bool { queue.isEmpty }
    
    // Persistence
    public func save() async throws   // Write to disk
    public func load() async throws   // Read from disk on launch
    
    // Flush
    public func flush(using client: OpenClawClient) async {
        // Send all queued messages in order
        // On success: remove from queue
        // On failure: increment attempts, keep in queue
        // After maxRetries: mark as failed, keep but don't retry
    }
}
```

### 2. Integration with ChatViewModel

Modify `ChatViewModel.swift`:

```swift
func sendMessage(_ text: String, attachments: [ChatSendAttachment]? = nil) async {
    // Try to send immediately
    do {
        try await client.chatSend(sessionKey: session.key, message: text, attachments: attachments)
    } catch {
        // If offline → queue the message
        if isOfflineError(error) {
            let queued = MessageQueue.QueuedMessage(
                id: UUID(),
                sessionKey: session.key,
                message: text,
                attachments: attachments,
                queuedAt: Date()
            )
            await messageQueue.enqueue(queued)
            // Show queued indicator on the message bubble (clock icon)
        } else {
            // Real error (auth, etc) — show error normally
        }
    }
}
```

### 3. Auto-Flush on Reconnect

In `OpenClawClient.swift` or wherever connection state changes:

```swift
// When WebSocket reconnects:
func onReconnected() async {
    await messageQueue.flush(using: self)
}
```

### 4. UI Indicators

**MessageBubble.swift:** Add a status badge for queued messages:
- 🕐 (clock) = queued, waiting to send
- ✓ = sent successfully
- ✗ = failed after max retries (tap to retry)

**Both platforms:** Show a banner when messages are queued:
- "3 messages queued — will send when connected"
- Dismiss when flushed

### 5. Persistence

On app background/terminate: save queue to disk.
On app launch: load queue, attempt flush if connected.

Storage path:
- macOS: `~/Library/Application Support/OptaPlus/message-queue.json`
- iOS: `FileManager.default.urls(for: .applicationSupportDirectory)` + `OptaPlus/message-queue.json`
</instructions>

<constraints>
- Actor for thread safety (MessageQueue is an actor)
- Max queue size: 50 messages (prevent unbounded growth)
- Max retry: 3 attempts per message
- Flush order: FIFO (oldest first)
- Persistence: JSON file, not CoreData/SQLite
- Don't queue if error is auth-related (only queue network errors)
- Both platforms build with 0 errors
</constraints>

<output>
Test checklist:
1. Disconnect gateway → send message → shows clock icon, "queued" banner
2. Reconnect → message auto-sends, clock becomes checkmark
3. Send 3 messages offline → all flush in order on reconnect
4. Kill app with queued messages → relaunch → messages still queued
5. After 3 failed retries → shows ✗ with retry button
6. Both platforms build with 0 errors

When completely finished, run:
```bash
openclaw system event --text "Done: Phase 9 — Offline message queue on both platforms" --mode now
```
</output>
