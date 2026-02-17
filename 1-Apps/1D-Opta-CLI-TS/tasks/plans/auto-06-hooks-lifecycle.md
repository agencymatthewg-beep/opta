# Auto-06: Hooks / Lifecycle Events

**Priority:** HIGH (gap score 3) | **Effort:** ~180 lines | **New module**
**Competitors with this:** Claude Code (PreToolUse/PostToolUse/Stop/Notification), OpenCode (plugin hooks)

**Launch:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1D-Opta-CLI-TS && claude --dangerously-skip-permissions`
**Paste:** `Proceed with the plan located at: /Users/matthewbyrden/Synced/Opta/1-Apps/1D-Opta-CLI-TS/tasks/plans/auto-06-hooks-lifecycle.md`

---

<context>
Read these files first:
1. `CLAUDE.md` — Architecture guide
2. `src/core/tools.ts` — Tool execution (hooks fire around this)
3. `src/core/agent.ts` — Agent loop (hooks fire at start/stop/compact)
4. `src/core/config.ts` — Config loading (hooks defined in config)
</context>

<instructions>
### 1. Create `src/hooks/manager.ts` (~100 lines)

```typescript
type HookEvent =
  | 'session.start'      // Agent loop begins
  | 'session.end'        // Agent loop ends (final response)
  | 'tool.pre'           // Before any tool execution
  | 'tool.post'          // After any tool execution
  | 'compact'            // After auto-compaction
  | 'error';             // On agent error

interface HookDefinition {
  event: HookEvent;
  command: string;       // Shell command to run
  timeout?: number;      // Timeout ms (default 10000)
  background?: boolean;  // Don't wait for completion (default false)
}

interface HookContext {
  event: HookEvent;
  tool_name?: string;     // For tool.pre/tool.post
  tool_args?: string;     // JSON string of tool args
  tool_result?: string;   // For tool.post only
  session_id?: string;
  model?: string;
}

class HookManager {
  constructor(hooks: HookDefinition[])

  // Run all hooks matching event, passing context as env vars
  async fire(event: HookEvent, context: HookContext): Promise<void>
}
```

### 2. Hook execution

Each hook runs as a shell command via `execa`:
- Context passed as environment variables: `OPTA_EVENT`, `OPTA_TOOL_NAME`, `OPTA_TOOL_ARGS`, `OPTA_SESSION_ID`
- Timeout: 10 seconds default (configurable)
- If `background: true`, fire and forget (don't await)
- If hook exits non-zero on `tool.pre`, CANCEL the tool execution and return the hook's stderr as the tool result

### 3. Config schema

In config, add hooks section:
```json
{
  "hooks": [
    {
      "event": "tool.pre",
      "command": "echo 'About to run $OPTA_TOOL_NAME'",
      "timeout": 5000
    },
    {
      "event": "session.end",
      "command": "git add -A && git commit -m 'opta: session complete'",
      "background": true
    }
  ]
}
```

Config location: `.opta/config.json` (project-local) or `~/.config/opta/config.json` (global)

### 4. Wire into agent loop

In `agent.ts`:
- Fire `session.start` at loop begin
- Fire `tool.pre` before each `executeTool()` — if hook cancels, skip tool
- Fire `tool.post` after each `executeTool()`
- Fire `session.end` when loop completes
- Fire `error` on any unhandled error

### 5. Tests

Create `tests/hooks/manager.test.ts`:
- Hook fires on matching event
- Hook receives correct env vars
- tool.pre cancellation works (non-zero exit = skip tool)
- Timeout kills slow hooks
- background hooks don't block
- No hooks configured = no-op
</instructions>

<constraints>
- Hooks are OPTIONAL — zero hooks configured = zero overhead
- Hook commands run in the same shell as run_command tool
- tool.pre cancellation is the only hook that can block execution
- Keep hook timeout strict (10s) — hooks should be lightweight
- Don't pass file contents in env vars (too large) — only metadata
</constraints>

<output>
When finished:
```bash
npm run typecheck && npm test
openclaw system event --text "Done: Auto-06 — Hook system with 6 lifecycle events, tool cancellation, env var context" --mode now
```
</output>
