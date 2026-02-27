# Auto-07: Custom User-Defined Tools

**Priority:** HIGH (gap score 3) | **Effort:** ~120 lines | **New module**
**Competitors with this:** OpenCode (JS/TS files in .opencode/tools/ — best in class), Claude Code (via hooks), Kimi Code (Skills)

**Launch:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1D-Opta-CLI-TS && claude --dangerously-skip-permissions`
**Paste:** `Proceed with the plan located at: /Users/matthewbyrden/Synced/Opta/1-Apps/1D-Opta-CLI-TS/tasks/plans/auto-07-custom-tools.md`

---

<context>
Read these files first:
1. `CLAUDE.md` — Architecture guide
2. `src/core/tools.ts` — Built-in tools + TOOL_SCHEMAS array (custom tools merge here)
3. `src/core/agent.ts` — System prompt + agent loop (custom tools must be included)
4. `src/core/config.ts` — Config loading
</context>

<instructions>
### 1. Create `src/tools/custom.ts` (~100 lines)

Custom tool loader:

```typescript
interface CustomToolDef {
  name: string;
  description: string;
  parameters: object;        // JSON Schema
  command: string;            // Shell command template
  timeout?: number;           // Default 30000
}

// Discover custom tools from:
// 1. .opta/tools/*.json (project-local)
// 2. ~/.config/opta/tools/*.json (global)
export async function loadCustomTools(): Promise<CustomToolDef[]>

// Convert to OpenAI function-call schema format
export function toToolSchema(tool: CustomToolDef): object

// Execute a custom tool — runs shell command with args as env vars
export async function executeCustomTool(tool: CustomToolDef, args: Record<string, unknown>): Promise<string>
```

### 2. Tool definition format

Each `.json` file in `.opta/tools/` defines one tool:

```json
{
  "name": "deploy",
  "description": "Deploy the current project to production",
  "parameters": {
    "type": "object",
    "properties": {
      "environment": { "type": "string", "description": "Target environment (staging/production)" }
    },
    "required": ["environment"]
  },
  "command": "bash scripts/deploy.sh $OPTA_TOOL_ARG_ENVIRONMENT",
  "timeout": 60000
}
```

### 3. Argument passing

Tool arguments are passed as environment variables:
- Each arg becomes `OPTA_TOOL_ARG_{NAME_UPPER}`
- Example: `environment` → `OPTA_TOOL_ARG_ENVIRONMENT`
- Also pass full args as JSON: `OPTA_TOOL_ARGS='{"environment":"production"}'`

### 4. Merge with built-in tools

In `tools.ts`, at the end of TOOL_SCHEMAS initialization:
1. Call `loadCustomTools()` at module load time (lazy — loaded on first agent loop)
2. Append custom tool schemas to TOOL_SCHEMAS
3. In `executeTool`, check if tool name matches a custom tool → route to `executeCustomTool`

### 5. Validation

When loading custom tools:
- Reject tools with names conflicting with built-in tools (read_file, write_file, etc.)
- Validate JSON schema structure
- Warn on tools with >30s timeout
- Max 10 custom tools (warn at >20 — token budget consideration)

### 6. Tests

Create `tests/tools/custom.test.ts`:
- Loads tool from .opta/tools/*.json
- Rejects conflicting names
- Executes shell command with correct env vars
- Timeout kills slow commands
- Invalid JSON schema rejected
</instructions>

<constraints>
- Tool definitions are JSON only (not JS/TS like OpenCode — simpler, more portable)
- Execution is always a shell command (no arbitrary code execution)
- Custom tools have the same permission model as run_command (ask_user if not in skip-permissions mode)
- Max 10 custom tools to prevent token budget explosion
</constraints>

<output>
When finished:
```bash
npm run typecheck && npm test
openclaw system event --text "Done: Auto-07 — Custom tool system (.opta/tools/*.json), shell execution, env var args" --mode now
```
</output>
