---
title: CLAUDE.md — Opta CLI Architecture Guide
audience: Claude Code, AI agents building this app
purpose: Enable autonomous feature development and bug fixes
updated: 2026-02-17
---

# Opta CLI Architecture & Development Guide

## Build Commands

```bash
npm install              # Install deps
npm run dev              # Watch mode with tsx (hot reload)
npm run build            # ESM build to dist/
npm start                # Run production build
npm run lint             # ESLint + TypeScript check
npm run format           # Prettier (formatting only, no lint fixes)
npm run typecheck        # tsc --noEmit (type errors)
npm test                 # Vitest (all test files)
npm test -- --watch      # Vitest watch mode
npm test -- --ui         # Vitest UI (browser)
```

### Common Workflows

```bash
# Develop a new command
npm run dev
# Edit src/commands/mycommand.ts, saves auto-reload

# Run a single test file
npm test -- src/__tests__/core/agent.test.ts

# Check types before committing
npm run typecheck && npm run lint

# Build and test in CI mode
npm run build && npm test
```

---

## File Structure

```
src/
├── index.ts                     # Entry point (~250 lines)
│                                # - Imports Commander + chalk (fast)
│                                # - Defines CLI program with all commands
│                                # - Lazy-loads all commands via dynamic import()
│                                # - SIGINT handler with graceful cleanup
│
├── types.d.ts                   # Module type declarations (marked-terminal)
│
├── commands/
│   ├── chat.ts                  # Interactive REPL session (~290 lines)
│   │                            # - Message loop with stdin
│   │                            # - Slash command handling (/exit, /model, etc.)
│   │                            # - Session persistence (create new or resume)
│   │                            # - TUI mode support (--tui flag)
│   │
│   ├── do.ts                    # Single-shot task execution (~150 lines)
│   │                            # - Wrapper around agent loop
│   │                            # - Auto-creates + closes session
│   │
│   ├── init.ts                  # OPIS project intelligence setup (~375 lines)
│   │                            # - Generates APP.md, AGENTS.md, TASKS.md
│   │                            # - Detects project stack (language, framework, tools)
│   │                            # - --yes for CI mode, --force to overwrite
│   │
│   ├── doctor.ts                # Environment health check (being added)
│   │                            # - Diagnose connection, config, and tool issues
│   │                            # - --json for machine-readable output
│   │
│   ├── status.ts               # LMX server health check (~100 lines)
│   ├── config.ts               # Config get/set/list/reset (~150 lines)
│   ├── models.ts               # Model list/use/info/load/unload (~265 lines)
│   ├── sessions.ts             # Session list/resume/delete/export (~115 lines)
│   ├── mcp.ts                  # MCP server management (~100 lines)
│   │                            # - list, add, remove, test subcommands
│   │
│   ├── completions.ts          # Shell completions (~300 lines)
│   │                            # - bash/zsh/fish completion scripts
│   │
│   ├── diff.ts                 # Session diff viewer (V2 stub, ~40 lines)
│   ├── serve.ts                # Remote LMX server management (~220 lines)
│   ├── server.ts               # HTTP API server (~210 lines)
│   ├── share.ts                # Session sharing (~60 lines)
│   ├── editor.ts               # Editor integration (~25 lines)
│   │
│   └── slash/                   # Slash command system for chat REPL
│       ├── types.ts             # SlashCommand + SlashHandler types (~37 lines)
│       ├── index.ts             # Slash command registry + dispatch (~127 lines)
│       ├── session.ts           # /save, /export, /clear, /undo (~253 lines)
│       ├── model.ts             # /model, /context, /temperature (~149 lines)
│       ├── display.ts           # /help, /status, /tokens (~141 lines)
│       ├── workflow.ts          # /commit, /plan, /checkpoint (~160 lines)
│       └── debug.ts             # /debug, /verbose, /profile (~103 lines)
│
├── core/
│   ├── agent.ts                 # The agent loop (~724 lines)
│   │                            # - Send to Opta-LMX via OpenAI SDK
│   │                            # - Parse tool calls from response
│   │                            # - Execute tools with permission checks
│   │                            # - Context compaction at 70% limit
│   │                            # - Circuit breaker (max 30 tool calls)
│   │                            # - Streaming token rendering
│   │
│   ├── config.ts                # Config loading & resolution (~265 lines)
│   │                            # - Priority: CLI flags > env > project > user > defaults
│   │                            # - Zod validation
│   │                            # - cosmiconfig for .opta/config.json discovery
│   │
│   ├── tools/                   # Tool system (split from single tools.ts)
│   │   ├── schemas.ts           # OpenAI function schemas (~481 lines)
│   │   │                        # - 8 tool schemas (read, write, edit, list, search, find, run, ask)
│   │   ├── executors.ts         # Tool execution logic (~558 lines)
│   │   │                        # - fs/shell executors, result formatting
│   │   ├── permissions.ts       # Permission resolution (~72 lines)
│   │   │                        # - allow/ask/deny per tool, CI mode handling
│   │   └── index.ts             # Re-exports + process manager (~11 lines)
│   │
│   ├── subagent.ts              # Sub-agent orchestration (~437 lines)
│   │                            # - Spawn focused sub-agents for subtasks
│   │
│   ├── orchestrator.ts          # Multi-agent orchestration (~83 lines)
│   ├── background.ts            # Background task execution (~288 lines)
│   ├── agent-profiles.ts        # Agent profile definitions (~79 lines)
│   ├── models.ts                # Model metadata & context limits (~78 lines)
│   ├── context.ts               # Context management (~39 lines)
│   ├── fileref.ts               # File reference tracking (~73 lines)
│   ├── errors.ts                # Error types & EXIT codes (~61 lines)
│   ├── debug.ts                 # Debug & verbose logging (~31 lines)
│   └── version.ts               # Version reading (~17 lines)
│
├── lmx/
│   └── client.ts               # Opta-LMX adapter (~207 lines)
│                                # - Wraps OpenAI SDK
│                                # - Points to custom base URL (192.168.188.11:1234)
│                                # - Handles streaming responses
│
├── mcp/
│   ├── client.ts                # MCP client connection (~84 lines)
│   └── registry.ts              # MCP server registry (~299 lines)
│
├── lsp/
│   ├── protocol.ts              # LSP protocol types (~238 lines)
│   ├── client.ts                # LSP client (~392 lines)
│   ├── manager.ts               # LSP server manager (~330 lines)
│   ├── servers.ts               # LSP server configs (~66 lines)
│   └── index.ts                 # Re-exports (~32 lines)
│
├── context/
│   ├── opis.ts                  # OPIS project intelligence loader (~291 lines)
│   └── exports.ts               # Context export utilities (~264 lines)
│
├── git/
│   ├── utils.ts                 # Git utility functions (~67 lines)
│   ├── commit.ts                # Auto-commit logic (~124 lines)
│   └── checkpoints.ts           # Session checkpoint management (~199 lines)
│
├── hooks/
│   ├── manager.ts               # Hook lifecycle manager (~201 lines)
│   └── integration.ts           # Hook integrations (~121 lines)
│
├── tools/
│   └── custom.ts               # Custom tool definitions (~245 lines)
│
├── utils/
│   ├── tokens.ts               # Token counting utilities (~44 lines)
│   └── config-helpers.ts       # Config helper functions (~48 lines)
│
├── memory/
│   ├── store.ts                 # Session persistence (~170 lines)
│   │                            # - Session CRUD (read, write, list, delete)
│   │                            # - Session schema validation
│   │
│   └── analytics.ts             # Session analytics (~59 lines)
│
├── skills/
│   └── (V2 — placeholder)
│
├── tui/                         # Full-screen terminal UI (Ink + React)
│   ├── adapter.ts               # Agent-to-TUI bridge (~132 lines)
│   ├── App.tsx                  # Root TUI component (~285 lines)
│   ├── render.tsx               # Ink render entry (~53 lines)
│   ├── keybindings.ts           # Keyboard shortcut definitions (~55 lines)
│   ├── Header.tsx               # Top bar component (~33 lines)
│   ├── InputBox.tsx             # Text input component (~46 lines)
│   ├── MessageList.tsx          # Chat message list (~102 lines)
│   ├── ScrollView.tsx           # Scrollable container (~72 lines)
│   ├── SplitPane.tsx            # Split view layout (~45 lines)
│   ├── Sidebar.tsx              # Session/file sidebar (~55 lines)
│   ├── StatusBar.tsx            # Bottom status bar (~49 lines)
│   ├── StreamingIndicator.tsx   # Streaming animation (~21 lines)
│   ├── FocusContext.tsx         # Focus management (~47 lines)
│   └── hooks/
│       ├── useTerminalSize.ts   # Terminal dimensions hook (~27 lines)
│       └── useKeyboard.ts       # Keyboard event hook (~78 lines)
│
└── ui/                          # CLI output helpers (non-TUI)
    ├── output.ts                # Chalk colors, TTY detection (~34 lines)
    ├── spinner.ts               # Ora wrapper (~29 lines)
    ├── markdown.ts              # Markdown rendering (~91 lines)
    ├── diff.ts                  # Diff display formatting (~71 lines)
    ├── theme.ts                 # Color theme definitions (~138 lines)
    ├── toolcards.ts             # Tool call card rendering (~101 lines)
    ├── box.ts                   # Box drawing utilities (~101 lines)
    ├── statusbar.ts             # Status bar rendering (~110 lines)
    ├── thinking.ts              # Thinking indicator (~153 lines)
    ├── input.ts                 # Input handling (~126 lines)
    ├── autocomplete.ts          # Autocomplete suggestions (~31 lines)
    └── history.ts               # Input history (~43 lines)
```

---

## Module Responsibilities

### Entry Point: `src/index.ts`

- Imports only `commander` + `chalk` (fast)
- Defines global flags (`--verbose`, `--debug`, `--version`)
- Routes each command via lazy import (only when called)
- SIGINT handler with graceful process cleanup

**Why lazy loading?**
`opta --help` <50ms (commander + chalk = fast). Full `opta chat` startup ~200ms (loads openai, marked, ora on demand).

### Commands: `src/commands/*.ts`

Each command file exports an async function that:
1. Parses command-specific flags
2. Loads config via `core/config.ts`
3. Calls LMX client (for models, status) OR agent loop (for chat, do)
4. Renders results via `ui/*.ts` helpers
5. Handles errors, exits with appropriate code

**Commands registered in index.ts:** chat, do, status, models, config, sessions, mcp (list/add/remove/test), init, diff, serve, server, completions, doctor (being added).

### Slash Commands: `src/commands/slash/`

In-REPL commands dispatched from chat mode. Organized by domain:
- **session.ts** — /save, /export, /clear, /undo
- **model.ts** — /model, /context, /temperature
- **display.ts** — /help, /status, /tokens
- **workflow.ts** — /commit, /plan, /checkpoint
- **debug.ts** — /debug, /verbose, /profile

### Core Loop: `src/core/agent.ts`

The heart of Opta (~724 lines). Implements the agent loop:

```
Input → Opta-LMX API → Parse response
  ├─ text only? Render & done
  └─ tool calls? Execute each → feed back → loop
```

**Key patterns:**

- **Streaming:** `stream: true` in OpenAI SDK call. Collect tokens and tool calls incrementally.
- **Permission gates:** Before every `edit_file`, `write_file`, `run_command`, check permissions. If `'ask'`, prompt user.
- **Context compaction:** If messages > 70% of `model.contextLimit`, summarize old turns before re-sending.
- **Circuit breaker:** After 30 tool calls in one loop, pause and ask user to continue.

### Sub-Agent System: `src/core/subagent.ts`

Spawns focused sub-agents for isolated subtasks (~437 lines). Works with `agent-profiles.ts` for role-based agent configurations and `orchestrator.ts` for multi-agent coordination.

### Tool System: `src/core/tools/`

Split into three files for maintainability:

- **schemas.ts** (~481 lines) — 8 OpenAI function schemas (read, write, edit, list, search, find, run, ask)
- **executors.ts** (~558 lines) — Tool execution logic (fs/shell calls, result formatting)
- **permissions.ts** (~72 lines) — Permission resolution (allow/ask/deny per tool, CI mode)

**Permissions:**

```typescript
const DEFAULT_PERMISSIONS = {
  read_file: 'allow',     // Always allow reads
  write_file: 'ask',      // Ask before creating files
  edit_file: 'ask',       // Ask before edits
  run_command: 'ask',     // Ask before bash
  ask_user: 'allow',      // Always allow model asking
  list_dir: 'allow',      // Always allow listings
  search_files: 'allow',
  find_files: 'allow',
};
```

Users override via `opta config set permissions.edit_file allow`. In CI mode, all `'ask'` becomes `'deny'`.

### Config System: `src/core/config.ts`

Loads config from (priority high → low):

1. CLI flags (`--host`, `--model`)
2. Environment variables (`OPTA_HOST`, `OPTA_MODEL`)
3. Project config (`.opta/config.json` via cosmiconfig)
4. User config (`~/.config/opta/config.json` via conf)
5. Hardcoded defaults (host: `192.168.188.11`, port: `1234`)

**Validation:** Zod schema ensures config is well-formed before use.

### LMX Client: `src/lmx/client.ts`

Wraps OpenAI SDK pointing to Opta-LMX HTTP API (~207 lines). Handles streaming responses, model listing, and health checks.

### MCP System: `src/mcp/`

- **client.ts** (~84 lines) — MCP client connection via stdio
- **registry.ts** (~299 lines) — MCP server registry (add/remove/list/test)

### LSP Integration: `src/lsp/`

Language Server Protocol support for code intelligence:
- **client.ts** (~392 lines) — LSP client implementation
- **manager.ts** (~330 lines) — Server lifecycle management
- **protocol.ts** (~238 lines) — LSP message types
- **servers.ts** (~66 lines) — Server configuration presets

### Context System: `src/context/`

- **opis.ts** (~291 lines) — OPIS project intelligence loader (reads APP.md, AGENTS.md, TASKS.md)
- **exports.ts** (~264 lines) — Context export utilities

### Git Integration: `src/git/`

- **utils.ts** (~67 lines) — Git utility functions (branch, status, diff)
- **commit.ts** (~124 lines) — Auto-commit with conventional commit format
- **checkpoints.ts** (~199 lines) — Session checkpoint management (stash-based)

### Session Storage: `src/memory/store.ts`

Sessions stored as JSON in `~/.config/opta/sessions/<id>.json`. Sessions can be resumed, exported, or deleted. `analytics.ts` provides session usage statistics.

### TUI: `src/tui/`

Full-screen terminal UI built with Ink (React for CLI). Activated via `opta chat --tui`. Components: App, Header, InputBox, MessageList, ScrollView, SplitPane, Sidebar, StatusBar, StreamingIndicator. `adapter.ts` bridges the agent loop to the TUI renderer.

### UI Helpers: `src/ui/*.ts`

Non-TUI output components:
- `output.ts` — Chalk colors, TTY detection, NO_COLOR check
- `spinner.ts` — Ora wrapper with non-TTY fallback
- `markdown.ts` — marked + marked-terminal for terminal rendering
- `theme.ts` — Color theme definitions
- `toolcards.ts` — Tool call card rendering
- `thinking.ts` — Thinking indicator animation
- `diff.ts`, `box.ts`, `statusbar.ts`, `input.ts`, `autocomplete.ts`, `history.ts`

---

## Code Patterns

### Lazy Loading

```typescript
// In index.ts (fast path)
program.command('chat').action(async (opts) => {
  const { startChat } = await import('./commands/chat.js');
  await startChat(opts);
});

// Heavy deps only load when command runs
```

### Agent Loop Pattern

```typescript
while (true) {
  const response = await lmx.complete(messages);
  
  if (!response.toolCalls.length) {
    console.log(response.text);
    break; // Done
  }
  
  messages.push({ role: 'assistant', ...response });
  
  for (const call of response.toolCalls) {
    const result = await executeTool(call);
    messages.push({ role: 'tool', ...result });
  }
}
```

### Permission Resolution

```typescript
function resolvePermission(toolName: string, config: OptaConfig): 'allow' | 'ask' | 'deny' {
  const perm = config.permissions[toolName] || 'allow';
  if (process.env.CI) return perm === 'ask' ? 'deny' : perm;
  return perm;
}
```

### Config Loading

```typescript
export async function loadConfig(overrides?: Partial<OptaConfig>): Promise<OptaConfig> {
  const cliArgs = overrides;                              // Highest priority
  const envVars = loadFromEnv();
  const projectConfig = await cosmiconfig.search();
  const userConfig = new Conf({ projectName: 'opta' });
  const defaults = DEFAULT_CONFIG;
  
  return merge(defaults, userConfig.store, projectConfig, envVars, cliArgs);
}
```

---

## Key Constraints

### ESM Only

- `type: "module"` in package.json
- All imports use `.js` extension (even TypeScript files)
- No `require()` or `module.exports`
- Lazy load heavy deps via `await import()`

### Node 20+ Required

- Native fetch API
- AbortController
- Top-level await
- `--no-warnings` for deprecation notices

### No Cloud Fallback (V1)

If Opta-LMX is unreachable, fail fast with actionable error. No fallback to OpenAI/Anthropic in V1.

### Agent Architecture

Primary agent loop is single-threaded (one model call at a time). Sub-agents can be spawned via `core/subagent.ts` for focused subtasks, coordinated by `core/orchestrator.ts`.

### Tool Execution Overhead

8 tool definitions in OpenAI schema format = ~1.5K tokens. Keep tool descriptions concise. Custom tools can be added via `tools/custom.ts`.

---

## Testing Strategy

> **Note:** Test files are not yet created. Vitest is configured but `src/__tests__/` does not exist yet. Below is the planned structure.

### Planned Unit Tests: `src/__tests__/core/`

- `agent.test.ts` — Agent loop with mocked Opta-LMX responses
- `config.test.ts` — Config loading and merging
- `tools.test.ts` — Tool execution, permission checks

### Planned Command Tests: `src/__tests__/commands/`

- `status.test.ts` — LMX health check flow
- `models.test.ts` — Model listing and switching
- `init.test.ts` — OPIS project initialization

### Planned E2E Test: `src/__tests__/cli.test.ts`

- `opta --help` returns 0
- `opta --version` returns version
- `opta unknown-command` returns exit code 2 (misuse)

### Running Tests

```bash
npm test                           # All
npm test -- --watch                # Watch mode
npm test -- agent.test.ts           # Single file
npm test -- --ui                   # Browser UI
```

---

## Debugging

### Enable Verbose Output

```bash
npm run dev -- --verbose     # See config loading
npm run dev -- --debug       # See API calls to Opta-LMX
```

### Debug Log Function

```typescript
import { debugLog } from './core/debug.ts';

debugLog('agent', 'Starting agent loop with', config);
debugLog('tools', 'Executing tool:', call.function.name);
```

Logs only print if `--debug` flag is set or `DEBUG=1` env var.

### Inspect Config

```bash
opta config list --json      # Pretty-printed JSON
```

### Mock Opta-LMX Responses

In tests, use mock responses:

```typescript
vi.mocked(lmx.complete).mockResolvedValue({
  text: 'I see the issue.',
  toolCalls: [],
});
```

---

## Common Tasks

### Add a New Command

1. Create `src/commands/mycommand.ts`
2. Export async function `export async function executeMyCommand(options) { ... }`
3. Add to `index.ts` with lazy import
4. Add test file `src/__tests__/commands/mycommand.test.ts`

### Add a New Tool

1. Define schema in `src/core/tools/schemas.ts` (OpenAI function format)
2. Add executor function in `src/core/tools/executors.ts`
3. Update permissions defaults in `src/core/tools/permissions.ts`
4. Add permission check in agent loop
5. Test in `tools.test.ts`

### Change Config Structure

1. Update Zod schema in `src/core/config.ts`
2. Update `DEFAULT_CONFIG` constant
3. Update tests
4. If breaking change: document in CHANGELOG

### Profile Performance

```bash
time opta --help              # Measure startup
node --prof dist/index.js     # Generate profile
```

---

## Before Submitting Code

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes (or skip non-blocking tests with `it.skip`)
- [ ] New files follow file structure above
- [ ] Tool-using code has permission checks
- [ ] External API calls use correct provider (Opta-LMX only, no Anthropic fallback in V1)
- [ ] Error messages are actionable (Context → Problem → Solution)

---

## References

- **Design Doc:** `docs/plans/2026-02-12-opta-cli-v1-design.md` — Full spec, agent loop diagram, V2+ roadmap
- **Decisions:** `docs/DECISIONS.md` — Why we chose OpenAI schema, lazy loading, etc.
- **Guardrails:** `docs/GUARDRAILS.md` — Safety rules for tool execution
- **Index:** `docs/INDEX.md` — Read order for this architecture
