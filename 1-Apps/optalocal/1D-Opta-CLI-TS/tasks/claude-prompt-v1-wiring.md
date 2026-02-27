# Claude Code Prompt — Opta CLI V1: Wire Up Commands

**Launch:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1D-Opta-CLI-TS && claude --dangerously-skip-permissions`
**Paste:** `Proceed with the plan located at: /Users/matthewbyrden/Synced/Opta/1-Apps/1D-Opta-CLI-TS/tasks/claude-prompt-v1-wiring.md`

---

<context>
You are completing the Opta CLI — a local-first agentic AI coding assistant. The hard parts are ALREADY BUILT:

- `src/core/agent.ts` (346 lines) — Full agent loop with streaming, tool calls, permissions, context compaction, circuit breaker
- `src/core/tools.ts` (374 lines) — 8 tools (read, write, edit, list, search, find, run, ask) with permission gates
- `src/core/config.ts` (111 lines) — Zod-validated config with loadConfig(), saveConfig(), getConfigStore()
- `src/lmx/client.ts` (215 lines) — Opta-LMX admin API client
- `src/commands/status.ts` (99 lines) — Opta-LMX health check and status
- `src/commands/models.ts` (183 lines) — Working model list/use/info
- `src/commands/do.ts` (48 lines) — Working single-shot task execution via agentLoop()
- 44/44 tests pass, typecheck clean

**6 commands are STUBS that need implementation:**
- `src/commands/chat.ts` (11 lines) — prints "Not yet implemented"
- `src/commands/sessions.ts` (13 lines) — prints "Not yet implemented"
- `src/commands/config.ts` (9 lines) — prints "Not yet implemented"
- `src/commands/completions.ts` (8 lines) — prints "Not yet implemented"
- `src/memory/store.ts` (5 lines) — empty export
- `src/skills/loader.ts` (4 lines) — V2 stub, leave as-is

**Read these files FIRST:**
1. `CLAUDE.md` — Full architecture guide, file map, code patterns, testing strategy
2. `docs/ROADMAP.md` — V1 spec with success criteria for each capability
3. `src/core/agent.ts` — The agent loop you'll be calling from chat.ts
4. `src/commands/do.ts` — Example of how to call agentLoop() (copy this pattern)
5. `src/core/config.ts` — Config schema (OptaConfig type, loadConfig/saveConfig)
6. `src/index.ts` — Command registration (already done, signatures match)

**Key interfaces already exported:**
```typescript
// agent.ts
export async function agentLoop(task: string, config: OptaConfig): Promise<void>

// config.ts
export async function loadConfig(overrides?: Record<string, unknown>): Promise<OptaConfig>
export async function saveConfig(partial: Record<string, unknown>): Promise<void>
export async function getConfigStore(): Promise<import('conf').default>
export type OptaConfig = { connection: {...}, model: {...}, permissions: {...}, safety: {...} }

// tools.ts
export function getToolNames(): string[]
```

**Dependencies already in package.json:** @inquirer/prompts, chalk, commander, conf, cosmiconfig, nanoid, openai, ora, marked, marked-terminal, yaml, zod
</context>

<instructions>
Develop a PLAN to implement the 5 remaining commands, then execute it. This is a WIRING job — the engine exists, you're building the cockpit.

### 1. Session Store (`src/memory/store.ts` — ~100 lines)

The persistence layer everything else depends on. Implement:

```typescript
interface Session {
  id: string;              // nanoid
  created: string;         // ISO timestamp
  updated: string;         // ISO timestamp
  model: string;           // model used
  cwd: string;             // working directory
  title: string;           // auto-generated from first message
  messages: AgentMessage[]; // full conversation history
  toolCallCount: number;
  compacted: boolean;
}

// CRUD operations
export async function createSession(model: string): Promise<Session>
export async function loadSession(id: string): Promise<Session>
export async function saveSession(session: Session): Promise<void>
export async function listSessions(): Promise<SessionSummary[]>  // id, title, model, created, messageCount
export async function deleteSession(id: string): Promise<void>
export async function exportSession(id: string): Promise<string>  // JSON string
```

**Storage:** `~/.config/opta/sessions/<id>.json` (one file per session)
**Title generation:** First user message, truncated to 60 chars
**Use:** `nanoid` for IDs, `node:fs/promises` for I/O

### 2. Interactive Chat (`src/commands/chat.ts` — ~150 lines)

The main user-facing command. This is a REPL that wraps the agent loop:

```
opta chat                    → new session
opta chat --resume abc123    → resume existing session
opta chat --model qwen       → override model
```

**Implementation:**
- Load config, check connection (same pattern as `do.ts`)
- Create or resume session via store.ts
- Print session header (model, session ID, working dir)
- Enter readline loop:
  - Read user input via `@inquirer/prompts` (input())
  - Handle slash commands: `/exit`, `/model <name>`, `/sessions`, `/history`, `/compact`, `/help`
  - For normal input: call `agentLoop(input, config)` — BUT the current agentLoop takes a single task and runs to completion
  - **IMPORTANT:** You need to modify `agentLoop` to support multi-turn conversation. Options:
    - a) Add an optional `existingMessages` parameter to agentLoop so it can continue a conversation
    - b) Extract the inner loop and expose a `continueConversation(messages, newInput, config)` function
    - Choose whichever is cleaner. The key is: chat needs to persist messages between turns.
  - After each turn, save session to disk
  - On `/exit` or Ctrl+C, save and exit cleanly

**Slash commands:**
| Command | Action |
|---------|--------|
| `/exit` | Save session, exit |
| `/model <name>` | Switch model mid-session |
| `/history` | Print conversation summary |
| `/compact` | Force context compaction |
| `/clear` | Clear screen |
| `/help` | Show available commands |

### 3. Sessions Command (`src/commands/sessions.ts` — ~80 lines)

```
opta sessions              → list all sessions (table format)
opta sessions resume <id>  → resume session (delegates to chat --resume)
opta sessions delete <id>  → delete session
opta sessions export <id>  → export session as JSON to stdout
opta sessions --json       → machine-readable list
```

Uses store.ts for all operations. Format session list as a table with columns: ID (first 8 chars), Title, Model, Date, Messages.

### 4. Config Command (`src/commands/config.ts` — ~70 lines)

```
opta config list            → show all config (formatted)
opta config get <key>       → get specific value (dot notation: connection.host)
opta config set <key> <val> → set value (persists to user config)
opta config reset           → reset to defaults
opta config --json          → machine-readable
```

Uses `getConfigStore()` from core/config.ts. Support dot-notation for nested keys (e.g., `permissions.edit_file`).

### 5. Shell Completions (`src/commands/completions.ts` — ~50 lines)

```
opta completions bash    → print bash completion script
opta completions zsh     → print zsh completion script
opta completions fish    → print fish completion script
```

Generate completion scripts that know about: commands (chat, do, connect, models, config, sessions), global flags (--verbose, --debug, --version), and command-specific flags.

### 6. Tests

Add/update tests for each new command:
- `tests/memory/store.test.ts` — Session CRUD (create, load, save, list, delete)
- `tests/commands/chat.test.ts` — Basic chat flow (mock agent loop)
- `tests/commands/sessions.test.ts` — List/delete/export
- `tests/commands/config.test.ts` — Update existing test with get/set/list

### 7. Verify Everything

After implementation:
```bash
npm run typecheck    # Must pass
npm run lint         # Must pass  
npm test             # All tests must pass
```
</instructions>

<constraints>
- ESM only — all imports use `.js` extension
- Node 20+ — use native fetch, AbortController
- Type hints on every function (this is TypeScript)
- Lazy loading pattern — heavy deps via `await import()`
- Error format: Context → Problem → Solution (see errors.ts)
- Permission checks on tool execution (see tools.ts resolvePermission)
- No cloud API calls — local Opta-LMX only
- Sessions stored as JSON in `~/.config/opta/sessions/`
- Config via `conf` library (already in deps)
- Use `@inquirer/prompts` for interactive input (already in deps)
- Use `nanoid` for session IDs (already in deps)
- Use `chalk` for colors, `ora` for spinners (already in deps)
- Keep agent.ts changes MINIMAL — it works, don't break it
- All existing 44 tests must still pass after changes
</constraints>

<examples>
Example: Chat session flow
```
$ opta chat
opta · Qwen2.5-72B · 192.168.188.11:1234
Session: abc12345 (new)

you: Fix the login bug in auth.ts

⠋ Thinking...
I'll start by reading the auth.ts file to understand the current implementation.

[read_file] src/auth.ts ✓
[edit_file] src/auth.ts ✓ (fixed null check on line 42)

Fixed the login bug. The issue was a missing null check on the session token.

you: /history
  1. [user] Fix the login bug in auth.ts
  2. [assistant] I'll start by reading... (3 tool calls)

you: /exit
Session saved: abc12345 "Fix the login bug in auth.ts"
```

Example: Session management
```
$ opta sessions
  ID        Title                          Model           Date         Messages
  abc12345  Fix the login bug in auth.ts   Qwen2.5-72B    2 hours ago       4
  def67890  Add user registration flow     Mistral-7B     yesterday        12

$ opta sessions resume abc12345
Resuming session abc12345...
opta · Qwen2.5-72B · 192.168.188.11:1234

you: Now add rate limiting to that endpoint
```

Example: Config management
```
$ opta config list
  connection.host        192.168.188.11
  connection.port        1234
  model.default          Qwen2.5-72B
  model.contextLimit     32768
  permissions.edit_file  ask
  permissions.run_command ask
  safety.maxToolCalls    30
  safety.compactAt       0.7

$ opta config set permissions.edit_file allow
✓ Set permissions.edit_file = allow
```
</examples>

<output>
Write the implementation plan to: `tasks/plans/2026-02-15-v1-wiring-plan.md`

Then execute the plan:
1. Implement store.ts first (everything depends on it)
2. Modify agent.ts minimally to support multi-turn (add existingMessages param or extract inner function)
3. Implement chat.ts (the main command)
4. Implement sessions.ts and config.ts (independent of each other)
5. Implement completions.ts (independent)
6. Write tests for all new code
7. Run `npm run typecheck && npm test` — everything must pass

Definition of done:
- `opta chat` starts interactive session, sends messages, receives streamed responses, persists session
- `opta chat --resume <id>` resumes with full history
- `opta sessions` lists all sessions with formatted table
- `opta config list/get/set/reset` all work
- `opta completions bash/zsh/fish` output valid scripts
- All tests pass (existing 44 + new tests)
- Typecheck clean
</output>
