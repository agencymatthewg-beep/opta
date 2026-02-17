---
title: Architecture Decisions
purpose: Settled design choices and their rationale
updated: 2026-02-15
reference: docs/plans/2026-02-12-opta-cli-v1-design.md
---

# Opta CLI — Architecture Decisions

This document records **settled decisions** made during Opta CLI design. These explain the "why" behind the architecture.

Each decision lists the question, options considered, the choice made, and the rationale.

---

## Decision 1: Direct API Connection (No Daemon)

### Question
Should Opta CLI connect directly to the inference server, or through an Opta daemon service?

### Options Considered
1. **Direct API** — CLI talks directly to Opta-LMX via HTTP
2. **Daemon** — Mac Studio runs a daemon; CLI connects to daemon

### Decision
**Direct API** (Option 1)

### Rationale

| Aspect | Direct API | Daemon |
|--------|-----------|--------|
| **Latency** | Low (direct HTTP) | Higher (2 hops) |
| **Reliability** | If Opta-LMX down, obvious error | If daemon down, confusing error |
| **Complexity** | Simple (one service to talk to) | Complex (daemon management) |
| **Debugging** | Easy (curl to Opta-LMX API) | Harder (debug daemon logs) |
| **Cost** | No additional service | Extra process on Mac Studio |
| **Future** | Can add daemon layer later if needed | Can't remove it easily |

### Implication
- All Opta CLI network calls go directly to Opta-LMX at `192.168.188.11:1234`
- Errors make it obvious if Mac Studio is offline
- No daemon to start/stop/manage

### Future
V2+ could add a daemon layer if we need multi-device sync or other features.

---

## Decision 2: OpenAI Function-Call Format

### Question
What schema format should we use for tool definitions? OpenAI native, custom, or something else?

### Options Considered
1. **OpenAI function-call schema** — `{ type: 'function', function: { name, description, parameters } }`
2. **Custom schema** — Invent our own tool format
3. **JSON-RPC** — Standard RPC schema

### Decision
**OpenAI function-call schema** (Option 1)

### Rationale

| Aspect | OpenAI | Custom | JSON-RPC |
|--------|--------|--------|----------|
| **LLM support** | Qwen, GLM, DeepSeek work natively via Opta-LMX | May not work with local models | Not common in LLMs |
| **Code examples** | Tons of examples online | Few examples | Few examples |
| **SDK support** | OpenAI SDK native | Need custom adapter | Need custom adapter |
| **Debugging** | Can inspect raw schema | Harder to debug | Less familiar |
| **Spec stability** | Stable (OpenAI maintains it) | We maintain it | Stable but less used |

### Implication
- Tool definitions in `src/core/tools.ts` are valid OpenAI schemas
- Can reuse OpenAI SDK directly (no custom adapter)
- Future migration to other schema formats is possible

### Example Tool Definition
```json
{
  "type": "function",
  "function": {
    "name": "read_file",
    "description": "Read a file's contents",
    "parameters": {
      "type": "object",
      "properties": {
        "path": { "type": "string" },
        "offset": { "type": "number" },
        "limit": { "type": "number" }
      },
      "required": ["path"]
    }
  }
}
```

---

## Decision 3: Lazy Loading of Dependencies

### Question
Should we load all dependencies on startup, or load them on-demand?

### Options Considered
1. **Lazy loading** — Load each dependency when its command runs
2. **Eager loading** — Import all deps in `src/index.ts`

### Decision
**Lazy loading** (Option 1)

### Rationale

| Metric | Lazy | Eager |
|--------|------|-------|
| **Startup time** | <50ms (help only) | ~500ms (all deps) |
| **Memory used** | 10-20MB (core only) | 50-100MB (all deps) |
| **Debugging** | Harder (lazy errors) | Easier (all errors visible) |
| **Code clarity** | Slightly more complex | Cleaner |

**Lazy loading wins because:**
- Matthew runs `opta --help` frequently (should be instant)
- `opta chat` startup is <200ms (acceptable)
- Memory savings matter on memory-constrained devices
- Common pattern in modern CLIs (Vercel Next CLI, etc.)

### Implication
```typescript
// In src/index.ts — only imports commander + chalk
program.command('chat').action(async (opts) => {
  const { startChat } = await import('./commands/chat.js');
  await startChat(opts);
});
```

### Tradeoff
- Lazy import errors show up when command runs, not on startup
- Tests must mock each dependency individually

---

## Decision 4: Single-Threaded Agent Loop

### Question
Should the agent execute tool calls sequentially or in parallel?

### Options Considered
1. **Sequential** — Execute tools one at a time, wait for result before next
2. **Parallel** — Execute multiple tools concurrently (if model calls multiple tools)

### Decision
**Sequential** (Option 1)

### Rationale

| Aspect | Sequential | Parallel |
|--------|-----------|----------|
| **Simplicity** | Simple logic | Complex orchestration |
| **Correctness** | Tool effects easy to reason about | Order-dependent bugs |
| **Performance** | Slower for independent tools | Faster if tools don't depend on each other |
| **Debugging** | Linear execution trace | Hard to debug timing issues |
| **Bandwidth** | One tool at a time | All tools start simultaneously |

**Sequential wins because:**
- Agent loop is easier to understand and debug
- Most tool sequences are dependent (edit file → test → view result)
- Qwen2.5-72B doesn't typically call 10 tools at once anyway
- Can always parallelize in V2 if benchmarks show it matters

### Implication
```typescript
// In agent.ts
for (const call of toolCalls) {
  const result = await executeTool(call);  // Wait before next
  messages.push(toolResult(call.id, result));
}
// Then loop back to model with all results
```

### Future
V2+ could support parallel tool execution with appropriate orchestration.

---

## Decision 5: Provider Interface Pattern

### Question
How should we abstract different LLM providers (Opta-LMX, Anthropic, OpenAI)?

### Options Considered
1. **Provider interface** — Abstract `ProviderClient` base class
2. **Conditional imports** — `if (provider === 'lmx') { import LmxClient; } ...`
3. **Provider factory** — Single factory function that returns client

### Decision
**Provider interface** (Option 1)

### Rationale

| Aspect | Interface | Conditional | Factory |
|--------|-----------|-----------|---------|
| **Testability** | Easy to mock | Need mocks per provider | Medium |
| **Extensibility** | Adding V2 provider is easy | Need new if-branch | Need new factory case |
| **Type safety** | Enforced (abstract class) | Not enforced | Medium |
| **Complexity** | Slight overhead | Simple | Medium |

### Implication
```typescript
// In src/providers/base.ts
export abstract class ProviderClient {
  abstract listModels(): Promise<ModelInfo[]>;
  abstract complete(messages: Message[]): Promise<CompleteResponse>;
  abstract health(): Promise<boolean>;
}

// In src/lmx/client.ts
export class LmxClient extends ProviderClient {
  // Implementation
}

// In src/providers/manager.ts
function getProvider(config: OptaConfig): ProviderClient {
  if (config.provider === 'lmx') {
    return new LmxClient(config);
  }
  if (config.provider === 'anthropic') {
    return new AnthropicClient(config);
  }
  throw new Error(`Unknown provider: ${config.provider}`);
}
```

### Future
Adding Anthropic, OpenAI, Google Gemini providers in V2 is straightforward — just add new `ProviderClient` implementations.

---

## Decision 6: Permission Model (Allow/Ask/Deny)

### Question
How should we control whether tools can execute?

### Options Considered
1. **Allow/Ask/Deny** — Granular per-tool permissions
2. **Yes/No** — Global "approve all" or "deny all"
3. **Approval list** — Whitelist specific commands
4. **No permissions** — Everything auto-executes (unsafe)

### Decision
**Allow/Ask/Deny** (Option 1)

### Rationale

| Model | Safety | Usability | Flexibility |
|-------|--------|-----------|-------------|
| **Allow/Ask/Deny** | ✅ High | ✅ Good | ✅ Excellent |
| **Yes/No** | Medium | Poor (all or nothing) | Poor |
| **Approval list** | ✅ High | Medium | Medium |
| **No permissions** | 🚫 None | ✅ Best | ✅ Best |

**Allow/Ask/Deny wins because:**
- Read tools (safe) always allow
- Edit/bash tools (risky) ask by default
- Users can customize: `opta config set permissions.edit_file allow`
- In CI mode, all `ask` becomes `deny` (safe by default)
- Familiar mental model from other tools (vim permissions, git safety)

### Implication
```typescript
// Default permissions in src/core/tools.ts
const DEFAULT_PERMISSIONS = {
  read_file: 'allow',
  write_file: 'ask',
  edit_file: 'ask',
  run_command: 'ask',
  ask_user: 'allow',
};
```

### Future
Could add time-based or rate-limited permissions in V2 (e.g., "allow 5 edits per session").

---

## Decision 7: Session Persistence Format

### Question
How should we store session history? JSON files, SQLite, cloud, something else?

### Options Considered
1. **JSON files** — One file per session in `~/.config/opta/sessions/`
2. **SQLite** — Single database file
3. **Cloud** — Sync sessions to cloud
4. **In-memory** — No persistence (lose session on exit)

### Decision
**JSON files** (Option 1)

### Rationale

| Aspect | JSON | SQLite | Cloud | In-Memory |
|--------|------|--------|-------|-----------|
| **Readability** | ✅ Human readable | Binary, not readable | Binary, not readable | N/A |
| **Portability** | ✅ Easy to copy, export | Need DB tools | Need account | N/A |
| **Searchability** | Easy (grep, text editors) | Needs SQL queries | Needs UI | N/A |
| **Scalability** | 100+ sessions ok | 1000s of sessions ok | Same | N/A |
| **Recovery** | ✅ Easy (just files) | Backup needed | Cloud provider | Lost forever |
| **Sync** | ✅ Can use Syncthing | Harder | Native | N/A |

**JSON wins because:**
- Sessions are small (<100KB typically)
- Matthew won't have 1000s of sessions (scaling isn't an issue)
- Easy to inspect sessions manually
- Can version-control sessions (git)
- Can sync with Syncthing if needed

### Implication
```
~/.config/opta/
├── sessions/
│   ├── abc123.json     # Session object
│   ├── def456.json
│   └── ...
├── config.json         # User config (via conf)
└── logs/
    └── ...
```

### Future
Could migrate to SQLite in V2 if performance becomes an issue (unlikely).

---

## Decision 8: Context Limit & Compaction Strategy

### Question
What context limit should we use, and how should we handle messages that exceed it?

### Options Considered
1. **Auto-compaction at 70%** — Summarize old turns when approaching limit
2. **Hard limit at 100%** — Reject new messages that exceed limit
3. **Sliding window** — Forget oldest turns without summarization
4. **No limit** — Send all messages (risky)

### Decision
**Auto-compaction at 70%** (Option 1)

### Rationale

| Strategy | Preservation | Usability | Complexity |
|----------|--------------|-----------|-----------|
| **Auto-compaction** | ✅ Keeps knowledge | ✅ Works forever | Medium |
| **Hard limit** | None (messages rejected) | 🚫 Fails | Simple |
| **Sliding window** | 🚫 Loses context | Works but forgetful | Simple |
| **No limit** | ✅ All context | 🚫 Crashes model | Simple |

**Auto-compaction wins because:**
- User doesn't hit a wall ("context limit exceeded")
- Session can continue indefinitely
- Model still has recent + summarized context
- 70% threshold gives buffer before model hits hard limit

### Implication
```typescript
// In agent.ts
const messageTokens = tokenCount(messages);
const contextLimit = config.model.contextLimit;

if (messageTokens > contextLimit * 0.7) {
  messages = await compactHistory(messages, config);
  // Summarize old turns, keep system + recent
}
```

### Compaction Details
- Keep system prompt (tool definitions + instructions)
- Keep last 3 turns (recent context)
- Summarize everything older than 3 turns
- New summary becomes a "history" message

### Future
Could add different compaction strategies in V2 (by intent, by token count, etc.).

---

## Decision 9: Tool Result Format

### Question
How should tool execution results be formatted when sent back to the model?

### Options Considered
1. **OpenAI tool_result message** — Standard format
2. **Custom format** — Invent our own
3. **Plain text concatenation** — Concatenate all results

### Decision
**OpenAI tool_result message** (Option 1)

### Rationale
- Works natively with OpenAI SDK
- Matches tool_calls schema
- Models trained on this format expect it
- Keeps conversation structured

### Implication
```typescript
// Tool execution result format
{
  role: 'tool',
  tool_call_id: '12345',
  content: 'result of tool execution',
}
```

---

## Decision 10: Default Connection Host

### Question
What should the default Opta-LMX host be?

### Options Considered
1. **192.168.188.11** — Mac Studio's fixed IP where Opta-LMX runs (Matthew's setup)
2. **localhost:1234** — Local machine only
3. **Discoverable** — Auto-discover via broadcast
4. **User-provided** — Always ask on first run

### Decision
**192.168.188.11** (Option 1) — But with clear error messaging

### Rationale

| Option | Flexibility | Usability | Security |
|--------|------------|-----------|----------|
| **Fixed IP** | ✅ Works for Matthew | ✅ Just works | ✅ Local LAN |
| **localhost** | 🚫 Requires tunnel | Not useful | ✅ Secure |
| **Auto-discover** | 🚫 Slow, unreliable | Medium | Medium |
| **Always ask** | ✅ Works for anyone | 🚫 Tedious | ✅ Secure |

**Fixed IP wins because:**
- Matthew's setup is stable (Mac Studio running Opta-LMX on LAN)
- Most users will have similar setup (MacBook + Mac Studio on same LAN)
- First `opta connect` can auto-discover and save the IP
- Error message is clear if it's wrong ("Cannot reach Opta-LMX at 192.168.188.11:1234. Try `opta connect --host <ip>`")

### Implication
```typescript
// In core/config.ts
const DEFAULT_CONFIG = {
  connection: {
    host: '192.168.188.11',
    port: 1234,
    protocol: 'http',
  },
  // ...
};
```

### Flexibility
- User can override with `OPTA_HOST` env var
- User can set with `opta config set connection.host <ip>`
- `opta connect --host <ip>` saves the override

---

## Summary Table

| # | Decision | Choice | Key Tradeoff |
|---|----------|--------|--------------|
| 1 | Connection | Direct API | Simplicity vs daemon features |
| 2 | Tool format | OpenAI schema | Familiarity vs custom |
| 3 | Startup | Lazy loading | Speed vs complexity |
| 4 | Tool execution | Sequential | Simplicity vs performance |
| 5 | Providers | Interface pattern | Flexibility vs overhead |
| 6 | Permissions | Allow/Ask/Deny | Safety vs usability |
| 7 | Sessions | JSON files | Simplicity vs scalability |
| 8 | Context | Auto-compaction at 70% | Preservation vs complexity |
| 9 | Tool results | OpenAI format | Familiarity vs custom |
| 10 | Default host | Fixed IP | Simplicity vs flexibility |

---

## Reversibility

Which decisions are reversible?

| # | Reversible? | Why |
|---|------------|-----|
| 1 | ✅ Yes | Can add daemon layer in V2 |
| 2 | ✅ Yes | Can migrate to different schema |
| 3 | ✅ Yes | Can remove lazy loading |
| 4 | ✅ Yes | Can add parallel execution |
| 5 | ✅ Yes | Can refactor provider pattern |
| 6 | 🔸 Partially | Hard to change default permissions |
| 7 | 🔸 Partially | Migrating JSON→SQLite is possible but tedious |
| 8 | ✅ Yes | Can change compaction threshold |
| 9 | ✅ Yes | Can change result format |
| 10 | ✅ Yes | Just change DEFAULT_CONFIG |

---

## When to Revisit These Decisions

- If performance numbers show lazy loading isn't worth it
- If Matthew's setup changes (different Mac Studio IP)
- If parallel tool execution becomes critical
- If session count exceeds ~500 (might need SQLite)
- If a new provider becomes essential (Anthropic, OpenAI)

Each decision should be revisited when the underlying assumption changes.
