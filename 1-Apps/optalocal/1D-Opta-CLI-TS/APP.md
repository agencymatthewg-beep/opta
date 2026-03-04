---
title: Opta CLI
tagline: Local-first agentic AI coding assistant — your dedicated Apple Silicon host, your control
audience: Matthew Byrden + AI agents (Claude Code, bots)
type: CLI tool (Node.js, TypeScript)
status: Active development (v0.5.0-alpha.1)
created: 2026-02-12
updated: 2026-02-26
---

# Opta CLI — Application Identity

## 🎯 TL;DR

Opta CLI is a Node.js command-line tool that connects your MacBook to Opta-LMX running on your dedicated Apple Silicon host. It gives you Claude Code-like agentic AI (read files, edit code, run commands) powered by your own local LLMs instead of cloud APIs. Think of it as a command center for your dedicated Apple Silicon host's inference engine.

---

## Problem Statement

No mainstream AI CLI offers **first-class remote local LLM management**.

- **Aider** talks to OpenAI/Anthropic APIs only — no local model support
- **Claude Code** is Anthropic-proprietary — no local option
- **Cursor/Continue** are editor plugins — not standalone CLI
- **Opta-LMX** handles inference but needs a CLI interface from other devices

**Gap:** You have Qwen2.5-72B running on your dedicated Apple Silicon host. You want to use it from your MacBook CLI for coding tasks, with tool-use (read/edit/bash). Today, no off-the-shelf tool does this well.

---

## Solution

**Opta CLI = Driver that talks to Opta-LMX**

```
MacBook (you running opta chat)
    ↓ (OpenAI-compatible API calls)
Opta-LMX on dedicated Apple Silicon host (Primary LMX Host)
    ↓ (tool calls)
MacBook local filesystem / bash (read, edit, run_command, etc.)
    ↓ (results back to model)
Done
```

### Core Capabilities (V1)

1. **Connect & Manage** — Discover Opta-LMX, list models, switch default
2. **Agentic Chat** — Interactive sessions where the model uses tools (read, edit, bash, search) to complete tasks autonomously
3. **Configuration** — Connection profiles, tool permissions, model defaults — works out of the box with sensible defaults

### Technical Foundation

| Component | Requirement | Rationale |
|-----------|-----------|-----------|
| **Runtime** | Node.js 20+ | ESM-only, native async/await, fetch API |
| **Language** | TypeScript 5.7+ | Type safety in agent loop code |
| **CLI Framework** | Commander.js 13+ | Subcommand routing, global flags, help generation |
| **API Client** | OpenAI SDK 4.77+ | Works with Opta-LMX's `/v1/chat/completions` endpoint |
| **Module Format** | ESM (no CommonJS) | Future-proof, better tree-shaking, native imports |
| **Config** | conf + cosmiconfig | User config (conf) + project config (cosmiconfig) |
| **Validation** | Zod 3.24+ | Runtime schema validation for tool responses |

### Why This Approach

- **Local-first security** — All computation, all files, all commands run on your own hardware. No cloud roundtrip.
- **No API keys** — No OpenAI/Anthropic subscription needed. Opta-LMX is a local service you control.
- **Flexible models** — Easy to swap Qwen → GLM → DeepSeek. Opta-LMX manages the model runtime.
- **Tool-use agent** — Model calls tools, not you typing every command. Faster iteration.
- **Respects your setup** — Knows about `.opta/memory.md` for project knowledge, persists sessions, integrates with your dotfiles.

---

## Ecosystem Position & The "Brother App" Vision

**Opta CLI and its "Brother App", Opta-LMX, combine to form a complete and highly competitive, premium, impressive, practical, MLX Local Model optimized coding and advanced development ecosystem.**

### Opta CLI vs. Opta-LMX

| Component | Role | Who Controls It |
|-----------|------|-----------------|
| **Opta CLI** | The driver/client | MacBook CLI, issues requests to Opta-LMX |
| **Opta-LMX (Brother App)** | The inference engine | dedicated Apple Silicon host service, runs local LLMs, returns completions |
| **OptaPlus** | Chat web UI | dedicated Apple Silicon host web interface, talks to LMX |
| **OpenClaw** | Orchestration layer | Gateway, nodes, skills, message routing |
| **Opta Life** | Task management | Separate service, syncs with CLI for context |

**Data Flow:**

```
CLI (chat command) → Opta-LMX API (lmx-host.local:1234) → Qwen2.5-72B
    ↓ model sees 8 tool schemas
    ↓ model calls run_command("npm test")
CLI executes → result → back to model → loop until done
```

---

## V1 Scope (3 Capabilities)

Defined in design doc (`docs/plans/2026-02-12-opta-cli-v1-design.md`):

1. **Connect & Manage** — `opta connect`, `opta models list/use/info`
2. **Agentic Chat** — `opta chat` (interactive REPL), `opta chat --resume <id>` (continue prior session)
3. **Configuration** — `opta config get/set/list/reset`, permission rules for tools

### Features Originally Deferred — Now Implemented

These items were listed as V2+ candidates in the original V1 design doc. All are now present in the codebase:

- **MCP integration** — Implemented (`src/mcp/`): full MCP client + registry, multi-server support
- **Browser automation** — Implemented (`src/browser/`): Playwright-based runtime daemon, session management, visual diff, policy engine, quality gates, replay, and canary evidence
- **Git integration** — Implemented (`src/git/`): auto-commit, checkpoints, session rollback
- **LSP feedback** — Implemented (`src/lsp/`): full LSP client, server lifecycle management, diagnostics
- **Agent swarms** — Implemented (`src/core/subagent.ts`, `src/core/orchestrator.ts`): sub-agent spawning and multi-agent coordination
- **Cloud fallback** — Implemented (`src/providers/`): multi-provider manager with Anthropic, LMX, and fallback routing
- **Daemon / background execution** — Implemented (`src/daemon/`): HTTP + WebSocket server, session manager, worker pool, permission coordinator
- **Research routing** — Implemented (`src/research/`): multi-provider web research (Brave, Exa, Tavily, Gemini, Groq)
- **Accounts & API keys** — Implemented (`src/accounts/`, `src/lmx/api-key.ts`): Supabase-backed account storage, key management
- **Benchmark suite** — Implemented (`src/benchmark/`): automated model evaluation
- **Learning system** — Implemented (`src/learning/`): retrieval, summarization, and adaptive ledger
- **Policy engine** — Implemented (`src/policy/`): permission policy evaluation for browser and tool actions
- **Protocol layer (v3)** — Implemented (`src/protocol/v3/`): structured HTTP + WebSocket + event protocols
- **Journal** — Implemented (`src/journal/`): session update logs, news, page records
- **Skill.md loader** — Implemented (`src/tui/skill-runtime.ts`): active skill execution in TUI

---

## Success Metrics

### For Matthew (You)

- ✅ `opta chat` opens a session in <200ms
- ✅ Can code a feature in one `opta chat` session with model tool-use (no manual CLI)
- ✅ Session resumes pick up context from prior turns
- ✅ Tool permissions are intuitive (safe by default, customizable)
- ✅ Project memory (`.opta/memory.md`) actually helps the model

### For AI Agents (Claude Code, bots)

- ✅ CLAUDE.md is clear enough to build features without asking
- ✅ Architecture is testable (mocks for Opta-LMX API responses)
- ✅ Error messages are actionable (not cryptic)
- ✅ Code style is consistent (eslint + prettier enforced)

---

## Design References

- **Design doc:** `docs/plans/2026-02-12-opta-cli-v1-design.md` — full 10,000-word spec
- **Competitive research:** `docs/research/ai-cli-landscape-2026.md` — what Aider/Cursor/Claude Code do
- **Architecture decisions:** `docs/DECISIONS.md` — why we chose OpenAI schema format, lazy loading, etc.

---

## Quick Start

```bash
# Install
npm install

# Connect to Opta-LMX
opta connect

# Chat with the default model
opta chat

# Execute a single task
opta do "add TypeScript support to the test suite"

# Resume a prior session
opta chat --resume <session-id>

# See all commands
opta --help
```

---

## Project Stats

| Metric | Value |
|--------|-------|
| **Version** | 0.5.0-alpha.1 |
| **Source files** | 225 TypeScript/TSX files |
| **Test files** | 165 TypeScript/TSX test files |
| **Source lines** | ~60,600 (src/) |
| **Test lines** | ~28,000 (tests/) |
| **Top-level modules** | 23 (accounts, benchmark, browser, commands, context, core, daemon, git, hooks, journal, learning, lmx, lsp, mcp, memory, policy, protocol, providers, research, skills, tools, tui, ui, utils) |
| **Build time** | ~1.5s (tsup ESM build) |
| **Startup time** | <50ms for `opta --help`, ~200ms for `opta chat` (lazy loading) |
| **Node version** | 20+ (ESM required) |

---

## Contact & Contribution

**Maintainer:** Matthew Byrden (<matthew@optamize.biz>)

**How to help:**

1. Read `CLAUDE.md` for architecture
2. Read `docs/DECISIONS.md` for design constraints
3. Check `docs/GUARDRAILS.md` for safety rules
4. Submit PRs targeting V1 scope only

**Questions?** Open an issue or ping Matthew directly.
