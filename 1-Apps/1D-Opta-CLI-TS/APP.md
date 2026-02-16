---
title: Opta CLI
tagline: Local-first agentic AI coding assistant — your Mac Studio, your control
audience: Matthew Byrden + AI agents (Claude Code, bots)
type: CLI tool (Node.js, TypeScript)
status: BETA (v0.1.0, unfinished Aider fork)
created: 2026-02-12
updated: 2026-02-15
---

# Opta CLI — Application Identity

## 🎯 TL;DR

Opta CLI is a Node.js command-line tool that connects your MacBook to LM Studio running on your Mac Studio. It gives you Claude Code–like agentic AI (read files, edit code, run commands) powered by your own local LLMs instead of cloud APIs. Think of it as a command center for your Mac Studio's inference engine.

---

## Problem Statement

No mainstream AI CLI offers **first-class remote local LLM management**.

- **Aider** talks to OpenAI/Anthropic APIs only — no local model support
- **Claude Code** is Anthropic-proprietary — no local option
- **Cursor/Continue** are editor plugins — not standalone CLI
- **LM Studio** is great for inference but has no CLI interface from other devices

**Gap:** You have Qwen2.5-72B running on your Mac Studio. You want to use it from your MacBook CLI for coding tasks, with tool-use (read/edit/bash). Today, no off-the-shelf tool does this well.

---

## Solution

**Opta CLI = Driver that talks to LM Studio**

```
MacBook (you running opta chat)
    ↓ (OpenAI-compatible API calls)
LM Studio on Mac Studio (Mono512)
    ↓ (tool calls)
MacBook local filesystem / bash (read, edit, run_command, etc.)
    ↓ (results back to model)
Done
```

### Core Capabilities (V1)

1. **Connect & Manage** — Discover LM Studio, list models, switch default
2. **Agentic Chat** — Interactive sessions where the model uses tools (read, edit, bash, search) to complete tasks autonomously
3. **Configuration** — Connection profiles, tool permissions, model defaults — works out of the box with sensible defaults

### Technical Foundation

| Component | Requirement | Rationale |
|-----------|-----------|-----------|
| **Runtime** | Node.js 20+ | ESM-only, native async/await, fetch API |
| **Language** | TypeScript 5.7+ | Type safety in agent loop code |
| **CLI Framework** | Commander.js 13+ | Subcommand routing, global flags, help generation |
| **API Client** | OpenAI SDK 4.77+ | Works with LM Studio's `/v1/chat/completions` endpoint |
| **Module Format** | ESM (no CommonJS) | Future-proof, better tree-shaking, native imports |
| **Config** | conf + cosmiconfig | User config (conf) + project config (cosmiconfig) |
| **Validation** | Zod 3.24+ | Runtime schema validation for tool responses |

### Why This Approach

- **Local-first security** — All computation, all files, all commands run on your own hardware. No cloud roundtrip.
- **No API keys** — No OpenAI/Anthropic subscription needed. LM Studio is a local service you control.
- **Flexible models** — Easy to swap Qwen → GLM → DeepSeek. LM Studio manages the model runtime.
- **Tool-use agent** — Model calls tools, not you typing every command. Faster iteration.
- **Respects your setup** — Knows about `.opta/memory.md` for project knowledge, persists sessions, integrates with your dotfiles.

---

## Ecosystem Position

### Opta CLI vs. Opta-LMX

| Component | Role | Who Controls It |
|-----------|------|-----------------|
| **Opta CLI** | The driver/client | MacBook CLI, issues requests to LM Studio |
| **Opta-LMX** | The inference engine | Mac Studio service, runs local LLMs, returns completions |
| **OptaPlus** | Chat web UI | Mac Studio web interface, talks to LMX |
| **OpenClaw** | Orchestration layer | Gateway, nodes, skills, message routing |
| **Opta Life** | Task management | Separate service, syncs with CLI for context |

**Data Flow:**
```
CLI (chat command) → LM Studio API (192.168.188.11:1234) → Qwen2.5-72B
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

### Features NOT in V1

These are V2+ candidates:

- **Agent swarms** — Single-threaded agent only in V1
- **Plugin system** — SKILL.md loader exists but is a stub
- **Cloud fallback** — No fallback to OpenAI/Anthropic if LM Studio is down (must fail fast)
- **MCP integration** — Model Context Protocol support deferred
- **Browser automation** — Not a use case for V1
- **Git integration** — No auto-commit, git snapshots, or rollback
- **Diff-based editing** — Only exact-match string replacement in V1
- **LSP feedback** — No real-time diagnostics after edits

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
- ✅ Architecture is testable (mocks for LM Studio API responses)
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

# Connect to LM Studio
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
| **Files** | 32 TypeScript + 6 test files |
| **Lines** | 2,135 (source) + 250 (tests) |
| **Build time** | ~1.5s (tsup ESM build) |
| **Startup time** | <50ms for `opta --help`, ~200ms for `opta chat` (lazy loading) |
| **Node version** | 20+ (ESM required) |
| **Dependencies** | 15 prod, 8 dev (all pinned, all security-audited) |

---

## Contact & Contribution

**Maintainer:** Matthew Byrden (matthew@optamize.biz)

**How to help:**
1. Read `CLAUDE.md` for architecture
2. Read `docs/DECISIONS.md` for design constraints
3. Check `docs/GUARDRAILS.md` for safety rules
4. Submit PRs targeting V1 scope only

**Questions?** Open an issue or ping Matthew directly.
