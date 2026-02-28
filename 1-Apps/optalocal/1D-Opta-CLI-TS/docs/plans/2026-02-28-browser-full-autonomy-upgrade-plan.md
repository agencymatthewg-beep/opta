---
status: active
---

# Browser Full Autonomy Upgrade — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the 7-tool legacy browser surface with `@playwright/mcp`, wire all calls through the safety infrastructure (policy engine, visual diff, approval gating), and deliver a full-peer browser sub-agent. End state: zero legacy browser tools, single clean path, 30+ Playwright tools available.

**Architecture:** The registry already auto-registers `@playwright/mcp` when `browser.mcp.enabled = true`. MCP tool names arrive as `browser_*` after namespace stripping, so policy-engine coverage mostly applies. The missing pieces are: (1) `browser_evaluate`/`browser_file_upload` fall through to `low` risk in `classifyAction`, (2) no interception layer wraps MCP calls through the policy pipeline, (3) no sub-agent delegator exists, (4) legacy tool schemas/executors still live in `schemas.ts`/`executors.ts`.

**Tech Stack:** TypeScript ESM, Vitest, `@playwright/mcp` (MCP stdio server), existing `spawnSubAgent` in `src/core/subagent.ts`.

---

## Phase 1 — MCP Bridge (≈3 days)

Goal: `@playwright/mcp` live, policy engine extended, interceptor wrapping all Playwright MCP calls, gating verified end-to-end.

---

### Task 1: Extend `classifyAction` for high-risk MCP-only tools

The `classifyAction` function in `policy-engine.ts` has no case for `browser_evaluate` (arbitrary JS) or `browser_file_upload` (filesystem). They currently fall through to `{ risk: 'low', actionKey: 'other' }` — dangerous.

**Files:**
- Modify: `src/browser/policy-engine.ts:223-289`
- Test: `tests/browser/policy-engine.test.ts`

**Step 1: Write the failing tests**

In `tests/browser/policy-engine.test.ts`, add a new describe block **after** existing tests:

```typescript
describe('MCP-only tool risk classification', () => {
  it('classifies browser_evaluate as high risk (requires approval)', () => {
    const decision = evaluateBrowserPolicyAction(
      { ...baseConfig, requireApprovalForHighRisk: true, allowedHosts: ['*'] },
      { toolName: 'browser_evaluate', args: { expression: 'document.cookie' } },
    );
    expect(decision.risk).toBe('high');
    expect(decision.decision).toBe('gate');
    expect(decision.actionKey).toBe('execute');
  });

  it('classifies browser_file_upload as high risk', () => {
    const decision = evaluateBrowserPolicyAction(
      { ...baseConfig, requireApprovalForHighRisk: true, allowedHosts: ['*'] },
      { toolName: 'browser_file_upload', args: { selector: 'input[type=file]', files: ['/tmp/a.txt'] } },
    );
    expect(decision.risk).toBe('high');
    expect(decision.decision).toBe('gate');
    expect(decision.actionKey).toBe('upload');
  });

  it('classifies browser_select_option as medium risk', () => {
    const decision = evaluateBrowserPolicyAction(
      { ...baseConfig, requireApprovalForHighRisk: false, allowedHosts: ['*'] },
      { toolName: 'browser_select_option', args: { selector: 'select#country', value: 'AU' } },
    );
    expect(decision.risk).toBe('medium');
    expect(decision.decision).toBe('allow');
    expect(decision.actionKey).toBe('select');
  });

  it('classifies browser_go_back and browser_reload as medium risk', () => {
    for (const toolName of ['browser_go_back', 'browser_go_forward', 'browser_reload']) {
      const decision = evaluateBrowserPolicyAction(
        { ...baseConfig, requireApprovalForHighRisk: false, allowedHosts: ['*'] },
        { toolName, args: {} },
      );
      expect(decision.risk).toBe('medium');
      expect(decision.actionKey).toBe('navigate');
    }
  });

  it('classifies browser_scroll and browser_hover as low risk', () => {
    for (const toolName of ['browser_scroll', 'browser_hover', 'browser_wait_for_element', 'browser_wait_for_navigation']) {
      const decision = evaluateBrowserPolicyAction(
        { ...baseConfig, requireApprovalForHighRisk: true, allowedHosts: ['*'] },
        { toolName, args: {} },
      );
      expect(decision.risk).toBe('low');
      expect(decision.decision).toBe('allow');
    }
  });
});
```

**Step 2: Run tests to confirm they fail**

```bash
cd optalocal/1D-Opta-CLI-TS
npm test -- tests/browser/policy-engine.test.ts
```

Expected: FAIL — `browser_evaluate` returns `low`/`allow` instead of `high`/`gate`.

**Step 3: Extend `classifyAction` in `policy-engine.ts`**

In `classifyAction`, add these cases **before** the final `return` statement (the `default` fallback):

```typescript
  // MCP-only high-risk tools
  if (toolName === 'browser_evaluate') {
    return { risk: 'high', actionKey: 'execute', matchedSignals: ['tool:browser_evaluate', 'risk:js-execution'] };
  }

  if (toolName === 'browser_file_upload') {
    return { risk: 'high', actionKey: 'upload', matchedSignals: ['tool:browser_file_upload', 'risk:filesystem'] };
  }

  // MCP-only medium-risk interaction tools
  if (toolName === 'browser_select_option') {
    const matchedSignals = ['tool:browser_select_option'];
    const keywordMatch = signalContainsSensitiveKeyword(collectSensitiveSignalText(args));
    if (keywordMatch && sensitiveActions.has(keywordMatch.actionKey)) {
      matchedSignals.push(`args:${keywordMatch.signal}`);
      return { risk: 'high', actionKey: keywordMatch.actionKey, matchedSignals };
    }
    return { risk: 'medium', actionKey: 'select', matchedSignals };
  }

  if (toolName === 'browser_drag') {
    return { risk: 'medium', actionKey: 'click', matchedSignals: ['tool:browser_drag'] };
  }

  if (toolName === 'browser_press_key' || toolName === 'browser_keyboard_type') {
    const matchedSignals = [`tool:${toolName}`];
    const keywordMatch = signalContainsSensitiveKeyword(collectSensitiveSignalText(args));
    if (keywordMatch && sensitiveActions.has(keywordMatch.actionKey)) {
      matchedSignals.push(`args:${keywordMatch.signal}`);
      return { risk: 'high', actionKey: keywordMatch.actionKey, matchedSignals };
    }
    return { risk: 'medium', actionKey: 'type', matchedSignals };
  }

  if (toolName === 'browser_go_back' || toolName === 'browser_go_forward' || toolName === 'browser_reload') {
    return { risk: 'medium', actionKey: 'navigate', matchedSignals: [`tool:${toolName}`] };
  }

  if (toolName === 'browser_tab_new' || toolName === 'browser_tab_close' || toolName === 'browser_tab_switch') {
    return { risk: 'medium', actionKey: 'navigate', matchedSignals: [`tool:${toolName}`] };
  }
```

**Step 4: Run tests to confirm they pass**

```bash
npm test -- tests/browser/policy-engine.test.ts
```

Expected: All PASS including new MCP tool cases.

**Step 5: Commit**

```bash
git add src/browser/policy-engine.ts tests/browser/policy-engine.test.ts
git commit -m "feat(browser): extend classifyAction with MCP-only tool risk tiers"
```

---

### Task 2: Build `BrowserMcpInterceptor`

The interceptor wraps every `@playwright/mcp` tool call: evaluates policy, handles gate/deny, records artifacts, feeds visual-diff.

**Files:**
- Create: `src/browser/mcp-interceptor.ts`
- Test: `tests/browser/mcp-interceptor.test.ts` (new)

**Step 1: Write the failing tests**

Create `tests/browser/mcp-interceptor.test.ts`:

```typescript
import { afterEach, describe, expect, it, vi } from 'vitest';
import { interceptBrowserMcpCall, type BrowserMcpInterceptorConfig } from '../../src/browser/mcp-interceptor.js';

// Mock the policy engine
vi.mock('../../src/browser/policy-engine.js', () => ({
  evaluateBrowserPolicyAction: vi.fn(),
  isBrowserToolName: (name: string) => name.startsWith('browser_'),
}));

// Mock artifacts + visual-diff
vi.mock('../../src/browser/artifacts.js', () => ({
  recordBrowserArtifact: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../src/browser/visual-diff.js', () => ({
  diffAndRecordBrowserScreenshots: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../src/browser/approval-log.js', () => ({
  appendBrowserApprovalEvent: vi.fn().mockResolvedValue(undefined),
}));

import { evaluateBrowserPolicyAction } from '../../src/browser/policy-engine.js';

const baseConfig: BrowserMcpInterceptorConfig = {
  policyConfig: {
    requireApprovalForHighRisk: true,
    allowedHosts: ['*'],
    blockedOrigins: [],
    sensitiveActions: ['auth_submit', 'post', 'checkout', 'delete'],
    credentialIsolation: true,
  },
  sessionId: 'test-sess-01',
};

afterEach(() => vi.clearAllMocks());

describe('BrowserMcpInterceptor', () => {
  it('allows low-risk tools and calls execute()', async () => {
    vi.mocked(evaluateBrowserPolicyAction).mockReturnValue({
      decision: 'allow', risk: 'low', actionKey: 'observe', reason: 'ok',
      riskEvidence: { classifier: 'static', matchedSignals: [] },
    });

    const execute = vi.fn().mockResolvedValue('snapshot-result');
    const result = await interceptBrowserMcpCall('browser_snapshot', {}, baseConfig, execute);

    expect(execute).toHaveBeenCalledOnce();
    expect(result).toBe('snapshot-result');
  });

  it('throws on denied tools without calling execute()', async () => {
    vi.mocked(evaluateBrowserPolicyAction).mockReturnValue({
      decision: 'deny', risk: 'high', actionKey: 'upload', reason: 'blocked origin',
      riskEvidence: { classifier: 'static', matchedSignals: ['policy:blocked-origin'] },
    });

    const execute = vi.fn();
    await expect(interceptBrowserMcpCall('browser_file_upload', {}, baseConfig, execute))
      .rejects.toThrow('BrowserPolicyDenied');
    expect(execute).not.toHaveBeenCalled();
  });

  it('gates high-risk tools: calls onGate, then execute() if approved', async () => {
    vi.mocked(evaluateBrowserPolicyAction).mockReturnValue({
      decision: 'gate', risk: 'high', actionKey: 'execute', reason: 'js execution',
      riskEvidence: { classifier: 'static', matchedSignals: ['tool:browser_evaluate'] },
    });

    const execute = vi.fn().mockResolvedValue('eval-result');
    const onGate = vi.fn().mockResolvedValue('approved');

    const result = await interceptBrowserMcpCall(
      'browser_evaluate', { expression: 'window.title' },
      { ...baseConfig, onGate },
      execute,
    );

    expect(onGate).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledOnce();
    expect(result).toBe('eval-result');
  });

  it('gates high-risk tools: throws if gate is denied', async () => {
    vi.mocked(evaluateBrowserPolicyAction).mockReturnValue({
      decision: 'gate', risk: 'high', actionKey: 'execute', reason: 'js execution',
      riskEvidence: { classifier: 'static', matchedSignals: [] },
    });

    const execute = vi.fn();
    const onGate = vi.fn().mockResolvedValue('denied');

    await expect(interceptBrowserMcpCall('browser_evaluate', {}, { ...baseConfig, onGate }, execute))
      .rejects.toThrow('BrowserPolicyDenied');
    expect(execute).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run tests to confirm they fail**

```bash
npm test -- tests/browser/mcp-interceptor.test.ts
```

Expected: FAIL — `mcp-interceptor.ts` doesn't exist yet.

**Step 3: Create `src/browser/mcp-interceptor.ts`**

```typescript
import {
  evaluateBrowserPolicyAction,
  isBrowserToolName,
  type BrowserPolicyConfig,
  type BrowserPolicyDecision,
} from './policy-engine.js';
import { appendBrowserApprovalEvent } from './approval-log.js';
import { recordBrowserArtifact } from './artifacts.js';
import { diffAndRecordBrowserScreenshots } from './visual-diff.js';
import type { BrowserPolicyAdaptationHint } from './adaptation.js';

export class BrowserPolicyDeniedError extends Error {
  constructor(
    public readonly toolName: string,
    public readonly decision: BrowserPolicyDecision,
  ) {
    super(`BrowserPolicyDenied: ${toolName} — ${decision.reason}`);
    this.name = 'BrowserPolicyDeniedError';
  }
}

export interface BrowserMcpInterceptorConfig {
  policyConfig: Partial<BrowserPolicyConfig>;
  sessionId: string;
  adaptationHint?: BrowserPolicyAdaptationHint;
  currentOrigin?: string;
  currentPageHasCredentials?: boolean;
  /** Called when a `gate` decision is reached. Return 'approved' to proceed, 'denied' to abort. */
  onGate?: (toolName: string, decision: BrowserPolicyDecision) => Promise<'approved' | 'denied'>;
}

/**
 * Intercepts a single Playwright MCP tool call through the full safety pipeline:
 * 1. Policy evaluation (allow / gate / deny)
 * 2. Gate prompt (if decision is 'gate')
 * 3. Execute the actual MCP call
 * 4. Record artifacts + visual diff
 */
export async function interceptBrowserMcpCall(
  toolName: string,
  args: Record<string, unknown>,
  config: BrowserMcpInterceptorConfig,
  execute: () => Promise<unknown>,
): Promise<unknown> {
  // Non-browser tools pass through without interception
  if (!isBrowserToolName(toolName)) {
    return execute();
  }

  const policyDecision = evaluateBrowserPolicyAction(config.policyConfig, {
    toolName,
    args,
    adaptationHint: config.adaptationHint,
    currentOrigin: config.currentOrigin,
    currentPageHasCredentials: config.currentPageHasCredentials,
  });

  if (policyDecision.decision === 'deny') {
    throw new BrowserPolicyDeniedError(toolName, policyDecision);
  }

  if (policyDecision.decision === 'gate') {
    const gateResult = config.onGate
      ? await config.onGate(toolName, policyDecision)
      : 'denied'; // No gate handler = deny by default

    if (gateResult !== 'approved') {
      throw new BrowserPolicyDeniedError(toolName, policyDecision);
    }

    // Log the approval
    await appendBrowserApprovalEvent(config.sessionId, {
      tool: toolName,
      sessionId: config.sessionId,
      decision: 'approved',
      actionKey: policyDecision.actionKey,
      riskLevel: policyDecision.risk,
    });
  }

  // Execute the real MCP tool call
  const result = await execute();

  // Record screenshot/snapshot artifacts
  const isScreenshot = toolName === 'browser_screenshot';
  const isSnapshot = toolName === 'browser_snapshot';
  if ((isScreenshot || isSnapshot) && typeof result === 'string') {
    await recordBrowserArtifact(config.sessionId, {
      kind: isScreenshot ? 'screenshot' : 'snapshot',
      content: result,
    });
    if (isScreenshot) {
      await diffAndRecordBrowserScreenshots(config.sessionId, result).catch(() => {});
    }
  }

  return result;
}
```

**Step 4: Run tests to confirm they pass**

```bash
npm test -- tests/browser/mcp-interceptor.test.ts
```

Expected: All PASS.

**Step 5: Commit**

```bash
git add src/browser/mcp-interceptor.ts tests/browser/mcp-interceptor.test.ts
git commit -m "feat(browser): add BrowserMcpInterceptor — policy/approval/artifact pipeline for MCP calls"
```

---

### Task 3: Wire interceptor into registry execute path

The registry currently calls `mcpConn.call(originalName, args)` directly. Route Playwright connections through the interceptor.

**Files:**
- Modify: `src/mcp/registry.ts:249-260`
- Test: `tests/mcp/client.test.ts` (add smoke test for playwright interception path)

**Step 1: Write the failing test**

In `tests/mcp/client.test.ts`, add at the end of the existing describe block:

```typescript
it('intercepts playwright browser tool calls through policy engine', async () => {
  // Verify that a browser_evaluate call routed through registry
  // raises BrowserPolicyDeniedError when policy denies it
  // (test with a mock registry built via buildToolRegistry)
  // This is a smoke test — full interception coverage is in mcp-interceptor.test.ts

  // For now, just assert that isBrowserToolName('browser_evaluate') returns true
  // and that the interceptor module is importable (wiring check)
  const { isBrowserToolName } = await import('../../src/browser/policy-engine.js');
  expect(isBrowserToolName('browser_evaluate')).toBe(true);
  expect(isBrowserToolName('browser_navigate')).toBe(true);
  expect(isBrowserToolName('read_file')).toBe(false);
});
```

**Step 2: Run test to verify it passes (it's a smoke test)**

```bash
npm test -- tests/mcp/client.test.ts
```

Expected: PASS (this test verifies preconditions, not the wiring itself).

**Step 3: Wire interceptor in `registry.ts`**

In the `execute()` method of `buildToolRegistry`, replace the MCP execution block:

```typescript
// Before (lines ~249-260):
const mcpConn = mcpRoutes.get(name);
if (mcpConn) {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(argsJson);
  } catch {
    return 'Error: Invalid JSON arguments';
  }
  // Strip namespace: mcp__server__toolname -> toolname
  const originalName = name.split('__').slice(2).join('__');
  return mcpConn.call(originalName, args);
}
```

Replace with:

```typescript
const mcpConn = mcpRoutes.get(name);
if (mcpConn) {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(argsJson);
  } catch {
    return 'Error: Invalid JSON arguments';
  }
  const originalName = name.split('__').slice(2).join('__');

  // Route Playwright MCP browser calls through the policy/safety interceptor
  if (mcpConn.name === PLAYWRIGHT_MCP_SERVER_KEY && config.browser?.enabled) {
    const { interceptBrowserMcpCall } = await import('../browser/mcp-interceptor.js');
    const { resolveBrowserPolicyConfig } = await import('../core/browser-policy-config.js');
    try {
      const result = await interceptBrowserMcpCall(
        originalName,
        args,
        {
          policyConfig: resolveBrowserPolicyConfig(config.browser),
          sessionId: parentCtx?.parentSessionId ?? 'registry',
        },
        () => mcpConn.call(originalName, args),
      );
      return typeof result === 'string' ? result : JSON.stringify(result);
    } catch (err) {
      return `Error: ${errorMessage(err)}`;
    }
  }

  return mcpConn.call(originalName, args);
}
```

**Step 4: Run typecheck + full browser test suite**

```bash
npm run typecheck
npm test -- tests/browser/ tests/mcp/
```

Expected: All PASS.

**Step 5: Commit**

```bash
git add src/mcp/registry.ts
git commit -m "feat(browser): wire BrowserMcpInterceptor into registry execute path for @playwright/mcp"
```

---

## Phase 2 — Sub-Agent Delegation (≈2 days)

Goal: Main agent delegates browser tasks to a full-peer sub-agent that runs an autonomous loop using the full Playwright MCP surface via the interceptor.

---

### Task 4: Build `BrowserSubAgentDelegator`

**Files:**
- Create: `src/browser/sub-agent-delegator.ts`
- Test: `tests/browser/sub-agent-delegator.test.ts` (new)

**Step 1: Write the failing tests**

Create `tests/browser/sub-agent-delegator.test.ts`:

```typescript
import { describe, expect, it, vi, afterEach } from 'vitest';
import { delegateToBrowserSubAgent, type BrowserSubAgentOptions } from '../../src/browser/sub-agent-delegator.js';
import { DEFAULT_CONFIG } from '../../src/core/config.js';

vi.mock('../../src/core/subagent.js', () => ({
  spawnSubAgent: vi.fn(),
  formatSubAgentResult: vi.fn((r: { response: string }) => r.response),
  createSubAgentContext: vi.fn(() => ({ depth: 1, parentSessionId: 'root' })),
}));
vi.mock('openai', () => ({
  default: vi.fn(() => ({ chat: { completions: { create: vi.fn() } } })),
}));

import { spawnSubAgent } from '../../src/core/subagent.js';

afterEach(() => vi.clearAllMocks());

describe('BrowserSubAgentDelegator', () => {
  const opts: BrowserSubAgentOptions = {
    goal: 'Navigate to https://example.com and take a screenshot',
    config: DEFAULT_CONFIG,
  };

  it('spawns a sub-agent with the browser goal and returns a BrowserSubAgentResult', async () => {
    vi.mocked(spawnSubAgent).mockResolvedValue({
      response: 'Screenshot captured. File: /tmp/ss-001.png',
      toolCallCount: 3,
      aborted: false,
    });

    const result = await delegateToBrowserSubAgent(opts);

    expect(spawnSubAgent).toHaveBeenCalledOnce();
    const spawnArgs = vi.mocked(spawnSubAgent).mock.calls[0];
    // First arg is the task spec
    expect(spawnArgs?.[0]?.description).toContain('Navigate to https://example.com');
    expect(result.ok).toBe(true);
    expect(result.summary).toContain('Screenshot captured');
  });

  it('returns ok: false when sub-agent throws', async () => {
    vi.mocked(spawnSubAgent).mockRejectedValue(new Error('LMX unreachable'));

    const result = await delegateToBrowserSubAgent(opts);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('LMX unreachable');
  });

  it('passes sessionId continuity if preferredSessionId is provided', async () => {
    vi.mocked(spawnSubAgent).mockResolvedValue({
      response: 'done', toolCallCount: 1, aborted: false,
    });

    await delegateToBrowserSubAgent({ ...opts, preferredSessionId: 'sess-reuse-01' });

    const spawnArgs = vi.mocked(spawnSubAgent).mock.calls[0];
    // System prompt passed in the task spec should contain the session ID
    expect(JSON.stringify(spawnArgs)).toContain('sess-reuse-01');
  });
});
```

**Step 2: Run tests to confirm they fail**

```bash
npm test -- tests/browser/sub-agent-delegator.test.ts
```

Expected: FAIL — `sub-agent-delegator.ts` doesn't exist yet.

**Step 3: Create `src/browser/sub-agent-delegator.ts`**

```typescript
import { errorMessage } from '../utils/errors.js';
import type { OptaConfig } from '../core/config.js';

export interface BrowserSubAgentOptions {
  goal: string;
  config: OptaConfig;
  preferredSessionId?: string;
  /** Optional summary from the main agent's current context window. */
  inheritedContext?: string;
  /** Callback for sub-agent progress events (mirrors SubAgentCallbacks). */
  onProgress?: (event: { type: string; content?: string }) => void;
}

export interface BrowserSubAgentResult {
  ok: boolean;
  summary: string;
  sessionId?: string;
  artifactPaths: string[];
  error?: string;
}

const BROWSER_SPECIALIST_PROMPT = `You are a browser automation specialist with access to the full Playwright MCP tool surface.

Your role:
- Execute the browser goal you are given using browser_* tools
- Always start with browser_snapshot to understand page state before interacting
- Take a browser_screenshot when the goal involves visual verification
- Respect policy gating — if a tool call is denied, report it and stop
- When complete, provide a concise summary of what you accomplished

Available tools include: browser_navigate, browser_click, browser_type, browser_select_option, browser_hover, browser_scroll, browser_snapshot, browser_screenshot, browser_evaluate, browser_go_back, browser_go_forward, browser_tab_new, browser_press_key, browser_handle_dialog, browser_wait_for_element, and more.

IMPORTANT: Do not write files or run shell commands. Focus only on browser automation.`;

export async function delegateToBrowserSubAgent(
  options: BrowserSubAgentOptions,
): Promise<BrowserSubAgentResult> {
  const { goal, config, preferredSessionId, inheritedContext, onProgress } = options;

  try {
    const { spawnSubAgent, formatSubAgentResult, createSubAgentContext } =
      await import('../core/subagent.js');
    const { nanoid } = await import('nanoid');
    const { default: OpenAI } = await import('openai');
    const { resolveLmxApiKey } = await import('../lmx/api-key.js');

    const agentId = nanoid(8);
    const childContext = createSubAgentContext('root', undefined, config);

    const client = new OpenAI({
      baseURL: `http://${config.connection.host}:${config.connection.port}/v1`,
      apiKey: resolveLmxApiKey(config.connection),
    });

    // Build the full task description for the sub-agent
    const sessionNote = preferredSessionId
      ? `\n\nReuse browser session ID: ${preferredSessionId}`
      : '';
    const contextNote = inheritedContext
      ? `\n\nContext from main session:\n${inheritedContext}`
      : '';
    const taskDescription = `${BROWSER_SPECIALIST_PROMPT}${sessionNote}${contextNote}\n\n---\n\nGoal: ${goal}`;

    // Lazily build a registry for the sub-agent (includes Playwright MCP tools)
    const { buildToolRegistry } = await import('../mcp/registry.js');
    const subRegistry = await buildToolRegistry(config, 'normal', {
      onSubAgentProgress: onProgress
        ? (evt) => onProgress({ type: 'progress', content: JSON.stringify(evt) })
        : undefined,
    });

    const spawnResult = await spawnSubAgent(
      {
        id: agentId,
        description: taskDescription,
        budget: { maxToolCalls: 30 },
        onProgress: onProgress
          ? (evt) => onProgress({ type: 'sub-agent-progress', content: JSON.stringify(evt) })
          : undefined,
      },
      config,
      client,
      subRegistry,
      childContext,
    );

    await subRegistry.close();

    const summary = formatSubAgentResult(spawnResult);

    return {
      ok: !spawnResult.aborted,
      summary,
      sessionId: preferredSessionId,
      artifactPaths: [],
    };
  } catch (err) {
    return {
      ok: false,
      summary: '',
      artifactPaths: [],
      error: errorMessage(err),
    };
  }
}
```

**Step 4: Run tests to confirm they pass**

```bash
npm test -- tests/browser/sub-agent-delegator.test.ts
```

Expected: All PASS.

**Step 5: Commit**

```bash
git add src/browser/sub-agent-delegator.ts tests/browser/sub-agent-delegator.test.ts
git commit -m "feat(browser): add BrowserSubAgentDelegator — autonomous browser goal delegation"
```

---

### Task 5: Wire delegator into agent loop + port integration test

**Files:**
- Modify: `src/core/agent.ts:393-405` (browser instruction injection block)
- Modify: `tests/integration/browser-autonomous-flow.test.ts` (port to delegation model)

**Step 1: Port the integration test**

The existing test in `tests/integration/browser-autonomous-flow.test.ts` uses `resolveToolDecisions` with `browser_click`. After cutover the legacy `browser_click` tool won't exist — we test the delegation path instead.

Add a new describe block **without removing existing tests** (those still need to pass until Phase 3):

```typescript
describe('browser delegation flow (MCP path)', () => {
  it('delegateToBrowserSubAgent propagates policy denial without crashing', async () => {
    const { delegateToBrowserSubAgent } = await import('../../src/browser/sub-agent-delegator.js');
    const config = structuredClone(DEFAULT_CONFIG);
    config.browser.enabled = true;

    // Mock spawnSubAgent to throw a policy denial
    const { spawnSubAgent } = await import('../../src/core/subagent.js');
    vi.mocked(spawnSubAgent).mockRejectedValue(new Error('BrowserPolicyDenied: upload — blocked origin'));

    const result = await delegateToBrowserSubAgent({
      goal: 'Upload file to https://blocked-site.com',
      config,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('BrowserPolicyDenied');
  });
});
```

**Step 2: Run the existing + new integration tests**

```bash
npm test -- tests/integration/browser-autonomous-flow.test.ts
```

Expected: All existing tests PASS. New delegation test: PASS (uses mocks).

**Step 3: Wire delegator into `agent.ts`**

In `src/core/agent.ts`, update the browser-intent section (lines ~393-405) to expose the delegator for use in the loop. The agent currently just injects an instruction — it doesn't auto-delegate. Add a helper export so that callers can invoke `delegateToBrowserSubAgent` when appropriate:

```typescript
// In agent.ts, update the browser availability instruction block:
if (effectiveConfig.browser.enabled) {
  const { buildBrowserAvailabilityInstruction } = await import('../browser/intent-router.js');
  // Check if browser MCP is enabled (new path) vs legacy (old path)
  const mcpEnabled = effectiveConfig.browser.mcp?.enabled ?? false;
  const explicitRequest = task.toLowerCase().includes('browser');
  const browserInstruction = buildBrowserAvailabilityInstruction(explicitRequest, mcpEnabled);
  if (
    browserInstruction &&
    systemMessage &&
    typeof systemMessage.content === 'string' &&
    !systemMessage.content.includes('### Browser Tools Available')
  ) {
    systemMessage.content = `${systemMessage.content}\n\n${browserInstruction}`;
  }
}
```

Then update `buildBrowserAvailabilityInstruction` in `src/browser/intent-router.ts` to accept the `mcpEnabled` flag and reflect the MCP tool list when true:

```typescript
// In src/browser/intent-router.ts, update signature:
export function buildBrowserAvailabilityInstruction(
  explicitRequest: boolean,
  mcpEnabled: boolean = false,
): string | null {
  if (!explicitRequest && !mcpEnabled) return null;

  const toolList = mcpEnabled
    ? 'browser_navigate, browser_click, browser_type, browser_select_option, browser_hover, browser_scroll, browser_snapshot, browser_screenshot, browser_evaluate, browser_go_back, browser_go_forward, browser_tab_new, browser_press_key, browser_handle_dialog, browser_wait_for_element'
    : 'browser_open, browser_navigate, browser_click, browser_type, browser_snapshot, browser_screenshot, browser_close';

  return `### Browser Tools Available\n\nUse ${toolList} for browser automation tasks. Always snapshot first to understand page state.`;
}
```

**Step 4: Run typecheck + agent tests**

```bash
npm run typecheck
npm test -- tests/core/ tests/integration/
```

Expected: All PASS.

**Step 5: Commit**

```bash
git add src/core/agent.ts src/browser/intent-router.ts tests/integration/browser-autonomous-flow.test.ts
git commit -m "feat(browser): wire BrowserSubAgentDelegator into agent loop; update browser instruction for MCP path"
```

---

## Phase 3 — Hard Cutover (≈1 day)

Goal: Remove the 7 legacy `browser_*` tool schemas, executors, and permissions. Single clean MCP path. Full test suite is the go/no-go gate.

---

### Task 6: Remove legacy browser tool schemas

**Files:**
- Modify: `src/core/tools/schemas.ts` — remove 7 `browser_*` definitions

**Step 1: Check what's there**

```bash
grep -n 'browser_' src/core/tools/schemas.ts
```

Expected output: lines defining `browser_open`, `browser_navigate`, `browser_click`, `browser_type`, `browser_snapshot`, `browser_screenshot`, `browser_close`.

**Step 2: Delete the 7 browser tool schema objects**

In `schemas.ts`, remove the 7 tool schema objects (each is a `{ type: 'function', function: { name: 'browser_*', ... } }` block). They span approximately lines 212–360. Keep all non-browser tools intact.

**Step 3: Run typecheck + tests immediately to catch breakage early**

```bash
npm run typecheck
npm test -- tests/core/
```

Note any failures — fix before proceeding.

**Step 4: Commit**

```bash
git add src/core/tools/schemas.ts
git commit -m "refactor(browser): remove 7 legacy browser_* tool schemas (cutover to @playwright/mcp)"
```

---

### Task 7: Remove legacy browser executors

**Files:**
- Modify: `src/core/tools/executors.ts` — remove `browser_open/navigate/click/type/snapshot/screenshot/close` cases

**Step 1: Find the executor cases**

```bash
grep -n 'browser_' src/core/tools/executors.ts
```

**Step 2: Remove each `case 'browser_*'` block**

Each case calls into `BrowserRuntimeDaemon` or the `control-surface`. Remove the full case including its handler code. The `default:` case should remain.

**Step 3: Run tests**

```bash
npm test -- tests/core/ tests/browser/
```

**Step 4: Commit**

```bash
git add src/core/tools/executors.ts
git commit -m "refactor(browser): remove legacy browser_* executors (cutover to @playwright/mcp interceptor)"
```

---

### Task 8: Remove legacy browser permissions + full suite gate

**Files:**
- Modify: `src/core/tools/permissions.ts` — remove `browser_*` permission defaults

**Step 1: Remove browser permission entries**

In `permissions.ts`, remove all `browser_open`, `browser_navigate`, `browser_click`, `browser_type`, `browser_snapshot`, `browser_screenshot`, `browser_close` entries from `DEFAULT_PERMISSIONS`.

**Step 2: Update `isBrowserToolName` callers**

`isBrowserToolName` in `policy-engine.ts` still correctly identifies `browser_*` names — no change needed. But `isInteractiveAction` in `evaluateBrowserPolicyAction` lists legacy tool names explicitly. Update those guards to use the broader `isBrowserToolName`:

```typescript
// Before (in evaluateBrowserPolicyAction):
const isInteractiveAction =
  request.toolName === 'browser_click'
  || request.toolName === 'browser_type'
  || request.toolName === 'browser_handle_dialog'
  || request.toolName === 'browser_navigate';

// After:
const isInteractiveAction = isBrowserToolName(request.toolName);
```

**Step 3: RUN THE FULL SUITE — go/no-go gate**

```bash
npm test
```

**This is the hard cutover gate. All 2,277+ tests must pass.**

If any test fails due to removed legacy tools: fix the test to use MCP delegation, not the legacy `browser_*` call.

**Step 4: Commit only if full suite passes**

```bash
git add src/core/tools/permissions.ts src/browser/policy-engine.ts
git commit -m "refactor(browser): remove legacy browser_* permissions; hard cutover complete — zero legacy surface"
```

---

## Phase 4 — Expansion + Cleanup (≈2 days)

Goal: New capabilities tested, run-corpus extended for MCP tool names, docs current.

---

### Task 9: Add expanded capability tests via interceptor

Test `browser_scroll`, `browser_hover`, `browser_select_option`, `browser_evaluate` through the interceptor end-to-end (with mock MCP connection).

**Files:**
- Modify: `tests/browser/mcp-interceptor.test.ts` (extend existing describe block)

**Step 1: Add tests for new capabilities**

```typescript
describe('MCP-only tool execution through interceptor', () => {
  it('allows browser_scroll (low risk) without gate', async () => {
    vi.mocked(evaluateBrowserPolicyAction).mockReturnValue({
      decision: 'allow', risk: 'low', actionKey: 'observe', reason: 'ok',
      riskEvidence: { classifier: 'static', matchedSignals: [] },
    });

    const execute = vi.fn().mockResolvedValue('scrolled');
    const result = await interceptBrowserMcpCall('browser_scroll', { direction: 'down', amount: 3 }, baseConfig, execute);
    expect(execute).toHaveBeenCalledOnce();
    expect(result).toBe('scrolled');
  });

  it('allows browser_hover (low risk) without gate', async () => {
    vi.mocked(evaluateBrowserPolicyAction).mockReturnValue({
      decision: 'allow', risk: 'low', actionKey: 'observe', reason: 'ok',
      riskEvidence: { classifier: 'static', matchedSignals: [] },
    });

    const execute = vi.fn().mockResolvedValue('hovered');
    const result = await interceptBrowserMcpCall('browser_hover', { selector: '#menu-item' }, baseConfig, execute);
    expect(execute).toHaveBeenCalledOnce();
    expect(result).toBe('hovered');
  });

  it('gates browser_evaluate (high risk) correctly', async () => {
    // Already covered in Task 2 test — verify integration with real policy engine (no mock)
    const { interceptBrowserMcpCall: realIntercept } = await import('../../src/browser/mcp-interceptor.js');
    vi.unmock('../../src/browser/policy-engine.js');

    const execute = vi.fn().mockResolvedValue('result');
    const onGate = vi.fn().mockResolvedValue('approved');

    await realIntercept(
      'browser_evaluate',
      { expression: 'document.title' },
      {
        policyConfig: { requireApprovalForHighRisk: true, allowedHosts: ['*'], blockedOrigins: [], sensitiveActions: ['auth_submit', 'post', 'checkout', 'delete'], credentialIsolation: true },
        sessionId: 'test',
        onGate,
      },
      execute,
    );

    expect(onGate).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledOnce();
  });
});
```

**Step 2: Run tests**

```bash
npm test -- tests/browser/mcp-interceptor.test.ts
```

Expected: All PASS.

**Step 3: Commit**

```bash
git add tests/browser/mcp-interceptor.test.ts
git commit -m "test(browser): add expanded capability tests for scroll/hover/evaluate via MCP interceptor"
```

---

### Task 10: Extend run-corpus adaptation for MCP tool names

`src/browser/adaptation.ts` uses a signal vocabulary to detect high-risk patterns. It references legacy `browser_*` names for signal matching.

**Files:**
- Modify: `src/browser/adaptation.ts` (extend signal vocabulary)
- Modify: `tests/browser/adaptation.test.ts` (add MCP tool name assertions)

**Step 1: Check current signal vocabulary**

```bash
grep -n 'browser_' src/browser/adaptation.ts
```

**Step 2: Update signal matching to cover new tools**

Find the pattern that checks tool names (typically a `Set` or explicit comparisons). Add the new MCP-only tools: `browser_evaluate`, `browser_file_upload`, `browser_select_option`, `browser_drag`.

**Step 3: Run adaptation tests**

```bash
npm test -- tests/browser/adaptation.test.ts
```

Expected: All PASS.

**Step 4: Commit**

```bash
git add src/browser/adaptation.ts tests/browser/adaptation.test.ts
git commit -m "feat(browser): extend run-corpus adaptation signal vocabulary for MCP tool names"
```

---

### Task 11: Update docs

**Files:**
- Modify: `CLAUDE.md` (browser section)
- Create (or modify): `docs/DECISIONS.md` (add MCP bridge rationale)

**Step 1: Update `CLAUDE.md` browser section**

Replace the browser tool list under "Browser Automation" with:

```markdown
### Browser Automation (`src/browser/`)

Playwright-backed via `@playwright/mcp`. All tool calls route through `BrowserMcpInterceptor` which:
1. Evaluates risk with `evaluateBrowserPolicyAction`
2. Gates or denies high-risk actions
3. Records artifacts (screenshots/snapshots)
4. Feeds `visual-diff.ts` pipeline

**Available tools (30+):** browser_navigate, browser_click, browser_type, browser_select_option,
browser_hover, browser_drag, browser_scroll, browser_press_key, browser_snapshot, browser_screenshot,
browser_evaluate, browser_go_back, browser_go_forward, browser_tab_new, browser_tab_close,
browser_tab_switch, browser_handle_dialog, browser_wait_for_element, browser_wait_for_navigation,
browser_file_upload, and more.

**Browser sub-agent:** Use `delegateToBrowserSubAgent()` in `src/browser/sub-agent-delegator.ts`
to spawn a full-peer browser specialist for autonomous multi-step goals.

**Config flag:** `browser.mcp.enabled = true` (auto-registers `@playwright/mcp` via `mcp-bootstrap.ts`).
```

**Step 2: Add decision record in `docs/DECISIONS.md`**

Add at the top of the decisions list:

```markdown
## 2026-02-28 — Browser MCP Bridge + Sub-Agent Delegation

**Decision:** Replace 7-tool legacy `browser_*` surface with `@playwright/mcp` (30+ tools).
Safety infrastructure (policy engine, visual diff, approval gating) preserved as `BrowserMcpInterceptor`
wrapping every MCP call. Browser goals delegated to full-peer sub-agents via `BrowserSubAgentDelegator`.
Hard cutover: zero legacy surface, single clean path.

**Rationale:** Legacy surface was incomplete (missing scroll, hover, JS eval, tabs). MCP bridge gives
full Playwright coverage while keeping all antigravity safety guarantees. Sub-agent delegation provides
true autonomy — the main agent sees browser work as a single tool result.

**Gate:** All 139+ pre-existing browser tests pass with zero legacy tool references.
```

**Step 3: Commit**

```bash
git add CLAUDE.md docs/DECISIONS.md
git commit -m "docs(browser): update CLAUDE.md + DECISIONS.md for MCP bridge architecture"
```

---

## Verification

After all phases complete, run the full verification suite:

```bash
cd optalocal/1D-Opta-CLI-TS

# Type check — must be clean
npm run typecheck

# Full test suite — must pass
npm test

# Browser module specifically
npm run test:browser:runtime-regression
npm run test:browser:gates

# Confirm zero legacy browser tool references remain
grep -rn 'browser_open\|browser_navigate\|browser_click\|browser_type\|browser_snapshot\|browser_screenshot\|browser_close' src/core/tools/ && echo "FAIL: legacy tools still present" || echo "PASS: legacy tools removed"

# Confirm interceptor is wired
grep -n 'interceptBrowserMcpCall\|PLAYWRIGHT_MCP_SERVER_KEY' src/mcp/registry.ts
```

All checks must pass before marking the upgrade complete.

---

## Checklist

- [ ] Task 1: Extend `classifyAction` for MCP-only tools (browser_evaluate, browser_file_upload, etc.)
- [ ] Task 2: Build `BrowserMcpInterceptor` (policy/approval/artifact pipeline)
- [ ] Task 3: Wire interceptor into registry execute path for @playwright/mcp
- [ ] Task 4: Build `BrowserSubAgentDelegator` (autonomous browser goal delegation)
- [ ] Task 5: Wire delegator into agent loop + port integration test
- [ ] Task 6: Remove legacy browser tool schemas from `schemas.ts`
- [ ] Task 7: Remove legacy browser executors from `executors.ts`
- [ ] Task 8: Remove legacy browser permissions + full suite gate (go/no-go)
- [ ] Task 9: Add expanded capability tests (scroll, hover, evaluate)
- [ ] Task 10: Extend run-corpus adaptation for MCP tool names
- [ ] Task 11: Update CLAUDE.md + DECISIONS.md
