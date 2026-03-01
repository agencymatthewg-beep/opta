---
status: archived
---

# Opta AI Capability Expansion: Implementation Report

Date: 2026-02-22
Status: Implemented and verified in current workspace

## 1. Scope Delivered

This implementation delivered the three requested capability pillars:

1. Research connectors and autonomous routing
2. Browser control with Playwright foundations (dual mode + persistence)
3. Learning and autonomous documentation loop with capture governance

It also delivered context-optimization controls (mode-based tool filtering), policy gating, and deep test verification.

## 2. Core Architecture Changes

### 2.1 Research capability layer

Added/used:
- `src/research/types.ts`
- `src/research/registry.ts`
- `src/research/router.ts`
- `src/research/health.ts`
- `src/research/providers/*.ts`

Behavior:
- Multi-provider routing across Tavily, Gemini, Exa, Brave, Groq.
- Intent-aware routing with fallback (`general`, `news`, `academic`, `coding`).
- Provider health checks available for runtime visibility.

### 2.2 Browser capability layer

Added/used:
- `src/browser/native-session-manager.ts`
- `src/browser/artifacts.ts`
- `src/browser/mcp-bootstrap.ts`
- `src/browser/types.ts`

Behavior:
- Native browser sessions support:
  - open/close
  - navigate
  - click/type
  - snapshot/screenshot
- Artifact persistence under `.opta/browser/<sessionId>/`.
- Dual mode:
  - `isolated` (default)
  - `attach` (CDP endpoint)

### 2.3 Learning capability layer

Added/used:
- `src/learning/ledger.ts`
- `src/learning/retrieval.ts`
- `src/learning/summarizer.ts`
- `src/learning/types.ts`
- `src/learning/hooks.ts`

Behavior:
- Structured JSONL learning ledger.
- Retrieval block injection for prior lessons.
- Summary generation by date.
- Automatic capture hooks for:
  - `/research` mode activation
  - `/plan` mode activation
  - tool failures
  - tool-assisted successful turn completion
  - top-level agent loop errors

## 3. Config and Persistence

### 3.1 Research config

Implemented in `src/core/config.ts`:
- `research.enabled`
- `research.defaultProvider`
- `research.alwaysIncludeDocumentation`
- `research.maxResults`
- `research.providers.{tavily|gemini|exa|brave|groq}.{enabled|apiKey|timeoutMs}`

### 3.2 Browser config

Implemented in `src/core/config.ts`:
- `browser.enabled`
- `browser.mode`
- `browser.screenshotPolicy`
- `browser.globalAllowedHosts`
- `browser.blockedOrigins`
- `browser.mcp.{enabled,command,package}`
- `browser.attach.{enabled,wsEndpoint,requireApproval}`

Persistence behavior:
- Browser config is reusable across models/sessions.
- When browser MCP is enabled, registry auto-adds a synthetic Playwright MCP server unless user already configured `mcp.servers.playwright`.

### 3.3 Learning and governance config

Implemented in `src/core/config.ts`:
- `learning.enabled`
- `learning.captureLevel` (`exhaustive|balanced|lean`)
- `learning.includeUnverified`
- `learning.ledgerPath`
- `learning.summaryDir`
- `learning.governor.{mode,autoCalibrate,allowAutoDownshift,restoreHysteresisSec,thresholds.*}`
  - `mode` now defaults to `hybrid` and still accepts legacy `combined` for backwards compatibility.

Per-device calibration:
- `src/learning/hooks.ts` writes and reuses calibration at:
  - `.opta/learning/device-calibration.json`
- Thresholds adapt to device profile and are reused per fingerprint.

### 3.4 Policy config and gating

Implemented in `src/core/config.ts` and enforced in runtime:
- `policy.enabled`
- `policy.mode`
- `policy.gateAllAutonomy`
- `policy.failureMode`
- `policy.audit.{enabled,path,redactSecrets}`

Enforcement:
- `src/core/agent-permissions.ts` integrates `PolicyEngine`.
- Policy decision occurs before tool execution.
- `gate` routes to approval flow.
- `deny` blocks execution.
- Failure mode mapping handles `degraded-safe` as fail-closed for engine compatibility.

## 4. Tool Surface Additions

### 4.1 New tool schemas and executors

Implemented in:
- `src/core/tools/schemas.ts`
- `src/core/tools/executors.ts`
- `src/core/tools/permissions.ts`

Research:
- `research_query`
- `research_health`

Browser:
- `browser_open`
- `browser_navigate`
- `browser_click`
- `browser_type`
- `browser_snapshot`
- `browser_screenshot`
- `browser_close`

Learning:
- `learning_log`
- `learning_summary`
- `learning_retrieve`

### 4.2 Permission model updates

Updated mode-aware permissions for new tools in:
- `src/core/tools/permissions.ts`
- default permission map in `src/core/config.ts`

Highlights:
- Read-only modes deny write/destructive tools.
- Research mode enables research/browser read-oriented flow while preserving safety.
- CI mode denies interactive/destructive operations.

## 5. Context Optimization and Capability Awareness

### 5.1 Mode-based context reduction

Implemented in:
- `src/core/agent-profiles.ts` (`filterToolsForMode`)
- applied in `src/core/agent.ts`

Effect:
- Active tool list is pruned by mode (`plan`, `review`, `research`) to reduce schema context load and align capabilities to current intent.

### 5.2 Runtime capability manifest injection

Implemented in:
- `src/core/agent-setup.ts`
- injected from `src/core/agent.ts`

Effect:
- System prompt includes concise active capability manifest each turn:
  - mode/profile/tool count
  - research availability
  - browser availability
  - learning availability
  - policy mode/gating/failure mode

### 5.3 Retrieval-aware memory priming

Implemented in:
- `src/core/agent.ts`
- `src/learning/retrieval.ts`

Effect:
- Relevant prior learning entries are appended to system prompt context when matches are found.

## 6. MCP Browser Bootstrapping

Implemented in:
- `src/mcp/registry.ts`
- `src/commands/mcp.ts`
- `src/index.ts`
- `src/commands/completions.ts`

New helper:
- `mcpAddPlaywright(...)`

CLI command:
- `opta mcp add-playwright`

Effect:
- Simple one-step browser MCP setup.
- Keeps browser capability persistent in config.
- Completions updated for new subcommand.

## 7. Learning Capture and Sanitization

Implemented in:
- `src/learning/hooks.ts`
- `src/core/agent-execution.ts`
- `src/core/agent.ts`
- `src/commands/slash/research.ts`
- `src/commands/slash/workflow.ts`

Sanitization:
- Redacts common secret/token patterns before persistence.

Capture policy:
- Defaults to high capture (`exhaustive`) with auto-downshift when pressure exceeds thresholds.
- Downshift path:
  - `exhaustive -> balanced`
  - `balanced -> lean`

## 8. Verification Evidence

The following verification commands were run successfully after integration:

1. Targeted tests
- `npx vitest run tests/learning/hooks.test.ts tests/core/agent.test.ts tests/core/agent-profiles.test.ts tests/core/tools.test.ts tests/core/permissions.test.ts tests/mcp/registry.test.ts tests/commands/mcp.test.ts tests/commands/completions.test.ts tests/commands/slash-smoke.test.ts`
- `npx vitest run tests/core/config.test.ts tests/commands/config.test.ts tests/commands/slash-manage.test.ts tests/cli.test.ts tests/commands/update.test.ts`
- `npx vitest run tests/commands/plan.test.ts`

2. Full suite
- `npm test -- --run`
  - Result: all tests passed

3. Type/build
- `npm run -s typecheck`
- `npm run -s build`
  - Result: both passed

## 9. Notable Operational Notes

- Test logs include expected noisy stderr from missing optional OPIS files in temp test directories; tests still pass.
- Policy and learning writes are best-effort and non-blocking for chat-loop responsiveness.
- Browser attach mode should be explicitly user-controlled in config due elevated risk versus isolated mode.

## 10. Follow-up Recommendations

1. Add `/browser` slash command family for direct operator workflows.
2. Add richer learning summary artifact writing to `learning.summaryDir` by date automatically.
3. Add policy redaction/audit assertions in dedicated tests for sensitive argument payloads.
4. Add integration tests that validate end-to-end:
   - research routing + citations
   - browser navigation + screenshot artifacts
   - learning retrieval improving subsequent response behavior
