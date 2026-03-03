# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---
title: CLAUDE.md — Opta CLI Architecture Guide
audience: Claude Code, AI agents building this app
purpose: Enable autonomous feature development and bug fixes
updated: 2026-02-26
---

# Opta CLI Architecture & Development Guide

## Build Commands

```bash
npm install              # Install deps
npm run dev              # Watch mode with tsx (hot reload)
npm run build            # ESM build to dist/
npm run typecheck        # tsc --noEmit (type errors)
npm run lint             # ESLint check
npm run format           # Prettier (format only, no lint fixes)
npm test                 # Vitest — all 197 test files (~14s)
npm test -- tests/core/config.test.ts  # Single file
npm test -- --watch      # Watch mode
```

### Targeted Test Suites

```bash
npm run test:core                    # Core + utils + ui only (fast)
npm run test:tui                     # TUI components only
npm run test:browser:runtime-regression  # Full browser module regression
npm run test:browser:gates           # Quality gate + artifact completeness
npm run test:parity:ws9              # Daemon HTTP + WS + permission race
npm run test:parity:desktop-path     # App.tsx + StatusBar TUI smoke
```

---

## Architecture Overview

Opta CLI is a **local-first agentic coding assistant** that routes through Opta-LMX (a local LLM inference server on Mac Studio at `192.168.188.11:1234`). The system has four major layers:

```
CLI entry (index.ts)
    ↓ lazy import per command
Commands (src/commands/)
    ↓ loadConfig → getProvider
Provider layer (src/providers/)        ← LMX primary, Anthropic fallback
    ↓
Agent loop (src/core/agent.ts)         ← streaming, tool dispatch, compaction
    ↓ tool calls
Tool executors (src/core/tools/)       ← 8 tools: read/write/edit/list/search/find/run/ask
    ↓ permission gates
Daemon (src/daemon/)                   ← HTTP + WS IPC, worker pool, permission coordinator
    ↓ via protocol/v3/
TUI (src/tui/)                         ← Ink/React full-screen UI, activated via --tui flag
```

### Module Map

| Module | Purpose |
|--------|---------|
| `src/core/` | Agent loop, config, tools, subagent, orchestrator, background tasks |
| `src/tui/` | Full-screen Ink/React terminal UI (25+ components) |
| `src/browser/` | Playwright browser automation: daemon, sessions, policy, visual diff, replay |
| `src/daemon/` | HTTP/WS background server, worker pool, session manager, permission coordinator |
| `src/providers/` | LLM routing: LMX (primary), Anthropic (fallback), base class, model scan |
| `src/lmx/` | Opta-LMX client: connection, health, model lifecycle, API keys, endpoints |
| `src/protocol/v3/` | Typed HTTP + WS message contracts used by daemon and clients |
| `src/commands/` | CLI subcommands + slash command system for in-REPL use |
| `src/mcp/` | MCP server registry and stdio client |
| `src/lsp/` | LSP client + server lifecycle management |
| `src/research/` | Multi-provider web search (Brave, Exa, Tavily, Gemini, Groq) |
| `src/accounts/` | Supabase-backed account/credential management |
| `src/context/` | OPIS project intelligence loader (APP.md, AGENTS.md, TASKS.md) |
| `src/git/` | Auto-commit, checkpoints (stash-based), git utilities |
| `src/journal/` | Structured semantic event logging (separate from session JSON) |
| `src/learning/` | Adaptive ledger + retrieval + session summarizer |
| `src/policy/` | Global permission policy evaluation (autonomy level, per-tool overrides) |
| `src/benchmark/` | Model evaluation suite (news, page analysis tasks) |
| `src/memory/` | Session CRUD + analytics (`~/.config/opta/sessions/<id>.json`) |
| `src/ui/` | Non-TUI output: chalk, ora, markdown, toolcards, diff, progress |

---

## Key Architectural Patterns

### Entry Point: Lazy Loading

`src/index.ts` imports only `commander` + `chalk`. Every command is lazy-loaded via dynamic `import()` so `opta --help` stays <50ms.

```typescript
program.command('chat').action(async (opts) => {
  const { startChat } = await import('./commands/chat.js');
  await startChat(opts);
});
```

### Agent Loop (`src/core/agent.ts`)

```
Input → Provider.complete(messages) → parse response
  ├─ no tool calls → render text, break
  └─ tool calls → executeTools() → push results → loop
```

Key behaviours wired into the loop:
- **Streaming**: `stream: true`, tokens collected incrementally via SSE
- **Permission gates**: `resolvePermission(tool, config)` before `edit_file`, `write_file`, `run_command`
- **Context compaction**: at 70% of model's context limit, old turns are summarized before re-sending
- **Circuit breaker**: after 30 tool calls in one loop, pauses for user confirmation

### Config Priority Chain (`src/core/config.ts`)

CLI flags → `OPTA_*` env vars → `.opta/config.json` (cosmiconfig) → `~/.config/opta/config.json` (conf) → defaults

Validated with Zod. Default host: `192.168.188.11`, port: `1234`.

### Tool Permissions (`src/core/tools/permissions.ts`)

```typescript
const DEFAULT_PERMISSIONS = {
  read_file: 'allow', list_dir: 'allow', search_files: 'allow', find_files: 'allow',
  write_file: 'ask',  edit_file: 'ask',  run_command: 'ask',    ask_user: 'allow',
};
```

Override via `opta config set permissions.edit_file allow`. In `CI=true`, all `'ask'` → `'deny'`.

### TUI Architecture (`src/tui/`)

The TUI is an Ink/React app launched via `opta chat --tui`. `adapter.ts` bridges the streaming agent loop into React state. Key data flow:

```
adapter.ts (AgentEventEmitter)
    → App.tsx (root, 20+ useState hooks, domain hooks in src/tui/hooks/)
    → MessageList, Sidebar, StatusBar, InputBox (layout)
    → OptaMenuOverlay, BrowserManagerRail, OptimiserPanel (overlays)
    → BrowserControlOverlay, ActionHistoryOverlay, HelpBrowserOverlay (modals)
```

Keybindings are centralized in `keybindings.ts` and processed in `hooks/useKeyboard.ts`.

### Daemon Architecture (`src/daemon/`)

The daemon (`opta daemon start`) runs as a persistent background process and exposes:
- HTTP REST API (`http-server.ts`) for session control
- WebSocket server (`ws-server.ts`) for streaming token delivery
- Worker pool (`worker-pool.ts`) for concurrent task execution
- Permission coordinator (`permission-coordinator.ts`) for cross-client approval gating

The `protocol/v3/` layer defines typed message contracts shared between the daemon and all clients.

### Browser Automation (`src/browser/`)

Playwright-backed via `@playwright/mcp`. All Playwright tool calls route through `BrowserMcpInterceptor` (`mcp-interceptor.ts`) which:
1. Evaluates risk with `evaluateBrowserPolicyAction` (policy-engine.ts)
2. Gates or denies high-risk actions (browser_evaluate, browser_file_upload)
3. Records artifacts (screenshots/snapshots) via `artifacts.ts`
4. Feeds the `visual-diff.ts` pipeline

**Available tools (30+):** browser_navigate, browser_click, browser_type, browser_select_option, browser_hover, browser_drag, browser_scroll, browser_press_key, browser_snapshot, browser_screenshot, browser_evaluate, browser_go_back, browser_go_forward, browser_tab_new, browser_tab_close, browser_tab_switch, browser_handle_dialog, browser_wait_for_element, browser_wait_for_navigation, browser_file_upload, and more.

**Browser sub-agent:** `delegateToBrowserSubAgent()` in `sub-agent-delegator.ts` spawns a full-peer browser specialist for autonomous multi-step goals.

**Config flag:** `browser.mcp.enabled = true` (auto-registers `@playwright/mcp` via `mcp-bootstrap.ts`).

**Legacy path (native sessions):** `trigger-session.ts` → `runtime-daemon.ts` → `native-session-manager.ts` → `control-surface.ts` — preserved for macOS profile isolation use-cases. `replay.ts` enables deterministic session replay from action logs.

---

## Key Constraints

### ESM Only

`type: "module"` in package.json. All imports use `.js` extension (even for `.ts` source files). No `require()`. Lazy-load heavy deps via `await import()`.

### Autonomy Floor

Autonomy level resolution uses `Math.floor` (not `Math.round`) — fractional levels always resolve down to prevent accidental permission escalation.

### Shell Injection Prevention

`src/daemon/background-manager.ts` uses a `parseShellCommand` tokenizer to spawn processes directly rather than `spawn('sh', ['-c', cmd])`. Never pass user strings to shell interpreter.

### Import extension rule

In TypeScript source, write imports as `./foo.js` not `./foo.ts`. tsup resolves correctly at build time.

---

## Common Tasks

### Add a New Command

1. Create `src/commands/mycommand.ts`, export `async function executeMyCommand(options)`
2. Register in `src/index.ts` with lazy `await import('./commands/mycommand.js')`
3. Add `tests/commands/mycommand.test.ts`

### Add a New Tool

1. Define schema in `src/core/tools/schemas.ts` (OpenAI function format)
2. Add executor in `src/core/tools/executors.ts`
3. Set permission default in `src/core/tools/permissions.ts`
4. Add permission gate in agent loop

### Add a New Slash Command

1. Add handler to the appropriate `src/commands/slash/*.ts` file
2. Register in `src/commands/slash/index.ts`

---

## Testing

**198 test files, 2,277 passing tests.** Tests live in `tests/` (not `src/__tests__/`).

Vitest with Ink testing library for TUI. Mocking pattern:

```typescript
vi.mocked(lmx.complete).mockResolvedValue({ text: 'Done', toolCalls: [] });
```

All browser modules have unit tests. Full E2E browser session flow covered in `tests/integration/browser-session-full-flow.test.ts`.

---

## References

- **Milestone definition:** `docs/plans/2026-02-26-v05-milestone-definition.md` — what v0.5-alpha is vs. v1.0 bar
- **Design doc:** `docs/plans/2026-02-12-opta-cli-v1-design.md` — original V1 spec
- **Decisions:** `docs/DECISIONS.md` — why daemon-first, HTTP + WS + SSE, Fastify
- **Guardrails:** `docs/GUARDRAILS.md` — safety rules for tool execution
- **Index:** `docs/INDEX.md` — documentation read order for agents
