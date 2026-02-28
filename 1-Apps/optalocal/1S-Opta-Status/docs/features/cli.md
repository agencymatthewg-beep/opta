# Opta CLI Features

The Opta CLI (`1D-Opta-CLI-TS`) is the primary interface for local AI inference, daemon management, and session orchestration.

## Core Chat & Agent Commands

- [x] `opta chat` — interactive chat TUI with streaming output
- [x] `opta do <task>` — agentic task execution with automatic tool approval
- [x] `opta do --mode chat` — inline chat without TUI
- [x] `opta tui` — full-screen TUI with session switching
- [x] Chat/Do mode toggle — switch between interactive and agentic modes mid-session

## Daemon & Session Management

- [x] `opta daemon start` — launch background session orchestrator
- [x] `opta daemon stop` — gracefully shut down daemon
- [x] `opta daemon status` — health and active session count
- [x] `opta sessions` — list, attach, and manage session history
- [x] `opta sessions rm <id>` — remove sessions
- [x] WebSocket streaming events — real-time turn events (`turn.start`, `turn.done`, `turn.error`)
- [x] Session reconnect — attach to in-progress sessions with event replay via `afterSeq`
- [x] Bearer token auth — HTTP API protected by `crypto.timingSafeEqual`
- [ ] Multi-writer determinism — concurrent CLI + web client on same session
- [ ] Soak test suite — p95 latency and event-loop lag measurement

## Model Management

- [x] `opta models scan` — discover LMX-available models with rich metadata
- [x] `opta models load <model>` — load model into LMX memory
- [x] `opta models unload <model>` — free model memory
- [x] `opta models list` — show loaded models and memory usage
- [x] LMX health integration — daemon proxies `/v3/lmx/status`, `/v3/lmx/models`, `/v3/lmx/memory`
- [ ] Model aliases — short-name resolution for common models

## Configuration & Auth

- [x] `opta config` — read/write configuration values
- [x] `opta key` — API key management (keychain-backed on macOS)
- [x] `opta env` — environment profile management
- [x] `opta doctor` — connectivity and dependency diagnostics

## MCP Integration

- [x] `opta mcp` — list configured MCP servers
- [x] `opta mcp add` — register new MCP server
- [x] MCP client — forwards tool calls to registered MCP servers
- [x] Tool compatibility layer — bridges daemon tool schema to MCP protocol
- [ ] Dynamic MCP server discovery via daemon

## Browser Automation

- [x] `opta browser` — trigger browser sessions
- [x] Native session manager — Playwright-based headless control
- [x] Policy engine — allowlist/blocklist for browser actions
- [x] Quality gates — screenshot + DOM diff validation
- [x] Approval log — persistent audit trail of approved browser actions
- [ ] Multi-tab support
- [ ] Video recording of browser sessions

## Advanced Features

- [x] Hooks system — pre/post tool-call shell hooks
- [x] LSP integration — language server protocol client for code intelligence
- [x] Background jobs — long-running tasks via worker pool
- [x] `opta serve` — serve sessions over HTTP for remote access
- [x] `opta share` — share session via URL
- [x] `opta rerank` — test reranking model endpoint

## Release & Packaging

- [x] GitHub Actions release workflow — build and publish on tag
- [x] `npm run build` — tsup bundle for distribution
- [ ] macOS `.pkg` installer
- [ ] Homebrew formula
- [ ] Auto-update mechanism
- [ ] First-run setup wizard

## Recent Updates

- 2026-02-28 — Chat/Do mode toggle wired end-to-end through TUI
- 2026-02-26 — Security hardening: timing-safe auth, input validation improvements
- 2026-02-23 — Browser runtime stability improvements, session reconnect fixes
- 2026-02-20 — Daemon v3 WebSocket protocol with event cursor support
