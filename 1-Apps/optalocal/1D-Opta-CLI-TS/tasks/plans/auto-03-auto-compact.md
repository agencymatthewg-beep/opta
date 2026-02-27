# Auto-03: Auto-Compact / Context Window Management

**Priority:** HIGH (gap score 3) | **Effort:** ~150 lines | **New module**
**Competitors with this:** Claude Code (auto-compact), OpenCode (auto-compact at 95%)

**Launch:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1D-Opta-CLI-TS && claude --dangerously-skip-permissions`
**Paste:** `Proceed with the plan located at: /Users/matthewbyrden/Synced/Opta/1-Apps/1D-Opta-CLI-TS/tasks/plans/auto-03-auto-compact.md`

---

<context>
Read these files first:
1. `CLAUDE.md` — Architecture guide
2. `src/core/agent.ts` — Agent loop (this is where compaction triggers)
3. `src/lmx/client.ts` — LMX client (has lookupContextLimit function)
4. `src/commands/chat.ts` — Chat REPL (has /compact slash command)
5. `docs/research/2026-02-15-plan-improvements.md` — Sliding window + summary recommendation
</context>

<instructions>
### 1. Create `src/context/compactor.ts` (~100 lines)

Token estimation + compaction logic:

```typescript
export interface CompactionResult {
  messages: AgentMessage[];
  compacted: boolean;
  tokensBefore: number;
  tokensAfter: number;
}

// Estimate tokens (4 chars ≈ 1 token, good enough for triggering)
export function estimateTokens(messages: AgentMessage[]): number

// Check if compaction needed (>80% of context limit)
export function needsCompaction(messages: AgentMessage[], contextLimit: number): boolean

// Compact: summarize early messages, keep recent ones
export async function compactMessages(
  messages: AgentMessage[],
  client: OpenAI,
  model: string,
  contextLimit: number
): Promise<CompactionResult>
```

**Compaction strategy (sliding window + summary):**
1. Keep the system prompt (message[0]) always
2. Keep the last N messages (where N = messages that fit in 40% of context)
3. Summarize all messages between system prompt and kept messages into a single "Previously:" message
4. The summary request itself uses the model: `"Summarize this conversation concisely, preserving key decisions, file paths mentioned, and current task state."`

### 2. Token usage display

After each assistant response in the agent loop (`agent.ts`), print a token usage bar:
```
[████████░░] 78% context (6,240 / 8,000 tokens)
```

Use chalk.dim for the bar. Only show when usage > 50%.

### 3. Auto-compact trigger

In the agent loop, after each assistant response:
1. Call `estimateTokens()` on the full message history
2. If `needsCompaction()` returns true (>80% of context):
   - Print: `⚡ Context 80% full — auto-compacting...`
   - Call `compactMessages()`
   - Print: `✅ Compacted: ${tokensBefore} → ${tokensAfter} tokens`
3. Continue the loop with the compacted messages

### 4. Wire into /compact slash command

In `chat.ts`, the existing `/compact` slash command should call `compactMessages()` directly (manual trigger).

### 5. Config option

In `src/core/config.ts`, add to config schema:
```typescript
autoCompact: boolean  // default: true
compactThreshold: number  // default: 0.8 (80%)
```

### 6. Tests

Create `tests/context/compactor.test.ts`:
- `estimateTokens` returns reasonable estimate (±20% of actual)
- `needsCompaction` triggers at threshold
- Compaction preserves system prompt and last N messages
- Compaction inserts summary message
</instructions>

<constraints>
- Token estimation is APPROXIMATE (4 chars = 1 token). This is intentional — no tokenizer dependency.
- Context limit comes from `lookupContextLimit()` in lmx/client.ts
- Summary uses the same model/client that's already connected (no extra API call setup)
- Auto-compact is opt-out via config (`autoCompact: false`)
- Never compact below 3 messages (system + summary + last user msg)
</constraints>

<output>
When finished:
```bash
npm run typecheck && npm test
openclaw system event --text "Done: Auto-03 — Auto-compact with token display, 80% threshold, sliding window + summary" --mode now
```
</output>
