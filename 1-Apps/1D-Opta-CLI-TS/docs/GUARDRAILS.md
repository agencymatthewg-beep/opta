---
title: Opta CLI Guardrails
purpose: Non-negotiable safety and design rules
updated: 2026-02-15
reference: ~/Synced/AI26/2-Bot-Ops/2A-Compliance/RULES-GLOBAL.md
---

# Opta CLI — Guardrails & Constraints

This document lists the non-negotiable rules for Opta CLI. These are not guidelines — they are hard constraints that must be followed.

---

## 🔴 CRITICAL Rules (Hard Stops)

These rules trigger **immediate action rejection**. Never bypass them.

### C01: No Data Exfiltration

**Rule:** Never send private data (API keys, tokens, personal information, file contents) to external services without explicit user approval.

**Application to Opta CLI:**
- ✅ Allowed: LM Studio API calls (local network only)
- ✅ Allowed: LM Studio connection health checks
- 🚫 Forbidden: Sending file contents to OpenAI/Anthropic without explicit `--use-cloud` flag
- 🚫 Forbidden: Logging API responses to external services
- 🚫 Forbidden: Uploading sessions to cloud without user opt-in

**Implementation:**
```typescript
// Good: Local LM Studio API only
const response = await openai.chat.completions.create({
  model: config.model.name,
  messages: [...],
  // baseURL set to local LM Studio
});

// Bad: Would exfiltrate
const response = await anthropic.messages.create({
  model: 'claude-opus',
  system: fileContents, // File contents sent to cloud
});
```

**In Tests:**
- Mock all external API calls
- Never hardcode real API keys
- Verify that credentials are not logged

---

### C02: No Destructive Commands Without Confirmation

**Rule:** `rm -rf`, `DELETE`, format operations, and other destructive actions require explicit confirmation from the user ("yes, delete" or similar).

**Application to Opta CLI:**
- ✅ Allowed: `edit_file` (exact-match string replacement, reversible)
- ✅ Allowed: `write_file` with `--confirm` or user approval
- 🚫 Forbidden: Auto-overwriting files without asking
- 🚫 Forbidden: Running `rm` without user approval
- 🚫 Forbidden: Deleting sessions without confirmation

**Implementation:**
```typescript
// In tools.ts - run_command
if (command.includes('rm') || command.includes('dd') || command.includes('format')) {
  const approved = await confirmToolApproval({
    toolName: 'run_command',
    description: `Execute: ${command}`,
    isDestructive: true,
  });
  if (!approved) {
    return toolResult(callId, 'User declined this destructive action.');
  }
}

// In commands/sessions.ts - delete session
const confirmed = await confirm({
  message: `Delete session "${session.title}"? This cannot be undone.`,
});
if (!confirmed) return;
```

**In Tests:**
- Test that `edit_file` asks for approval before executing
- Test that `rm` commands are blocked unless approved
- Test that CI mode auto-denies destructive actions

---

### C03: No External Posts Without Approval

**Rule:** Never send messages to Telegram, email, Discord, or public platforms without explicit user confirmation.

**Application to Opta CLI:**
- ✅ Allowed: Logging to local files (`~/.opta/logs/`)
- ✅ Allowed: Printing to stdout (user sees it)
- 🚫 Forbidden: Sending error reports to external service without opt-in
- 🚫 Forbidden: Posting session summaries to Telegram
- 🚫 Forbidden: Exporting to cloud storage without asking

**Implementation:**
```typescript
// Bad: Would post externally
if (sessionError) {
  await message.send({
    target: 'telegram',
    text: `Opta CLI error in ${cwd}: ${error.message}`,
  });
}

// Good: Just log locally or return to user
if (sessionError) {
  console.error(error);
  process.exit(EXIT.ERROR);
}
```

**In Tests:**
- No outbound HTTP requests to external services
- No `message.send()` calls without explicit mocking

---

### C04: No Self-Modification of Safety Rules

**Rule:** Cannot edit `GUARDRAILS.md`, `DECISIONS.md`, or other safety/design docs autonomously. Cannot disable compliance checks.

**Application to Opta CLI:**
- 🚫 Forbidden: Modifying this file without Matthew's approval
- 🚫 Forbidden: Removing permission checks from agent loop
- 🚫 Forbidden: Disabling tool execution verification
- 🚫 Forbidden: Removing SIGINT handler or session saves

**Implementation:**
- These rules are enforced at review time (PRs must be approved)
- Code cannot bypass them at runtime

**In Tests:**
- Verify that permission checks are in place
- Verify that destructive operations are gated

---

### C05: No Bypassing Authentication

**Rule:** Cannot disable auth, share tokens publicly, or expose gateway credentials.

**Application to Opta CLI:**
- ✅ Allowed: Storing LM Studio API connection (it's on local network, no auth)
- 🚫 Forbidden: Logging full API responses with tokens
- 🚫 Forbidden: Storing Anthropic API keys in plaintext in config
- 🚫 Forbidden: Exporting sessions with embedded tokens

**Implementation:**
```typescript
// Bad: Logs token
debugLog('api', 'Sending request', { headers: request.headers });

// Good: Redacts token
debugLog('api', 'Sending request to LM Studio', {
  model: request.model,
  toolCount: request.tools.length,
});
```

**In Tests:**
- Verify that debug logs don't contain sensitive data
- Verify that config serialization excludes tokens

---

### C06: No Executing Untrusted Code

**Rule:** Cannot run scripts from ClawHub, GitHub, or other external sources without review.

**Application to Opta CLI:**
- ✅ Allowed: `run_command` with user approval (user sees the command first)
- 🚫 Forbidden: Auto-running scripts from project `.opta/scripts/`
- 🚫 Forbidden: Installing npm packages without user confirmation
- 🚫 Forbidden: Executing pre-commit hooks automatically

**Implementation:**
```typescript
// In tools.ts - run_command always asks
const approved = await confirmToolApproval({
  toolName: 'run_command',
  description: `Run: ${command}`,
  userCanSee: true, // User sees command before approval
});
if (!approved) return;

// Never auto-execute
// ✓ User sees: "npm install" — approve?
// ✗ User doesn't see: [auto-running install script]
```

**In Tests:**
- Verify that `run_command` always asks for approval (in non-CI mode)
- Verify that scripts are not auto-executed

---

## 🟠 STRICT Rules (Must Follow, Log Violations)

These rules must be followed. Violations are logged and reviewed.

### S01: Tool Execution Requires Permission Check

**Rule:** Every tool call (read_file, write_file, run_command, etc.) must check permissions before executing.

**Implementation:**
```typescript
// In agent.ts - core loop
for (const call of toolCalls) {
  const perm = resolvePermission(call.function.name, config);
  
  if (perm === 'deny') {
    messages.push(toolResult(callId, 'Tool denied by policy.'));
    continue;
  }
  
  if (perm === 'ask') {
    const approved = await promptToolApproval(call);
    if (!approved) {
      messages.push(toolResult(callId, 'User declined.'));
      continue;
    }
  }
  
  // perm === 'allow' — proceed
  const result = await executeTool(call);
  messages.push(toolResult(callId, result));
}
```

**Default Permissions:**
| Tool | Default | Reasoning |
|------|---------|-----------|
| `read_file` | allow | Reading is safe, no side effects |
| `list_dir` | allow | Listing is safe |
| `search_files` | allow | Searching is safe |
| `find_files` | allow | Searching is safe |
| `write_file` | ask | Creates new files, may overwrite |
| `edit_file` | ask | Modifies existing files |
| `run_command` | ask | Executes arbitrary code |
| `ask_user` | allow | Just asks a question |

---

### S02: Never Expose Gateway Tokens in Logs

**Rule:** API keys, gateway tokens, auth headers, and credentials must never appear in debug output or error messages.

**Implementation:**
```typescript
// Bad
debugLog('api-call', {
  url: 'http://lmstudio:1234/v1/chat/completions',
  headers: { authorization: `Bearer ${token}` },
  data: messages,
});

// Good
debugLog('api-call', {
  endpoint: '/v1/chat/completions',
  modelName: config.model.name,
  messageCount: messages.length,
});

// Good — redacted error
try {
  const response = await fetch(url, { headers });
} catch (e) {
  console.error(`Failed to reach LM Studio at ${url}`);
  // Don't log raw error if it contains headers
}
```

**In Tests:**
- Verify that no tokens appear in console output
- Verify that error messages don't leak sensitive data

---

### S03: ESM-Only Module Format

**Rule:** Opta CLI must use ESM exclusively. No CommonJS (`require()`, `module.exports`).

**Why:** ESM is the future of Node.js. It enables lazy loading and tree-shaking. CommonJS is legacy.

**Implementation:**
```typescript
// Good: ESM
import { readFile } from 'fs/promises';
export async function startChat() { ... }
import('./commands/chat.js'); // Lazy load

// Bad: CommonJS
const { readFile } = require('fs');
module.exports = { startChat };
require('./commands/chat'); // Blocks startup
```

**In package.json:**
```json
{
  "type": "module",
  "engines": { "node": ">=20.0.0" }
}
```

**In tsconfig.json:**
```json
{
  "compilerOptions": {
    "module": "esnext",
    "moduleResolution": "bundler"
  }
}
```

**In Build:**
- `tsup` compiles to ESM with `.js` extensions
- No `--format=cjs` option allowed

---

### S04: No Cloud API Calls Without Explicit Opt-In

**Rule:** V1 does not fallback to cloud APIs (OpenAI, Anthropic). All calls go to LM Studio only.

**Why:** V1 is local-first. Cloud fallback is a V2 feature that requires design decisions about keys, costs, privacy.

**Implementation:**
```typescript
// Good: LM Studio only
const baseURL = config.connection.host;
const client = new OpenAI({ apiKey: 'local', baseURL });

// Bad: Would fallback to cloud
if (!lmstudio.isReachable()) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  // This is V2 behavior, not V1
}
```

**In Errors:**
```
If LM Studio is unreachable:

✗ Cannot reach LM Studio at 192.168.188.11:1234

Possible causes:
  • Mac Studio (Mono512) is offline
  • LM Studio is not running
  • Firewall blocking port 1234

Try:
  • Check connectivity: ping 192.168.188.11
  • Start LM Studio on the Mac Studio
  • Use a different host: opta connect --host <ip>

(V1 has NO cloud fallback. This is V2+)
```

---

### S05: Context Compaction Must Preserve Safety

**Rule:** When summarizing conversation history, never lose tool permissions or security constraints.

**Implementation:**
```typescript
// When compacting messages
async function compactHistory(messages: Message[]): Promise<Message[]> {
  // Keep system prompt (contains tool definitions + permissions)
  // Keep last 3 turns (recent context)
  // Summarize everything older than 3 turns
  
  const systemPrompt = messages[0]; // Never remove
  const recentTurns = messages.slice(-6); // Last 3 exchanges
  const oldTurns = messages.slice(1, -6); // Everything to summarize
  
  const summary = await summarizeOldTurns(oldTurns, config);
  
  return [systemPrompt, summary, ...recentTurns];
}
```

---

### S06: Agent Loop Must Terminate

**Rule:** The agent loop must eventually terminate (not infinite). Circuit breaker prevents runaway loops.

**Implementation:**
```typescript
// In agent.ts
let toolCallCount = 0;
const MAX_TOOL_CALLS = 30;

while (true) {
  const response = await lmstudio.complete(messages);
  
  if (!response.toolCalls.length) {
    // No tool calls = task complete
    renderMarkdown(response.text);
    break; // EXIT 1
  }
  
  // Execute tools...
  toolCallCount += response.toolCalls.length;
  
  if (toolCallCount >= MAX_TOOL_CALLS) {
    console.log('Tool call limit reached. Pausing.');
    const shouldContinue = await confirm({ message: 'Continue?' });
    if (!shouldContinue) break; // EXIT 2
    toolCallCount = 0;
  }
}
```

**In Tests:**
- Verify that loop terminates with model response text
- Verify that circuit breaker catches runaway loops

---

## 🟡 Guidelines (Encouraged)

Not enforced strictly, but recommended.

| Guideline | Why |
|-----------|-----|
| Use exact-match string edits (V1), not diffs | Simpler, fewer bugs |
| Always ask permission before `run_command` | User should see what runs |
| Keep tool descriptions under 100 chars | Fit in token budget |
| Log what you're doing, not raw API responses | Better debugging |
| Cache session results, don't re-compute | Faster resume |
| Test with real LM Studio, not just mocks | Catch integration bugs |

---

## Compliance Checklist

**Before submitting code:**
- [ ] No C01 violations (data exfil)
- [ ] No C02 violations (destructive without confirm)
- [ ] No C03 violations (external posts without approval)
- [ ] No C04 violations (self-modifying safety rules)
- [ ] No C05 violations (auth bypass)
- [ ] No C06 violations (untrusted code execution)
- [ ] Permission checks on all tool calls (S01)
- [ ] No tokens in debug logs (S02)
- [ ] ESM-only imports (S03)
- [ ] No cloud API fallback (S04)
- [ ] Context compaction preserves safety (S05)
- [ ] Agent loop has circuit breaker (S06)

---

## Questions?

**Q: Can we add Anthropic fallback in V1?**  
A: No. That's C04 (modifying safety rules without approval). Cloud fallback is V2 and requires design decisions.

**Q: Can the agent auto-commit changes?**  
A: V1 does not. Show diffs, ask for confirmation, let user decide about commits. V2 could have `--auto-commit` flag.

**Q: What if LM Studio is offline?**  
A: Fail fast with actionable error (see S04). Don't fallback to cloud in V1.

**Q: Can tools run in parallel?**  
A: V1: No, single-threaded. V2+ could have parallel tool execution if needed.

---

## Keep This Updated

When adding new constraints or rules:
1. Decide: Critical (C0x), Strict (S0x), or Guideline (G0x)?
2. Add to appropriate section
3. Update checklist above
4. Update `docs/INDEX.md` (read order)

**Never remove rules without Matthew's approval.**
