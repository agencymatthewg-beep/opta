# OpenCode TUI Reference

Competitive intelligence from OpenCode's TUI implementation. Use during phase planning.

## Stack
- **Go + Bubble Tea** (Elm architecture: Model-Update-View)
- **Client/server model** — thin TUI, backend handles logic via SSE
- **30+ LSP servers**, MCP integration, git-backed rollback

## Key Features We Should Match

### Markdown (Phase 1)
- Full markdown with syntax-highlighted code blocks
- Theme-based syntax colors
- **PartCache** — avoids redundant re-renders of unchanged messages
- Copy-to-clipboard for code blocks

### Input (Phase 2)
- **Meta+Return** for multiline
- **@** triggers frecency-scored file autocomplete
- **/** triggers slash command autocomplete
- **!** at line start = shell mode
- **Ctrl+E** opens `$EDITOR` for complex compositions
- **Prompt stashing** — save drafts for later
- Smart paste: images → `[Image N]`, long text → `[Pasted ~N lines]`
- Up to 5 file attachments per message

### Slash Commands (Phase 3)
- Built-in: `/undo`, `/redo`, `/compact`, `/share`, `/new`, `/models`, `/session`, `/editor`, `/exit`
- MCP-provided custom commands
- Fuzzy-searchable command palette via Ctrl+X Ctrl+X

### Tool Display (Phase 4)
- State machine: Pending → Running → Completed → Error
- Collapsible tool details (toggle on/off)
- Tool.Result with `output`, `title`, `metadata`, `attachments`
- MCP tool results converted to standardized format

### Thinking (Phase 5)
- Not explicitly a first-class feature in OpenCode docs
- Our ThinkingRenderer is already more developed

### Permissions (Phase 6)
- Granular per-tool: allow/ask/deny
- Explicit approval dialogs for sensitive ops
- CI mode: all `ask` → `deny`
- Non-blocking in CI

### Scrollback (Phase 7)
- Sticky scroll during streaming
- Page up/down, half-page up/down
- Ctrl+G go to first, Ctrl+Alt+G go to last
- Lazy rendering (only visible messages)

### Integration (Phase 8)
- Real-time cost tracking in status bar
- Token usage + context window percentage
- File modification count
- Session title, working directory display

### Keybindings (Phase 9)
- **Leader key pattern** (Ctrl+X) to avoid terminal conflicts
- 80+ customizable shortcuts
- Command palette (Ctrl+X Ctrl+X) for discoverability
- Context-sensitive bindings

### Polish (Phase 10)
- 20+ built-in themes
- Toast notifications (color-coded, auto-dismiss 5s)
- Dialog system with fuzzy search
- Session branching/forking
- Error boundary with recovery shortcuts

## Features We Already Have That OpenCode Has
- Agent loop with tool execution ✓
- Session persistence with resume ✓
- @file references ✓
- Shell mode (!) ✓
- Slash command system ✓
- Git checkpoints/undo ✓
- LSP integration ✓
- MCP integration ✓
- Sub-agent delegation ✓
- Permission system ✓

## Gap Analysis (What We're Missing in TUI)
1. Markdown rendering (Phase 1)
2. Multiline input (Phase 2)
3. Slash commands in TUI (Phase 3)
4. Rich tool cards (Phase 4)
5. Interactive permissions (Phase 6)
6. Line-accurate scroll (Phase 7)
7. Command palette / dialog system (Phase 9)
8. Toast notifications (Phase 10)
9. Frecency-scored autocomplete (Phase 2)
10. Cost/token tracking accuracy (Phase 8)
