# Opta Code Desktop Features

Opta Code Desktop (`1P-Opta-Code-Universal`) is a native-feeling desktop client for the Opta CLI daemon.

## Session Management

- [x] Daemon WebSocket streaming — real-time event consumption via WS
- [x] Session list — workspace rail with all active and past sessions
- [x] Session creation — start new sessions with model/mode selection
- [x] Session search — filter sessions by title or session ID
- [x] Session copy — duplicate session ID to clipboard
- [x] Session remove — delete sessions via daemon API
- [x] Token persistence — connection token stored in `localStorage` under `opta:daemon-connection`
- [x] Reconnect with backoff — exponential reconnect on WebSocket drop
- [x] Event cursor — resume from `lastReceivedSeq` to avoid duplicate events

## Chat Interface

- [x] Markdown rendering — zero-dependency markdown renderer in `MarkdownMessage.tsx`
- [x] Code blocks — syntax-highlighted fenced code blocks
- [x] Inline formatting — bold, italic, inline code
- [x] Lists and headers — full Markdown block support
- [x] Blockquotes — styled quote rendering
- [x] Tool cards — collapsible tool-call and tool-result cards
- [x] Turn statistics — tokens, speed (tok/s), elapsed time, tool call count
- [x] Streaming indicator — live typing animation during assistant turns

## Mode Toggle

- [x] Chat mode — standard conversational interaction
- [x] Do mode — agentic mode with auto-approval of safe tools
- [x] Mode indicator pill — header badge showing current mode
- [x] Per-session mode persistence — mode remembered across reconnects

## Background Jobs

- [x] Background jobs page — view and manage long-running daemon processes
- [x] Job launcher — form to start new background processes with args
- [x] Job status — live status polling for active jobs
- [x] Job termination — kill running jobs

## Connection Management

- [x] Connection settings — configure daemon URL and auth token
- [x] Connection status indicator — real-time online/offline badge
- [x] Auto-reconnect — transparent reconnection to daemon

## Operations

- [x] Operations page — expose CLI-backed operations as GUI forms
- [x] Models page — view and manage LMX-available models
- [x] Settings page — daemon connection and app preferences

## Packaging & Distribution

- [ ] Electron/Tauri wrapper — native desktop app packaging
- [ ] Auto-update — in-app update mechanism
- [ ] macOS DMG — distributable installer
- [ ] Code signing — Apple Developer ID signing

## Recent Updates

- 2026-02-28 — Session search, copy, remove; Chat/Do toggle; turn stats; tool cards; Markdown rendering
- 2026-02-26 — Background jobs launcher form; Codex Desktop parity sprint
- 2026-02-25 — Fix: timer leaks, dead memo, type precision improvements
- 2026-02-24 — Daemon v3 WebSocket event routing fixed (`envelope.event` not `envelope.kind`)
