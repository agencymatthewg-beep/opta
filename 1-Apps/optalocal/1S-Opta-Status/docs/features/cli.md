# Opta CLI Features

## Core Agent

- [x] Streaming agent loop with tool dispatch
- [x] Provider abstraction (LMX local + Anthropic fallback)
- [x] LMX connection with automatic discovery
- [x] Anthropic API integration (claude-sonnet-4-5)
- [x] Model routing by latency/capability
- [x] Context compaction at configurable threshold
- [x] Token counting + budget enforcement

## TUI (Full-screen Terminal UI)

- [x] Full-screen Ink/React TUI (`opta tui`)
- [x] Chat mode with streaming output
- [x] Do mode (agentic, auto-approve safe tools)
- [x] Session switcher sidebar
- [x] Tool cards (collapsible, tool-call + tool-result)
- [x] Markdown rendering (code blocks, bold, lists, headers)
- [x] Slash command palette
- [x] Trigger mode detection (plan/review/research words)
- [x] TUI skill runtime with dynamic loading

## Daemon

- [x] Background HTTP daemon (`opta daemon start/stop/status`)
- [x] WebSocket streaming endpoint (`/v3/sessions/:id/stream`)
- [x] Session persistence (JSONL event log)
- [x] Worker pool (parallel agent execution)
- [x] Bearer token authentication
- [x] Session management REST API
- [x] Background job runner (`/v3/background/`)
- [x] Operations registry (`/v3/operations/`)
- [x] Daemon metrics endpoint
- [x] Session replay API

## LMX Integration

- [x] LMX client with auto-discovery
- [x] Model inventory and lifecycle management
- [x] `/lmx scan` — model catalog display
- [x] `/lmx load` / `/lmx unload` commands
- [x] `/lmx status` — health and active sessions
- [x] Model aliases (q, f, l → quality/fast/local)
- [x] Rerank API integration
- [x] Embedding pipeline

## Browser Automation

- [x] Playwright MCP integration
- [x] Native session manager
- [x] Policy engine (approval gating)
- [x] Quality gates for regression detection
- [x] Visual diff manifests
- [x] Headless CI mode for browser tests

## LSP Integration

- [x] LSP client (go-to-definition, references, hover)
- [x] Language server manager (start/stop per-project)
- [x] Protocol implementation (TypeScript, Python, Rust, Go)
- [x] Diagnostics in TUI
- [x] Code actions via LSP

## Security & Config

- [x] Platform abstraction (macOS/Windows/Linux)
- [x] macOS Keychain via keyring (daemon token)
- [x] Windows DPAPI fallback keychain
- [x] Zod-validated config with self-healing
- [x] Per-tool permission model (allow/ask/deny)
- [x] Autonomy level enforcement (1-5)
- [x] Circuit breaker (warn/pause/hard-stop)
- [x] Policy runtime enforcement endpoint

## MCP

- [x] MCP client (stdio + HTTP transports)
- [x] MCP server registry
- [x] Dynamic tool registration
- [x] MCP server health monitoring

## Voice & Audio Operations

- [x] `audio.transcribe` daemon operation — routes base64 audio to LMX STT or OpenAI Whisper-1
- [x] `audio.tts` daemon operation — routes text to LMX TTS or OpenAI TTS-1
- [x] Provider selection from keychain (LMX local default, OpenAI cloud fallback)
- [x] Typed V3 protocol events: `audio.transcription.result`, `audio.tts.chunk`, `voice.state`
- [x] Input schemas: audioBase64, audioFormat, provider, language, voice
- [ ] Unit tests for audio daemon operations
- [ ] Integration test: STT round-trip on Apple Silicon

## Cross-App Coordination

- [x] `todo-optalocal/` cross-agent hub — structured handoff documents for multi-app feature changes

## Recent Updates

- 2026-03-07 — Opta Daemon v0.

- 2026-03-04 — This update introduces native localized voice dictation, Text-to-Speech (TTS), and global audio p...

## Auto-Synced Features
- [x] Feature: Opta Daemon v0.4.1 is now shipping on the stable channel with full macOS and Win
- [x] Introduced typed protocols via `protocol/v3` schemas (`V3Event` and `audio.transcribe`/`audio.tts`). Connected logic for proxying directly into LMX and fallback routines natively into the OpenAI APIs (`whisper-1`/`tts-1`) if configured that way via the `keychain` integration.

<!-- opta-sync-applied: 0004-opta-core-voice-integration -->

<!-- opta-sync-applied: 0015-opta-daemon-v041-stable-windows -->
