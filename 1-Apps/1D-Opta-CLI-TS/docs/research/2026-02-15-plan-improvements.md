# Opta CLI Plan Improvements — Research Findings (2026-02-15)

## Current V1 Wiring Plan Assessment

The plan is solid for what it covers. Gaps identified:

### 1. Multi-Provider Support (Priority: Medium)
Current plan only wires LM Studio. But `src/providers/` already has:
- `base.ts` — abstract provider interface
- `lmstudio.ts` — LM Studio adapter
- `anthropic.ts` — exists (needs verification)
- `manager.ts` — provider manager

**Improvement:** The chat command should use `manager.ts` to support provider switching mid-session, not hardcode LM Studio. This is ~20 extra lines in chat.ts.

### 2. Session Title Generation (Priority: Low)
Plan says "first user message, truncated to 60 chars". Better: use the LLM to generate a 4-6 word title after the first exchange (like Claude Code does). Costs 1 extra API call but dramatically improves session list readability.

**Trade-off:** Adds latency + 1 API call per new session. Skip for V1 if local models are slow.

### 3. Context Window Management (Priority: High)
Plan mentions `agentLoop` has compaction, but doesn't specify how `chat.ts` handles context overflow across turns. If a session has 50 messages and the model's context is 32K:
- Option A: Always compact before sending (safe, lossy)
- Option B: Sliding window of recent messages + compacted summary
- Option C: Pass all messages, let agent loop's circuit breaker handle overflow

**Recommendation:** Option B — store a running summary in session metadata, send summary + last N messages. This is what Claude Code and Cursor do.

### 4. MCP Stub (`src/skills/loader.ts`)
Plan says "leave as-is (V2 stub)". Fine, but worth adding a `--mcp` flag to chat.ts that's hidden/disabled, so the command signature doesn't change when MCP lands in V2.

### 5. Anthropic Provider (`src/providers/anthropic.ts`)
File exists but wasn't mentioned in the wiring plan. Worth verifying if it works — if Matthew has Anthropic API access, this gives Opta CLI cloud model support immediately.

---

## No Structural Changes Needed
The V1 wiring plan is well-scoped. These are enhancements, not blockers. The plan can execute as-is and these improvements can be follow-up PRs.
