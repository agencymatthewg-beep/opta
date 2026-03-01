# Changelog

All notable changes to Opta CLI are documented in this file.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

## [Unreleased]

### In Progress
- Phase 2 Runtime Confidence: cancellation backpressure, P50/P99 latency metrics, multi-writer soak testing
- Phase 3 Release Readiness: macOS packaging sign-off, clean-machine validation, npm publish

---

## [0.5.0-alpha.1] - 2026-03-01

### Added
- **TUI**: Full-screen Ink/React terminal UI (25+ components) with 10 phase overlay system
- **Daemon**: HTTP v3 REST + WebSocket server with permission coordinator and worker pool
- **Browser automation**: Playwright MCP bridge with policy engine, visual diff, sub-agent delegator, and session replay
- **MCP registry**: Dynamic MCP server registration with stdio client
- **LSP client**: Language Server Protocol client with server lifecycle management
- **Shell completions**: `opta completions [bash|zsh|fish] [--install]` for all subcommands
- **Version check**: `opta version --check` fetches npm registry with 5s timeout and offline handling
- **Cloud key management**: `opta account keys list|push|delete` syncs API keys to/from Opta Accounts cloud
- **Keychain**: OS-native keychain storage for Anthropic and LMX API keys
- **Account commands**: `opta account login|logout|status` with Supabase auth
- **Onboarding**: `opta onboard` with mDNS LAN discovery for LMX hosts
- **Daemon install**: `opta daemon install|uninstall` registers launchd/systemd auto-start service
- **Doctor**: `opta doctor [--fix]` with auto-remediation for common issues
- **Crash guardian**: Daemon auto-restarts on crash without user intervention
- **DeviceId fingerprint dedup**: Prevents duplicate device registration on re-login
- **Capability gating**: `cli.chat` and `cli.run` capability evaluation via Opta Accounts

### Fixed
- LMX WebSocket reconnection spam during multi-turn sessions (SSE fallback debounce)
- Cancellation propagation from CLI through daemon to LMX transport
- Permission coordinator race conditions under concurrent client load

### Infrastructure
- 2,277 tests across 197 test files (all passing)
- ESM-only output with tsup bundling
- TypeScript strict mode throughout
- GitHub Actions: CI + parity-macos-codex matrix + release automation

---

*Opta CLI is alpha software. APIs and behaviours may change between alpha releases.*
