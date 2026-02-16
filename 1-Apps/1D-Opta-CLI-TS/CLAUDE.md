---
title: CLAUDE.md — Opta CLI Architecture Guide
audience: Claude Code, AI agents building this app
purpose: Enable autonomous feature development and bug fixes
updated: 2026-02-15
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
├── index.ts                 # Entry point (80 lines)
│                            # - Imports Commander + chalk (fast)
│                            # - Defines CLI program
│                            # - Lazy-loads all commands via dynamic import()
│
├── commands/
│   ├── chat.ts              # Interactive REPL session (~150 lines)
│   │                         # - Message loop with stdin
│   │                         # - Slash command handling (/exit, /model, etc.)
│   │                         # - Session persistence (create new or resume)
│   │
│   ├── do.ts                # Single-shot task execution (~50 lines)
│   │                         # - Wrapper around agent loop
│   │                         # - Auto-creates + closes session
│   │
│   ├── connect.ts           # LM Studio discovery & validation (~80 lines)
│   │                         # - GET /v1/models from LM Studio
│   │                         # - Validate with completions test call
│   │                         # - Save connection profile to config
│   │
│   ├── config.ts            # Config get/set/list/reset (~60 lines)
│   │                         # - Read from conf (user home)
│   │                         # - Read from cosmiconfig (project)
│   │                         # - Merge with env vars
│   │
│   ├── models.ts            # Model list/use/info (~80 lines)
│   │                         # - List loaded models
│   │                         # - Switch default model
│   │                         # - Show context limits + capabilities
│   │
│   ├── sessions.ts          # Session list/resume/delete/export (~70 lines)
│   │                         # - Read session directory
│   │                         # - Resume with memory restoration
│   │                         # - Export to JSON
│   │
│   ├── completions.ts       # Shell completions (~40 lines)
│   │                         # - bash/zsh/fish completion scripts
│   │
│   └── mcp.ts               # MCP tools (V2 stub, ~10 lines)
│
├── core/
│   ├── agent.ts             # The agent loop (~120 lines)
│   │                         # - Send to LM Studio via OpenAI SDK
│   │                         # - Parse tool calls from response
│   │                         # - Execute tools with permission checks
│   │                         # - Context compaction at 70% limit
│   │                         # - Circuit breaker (max 30 tool calls)
│   │
│   ├── config.ts            # Config loading & resolution (~80 lines)
│   │                         # - Priority: CLI flags > env > project > user > defaults
│   │                         # - Zod validation
│   │                         # - cosmiconfig for .opta/config.json discovery
│   │
│   ├── tools.ts             # Tool definitions & execution (~200 lines)
│   │                         # - 8 tool schemas (read, write, edit, list, search, find, run, ask)
│   │                         # - Tool executors (call actual fs/shell)
│   │                         # - Permission resolution (allow/ask/deny)
│   │                         # - Tool result formatting
│   │
│   ├── errors.ts            # Error types & formatting (~40 lines)
│   │                         # - EXIT codes (SUCCESS, ERROR, NO_CONNECTION, etc.)
│   │                         # - Error message format (Context → Problem → Solution)
│   │                         # - SIGINT handler
│   │
│   ├── debug.ts             # Debug & verbose logging (~30 lines)
│   │                         # - Colored debug output
│   │                         # - Conditional logging (--verbose, --debug flags)
│   │
│   └── version.ts           # Version reading (~10 lines)
│
├── providers/
│   ├── base.ts              # Provider interface (~30 lines)
│   │                         # - abstract class ProviderClient
│   │                         # - methods: listModels(), complete(), health()
│   │
│   ├── manager.ts           # Provider selection (~40 lines)
│   │                         # - Detect provider from config
│   │                         # - Create appropriate client (LMStudio vs Anthropic)
│   │                         # - Health check + fallback
│   │
│   ├── lmstudio.ts          # LM Studio adapter (~60 lines)
│   │                         # - Wraps OpenAI SDK
│   │                         # - Points to custom base URL (192.168.188.11:1234)
│   │                         # - Handles streaming responses
│   │
│   └── anthropic.ts         # Anthropic adapter (V2 stub, ~10 lines)
│
├── memory/
│   └── store.ts             # Session persistence (~80 lines)
│                            # - Session CRUD (read, write, list, delete)
│                            # - Load `.opta/memory.md` for project context
│                            # - Session schema validation
│
├── skills/
│   └── loader.ts            # SKILL.md loader (V2 stub, ~20 lines)
│
└── ui/
    ├── output.ts            # Terminal output helpers (~40 lines)
    │                         # - Chalk color constants
    │                         # - TTY detection
    │                         # - NO_COLOR support
    │
    ├── spinner.ts           # Ora wrapper (~30 lines)
    │                         # - Non-TTY fallback (plain text)
    │                         # - Spinner styling
    │
    └── markdown.ts          # Markdown rendering (~20 lines)
                              # - marked + marked-terminal setup
                              # - TTY-aware rendering
```

---

## Module Responsibilities

### Entry Point: `src/index.ts`

- Imports only `commander` + `chalk` (fast)
- Defines global flags (`--verbose`, `--debug`, `--version`)
- Routes each command via lazy import (only when called)
- Handles top-level errors

**Why lazy loading?**  
`opta --help` <50ms (commander + chalk = fast). Full `opta chat` startup ~200ms (loads openai, marked, ora on demand).

### Commands: `src/commands/*.ts`

Each command file exports an async function that:
1. Parses command-specific flags
2. Loads config via `core/config.ts`
3. Calls provider (for models, connect) OR agent loop (for chat, do)
4. Renders results via `ui/*.ts` helpers
5. Handles errors, exits with appropriate code

**Example: `chat.ts`**
```typescript
export async function startChat(options: { resume?: string; model?: string }) {
  const config = await loadConfig(options);
  const session = options.resume 
    ? await loadSession(options.resume)
    : createNewSession();
  
  while (true) {
    const userInput = await getInput('you: ');
    if (userInput === '/exit') break;
    
    const response = await runAgent(userInput, session, config);
    await saveSession(session);
  }
}
```

### Core Loop: `src/core/agent.ts`

The heart of Opta. Implements the agent loop:

```
Input → LM Studio API → Parse response
  ├─ text only? Render & done
  └─ tool calls? Execute each → feed back → loop
```

**Key patterns:**

- **Streaming:** `stream: true` in OpenAI SDK call. Collect tokens and tool calls incrementally.
- **Permission gates:** Before every `edit_file`, `write_file`, `run_command`, check `config.permissions[toolName]`. If `'ask'`, prompt user.
- **Context compaction:** If messages > 70% of `model.contextLimit`, summarize old turns before re-sending.
- **Circuit breaker:** After 30 tool calls in one loop, pause and ask user to continue.

**File:** `src/core/agent.ts` (~120 lines). Read this to understand the core flow.

### Tool System: `src/core/tools.ts`

8 tools exposed as OpenAI function schemas:

| Tool | What | Example |
|------|------|---------|
| `read_file` | Read file content | Read the auth.ts file |
| `write_file` | Create or overwrite | Write boilerplate to new file |
| `edit_file` | Exact-match string replace | Fix a bug in one function |
| `list_dir` | Directory listing | Show project structure |
| `search_files` | Regex search via ripgrep | Find all uses of "token" |
| `find_files` | Glob file name search | Find all .test.ts files |
| `run_command` | Execute bash command | Run `npm test` |
| `ask_user` | Ask a clarifying question | Get approval for a decision |

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

Users override via `opta config set permissions.edit_file allow`.

In CI mode, all `'ask'` becomes `'deny'`.

### Config System: `src/core/config.ts`

Loads config from (priority high → low):

1. CLI flags (`--host`, `--model`)
2. Environment variables (`OPTA_HOST`, `OPTA_MODEL`)
3. Project config (`.opta/config.json` via cosmiconfig)
4. User config (`~/.config/opta/config.json` via conf)
5. Hardcoded defaults (host: `192.168.188.11`, port: `1234`)

**Validation:** Zod schema ensures config is well-formed before use.

### Provider Interface: `src/providers/base.ts`

Abstract class:

```typescript
export abstract class ProviderClient {
  abstract listModels(): Promise<ModelInfo[]>;
  abstract complete(messages: Message[], options: CompleteOptions): Promise<CompleteResponse>;
  abstract health(): Promise<boolean>;
}
```

Implementations:
- `LMStudioClient` — Points to LM Studio HTTP API
- `AnthropicClient` — V2 stub, would use Anthropic SDK

This allows easy swapping of providers later.

### Session Storage: `src/memory/store.ts`

Sessions stored as JSON:

```json
{
  "id": "abc123",
  "created": "2026-02-15T10:30:00Z",
  "model": "Qwen2.5-72B",
  "cwd": "/Users/matthewbyrden/Opta",
  "title": "Fix auth middleware",
  "messages": [ ... ],
  "toolCallCount": 7,
  "compacted": false
}
```

File path: `~/.config/opta/sessions/<id>.json`

Sessions can be resumed, exported, or deleted.

Project memory (`.opta/memory.md`) injected into system prompt at session start.

### UI Helpers: `src/ui/*.ts`

- `output.ts` — Chalk colors, TTY detection, NO_COLOR check
- `spinner.ts` — Ora wrapper with non-TTY fallback
- `markdown.ts` — marked + marked-terminal for terminal rendering

These ensure output is consistent and respects user preferences (colors, TTY, CI mode).

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
  const response = await lmstudio.complete(messages);
  
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

If LM Studio is unreachable, fail fast with actionable error. No fallback to OpenAI/Anthropic in V1.

### Single-Threaded Agent Loop

One model call at a time. No swarms, no parallel tool execution. Sequential tool calls only.

### Tool Execution Overhead

8 tool definitions in OpenAI schema format = ~1.5K tokens. Keep tool descriptions concise.

---

## Testing Strategy

### Unit Tests: `src/__tests__/core/`

- `agent.test.ts` — Agent loop with mocked LM Studio responses
- `config.test.ts` — Config loading and merging
- `tools.test.ts` — Tool execution, permission checks

### Command Tests: `src/__tests__/commands/`

- `connect.test.ts` — LM Studio discovery flow
- `models.test.ts` — Model listing and switching

### E2E Test: `src/__tests__/cli.test.ts`

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
npm run dev -- --debug       # See API calls to LM Studio
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

### Mock LM Studio Responses

In tests, use mock responses:

```typescript
vi.mocked(lmstudio.complete).mockResolvedValue({
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

1. Define schema in `src/core/tools.ts` (OpenAI function format)
2. Add executor function
3. Update tool types + permissions defaults
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
- [ ] External API calls use correct provider (LM Studio only, no Anthropic fallback in V1)
- [ ] Error messages are actionable (Context → Problem → Solution)

---

## References

- **Design Doc:** `docs/plans/2026-02-12-opta-cli-v1-design.md` — Full spec, agent loop diagram, V2+ roadmap
- **Decisions:** `docs/DECISIONS.md` — Why we chose OpenAI schema, lazy loading, etc.
- **Guardrails:** `docs/GUARDRAILS.md` — Safety rules for tool execution
- **Index:** `docs/INDEX.md` — Read order for this architecture
