# Auto-08: Token Usage Display + Thinking Indicator

**Priority:** MEDIUM (gap score 2) | **Effort:** ~60 lines | **Quick Win ✅**
**Competitors with this:** Claude Code (status bar + thinking display), OpenCode (token % display)

**Launch:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1D-Opta-CLI-TS && claude --dangerously-skip-permissions`
**Paste:** `Proceed with the plan located at: /Users/matthewbyrden/Synced/Opta/1-Apps/1D-Opta-CLI-TS/tasks/plans/auto-08-token-display.md`

---

<context>
Read these files first:
1. `CLAUDE.md` — Architecture guide
2. `src/core/agent.ts` — Agent loop (add display after each response)
3. `src/ui/spinner.ts` — UI utilities (add token bar here)
4. `src/lmx/client.ts` — lookupContextLimit function
</context>

<instructions>
### 1. Create token bar renderer in `src/ui/tokens.ts` (~40 lines)

```typescript
export function renderTokenBar(used: number, limit: number): string
```

Output format:
```
[████████░░] 78% · 6,240 / 8,000 tokens
```

- Use chalk.green for <60%, chalk.yellow for 60-80%, chalk.red for >80%
- Filled blocks: `█`, empty: `░`
- Bar width: 20 chars
- Only render if used > 50% of limit (don't clutter low-usage sessions)

### 2. Track token usage in agent loop

In `agent.ts`, after receiving each completion response:
1. Check `response.usage` for `prompt_tokens` and `completion_tokens`
2. If the API returns usage data, use it directly
3. If not (some local models don't), fall back to `estimateTokens()` from compactor (Auto-03) or simple char/4 estimate
4. Call `renderTokenBar(totalTokens, contextLimit)` and print with `chalk.dim`

### 3. Thinking indicator

When the model is processing (between user input and first response token):
- Show spinner with: `⟳ Thinking...`
- If streaming, update to: `⟳ Generating... (${tokensGenerated} tokens)`
- After completion: clear spinner, show response

This mostly exists via ora spinner already — just ensure the token count updates during streaming if possible.

### 4. Tests

Add to test file:
- renderTokenBar at 0% returns empty
- renderTokenBar at 50% shows half-filled bar
- renderTokenBar at 100% shows full red bar
- Token formatting includes commas for thousands
</instructions>

<constraints>
- No new dependencies (chalk + existing utilities only)
- Token display is informational only — doesn't affect behavior
- Fall back gracefully if API doesn't return usage data
- Keep display compact (one line, after each response)
</constraints>

<output>
When finished:
```bash
npm run typecheck && npm test
openclaw system event --text "Done: Auto-08 — Token usage bar + thinking indicator" --mode now
```
</output>
