# Opta CLI

## What This Is

A TypeScript-based AI coding assistant CLI that connects to a local LLM inference server (Opta-LMX) and provides an agentic tool-use loop for software engineering tasks. Think "Claude Code but self-hosted" — runs entirely on local hardware with no cloud dependency.

## Core Value

Fast, reliable, self-hosted AI coding agent with a premium terminal experience that makes local inference feel as polished as cloud-hosted tools.

## Requirements

### Validated

- Agent loop with streaming tool calls (v0.1-v0.5)
- 15+ built-in tools (read, write, edit, search, run, background, LSP, etc.)
- Session persistence with resume capability
- MCP server integration for external tools
- Sub-agent delegation system with budget controls
- Git checkpoint/undo system
- Interactive slash command system (/help, /model, /undo, /status, etc.)
- Shell completions (bash, zsh, fish)
- OPIS project intelligence (APP.md, export map)
- Health diagnostics (`opta doctor`)

### Active

- [ ] Full-screen TUI with premium UX (Ink/React)
- [ ] Markdown rendering in TUI output
- [ ] TUI slash command support
- [ ] Multiline input with history in TUI
- [ ] Tool call visualization matching REPL quality

### Out of Scope

- Cloud provider fallback (v1 is local-only) — keeps architecture simple
- GUI/web interface — terminal-first philosophy
- Multi-user/collaborative features — single-user tool

## Context

- **Stack:** TypeScript + Commander + Ink 5 + React 18 + tsup + vitest
- **Codebase:** 87 source files, 13,267 lines, 735 tests across 70 files
- **TUI status:** Scaffolded (15 files, 21 tests) but ~40% complete vs REPL feature parity
- **Inspiration:** OpenCode's TUI is the gold standard for terminal AI coding UX
- **LMX backend:** Local MLX inference server at 192.168.188.11:1234

## Constraints

- **ESM only:** All imports use `.js` extensions, no CommonJS
- **Node 20+:** Required for native fetch, AbortController
- **Ink 5 + React 18:** Rendering framework is locked in
- **No cloud calls:** All inference via local Opta-LMX

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Ink 5 over raw ANSI | Component-based rendering, React mental model | -- Pending |
| EventEmitter bridge for streaming | Decouples agent loop from React rendering | ✓ Good |
| Alternate screen buffer for TUI | Clean separation from standard terminal | ✓ Good |
| ink-text-input for input | Simple single-line, but limits multiline | ⚠️ Revisit |

---
*Last updated: 2026-02-17 after v0.5.0-alpha.1 release*
