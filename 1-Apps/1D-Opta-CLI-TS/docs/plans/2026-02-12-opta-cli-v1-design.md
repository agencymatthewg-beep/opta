# Opta CLI V1 — Design Document

**Date:** 2026-02-12
**Status:** Approved design, ready for implementation
**Author:** Matthew Byrden + Claude Opus 4.6

---

## 1. Product Vision

Opta CLI is a local-first, agentic AI coding assistant that connects to LM Studio on your Mac Studio (Mono512) via its OpenAI-compatible API. It provides a Claude Code-like tool-use experience — read files, edit code, run commands, search codebases — powered by your own hardware instead of cloud APIs.

**What makes it different:** No mainstream AI CLI offers first-class "remote local LLM" management. Aider talks to APIs, Claude Code is Anthropic-only. Opta CLI makes your Mac Studio your private AI cloud and gives you a command center for it from any device on your LAN.

### V1 Scope (3 capabilities)

1. **Connect & Manage** — Discover, connect to, and switch between models on LM Studio.
2. **Agentic Chat** — Interactive sessions where the model uses tools (read, edit, bash, search) to complete coding tasks autonomously.
3. **Configuration** — Connection profiles, model defaults, tool permissions. Works out of the box with sensible defaults.

### Explicitly NOT in V1

Agent swarms, plugin/skill system, cloud LLM fallback, diff-based editing mode, MCP integration, browser automation, tree-sitter repo maps, LSP integration. These are V2+ features.

---

## 2. Architecture

### Core Loop

```
User Input → LM Studio (Mono512) → Tool Call → Execute Locally → Result → LM Studio → ... → Done
```

The CLI runs entirely on the MacBook. It sends prompts + tool definitions to LM Studio's `/v1/chat/completions` at `192.168.188.11:1234`. When the model returns a tool call, the CLI executes it locally and feeds the result back. The loop continues until the model produces plain text with no tool calls.

### Module Map

```
src/
├── index.ts                 # Entry point — Commander program, lazy command routing
├── commands/
│   ├── chat.ts              # Interactive REPL chat session
│   ├── connect.ts           # Discover and connect to LM Studio
│   ├── do.ts                # Single-shot agentic task execution
│   ├── config.ts            # Config subcommands (get/set/list/reset)
│   ├── models.ts            # Model listing, switching, info
│   ├── sessions.ts          # Session list, resume, delete, export
│   └── mcp.ts               # MCP tools (V2 stub)
├── core/
│   ├── agent.ts             # The agent loop — send, parse, execute, re-send
│   ├── config.ts            # Config loading (conf + cosmiconfig + env vars)
│   ├── tools.ts             # Tool definitions, schemas, execution, permissions
│   ├── errors.ts            # Error types, exit codes, actionable messages
│   ├── debug.ts             # Debug/verbose logging utilities
│   └── version.ts           # Version reading
├── providers/
│   ├── base.ts              # Provider interface
│   ├── manager.ts           # Provider selection and health checks
│   ├── lmstudio.ts          # LM Studio adapter (OpenAI-compatible API)
│   └── anthropic.ts         # Anthropic adapter (V2 stub, empty)
├── memory/
│   └── store.ts             # Session persistence + project memory (.opta/memory.md)
├── skills/
│   └── loader.ts            # SKILL.md loader (V2 stub)
└── ui/
    ├── output.ts            # Chalk helpers, TTY detection, NO_COLOR support
    ├── spinner.ts           # Ora wrapper with non-TTY fallback
    └── markdown.ts          # marked + marked-terminal rendering
```

### Key Design Decisions

- **Direct API** — CLI connects straight to LM Studio. No daemon on the Mac Studio.
- **OpenAI function-call format** — Tool definitions sent as JSON schemas. Works natively with LM Studio and local models (Qwen2.5-72B, GLM-4.7 handle function calling well).
- **Lazy loading** — Heavy deps (openai, marked, ora, conf) loaded per-command via dynamic `import()`. Keeps `opta --help` under 50ms.
- **Single-threaded agent loop** — One model call at a time. No swarms in V1.

---

## 3. Command Structure

```
opta                                    # Show help
opta --version                          # Show version
opta --verbose                          # Global: detailed output
opta --debug                            # Global: debug info including API calls

opta chat                               # Start interactive AI chat session
opta chat --resume <id>                 # Resume a previous session
opta chat --plan                        # Plan mode (all edits require approval)
opta chat --model <name>                # Override default model for this session

opta do <task...>                       # Execute a coding task (single-shot agent)
opta do --model <name> <task...>        # Use specific model for this task

opta connect                            # Connect to LM Studio (saved host)
opta connect --host <ip>                # Connect to specific host
opta connect --port <port>              # Connect to specific port (default: 1234)

opta models                             # List all models (loaded + available)
opta models use <name>                  # Switch default model
opta models info <name>                 # Show model details (size, context limit)
opta models --json                      # Machine-readable output

opta config list                        # Show all config values
opta config get <key>                   # Get a config value
opta config set <key> <value>           # Set a config value
opta config reset                       # Reset to defaults

opta sessions                           # List recent sessions
opta sessions resume <id>               # Resume a session (alias for chat --resume)
opta sessions delete <id>               # Delete a session
opta sessions export <id>               # Export session as JSON
opta sessions --json                    # Machine-readable output

opta completions <shell>                # Generate shell completions (bash/zsh/fish)
```

### Flag Conventions

- Short flags for common operations: `-v` (verbose), `-m` (model)
- Long flags for everything: `--host`, `--port`, `--json`, `--plan`, `--resume`
- `--json` on any list command for machine-readable output
- Global flags (`--verbose`, `--debug`) available on all commands

### Environment Variables

| Variable | Purpose | Overrides |
|----------|---------|-----------|
| `OPTA_HOST` | LM Studio host | config.connection.host |
| `OPTA_PORT` | LM Studio port | config.connection.port |
| `OPTA_MODEL` | Default model | config.model.default |
| `NO_COLOR` | Disable colors | chalk auto-detects |
| `CI` | Non-interactive mode | disables prompts, auto-denies `ask` permissions |
| `DEBUG` | Enable debug logging | --debug flag |

### Configuration Priority (highest to lowest)

1. Command-line flags (`--host`, `--model`)
2. Environment variables (`OPTA_HOST`, `OPTA_MODEL`)
3. Project config (`.opta/config.json` in cwd)
4. User config (`~/.config/opta/config.json` via `conf`)
5. Defaults (host: `192.168.188.11`, port: `1234`)

---

## 4. Tool System

Eight tools exposed to the model as OpenAI function-call schemas:

| Tool | Parameters | What It Does |
|------|-----------|--------------|
| `read_file` | `path`, `offset?`, `limit?` | Read file contents. Returns line-numbered text. |
| `write_file` | `path`, `content` | Create or overwrite a file. |
| `edit_file` | `path`, `old_text`, `new_text` | Exact string replacement. Fails if `old_text` isn't unique. |
| `list_dir` | `path`, `recursive?` | Directory listing. Defaults to cwd. |
| `search_files` | `pattern`, `path?`, `glob?` | Regex content search. Runs ripgrep via execa. |
| `find_files` | `pattern`, `path?` | Glob-based file name search via fast-glob. |
| `run_command` | `command`, `timeout?` | Execute a shell command. Returns stdout + stderr + exit code. |
| `ask_user` | `question` | Pause and ask the user a clarifying question. |

### Tool Permissions

| Tool | Default | CI Mode |
|------|---------|---------|
| `read_file` | allow | allow |
| `list_dir` | allow | allow |
| `search_files` | allow | allow |
| `find_files` | allow | allow |
| `edit_file` | ask | deny |
| `write_file` | ask | deny |
| `run_command` | ask | deny |
| `ask_user` | allow | deny |

Users customize via `opta config set permissions.edit_file allow`.

### System Prompt Budget

With 8 tool definitions in OpenAI function schema format, tool overhead is ~1.5K tokens. Base instructions ~500 tokens. Project memory ~200-500 tokens. Total overhead: ~2.5K tokens before conversation. Leaves 5.5K+ of an 8K window or 29K+ of a 32K window for work.

### Ripgrep for Search

`search_files` spawns `rg` via `execa` rather than using Node fs operations. 10-100x faster. Respects `.gitignore` automatically. Falls back to `fast-glob` + `fs.readFile` if rg is not installed.

---

## 5. Agent Loop

```typescript
async function agentLoop(task: string, config: OptaConfig): Promise<void> {
  const messages: Message[] = [
    { role: 'system', content: buildSystemPrompt(config) },
    { role: 'user', content: task },
  ];

  let toolCallCount = 0;

  while (true) {
    // 1. Context compaction — summarize if > 70% of model's limit
    if (tokenCount(messages) > config.model.contextLimit * config.safety.compactAt) {
      messages = await compactHistory(messages, config);
    }

    // 2. Call LM Studio
    const response = await openai.chat.completions.create({
      model: config.model.name,
      messages,
      tools: TOOL_SCHEMAS,
      tool_choice: 'auto',
      stream: true,
    });

    // 3. Stream tokens to terminal, collect tool calls
    const { text, toolCalls } = await collectStream(response);

    // 4. No tool calls = task complete
    if (!toolCalls.length) {
      renderMarkdown(text);
      break;
    }

    // 5. Append assistant message
    messages.push({ role: 'assistant', content: text, tool_calls: toolCalls });

    // 6. Execute each tool call with permission checks
    for (const call of toolCalls) {
      const permission = resolvePermission(call.function.name, config);

      if (permission === 'deny') {
        messages.push(toolResult(call.id, 'Permission denied by configuration.'));
        continue;
      }

      if (permission === 'ask') {
        const approved = await promptToolApproval(call);
        if (!approved) {
          messages.push(toolResult(call.id, 'User declined this action.'));
          continue;
        }
      }

      const result = await executeTool(call.function.name, call.function.arguments);
      messages.push(toolResult(call.id, result));
      toolCallCount++;
    }

    // 7. Circuit breaker — prevent infinite loops
    if (toolCallCount >= config.safety.maxToolCalls) {
      console.log(chalk.yellow('Reached tool call limit. Pausing for input.'));
      const shouldContinue = await confirm({ message: 'Continue?' });
      if (!shouldContinue) break;
      toolCallCount = 0;
    }
  }
}
```

### Key Mechanisms

1. **Streaming output** — Tokens render to terminal as they arrive via `stream: true`. Tool calls assembled incrementally from `delta.tool_calls` fragments.

2. **Permission gate** — Before every tool execution, checks config permission map. Read tools auto-execute. Edit/bash tools show what will happen and wait for y/n. In CI mode, `ask` becomes `deny`.

3. **Context compaction** — When messages exceed 70% of the model's context window, older turns are summarized (keeping system prompt + last 3 turns intact). Uses the same model with a summarization prompt.

4. **Circuit breaker** — After 30 consecutive tool calls (configurable), pauses and asks the user whether to continue. Prevents runaway loops.

5. **Termination** — Loop ends when the model returns plain text with no tool calls. This is the model's signal that the task is done.

---

## 6. Connection & Config

### Config Schema

```typescript
interface OptaConfig {
  connection: {
    host: string;          // default: "192.168.188.11"
    port: number;          // default: 1234
    protocol: 'http';
  };
  model: {
    default: string;       // auto-set by `opta connect`
    contextLimit: number;  // auto-detected from LM Studio API
  };
  permissions: Record<ToolName, 'allow' | 'ask' | 'deny'>;
  safety: {
    maxToolCalls: number;  // default: 30
    compactAt: number;     // default: 0.7
  };
}
```

Config stored via `conf` at `~/.config/opta/config.json`.

### `opta connect` Flow

1. Hit `GET /v1/models` on configured host:port
2. Parse response: loaded models (`state: "loaded"`) vs available models
3. Auto-select first loaded model as default (user overrides with `opta models use`)
4. Validate with a tiny completions request (1 token)
5. Read context limit from model metadata (fallback to lookup table)
6. Save connection profile to config

### Model Context Limits (Fallback Table)

| Model | Context |
|-------|---------|
| GLM-4.7-Flash-MLX-8bit | 128,000 |
| Qwen2.5-72B-Instruct-4bit | 32,768 |
| Step-3.5-Flash-Int4 | 32,768 |
| QwQ-32B-abliterated | 32,768 |
| DeepSeek-R1-Distill | 32,768 |
| WizardLM-Uncensored | 4,096 |
| Gemma-3-4b | 8,192 |

### Offline Handling

If Mac Studio is unreachable, all commands that need the API print an actionable error:

```
✗ Cannot reach LM Studio at 192.168.188.11:1234

Possible causes:
  • Mac Studio (Mono512) is offline
  • LM Studio is not running
  • Firewall blocking port 1234

Try:
  • Check connectivity: ping 192.168.188.11
  • Start LM Studio on the Mac Studio
  • Use a different host: opta connect --host <ip>
```

---

## 7. Chat UI & UX

### Session Layout

```
╭─ opta · Qwen2.5-72B · 192.168.188.11 ──────────────╮

  you: fix the authentication middleware to check token expiry

  ● Reading src/middleware/auth.ts...
  ● Searching for "token" in src/...

  opta: Found the issue. The verifyToken function checks
  signature validity but never compares exp against the
  current timestamp.

  ┌─ edit src/middleware/auth.ts ─────────────────────┐
  │ -  if (!decoded) return res.status(401).send();   │
  │ +  if (!decoded || decoded.exp < Date.now / 1000) │
  │ +    return res.status(401).send('Token expired'); │
  └───────────────────────────────────────────────────┘
  Apply? (y/n): y
  ✓ Applied

  opta: Fixed. The middleware now rejects expired JWTs.

  ▪ 4.2K / 32K tokens · 3 tool calls

  you: █
╰──────────────────────────────────────────────────────╯
```

### UI Components

| Element | Implementation | Non-TTY Fallback |
|---------|---------------|------------------|
| Status bar | `chalk.dim()` — model, host, connection | Plain text header |
| User input | `@inquirer/prompts` input with `you:` prefix | Read from stdin |
| Streaming text | `process.stdout.write` as tokens arrive | Buffer then print |
| Markdown | `marked` + `marked-terminal` | Plain text |
| Tool activity | `ora` spinner | `[working] Reading file...` |
| Edit previews | `chalk.red`/`chalk.green` with box borders | Unified diff text |
| Permission prompts | `@inquirer/prompts` confirm | Auto-deny in CI |
| Token budget | `chalk.dim` one-liner after response | Omit |

### Slash Commands (in chat)

| Command | Action |
|---------|--------|
| `/exit` | End session |
| `/model <name>` | Switch model mid-conversation |
| `/clear` | Reset conversation history |
| `/compact` | Force context compaction now |
| `/tools` | Show tool call count and permission status |
| `/save` | Force save current session |
| `/help` | List slash commands |

### TTY & CI Detection

```typescript
const isTTY = process.stdout.isTTY === true;
const isCI = process.env.CI === 'true' || !isTTY;
const noColor = !!process.env.NO_COLOR;

// In CI: no spinners, no prompts, no colors, auto-deny `ask` permissions
// In non-TTY pipe: no spinners, no colors, plain text output
```

---

## 8. Memory & Sessions

### Session Storage

Sessions stored as JSON in `~/.config/opta/sessions/`:

```typescript
interface Session {
  id: string;              // nanoid
  created: string;         // ISO timestamp
  updated: string;
  model: string;
  cwd: string;             // project directory at session start
  title: string;           // auto-generated from first user message
  messages: Message[];
  toolCallCount: number;
  compacted: boolean;
}
```

- Each `opta chat` starts a new session.
- `opta do` also creates a session (single-turn, auto-closed).
- `opta chat --resume <id>` reloads messages and continues.
- Compacted sessions store the summary, not the full history.

### Project Memory

`.opta/memory.md` in project root — persistent knowledge about the project:

```markdown
# Project: opta-web
- Build: `pnpm build` (Next.js 15)
- Test: `pnpm test` (vitest)
- Auth uses NextAuth with Google OAuth
- DB is Prisma + PostgreSQL on Supabase
```

Injected into system prompt at session start for any session opened in that project directory. The model proposes additions; user confirms (same `ask` permission flow).

### System Prompt Assembly

```
1. Base instructions          ~500 tokens    (who you are, tool rules)
2. Tool schemas               ~1.5K tokens   (8 function definitions)
3. Project memory             ~200-500 tokens (.opta/memory.md if exists)
4. Conversation history       variable        (messages array)
5. Current user message       variable        (input)
───────────────────────────────────────────
Overhead: ~2.5K tokens before conversation
```

---

## 9. Error Handling & Exit Codes

### Exit Codes

```typescript
export const EXIT = {
  SUCCESS: 0,
  ERROR: 1,
  MISUSE: 2,          // invalid arguments or bad command usage
  NO_CONNECTION: 3,   // LM Studio unreachable
  PERMISSION: 77,     // filesystem permission denied
  NOT_FOUND: 127,     // file or command not found
  SIGINT: 130,        // user pressed Ctrl+C
} as const;
```

### Error Message Pattern

All errors follow: **Context → Problem → Solution**

```
✗ <What went wrong>

<Why it might have happened>
  • Cause 1
  • Cause 2

Try:
  • Solution 1
  • Solution 2
```

### SIGINT Handler

```typescript
let isShuttingDown = false;

process.on('SIGINT', () => {
  if (isShuttingDown) process.exit(EXIT.SIGINT);  // force on double Ctrl+C
  isShuttingDown = true;
  console.log('\n' + chalk.dim('Interrupted — saving session...'));
  saveCurrentSession().finally(() => process.exit(EXIT.SIGINT));
});
```

Saves the current session to disk before exiting so it can be resumed later.

---

## 10. Performance

### Startup Time Target: <50ms for `opta --help`

Achieved via lazy loading. The entry point (`index.ts`) only imports `commander` and `chalk`. All other deps load dynamically per command:

```typescript
// index.ts — fast path
import { Command } from 'commander';
import chalk from 'chalk';

program.command('chat').action(async (opts) => {
  const { startChat } = await import('./commands/chat.js');
  await startChat(opts);
});

program.command('do <task...>').action(async (task, opts) => {
  const { executeTask } = await import('./commands/do.js');
  await executeTask(task, opts);
});
```

### Load Profile

| Command | Deps Loaded | Expected Startup |
|---------|------------|-----------------|
| `opta --help` | commander, chalk | ~15ms |
| `opta --version` | commander, chalk | ~15ms |
| `opta models` | + openai, conf | ~80ms |
| `opta connect` | + openai, conf, ora | ~100ms |
| `opta chat` | + openai, conf, ora, inquirer, marked | ~200ms |
| `opta do <task>` | + openai, conf, ora, marked, execa | ~200ms |

---

## 11. Dependencies (15 production, 8 dev)

### Production

| Package | Purpose | Loaded By |
|---------|---------|-----------|
| `commander` | CLI framework | index.ts (always) |
| `chalk` | Terminal colors | index.ts (always) |
| `openai` | LM Studio API client | chat, do, connect, models |
| `@inquirer/prompts` | Interactive prompts | chat, config |
| `conf` | Config persistence | config, connect, models |
| `cosmiconfig` | Project config discovery | agent loop (system prompt) |
| `dotenv` | Env var loading | config |
| `execa` | Shell command execution (tools) | agent loop |
| `fast-glob` | File search (tools) | agent loop |
| `marked` | Markdown parser | chat, do |
| `marked-terminal` | Terminal markdown renderer | chat, do |
| `nanoid` | Session ID generation | sessions |
| `ora` | Spinners | chat, do, connect |
| `p-queue` | Promise queue (rate limiting) | agent loop |
| `yaml` | YAML parsing | config |
| `zod` | Schema validation | config, tools |

### Dev

typescript, tsup, tsx, vitest, eslint, @typescript-eslint/\*, prettier, @types/node

---

## 12. File Layout After V1 Implementation

```
1F-Opta-CLI-TS/
├── src/
│   ├── index.ts              # 80 lines — Commander + lazy routing
│   ├── commands/
│   │   ├── chat.ts           # ~150 lines — REPL loop + slash commands
│   │   ├── do.ts             # ~50 lines — single-shot wrapper around agent loop
│   │   ├── connect.ts        # ~80 lines — LM Studio discovery + validation
│   │   ├── config.ts         # ~60 lines — get/set/list/reset subcommands
│   │   ├── models.ts         # ~80 lines — list/use/info subcommands
│   │   ├── sessions.ts       # ~70 lines — list/resume/delete/export
│   │   └── mcp.ts            # ~10 lines — V2 stub
│   ├── core/
│   │   ├── agent.ts          # ~120 lines — the agent loop
│   │   ├── config.ts         # ~80 lines — config loading + priority resolution
│   │   ├── tools.ts          # ~200 lines — 8 tool definitions + execution
│   │   ├── errors.ts         # ~40 lines — exit codes + error formatting
│   │   ├── debug.ts          # ~30 lines — verbose/debug logging
│   │   └── version.ts        # ~10 lines
│   ├── providers/
│   │   ├── base.ts           # ~30 lines — provider interface
│   │   ├── manager.ts        # ~40 lines — provider selection + health check
│   │   ├── lmstudio.ts       # ~60 lines — OpenAI SDK wrapper for LM Studio
│   │   └── anthropic.ts      # ~10 lines — V2 stub
│   ├── memory/
│   │   └── store.ts          # ~80 lines — session CRUD + project memory
│   └── ui/
│       ├── output.ts         # ~40 lines — chalk helpers, TTY detection
│       ├── spinner.ts        # ~30 lines — ora wrapper
│       └── markdown.ts       # ~20 lines — marked-terminal setup
├── tests/
│   ├── core/
│   │   ├── agent.test.ts
│   │   ├── config.test.ts
│   │   └── tools.test.ts
│   ├── commands/
│   │   ├── connect.test.ts
│   │   └── models.test.ts
│   └── cli.test.ts           # E2E: --help, --version, invalid commands
├── docs/
│   ├── plans/
│   │   └── 2026-02-12-opta-cli-v1-design.md  # This document
│   └── research/
│       └── ai-cli-landscape-2026.md
├── package.json
├── tsconfig.json
├── eslint.config.js
├── vitest.config.ts
├── .prettierrc
├── .gitignore
├── CLAUDE.md
└── README.md
```

Estimated total: ~1,400 lines of TypeScript for a fully functional V1.

---

## 13. Implementation Order

Build in this sequence — each step produces a testable artifact:

### Phase 1: Core Infrastructure (get `opta --help` working)
1. Rewrite `index.ts` with lazy loading, global flags, SIGINT handler
2. Implement `core/errors.ts` — exit codes + error formatting
3. Implement `core/config.ts` — config loading with priority resolution
4. Implement `ui/output.ts` — TTY detection, chalk helpers
5. Write `tests/cli.test.ts` — help, version, invalid command

### Phase 2: Connection (get `opta connect` + `opta models` working)
6. Implement `providers/base.ts` + `providers/lmstudio.ts`
7. Implement `providers/manager.ts` — health check + model listing
8. Implement `commands/connect.ts`
9. Implement `commands/models.ts` (list, use, info subcommands)
10. Write connection + models tests

### Phase 3: Agent Loop (get `opta do` working)
11. Implement `core/tools.ts` — 8 tool schemas + executors
12. Implement `core/agent.ts` — the main loop with streaming, permissions, compaction
13. Implement `ui/spinner.ts` + `ui/markdown.ts`
14. Implement `commands/do.ts` — single-shot wrapper
15. Write agent loop tests (mock LM Studio responses)

### Phase 4: Chat & Sessions (get `opta chat` working)
16. Implement `memory/store.ts` — session CRUD + project memory
17. Implement `commands/chat.ts` — REPL + slash commands
18. Implement `commands/sessions.ts` — list, resume, delete, export
19. Write chat + session tests

### Phase 5: Polish
20. Implement `commands/config.ts` subcommands
21. Add shell completions
22. Update README with real usage examples
23. Performance profiling (verify <50ms help)

---

## 14. Competitive Research Summary

Full research in `docs/research/ai-cli-landscape-2026.md`. Key patterns incorporated:

| Pattern | Source | How Opta Uses It |
|---------|--------|-------------------|
| Tool-use agent loop | Claude Code, OpenCode, Cline | Core architecture |
| allow/ask/deny permissions | OpenCode, Roo Code | Tool permission system |
| Exact-match string editing | Claude Code, OpenCode | `edit_file` tool |
| Ripgrep-backed search | OpenCode, Claude Code | `search_files` tool |
| Context compaction | OpenCode (hidden agent) | Auto-summarize at 70% |
| Streaming output | All modern CLIs | Token-by-token terminal rendering |
| Session persistence | Claude Code (CLAUDE.md) | `.opta/memory.md` + session files |
| Lazy loading | Vite, Turbo, Next CLI | Dynamic imports per command |

### V2+ Ideas from Research

- Aider's dual-model architect/editor split
- OpenCode's LSP feedback loop (diagnostics after edits)
- Roo Code's orchestrator/boomerang pattern for agent swarms
- Kimi K2.5's self-orchestrated parallel swarms
- Aider's watch mode (AI! comments from any IDE)
- OpenCode's git snapshots per step (auto-rollback on failure)
- Continue.dev's model role separation (different models per task type)
- OpenCode's SKILL.md loadable instructions
- Aider's tree-sitter repo map with PageRank symbol ranking

---

## 15. Open Questions

1. **Should `opta do` auto-commit changes?** Aider does this. Could add `--auto-commit` flag.
2. **Session cleanup policy?** Auto-delete sessions older than 30 days? Or keep forever?
3. **Should project memory (`.opta/memory.md`) be gitignored?** It contains project knowledge but also potentially personal preferences.
4. **Multi-device sync?** Sessions are stored locally. If Opta CLI is used from both MacBook and a PC, sessions won't sync unless we put them in a Syncthing-shared directory.
