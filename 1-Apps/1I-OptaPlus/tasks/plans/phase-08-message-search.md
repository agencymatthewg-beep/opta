# Phase 8: Message Search

**Launch:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1I-OptaPlus && claude --dangerously-skip-permissions`
**Paste:** `Proceed with the plan located at: /Users/matthewbyrden/Synced/Opta/1-Apps/1I-OptaPlus/tasks/plans/phase-08-message-search.md`

---

<context>
Read these files:
1. `CLAUDE.md` — Coding rules
2. `Shared/Sources/OptaMolt/Networking/ChatViewModel.swift` — Has messages array, chatHistory()
3. `Shared/Sources/OptaMolt/Networking/OpenClawClient.swift` — Has chatHistory(sessionKey:limit:before:)
4. `Shared/Sources/OptaMolt/Chat/MessageBubble.swift` — Message rendering
5. `macOS/OptaPlusMacOS/ContentView.swift` — macOS layout
6. `iOS/OptaPlusIOS/Views/ChatView.swift` — iOS chat view

Messages are fetched from the gateway via `chat.history`. Search is client-side — filter the loaded messages array. For deep search across all sessions, iterate sessionsList + chatHistory per session.
</context>

<instructions>
### 1. Shared: SearchEngine (OptaMolt)

Create `Shared/Sources/OptaMolt/Chat/SearchEngine.swift`:

```swift
public final class SearchEngine: ObservableObject {
    @Published public var query: String = ""
    @Published public var results: [SearchResult] = []
    @Published public var currentIndex: Int = 0
    @Published public var isSearching: Bool = false
    
    public struct SearchResult: Identifiable {
        public let id: String  // message ID
        public let sessionKey: String?
        public let matchRange: Range<String.Index>
        public let snippet: String  // Context around match
        public let timestamp: Date?
    }
    
    /// Search within current session's loaded messages
    public func searchLocal(messages: [ChatMessage], query: String) -> [SearchResult]
    
    /// Search across all sessions (async — fetches history from gateway)
    public func searchGlobal(client: OpenClawClient, query: String) async -> [SearchResult]
    
    /// Navigate matches
    public func nextMatch()
    public func previousMatch()
    public var currentResult: SearchResult? { results.isEmpty ? nil : results[currentIndex] }
}
```

Search logic:
- Case-insensitive substring match
- Highlight matched text in results
- Sort by recency (newest first)
- Debounce input (300ms) before searching

### 2. macOS: Search Bar (⌘F)

**ContentView.swift changes:**

1. **Toggle:** `⌘F` keyboard shortcut shows/hides search bar
2. **Search bar:** Slides down from top of chat area (like Safari/Chrome find bar)
   - Text field + "X of Y" counter + ▲/▼ navigation arrows + ✕ close
3. **Highlight:** Matching messages get a glow outline (`optaViolet` tint)
4. **Auto-scroll:** Navigating matches scrolls to the matched message
5. **Scope toggle:** "This chat" / "All chats" — local vs global search

Layout:
```
┌─────────────────────────────────┐
│ 🔍 [search text...] 3 of 12 ▲▼ ✕│  ← Search bar (animated slide-in)
├─────────────────────────────────┤
│ ... messages ...                 │
│ [highlighted match]              │  ← Yellow/violet glow on match
│ ... messages ...                 │
└─────────────────────────────────┘
```

### 3. iOS: Search UI

**ChatView.swift / ChatHistoryView.swift changes:**

1. **Activation:** `.searchable(text:placement:)` modifier on the chat list
2. **Results list:** When searching, show filtered results with snippets
3. **Tap result:** Scroll to that message in chat, highlight it
4. **History search:** In `ChatHistoryView`, add search bar at top that filters session titles + message content

### 4. Message Highlight Component

Create `Shared/Sources/OptaMolt/Chat/SearchHighlight.swift`:

```swift
public struct HighlightedText: View {
    let text: String
    let highlight: String
    
    public var body: some View {
        // Split text, apply accent color to matching segments
        // Use AttributedString for rich text highlighting
    }
}
```

Apply to MessageBubble when search is active — matching text gets `optaViolet` background.

### 5. Keyboard Navigation (macOS)

- `⌘F` → Open search
- `⌘G` → Next match
- `⌘⇧G` → Previous match
- `Escape` → Close search
- `Enter` in search field → Next match
</instructions>

<constraints>
- Client-side search only (no server-side search API exists)
- Debounce 300ms before searching
- Max 1000 messages searched per session for performance
- Global search: max 20 sessions, 50 messages each
- Highlight using AttributedString (not regex on rendered markdown)
- Spring physics for search bar appear/dismiss
- Both platforms build with 0 errors
</constraints>

<output>
Test checklist:
1. macOS: ⌘F opens search bar with animation
2. Type query → results count updates, first match highlighted
3. ▲▼ arrows navigate between matches, auto-scroll works
4. "All chats" toggle searches across sessions
5. iOS: .searchable filter works in chat
6. iOS: search in ChatHistoryView filters sessions
7. Escape/✕ closes search, highlight removed
8. Both platforms build with 0 errors

When completely finished, run:
```bash
openclaw system event --text "Done: Phase 8 — Message search on both platforms" --mode now
```
</output>
