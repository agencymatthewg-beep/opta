# Phase 11: @mention Cross-Bot Handoff

**Launch:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1I-OptaPlus && claude --dangerously-skip-permissions`
**Paste:** `Proceed with the plan located at: /Users/matthewbyrden/Synced/Opta/1-Apps/1I-OptaPlus/tasks/plans/phase-11-crossbot-mention.md`

---

<context>
Read these files:
1. `CLAUDE.md` — Coding rules
2. `Shared/Sources/OptaMolt/Networking/ChatViewModel.swift` — Message sending, bot list
3. `Shared/Sources/OptaMolt/Networking/OpenClawClient.swift` — chatSend, sessionsList
4. `Shared/Sources/OptaMolt/Chat/MessageBubble.swift` — Message rendering
5. `macOS/OptaPlusMacOS/ContentView.swift` — macOS chat + bot sidebar
6. `iOS/OptaPlusIOS/Views/ChatInputBar.swift` — iOS text input

Cross-bot handoff: Type "@Mono" in a chat with Opta Max → the message (with context) is sent to Mono's gateway instead. The tagged bot receives the message and the conversation context.

Each bot has its own gateway on a different port/host. The AppState holds the bot list with connection details.
</context>

<instructions>
### 1. Shared: MentionDetector

Create `Shared/Sources/OptaMolt/Chat/MentionDetector.swift`:

```swift
public struct BotMention {
    public let botName: String
    public let range: Range<String.Index>
    public let cleanedMessage: String  // Message with @mention removed
}

public final class MentionDetector {
    /// Detect @mentions at the start of a message
    public static func detect(in text: String, knownBots: [String]) -> BotMention? {
        // Match @BotName (case-insensitive) at start of message
        // Return the matched bot and the message without the mention
        // Example: "@Mono check server status" → BotMention(botName: "Mono", cleanedMessage: "check server status")
    }
}
```

### 2. Shared: CrossBotSender

Create `Shared/Sources/OptaMolt/Chat/CrossBotSender.swift`:

```swift
public actor CrossBotSender {
    /// Send a message to a different bot's gateway
    public func handoff(
        message: String,
        fromBot: BotConfig,      // Current bot (for context)
        toBot: BotConfig,        // Target bot
        context: [ChatMessage]?  // Last N messages for context
    ) async throws -> String {
        // 1. Create temporary OpenClawClient for target bot
        // 2. Connect to target gateway
        // 3. Send message with context prefix:
        //    "[Handoff from @{fromBot.name}] Context: {summary}\n\n{message}"
        // 4. Disconnect
        // Return acknowledgement
    }
}
```

### 3. Integration with ChatViewModel.sendMessage

Modify send flow:

```swift
func sendMessage(_ text: String) async {
    // Check for @mention
    let knownBots = appState.bots.map { $0.name }
    if let mention = MentionDetector.detect(in: text, knownBots: knownBots) {
        // Find target bot config
        guard let targetBot = appState.bots.first(where: { 
            $0.name.lowercased() == mention.botName.lowercased() 
        }) else {
            // Show error: "Bot @{mention.botName} not found"
            return
        }
        
        // Get last 5 messages for context
        let context = Array(messages.suffix(5))
        
        // Send to target bot
        try await crossBotSender.handoff(
            message: mention.cleanedMessage,
            fromBot: currentBot,
            toBot: targetBot,
            context: context
        )
        
        // Show confirmation in current chat
        // "[Handed off to @Mono: 'check server status']"
        return
    }
    
    // Normal send
    try await client.chatSend(...)
}
```

### 4. macOS: @mention Autocomplete

**ChatTextInput.swift:**

1. When user types "@", show autocomplete dropdown with bot names
2. Filter as they type: "@Mo" → shows "Mono"
3. Tab/Enter to accept → inserts full "@Mono "
4. Style mentions in input field with accent color
5. Dropdown shows bot avatar + name + online status

### 5. iOS: @mention Autocomplete

**ChatInputBar.swift:**

1. Same trigger: "@" shows autocomplete bar above keyboard
2. Horizontal scroll of bot chips (avatar + name)
3. Tap to insert mention
4. Inline mention highlighted in accent color

### 6. Visual Feedback

**MessageBubble.swift:**

- Handoff messages get a special indicator: ↗️ icon + "Handed to @Mono"
- Render @mentions in message text with accent color + bold
- Tap @mention in a message → switch to that bot's chat
</instructions>

<constraints>
- Cross-bot connection: create temporary OpenClawClient, connect, send, disconnect
- Context limit: max 5 recent messages, max 2000 chars total
- @mention only at START of message (not inline — inline is just styled text)
- Autocomplete shows max 10 bots
- Target bot must be in the bot list (can't mention unknown bots)
- Gateway tokens: each bot has its own token — use the stored token for that bot
- Don't keep cross-bot connections open (connect → send → disconnect)
- Both platforms build with 0 errors
</constraints>

<output>
Test checklist:
1. Type "@" → autocomplete shows bot list
2. Select bot → mention inserted with styling
3. Send "@Mono check status" → message sent to Mono's gateway
4. Current chat shows handoff confirmation
5. Mention in message bubble is styled (accent color)
6. Tap mention → switches to that bot's chat
7. Unknown bot mention → error shown
8. Both platforms build with 0 errors

When completely finished, run:
```bash
openclaw system event --text "Done: Phase 11 — Cross-bot @mention handoff on both platforms" --mode now
```
</output>
