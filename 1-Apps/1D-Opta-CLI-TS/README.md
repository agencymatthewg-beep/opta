# Opta CLI

Agentic AI coding assistant powered by local LLMs. Privacy-first, runs entirely on your hardware via [Opta LMX](../1M-Opta-LMX/).

## Features

**Agent Loop** — Autonomous coding with tool use: read, edit, search files, run commands, and manage git — all orchestrated by a local model with streaming output.

**Multi-Provider** — Primary: Opta LMX (local inference). Fallback: Anthropic Claude API. Switch providers via `opta config set provider.active anthropic`.

**Full-Screen TUI** — React/Ink terminal UI with split panes, streaming indicators, model picker (Ctrl+M), keyboard shortcuts, and real-time token stats.

**Modes** — `--plan` (read-only architecture), `--review` (structured code review), `--research` (exploration without edits), `--auto` (auto-accept edits), `--dangerous` (bypass all prompts).

**Sub-Agents** — Spawn focused sub-agents for isolated subtasks with budget controls (max tool calls, token limits, timeouts) and depth tracking.

**Streaming Reconnection** — Automatic retry with exponential backoff when LMX connection drops mid-stream. Configurable via `connection.retry`.

**Checkpoint System** — Git-based checkpoints on every file edit. Interactive undo via `/undo` with checkpoint picker.

**MCP Integration** — Connect external tools via Model Context Protocol (stdio/HTTP transports). Add servers with `opta mcp add`.

**LSP Intelligence** — Go-to-definition, find references, hover info, and symbol search via Language Server Protocol.

**Slash Commands** — In-session commands: `/model`, `/plan`, `/review`, `/research`, `/commit`, `/checkpoint`, `/undo`, `/export`, `/debug`, `/profile`, and more.

**Hooks** — Lifecycle hooks for session start/end, pre/post tool execution, compaction, and errors.

**Shell Completions** — Tab completion for bash, zsh, and fish: `eval "$(opta completions zsh)"`.

## Quick Start

```bash
npm install
npm run dev          # Development with hot reload
npm run build        # Build for production
npm start            # Run production build
npm test             # Run tests (840 tests, 76 files)
```

## Usage

```bash
opta chat                         # Interactive session
opta chat --tui                   # Full-screen terminal UI
opta chat --plan                  # Architecture planning mode
opta chat --review                # Code review mode
opta chat --research              # Research & exploration mode
opta do "fix the auth bug"        # One-shot task execution
opta status                       # Check LMX connection
opta models                       # List loaded models
opta doctor                       # Environment health check
```

## Architecture

```
src/
├── commands/         CLI commands + slash command system
├── core/             Agent loop, config, tools, sub-agents
├── providers/        LMX + Anthropic provider backends
├── tui/              React/Ink full-screen terminal UI
├── ui/               CLI output helpers (non-TUI)
├── lmx/              Opta LMX client adapter
├── mcp/              MCP client + server registry
├── lsp/              Language Server Protocol integration
├── memory/           Session persistence + analytics
├── git/              Checkpoints, auto-commit, utilities
├── hooks/            Lifecycle hook manager
└── context/          OPIS project intelligence + exports
```

## Configuration

Priority: CLI flags > env vars > project config > user config > defaults.

```bash
opta config list                  # Show all settings
opta config set model.default qwen2.5-coder
opta config set provider.active anthropic
opta config set permissions.edit_file allow
```

## Documentation

See `docs/` for detailed documentation:
- `docs/INDEX.md` — Read order and onboarding guide
- `docs/DECISIONS.md` — Architectural decision records
- `docs/ROADMAP.md` — Version roadmap (V0 through V3+)
- `docs/GUARDRAILS.md` — Safety rules for tool execution
- `CLAUDE.md` — Full architecture guide for AI agents
