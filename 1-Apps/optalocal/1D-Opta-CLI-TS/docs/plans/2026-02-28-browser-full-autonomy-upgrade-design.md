---
status: active
---

# Browser Full Autonomy Upgrade — Design
Date: 2026-02-28
Status: APPROVED — ready for implementation

---

## Implementation Checklist

- [ ] Phase 1: Register `@playwright/mcp` in MCP registry
- [ ] Phase 1: Build `BrowserMcpInterceptor` with policy + visual-diff + artifacts wiring
- [ ] Phase 1: Extend `classifyAction` in policy-engine for new MCP tool risk tiers
- [ ] Phase 1: Port `tests/browser/policy-engine.test.ts` to MCP tool names
- [ ] Phase 2: Build `BrowserSubAgentDelegator` using orchestrator sub-agent machinery
- [ ] Phase 2: Wire delegator into main agent loop (replace auto-open-session path)
- [ ] Phase 2: Port `tests/integration/browser-autonomous-flow.test.ts` to delegation model
- [ ] Phase 3: Remove 7 legacy `browser_*` schemas from `schemas.ts`
- [ ] Phase 3: Remove legacy browser executors from `executors.ts`
- [ ] Phase 3: Remove legacy browser permissions from `permissions.ts`
- [ ] Phase 3: `npm test` full suite pass — go/no-go gate
- [ ] Phase 4: Add tests for scroll, select_option, hover, evaluate via interceptor
- [ ] Phase 4: Extend run-corpus adaptation for MCP tool names
- [ ] Phase 4: Update docs (CLAUDE.md, DECISIONS.md, buildBrowserAvailabilityInstruction)

---

## Goals

- Achieve 100% browser tool coverage by replacing the 7-tool legacy surface with `@playwright/mcp`
- Preserve the full antigravity safety infrastructure (policy engine, approval gating, visual diff, run-corpus adaptation) as an MCP interception layer
- Deliver a full-peer browser sub-agent that inherits the complete tool surface and operates autonomously on delegated goals
- End the migration with zero legacy surface and a single clean browser tool path

---

## Architecture

### Before

```
main agent loop
  → tool executor
    → 7 legacy browser_* executors (open, navigate, click, type, snapshot, screenshot, close)
      → runtime-daemon
        → Playwright
```

### After

```
main agent loop
  → BrowserSubAgentDelegator
    → spawns full peer sub-agent (all tools: code + browser)
      → MCP registry
        → @playwright/mcp server  (30+ Playwright tools)
          → BrowserMcpInterceptor
            (policy engine + visual-diff + artifacts + approval gating)
              → Playwright (via runtime-daemon wsEndpoint)
```

### Unchanged Components

- `runtime-daemon.ts` — Playwright process lifecycle manager; `@playwright/mcp` connects via `wsEndpoint`
- `policy-engine.ts` — `evaluateBrowserPolicyAction` is untouched; interceptor calls it
- `visual-diff.ts`, `artifacts.ts`, `approval-log.ts`, `run-corpus.ts` — all remain, wired through interceptor
- `native-session-manager.ts`, `session-store.ts`, `profile-store.ts` — session/profile management unchanged

---

## New Components

### 1. `@playwright/mcp` Registration (`src/mcp/registry.ts`)

Auto-registered as a built-in MCP server when `browser.enabled = true`. Exposes the full Playwright MCP tool surface including:

| Tool category | Example tools |
|--------------|---------------|
| Navigation | navigate, go_back, go_forward, reload |
| Interaction | click, type, select_option, hover, drag |
| Keyboard | press_key, keyboard_type |
| Scroll | scroll, scroll_to_element |
| File | file_upload |
| Observation | snapshot (accessibility tree), screenshot, get_text, get_attribute |
| JavaScript | evaluate |
| Tabs | new_tab, close_tab, switch_tab |
| Dialogs | handle_dialog |
| Wait | wait_for_element, wait_for_navigation |

The `wsEndpoint` from `runtime-daemon.health()` is passed as the connection target so Playwright reuses the managed browser instance.

### 2. `BrowserMcpInterceptor` (`src/browser/mcp-interceptor.ts`)

Wraps every MCP tool call matching `browser_*` or Playwright MCP tool names before execution.

```typescript
interface BrowserMcpInterceptorConfig {
  policyConfig: Partial<BrowserPolicyConfig>;
  sessionId: string;
  adaptationHint?: BrowserPolicyAdaptationHint;
}

async function interceptBrowserMcpCall(
  toolName: string,
  args: Record<string, unknown>,
  config: BrowserMcpInterceptorConfig,
  execute: () => Promise<unknown>
): Promise<unknown>
```

**Interception flow per call:**
1. Translate `(toolName, args)` → `BrowserPolicyRequest`
2. Call `evaluateBrowserPolicyAction` → `BrowserPolicyDecision`
3. If `deny` → throw `BrowserPolicyDeniedError` with evidence
4. If `gate` → surface approval prompt to user; await `approved` flag before proceeding
5. If `allow` → call `execute()` (the actual MCP tool)
6. Record to `artifacts.ts` (screenshot/snapshot kinds)
7. Feed result into `visual-diff.ts` pipeline
8. Append to `approval-log.ts` if gated

**Extended risk classification** (additions to `policy-engine.ts` `classifyAction`):

| New tool | Risk tier | Action key |
|----------|-----------|------------|
| `scroll` | low | `scroll` |
| `select_option` | medium | `select` |
| `hover` | low | `observe` |
| `evaluate` | high | `execute` |
| `file_upload` | high | `upload` |
| `new_tab` | medium | `navigate` |
| `press_key` | medium | `type` |
| `handle_dialog` | medium/high | `confirm`/`dismiss` |

### 3. `BrowserSubAgentDelegator` (`src/browser/sub-agent-delegator.ts`)

Main agent hook. Fires on browser-intent detection (existing `routeBrowserIntent` or `"browser"` keyword). Replaces the current "auto-open session + inject system prompt" path.

```typescript
interface BrowserSubAgentOptions {
  goal: string;
  config: OptaConfig;
  preferredSessionId?: string;
  inheritedContext?: string;  // summary from main agent's current context
}

interface BrowserSubAgentResult {
  ok: boolean;
  summary: string;          // model-generated summary of what was accomplished
  sessionId?: string;       // session to reuse if main agent continues browsing
  artifactPaths: string[];  // screenshots/snapshots retained as evidence
  error?: string;
}

async function delegateToBrowserSubAgent(
  options: BrowserSubAgentOptions
): Promise<BrowserSubAgentResult>
```

**Spawn mechanism:** Uses existing `src/core/orchestrator.ts` sub-agent infrastructure.

**Sub-agent receives:**
- Full tool surface (all 8 core tools + full MCP browser surface via interceptor)
- System prompt: browser-specialist persona, goal framing, active session ID if provided, policy reminder
- Goal verbatim from the main agent

**Sub-agent terminates when:**
- Goal is achieved (model signals completion)
- Unrecoverable error (policy deny, session crash)
- Circuit breaker fires (30 tool calls per loop — existing limit)

**Session continuity:** Returned `sessionId` can be passed into the next `delegateToBrowserSubAgent` call. The Playwright session stays warm across multiple delegations within a conversation.

**Result propagation:** The `BrowserSubAgentResult` is formatted as a tool result and injected into the main agent's message stream. The main agent sees it as a completed tool call and continues its own loop.

---

## Migration Phases (Hard Cutover)

The existing 139+ browser tests are the acceptance gate. The migration is complete when all pass against the new layer with zero legacy surface remaining.

### Phase 1 — MCP Bridge (≈3 days)

**Goal:** `@playwright/mcp` live, interceptor wrapping all calls, policy gating verified.

Files to create:
- `src/browser/mcp-interceptor.ts`

Files to modify:
- `src/mcp/registry.ts` — auto-register `@playwright/mcp` when `browser.enabled`
- `src/mcp/client.ts` — wire `BrowserMcpInterceptor` as call middleware for browser tool names
- `src/browser/policy-engine.ts` — extend `classifyAction` with new tool risk tiers
- `src/core/browser-policy-config.ts` — add new action keys to config types

Tests to port/add:
- `tests/browser/policy-engine.test.ts` — assert against MCP tool names
- `tests/browser/mcp-interceptor.test.ts` — new; covers allow/gate/deny + visual diff recording

Acceptance criteria:
- Policy gating, host allowlist, credential isolation, visual diff all pass on MCP surface
- `npm run typecheck` clean

### Phase 2 — Sub-Agent Delegation (≈2 days)

**Goal:** Main agent delegates browser tasks; sub-agent runs full autonomous loop; results propagate correctly.

Files to create:
- `src/browser/sub-agent-delegator.ts`

Files to modify:
- `src/core/agent.ts` — replace "auto-open session + inject prompt" path with `delegateToBrowserSubAgent`
- `src/core/agent-setup.ts` — pass browser-specialist system prompt variant into sub-agent
- `src/tui/App.tsx` — surface sub-agent activity in BrowserManagerRail

Tests to port/add:
- `tests/integration/browser-autonomous-flow.test.ts` — ported to delegation model
- `tests/browser/sub-agent-delegator.test.ts` — new; covers spawn, result propagation, session continuity

### Phase 3 — Hard Cutover (≈1 day)

**Goal:** Legacy surface gone. Single clean path through MCP.

Files to delete content from (not delete files):
- `src/core/tools/schemas.ts` — remove 7 `browser_*` tool definitions
- `src/core/tools/executors.ts` — remove `browser_open/navigate/click/type/snapshot/screenshot/close` cases
- `src/core/tools/permissions.ts` — remove all `browser_*` permission entries
- `src/browser/intent-router.ts` — update `buildBrowserAvailabilityInstruction` with MCP tool names

**Gate:** `npm test` — full suite must pass. This is go/no-go.

### Phase 4 — Expansion + Cleanup (≈2 days)

**Goal:** New capabilities tested, run-corpus extended, docs current.

- Add tests for scroll, select_option, hover, evaluate via interceptor
- Extend run-corpus adaptation signal vocabulary to MCP tool names
- Update `CLAUDE.md` browser section with new tool surface
- Update `docs/DECISIONS.md` with MCP bridge rationale
- Update `src/browser/intent-router.ts` `buildBrowserAvailabilityInstruction` with full MCP tool list

---

## Key Constraints

| Constraint | How enforced |
|-----------|-------------|
| Policy gating preserved | BrowserMcpInterceptor calls `evaluateBrowserPolicyAction` on every call |
| Visual diff preserved | Interceptor feeds screenshots into existing `visual-diff.ts` pipeline |
| Approval gating preserved | Interceptor surfaces `gate` decisions before `execute()` is called |
| Run-corpus adaptation preserved | Signal vocabulary extended; adaptation logic unchanged |
| Backward compatible config | `browser.enabled`, `browser.runtime.*`, `browser.artifacts.*` all unchanged |
| No dual-stack | Legacy tools removed in Phase 3; no `browser.provider` flag needed |
| CI gate | Existing 139+ browser tests must pass before Phase 3 merges |

---

## Test Surface After Upgrade

| Suite | Count (estimated) | Status |
|-------|------------------|--------|
| `tests/browser/policy-engine.test.ts` | ~40 | Ported to MCP tool names |
| `tests/browser/mcp-interceptor.test.ts` | ~25 | New |
| `tests/browser/sub-agent-delegator.test.ts` | ~15 | New |
| `tests/integration/browser-autonomous-flow.test.ts` | ~10 | Ported to delegation model |
| `tests/browser/visual-diff.test.ts` | ~20 | Unchanged |
| `tests/browser/run-corpus.test.ts` | ~15 | Extended for MCP tool names |
| `tests/browser/replay.test.ts` | ~12 | Ported |
| `tests/commands/slash-browser.test.ts` | ~15 | Updated for MCP tool names |

---

## Timeline

| Phase | Duration | Gate |
|-------|----------|------|
| Phase 1: MCP Bridge | 3 days | policy + interceptor tests pass |
| Phase 2: Sub-Agent | 2 days | integration delegation tests pass |
| Phase 3: Hard Cutover | 1 day | full `npm test` pass, zero legacy surface |
| Phase 4: Expansion | 2 days | new capability tests pass, docs updated |
| **Total** | **~8 days** | |

---

## References

- Antigravity implementation report: `docs/research/2026-02-23-antigravity-runtime-implementation-report.md`
- Browser module: `src/browser/`
- MCP client: `src/mcp/client.ts`, `src/mcp/registry.ts`
- Orchestrator sub-agent: `src/core/orchestrator.ts`
- CI parity workflow: `.github/workflows/parity-macos-codex.yml`
