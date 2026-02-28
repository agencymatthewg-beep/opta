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
- [ ] Multi-pane split view
- [ ] Inline diff viewer for edits

## Daemon
- [x] Background HTTP daemon (`opta daemon start/stop/status`)
- [x] WebSocket streaming endpoint (`/v3/sessions/:id/stream`)
- [x] Session persistence (JSONL event log)
- [x] Worker pool (parallel agent execution)
- [x] Bearer token authentication
- [x] Session management REST API
- [x] Background job runner (`/v3/background/`)
- [x] Operations registry (`/v3/operations/`)
- [ ] Daemon metrics endpoint
- [ ] Session replay API

## LMX Integration
- [x] LMX client with auto-discovery
- [x] Model inventory and lifecycle management
- [x] `/lmx scan` — model catalog display
- [x] `/lmx load` / `/lmx unload` commands
- [x] `/lmx status` — health and active sessions
- [x] Model aliases (q, f, l → quality/fast/local)
- [x] Rerank API integration
- [ ] Embedding pipeline

## Browser Automation
- [x] Playwright MCP integration
- [x] Native session manager
- [x] Policy engine (approval gating)
- [x] Quality gates for regression detection
- [x] Visual diff manifests
- [ ] Headless CI mode for browser tests

## LSP Integration
- [x] LSP client (go-to-definition, references, hover)
- [x] Language server manager (start/stop per-project)
- [x] Protocol implementation (TypeScript, Python, Rust, Go)
- [ ] Diagnostics in TUI
- [ ] Code actions via LSP

## Security & Config
- [x] Platform abstraction (macOS/Windows/Linux)
- [x] macOS Keychain via keyring (daemon token)
- [x] Windows DPAPI fallback keychain
- [x] Zod-validated config with self-healing
- [x] Per-tool permission model (allow/ask/deny)
- [x] Autonomy level enforcement (1-5)
- [x] Circuit breaker (warn/pause/hard-stop)
- [ ] Policy runtime enforcement endpoint

## MCP
- [x] MCP client (stdio + HTTP transports)
- [x] MCP server registry
- [x] Dynamic tool registration
- [ ] MCP server health monitoring
