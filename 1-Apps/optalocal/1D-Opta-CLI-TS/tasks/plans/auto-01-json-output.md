# Auto-01: JSON Output Flag

**Priority:** MEDIUM (gap score 2) | **Effort:** ~30 lines | **Quick Win ✅**
**Competitors with this:** Claude Code (`--output-format json`), OpenCode (`-f json`)

**Launch:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1D-Opta-CLI-TS && claude --dangerously-skip-permissions`
**Paste:** `Proceed with the plan located at: /Users/matthewbyrden/Synced/Opta/1-Apps/1D-Opta-CLI-TS/tasks/plans/auto-01-json-output.md`

---

<context>
Read these files first:
1. `CLAUDE.md` — Architecture guide
2. `src/commands/do.ts` — Non-interactive task execution (add --format flag here)
3. `src/core/agent.ts` — Agent loop (need to capture structured output)
4. `src/index.ts` — CLI command definitions (add --format option)
</context>

<instructions>
### 1. Add `--format` option to `opta do`

In `src/index.ts`, add a `-f, --format <type>` option to the `do` command:
```typescript
.option('-f, --format <type>', 'Output format: text (default) or json')
```

### 2. Modify `do.ts` to support JSON output

When `--format json` is passed:
- Suppress spinner, chalk colors, and markdown rendering
- Capture the final assistant message
- Output a JSON object:
```json
{
  "result": "assistant's final message text",
  "tool_calls": 5,
  "model": "model-id",
  "session_id": "xxx"
}
```

### 3. Also add to `opta chat`

Add `--format json` to chat command. When set:
- Each assistant response is printed as a JSON line (JSONL):
```json
{"role": "assistant", "content": "...", "tool_calls": [...]}
```

### 4. Tests

Add to `tests/cli.test.ts`:
- Test that `--format json` option is recognized
- Test JSON output structure has required fields
</instructions>

<constraints>
- Pure addition — no breaking changes to existing text output
- Default format is always "text" (current behavior unchanged)
- JSON output must be valid parseable JSON (no trailing commas, no chalk escape codes)
- Suppress ALL non-JSON output when --format json (no spinners, no banners)
</constraints>

<output>
When finished:
```bash
npm run typecheck && npm test
openclaw system event --text "Done: Auto-01 — JSON output flag added to opta do and opta chat" --mode now
```
</output>
