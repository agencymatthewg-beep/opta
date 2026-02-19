# Developer Velocity Improvements — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate code duplication, break up the god file, clean dead code, and add guardrails — 18 improvements to make Opta CLI faster to evolve.

**Architecture:** Pure refactoring — no behavior changes. Every task follows extract → replace → verify. Tests must pass after every task. Existing public API surfaces stay identical.

**Tech Stack:** TypeScript 5, vitest, tsup (ESM build), Node 20+

---

## Phase 1: P0 — Quick Wins (Tasks 1-5)

These are under 15 minutes each with immediate payoff. Do them in order.

---

### Task 1: Create `utils/errors.ts` — Unified error message extraction

**Files:**
- Create: `src/utils/errors.ts`
- Create: `tests/utils/errors.test.ts`
- Modify: All 16 files containing `err instanceof Error ? err.message : String(err)`

**Step 1: Write the failing test**

```typescript
// tests/utils/errors.test.ts
import { describe, it, expect } from 'vitest';
import { errorMessage } from '../src/utils/errors.js';

describe('errorMessage', () => {
  it('extracts message from Error instance', () => {
    expect(errorMessage(new Error('fail'))).toBe('fail');
  });

  it('converts non-Error to string', () => {
    expect(errorMessage('raw string')).toBe('raw string');
    expect(errorMessage(42)).toBe('42');
    expect(errorMessage(null)).toBe('null');
    expect(errorMessage(undefined)).toBe('undefined');
  });

  it('handles Error subclasses', () => {
    expect(errorMessage(new TypeError('type fail'))).toBe('type fail');
    expect(errorMessage(new RangeError('range fail'))).toBe('range fail');
  });

  it('handles objects with message property', () => {
    expect(errorMessage({ message: 'obj msg' })).toBe('[object Object]');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/utils/errors.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/utils/errors.ts
/**
 * Extract a human-readable message from any caught error value.
 *
 * Replaces the repeated `err instanceof Error ? err.message : String(err)` pattern.
 */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/utils/errors.test.ts`
Expected: PASS

**Step 5: Replace all 25+ occurrences across 16 files**

In each file, add `import { errorMessage } from '../utils/errors.js';` (adjust relative path) and replace every `err instanceof Error ? err.message : String(err)` with `errorMessage(err)`.

Files to update (found via grep):
- `src/commands/slash/lmx.ts`
- `src/providers/lmx.ts`
- `src/commands/chat.ts`
- `src/core/tools/executors.ts`
- `src/core/agent.ts`
- `src/commands/serve.ts`
- `src/tui/adapter.ts`
- `src/tui/ModelPicker.tsx`
- `src/providers/anthropic.ts`
- `src/core/subagent.ts`
- `src/mcp/client.ts`
- `src/mcp/registry.ts`
- `src/commands/doctor.ts`
- `src/tools/custom.ts`
- `src/commands/server.ts`
- `src/lsp/manager.ts`

**Step 6: Verify no regressions**

Run: `npm run typecheck && npm test`
Expected: All pass

**Step 7: Commit**

```bash
git add src/utils/errors.ts tests/utils/errors.test.ts src/commands/ src/core/ src/providers/ src/tui/ src/mcp/ src/tools/ src/lsp/
git commit -m "refactor(cli): extract errorMessage utility — deduplicate 25+ catch patterns"
```

---

### Task 2: Consolidate token estimation

**Files:**
- Modify: `src/utils/tokens.ts`
- Modify: `tests/utils/tokens.test.ts` (or create if missing)
- Modify: `src/core/agent.ts` (remove `estimateTokens` function, lines 204-218)
- Modify: `src/core/subagent.ts` (remove `estimateTokensSimple`, lines 490-494)
- Modify: `src/commands/slash/debug.ts` (line 37)
- Modify: `src/mcp/registry.ts` (line 121)
- Modify: `src/core/insights.ts` (line 139)

**Step 1: Write failing tests for the new overloads**

```typescript
// tests/utils/tokens.test.ts
import { describe, it, expect } from 'vitest';
import { estimateTokens, estimateMessageTokens, formatTokens } from '../src/utils/tokens.js';

describe('estimateTokens', () => {
  it('estimates from plain string', () => {
    expect(estimateTokens('hello world')).toBe(Math.ceil(11 / 4));
  });

  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });
});

describe('estimateMessageTokens', () => {
  it('handles string content', () => {
    const msgs = [{ role: 'user', content: 'hello world' }];
    expect(estimateMessageTokens(msgs)).toBe(Math.ceil(11 / 4));
  });

  it('handles null content', () => {
    const msgs = [{ role: 'assistant', content: null }];
    expect(estimateMessageTokens(msgs)).toBe(0);
  });

  it('handles ContentPart array with text', () => {
    const msgs = [{
      role: 'user',
      content: [
        { type: 'text' as const, text: 'describe this' },
      ],
    }];
    expect(estimateMessageTokens(msgs)).toBe(Math.ceil(13 / 4));
  });

  it('handles ContentPart array with image_url', () => {
    const msgs = [{
      role: 'user',
      content: [
        { type: 'text' as const, text: 'look' },
        { type: 'image_url' as const, image_url: { url: 'data:...' } },
      ],
    }];
    // 4 chars text + 1000 for image = 1004
    expect(estimateMessageTokens(msgs)).toBe(Math.ceil(1004 / 4));
  });

  it('includes tool_calls in estimate', () => {
    const calls = [{ id: 'x', function: { name: 'test', arguments: '{}' } }];
    const msgs = [{ role: 'assistant', content: 'ok', tool_calls: calls }];
    const expected = Math.ceil(('ok'.length + JSON.stringify(calls).length) / 4);
    expect(estimateMessageTokens(msgs)).toBe(expected);
  });
});

describe('formatTokens', () => {
  it('formats large numbers with K suffix', () => {
    expect(formatTokens(150000)).toBe('150K');
    expect(formatTokens(1500)).toBe('1.5K');
    expect(formatTokens(500)).toBe('500');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/utils/tokens.test.ts`
Expected: FAIL — `estimateMessageTokens` doesn't handle ContentPart arrays yet

**Step 3: Update `src/utils/tokens.ts` with full implementation**

```typescript
/**
 * Canonical token estimation and formatting utilities.
 *
 * All token counting in Opta CLI MUST use these functions
 * rather than inline `text.length / 4` or ad-hoc approaches.
 */

/** A content part in a multimodal message. */
interface ContentPart {
  type: string;
  text?: string;
  image_url?: { url: string };
}

/** A chat message with optional multimodal content and tool calls. */
interface TokenMessage {
  role: string;
  content?: string | ContentPart[] | null;
  tool_calls?: unknown[];
}

/**
 * Estimate token count for a plain string using chars/4 heuristic.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Estimate total tokens for an array of chat messages.
 * Handles string content, ContentPart[] (multimodal), and tool_calls.
 */
export function estimateMessageTokens(messages: TokenMessage[]): number {
  return messages.reduce((sum, m) => {
    let contentLen = 0;
    if (typeof m.content === 'string') {
      contentLen = m.content.length;
    } else if (Array.isArray(m.content)) {
      contentLen = m.content.reduce((s, p) => {
        if (p.type === 'text' && p.text) return s + p.text.length;
        if (p.type === 'image_url') return s + 1000;
        return s;
      }, 0);
    }
    const toolCallsStr = m.tool_calls ? JSON.stringify(m.tool_calls) : '';
    return sum + Math.ceil((contentLen + toolCallsStr.length) / 4);
  }, 0);
}

/**
 * Format a token count for display.
 *
 * - 100K+ → "100K" (no decimal)
 * - 1K–99.9K → "1.5K" (one decimal)
 * - <1K → "500" (raw number)
 */
export function formatTokens(n: number): string {
  if (n >= 100_000) return `${(n / 1000).toFixed(0)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/utils/tokens.test.ts`
Expected: PASS

**Step 5: Replace all duplicate implementations**

1. In `src/core/agent.ts`: Remove the `estimateTokens` function (lines 202-218). Replace import sites with `import { estimateTokens, estimateMessageTokens } from '../utils/tokens.js'`. Change calls from `estimateTokens(messages)` to `estimateMessageTokens(messages)`.
2. In `src/core/subagent.ts`: Remove `estimateTokensSimple` (lines 488-494). Import `estimateMessageTokens` from `../utils/tokens.js`. Replace `estimateTokensSimple(messages)` calls.
3. In `src/commands/slash/debug.ts` line 37: Replace `Math.ceil(len / 4)` with `estimateTokens(text)`.
4. In `src/mcp/registry.ts` line 121: Replace `Math.ceil(schemaJson.length / 4)` with `estimateTokens(schemaJson)`.
5. In `src/core/agent.ts` line 365: Replace `Math.ceil(delta.content.length / 4)` with `estimateTokens(delta.content)`.
6. In `src/core/insights.ts` line 139: Replace `Math.ceil(resultLen / 4)` with inline import or pass pre-computed value.

**Step 6: Verify no regressions**

Run: `npm run typecheck && npm test`
Expected: All pass

**Step 7: Commit**

```bash
git add src/utils/tokens.ts tests/utils/tokens.test.ts src/core/agent.ts src/core/subagent.ts src/commands/slash/debug.ts src/mcp/registry.ts src/core/insights.ts
git commit -m "refactor(cli): consolidate token estimation — 3 impls + 7 inline sites → 1 module"
```

---

### Task 3: Remove `stubs.ts` dead code

**Files:**
- Delete: `src/core/stubs.ts`

**Step 1: Verify stubs.ts has zero imports**

Run: `grep -r "stubs" src/ --include="*.ts" --include="*.tsx" | grep -v "stubs.ts"`
Expected: No results (no file imports stubs.ts)

**Step 2: Delete the file**

Delete `src/core/stubs.ts` (63 lines of dead code).

**Step 3: Verify no regressions**

Run: `npm run typecheck && npm test`
Expected: All pass

**Step 4: Commit**

```bash
git rm src/core/stubs.ts
git commit -m "chore(cli): remove stubs.ts — 63 lines of dead placeholder code"
```

---

### Task 4: Fix hardcoded version in server.ts

**Files:**
- Modify: `src/commands/server.ts` (line 39)

**Step 1: Verify existing test catches the drift**

Check if `tests/commands/server.test.ts` tests the version field. If not, add a test:

```typescript
it('returns version from package.json, not hardcoded', () => {
  const handler = createServerHandler({ model: 'test', host: '127.0.0.1', port: 1234 });
  const health = handler.handleHealth();
  expect(health.version).not.toBe('0.4.0'); // Must not be hardcoded
  expect(health.version).toMatch(/^\d+\.\d+\.\d+/); // Must be semver-like
});
```

**Step 2: Fix the implementation**

In `src/commands/server.ts`, add import and replace hardcoded version:

```typescript
// Add at top of file:
import { VERSION } from '../core/version.js';

// Line 39 — change:
//   version: '0.4.0',
// To:
    version: VERSION,
```

**Step 3: Verify**

Run: `npm run typecheck && npm test`
Expected: All pass

**Step 4: Commit**

```bash
git add src/commands/server.ts tests/commands/server.test.ts
git commit -m "fix(cli): use dynamic version in HTTP server health endpoint"
```

---

### Task 5: Fix SearXNG URL mismatch

**Files:**
- Modify: `src/core/tools/executors.ts` (lines 352-359)

**Step 1: Understand the current behavior**

Line 352 hardcodes `http://192.168.188.10:8888` as fallback. Config default is `http://192.168.188.11:8081`. These are different servers. The try/catch silently falls back to the wrong URL if config loading fails.

**Step 2: Fix — remove the hardcoded URL, fail if config unavailable**

```typescript
// Replace lines 348-359 of executors.ts:
async function execWebSearch(args: Record<string, unknown>): Promise<string> {
  const query = String(args['query'] ?? '');
  const maxResults = Number(args['max_results'] ?? 5);

  const { loadConfig } = await import('../config.js');
  const config = await loadConfig();
  const searxngUrl = config.search?.searxngUrl;

  if (!searxngUrl) {
    return 'Error: No SearXNG URL configured. Run: opta config set search.searxngUrl <url>';
  }
```

**Step 3: Verify**

Run: `npm run typecheck && npm test`
Expected: All pass

**Step 4: Commit**

```bash
git add src/core/tools/executors.ts
git commit -m "fix(cli): remove mismatched SearXNG fallback URL — use config or fail with guidance"
```

---

## Phase 2: P1 — This Week (Tasks 6-11)

Small effort, compound returns. Each one prevents future drift.

---

### Task 6: Safe JSON parse utility

**Files:**
- Create: `src/utils/json.ts`
- Create: `tests/utils/json.test.ts`
- Modify: `src/mcp/registry.ts` (5 sites)
- Modify: `src/core/agent.ts` (3 sites)
- Modify: `src/core/subagent.ts` (1 site)
- Modify: `src/core/tools/executors.ts` (1 site)

**Step 1: Write failing test**

```typescript
// tests/utils/json.test.ts
import { describe, it, expect } from 'vitest';
import { safeParseJson } from '../src/utils/json.js';

describe('safeParseJson', () => {
  it('parses valid JSON', () => {
    expect(safeParseJson('{"a": 1}')).toEqual({ a: 1 });
  });

  it('returns null for invalid JSON', () => {
    expect(safeParseJson('not json')).toBeNull();
    expect(safeParseJson('')).toBeNull();
    expect(safeParseJson(undefined as unknown as string)).toBeNull();
  });

  it('returns null for non-object JSON', () => {
    expect(safeParseJson('"string"')).toBeNull();
    expect(safeParseJson('42')).toBeNull();
    expect(safeParseJson('null')).toBeNull();
  });

  it('parses nested objects', () => {
    const input = '{"path": "/tmp/test", "content": "hello"}';
    expect(safeParseJson(input)).toEqual({ path: '/tmp/test', content: 'hello' });
  });
});
```

**Step 2: Implement**

```typescript
// src/utils/json.ts
/**
 * Safely parse a JSON string into a Record.
 * Returns null if parsing fails or result is not an object.
 */
export function safeParseJson(input: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(input);
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}
```

**Step 3: Replace all 10+ sites, run tests**

Run: `npm run typecheck && npm test`

**Step 4: Commit**

```bash
git add src/utils/json.ts tests/utils/json.test.ts src/mcp/registry.ts src/core/agent.ts src/core/subagent.ts src/core/tools/executors.ts
git commit -m "refactor(cli): extract safeParseJson — deduplicate 10+ try/catch JSON.parse blocks"
```

---

### Task 7: Shared ignore patterns

**Files:**
- Create: `src/utils/ignore.ts`
- Create: `tests/utils/ignore.test.ts`
- Modify: `src/core/tools/executors.ts` (lines 226, 274, 308)
- Modify: `src/ui/autocomplete.ts` (line 27)
- Modify: `src/tui/InputBox.tsx` (line 131)

**Step 1: Write failing test**

```typescript
// tests/utils/ignore.test.ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_IGNORE_DIRS, toGlobIgnore } from '../src/utils/ignore.js';

describe('DEFAULT_IGNORE_DIRS', () => {
  it('includes standard directories', () => {
    expect(DEFAULT_IGNORE_DIRS).toContain('node_modules');
    expect(DEFAULT_IGNORE_DIRS).toContain('.git');
    expect(DEFAULT_IGNORE_DIRS).toContain('dist');
    expect(DEFAULT_IGNORE_DIRS).toContain('coverage');
    expect(DEFAULT_IGNORE_DIRS).toContain('.next');
  });
});

describe('toGlobIgnore', () => {
  it('converts dir names to glob patterns', () => {
    const result = toGlobIgnore(['node_modules', 'dist']);
    expect(result).toEqual(['node_modules/**', 'dist/**']);
  });
});
```

**Step 2: Implement**

```typescript
// src/utils/ignore.ts
/**
 * Canonical set of directories to ignore in file operations.
 * Used by tool executors, autocomplete, and TUI file pickers.
 */
export const DEFAULT_IGNORE_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'coverage',
  '.next',
] as const;

/** Extra patterns for glob-based ignore (includes file patterns). */
export const DEFAULT_IGNORE_GLOBS = [
  ...DEFAULT_IGNORE_DIRS.map(d => `${d}/**`),
  '*.lock',
] as const;

/**
 * Convert directory names to glob ignore patterns.
 * Use when a library expects `['node_modules/**']` instead of `['node_modules']`.
 */
export function toGlobIgnore(dirs: readonly string[]): string[] {
  return dirs.map(d => `${d}/**`);
}
```

**Step 3: Replace all 5 sites, run tests**

Run: `npm run typecheck && npm test`

**Step 4: Commit**

```bash
git add src/utils/ignore.ts tests/utils/ignore.test.ts src/core/tools/executors.ts src/ui/autocomplete.ts src/tui/InputBox.tsx
git commit -m "refactor(cli): unify ignore patterns — 5 inconsistent lists → 1 constant"
```

---

### Task 8: Config store singleton

**Files:**
- Modify: `src/core/config.ts` (lines 334, 436, 512, 519-522)

**Step 1: Refactor `getConfigStore` to lazy singleton**

```typescript
// Replace lines 519-522 and update the function:
let _configStore: import('conf').default | null = null;

export async function getConfigStore(): Promise<import('conf').default> {
  if (!_configStore) {
    const { default: Conf } = await import('conf');
    _configStore = new Conf({ projectName: 'opta' });
  }
  return _configStore;
}
```

**Step 2: Replace all 3 other instantiation sites**

- Line 334 in `loadConfig`: `const store = await getConfigStore();`
- Line 436 in `healConfig`: `const store = await getConfigStore();`
- Line 512 in `saveConfig`: `const store = await getConfigStore();`

Remove the inline `new Conf({ projectName: 'opta' })` from each.

**Step 3: Verify**

Run: `npm run typecheck && npm test`

**Step 4: Commit**

```bash
git add src/core/config.ts
git commit -m "refactor(cli): use getConfigStore singleton — 4 Conf instantiations → 1"
```

---

### Task 9: Hoist dynamic imports from agent loop

**Files:**
- Modify: `src/core/agent.ts`

**Step 1: Identify imports inside the while loop**

The `agentLoop` function starts at line 452. Inside the loop body:
- Lines 737, 752: `await import('../core/config.js')` (permission-save path)
- Line 861: `await import('../git/utils.js')` (checkpoint path)
- Line 863: `await import('../git/checkpoints.js')` (checkpoint path)

**Step 2: Move to function preamble**

At the top of `agentLoop` (around line 553-558 where other hoisted imports live), add:

```typescript
const { saveConfig } = await import('./config.js');
const gitUtils = await import('../git/utils.js');
const checkpoints = await import('../git/checkpoints.js');
```

Then replace the inline `await import()` calls with the hoisted variables.

**Step 3: Verify**

Run: `npm run typecheck && npm test`

**Step 4: Commit**

```bash
git add src/core/agent.ts
git commit -m "perf(cli): hoist dynamic imports out of agent loop hot path"
```

---

### Task 10: Set vitest coverage thresholds

**Files:**
- Modify: `vitest.config.ts`

**Step 1: Get current coverage numbers**

Run: `npm test -- --coverage`

Note the actual statement/branch/function/line coverage percentages.

**Step 2: Set thresholds to current actuals minus 5% buffer**

```typescript
// vitest.config.ts — update thresholds section:
thresholds: {
  statements: 35,  // adjust to actual - 5%
  branches: 25,    // adjust to actual - 5%
  functions: 30,   // adjust to actual - 5%
  lines: 35,       // adjust to actual - 5%
},
```

**Step 3: Verify thresholds don't fail current codebase**

Run: `npm test -- --coverage`
Expected: PASS (thresholds should be below actuals)

**Step 4: Commit**

```bash
git add vitest.config.ts
git commit -m "ci(cli): set coverage thresholds to prevent silent regressions"
```

---

### Task 11: Named constants for magic numbers

**Files:**
- Modify: `src/core/agent.ts` (lines 230, 238)
- Modify: `src/core/context.ts` (line 20)

**Step 1: Extract constants at top of agent.ts**

```typescript
// Add near top of agent.ts, after imports:

/** Minimum number of recent messages to preserve during compaction. */
const MIN_COMPACTION_WINDOW = 6;
/** Maximum recent messages to keep (scales with context limit). */
const MAX_COMPACTION_WINDOW = 20;
/** Divisor for scaling compaction window to context limit. */
const COMPACTION_WINDOW_SCALE = 4000;
/** Minimum tokens allocated for conversation summary during compaction. */
const MIN_SUMMARY_BUDGET = 500;
/** Maximum tokens allocated for conversation summary. */
const MAX_SUMMARY_BUDGET = 2000;
/** Fraction of context limit allocated to summary budget. */
const SUMMARY_BUDGET_RATIO = 0.05;
```

**Step 2: Replace inline magic numbers**

```typescript
// Line 230:
const recentCount = Math.max(MIN_COMPACTION_WINDOW, Math.min(Math.floor(contextLimit / COMPACTION_WINDOW_SCALE), MAX_COMPACTION_WINDOW));

// Line 238:
const summaryBudget = Math.max(MIN_SUMMARY_BUDGET, Math.min(Math.floor(contextLimit * SUMMARY_BUDGET_RATIO), MAX_SUMMARY_BUDGET));
```

**Step 3: Verify**

Run: `npm run typecheck && npm test`

**Step 4: Commit**

```bash
git add src/core/agent.ts src/core/context.ts
git commit -m "refactor(cli): name magic numbers in compaction logic for self-documenting code"
```

---

## Phase 3: P2 — Scheduled (Tasks 12-14)

Medium effort, significant velocity gain. These clean up architectural duplication.

---

### Task 12: Shared model scan service

**Files:**
- Create: `src/services/model-scan.ts`
- Create: `tests/services/model-scan.test.ts`
- Modify: `src/commands/models.ts` (lines ~307-374)
- Modify: `src/commands/slash/lmx.ts` (lines ~9-134)

**Step 1: Write test for the shared scan function**

```typescript
// tests/services/model-scan.test.ts
import { describe, it, expect, vi } from 'vitest';
import { gatherModelScan, type ModelScanResult } from '../src/services/model-scan.js';

describe('gatherModelScan', () => {
  it('returns structured scan data', async () => {
    // Mock LmxClient
    const mockClient = {
      listModels: vi.fn().mockResolvedValue([]),
      getAvailable: vi.fn().mockResolvedValue([]),
      getPresets: vi.fn().mockResolvedValue([]),
      getStack: vi.fn().mockResolvedValue([]),
      getMemory: vi.fn().mockResolvedValue({ total: 0, used: 0 }),
    };

    const result = await gatherModelScan(mockClient as any);
    expect(result).toHaveProperty('loaded');
    expect(result).toHaveProperty('available');
    expect(result).toHaveProperty('presets');
    expect(result).toHaveProperty('memory');
  });
});
```

**Step 2: Extract shared logic from `commands/models.ts:gatherScanData`**

Read both `gatherScanData` in models.ts and `scanHandler` in lmx.ts. Extract the common data-gathering logic (endpoint queries, role lookup map construction) into `services/model-scan.ts`. Keep formatting in the consumer files.

**Step 3: Update both consumers to use the shared service**

Both `commands/models.ts` and `commands/slash/lmx.ts` should import `gatherModelScan` and only handle their own formatting.

**Step 4: Verify**

Run: `npm run typecheck && npm test`

**Step 5: Commit**

```bash
git add src/services/model-scan.ts tests/services/model-scan.test.ts src/commands/models.ts src/commands/slash/lmx.ts
git commit -m "refactor(cli): extract shared model scan service — deduplicate ~200 lines"
```

---

### Task 13: SubAgentResult builder

**Files:**
- Modify: `src/core/subagent.ts`
- Modify: `tests/core/subagent.test.ts`

**Step 1: Add test for the builder helper**

```typescript
// Add to tests/core/subagent.test.ts
it('buildResult produces consistent shape', () => {
  // Test that all required fields are present
  // Verify deduplication of filesRead/filesModified
  // Verify timing calculation
});
```

**Step 2: Create the builder inside subagent.ts**

```typescript
function buildResult(
  taskId: string,
  status: SubAgentResult['status'],
  response: string,
  extras: {
    filesRead: string[];
    filesModified: string[];
    startTime: number;
    messages: Array<{ content: string | null }>;
    toolCallCount?: number;
    error?: string;
  }
): SubAgentResult {
  return {
    taskId,
    status,
    response,
    filesRead: [...new Set(extras.filesRead)],
    filesModified: [...new Set(extras.filesModified)],
    duration: Date.now() - extras.startTime,
    tokenEstimate: estimateMessageTokens(extras.messages),
    toolCallCount: extras.toolCallCount ?? 0,
    error: extras.error,
  };
}
```

**Step 3: Replace all 7 return sites with `buildResult()` calls**

**Step 4: Verify**

Run: `npm run typecheck && npm test`

**Step 5: Commit**

```bash
git add src/core/subagent.ts tests/core/subagent.test.ts
git commit -m "refactor(cli): extract SubAgentResult builder — 7 duplicate return objects → 1 helper"
```

---

### Task 14: Replace process.exit() with thrown errors (incremental)

**Files:**
- Modify: `src/commands/models.ts` (13 sites)
- Modify: `src/commands/sessions.ts` (6 sites)
- Modify: `src/commands/config.ts` (4 sites)
- Modify: `src/commands/do.ts` (3 sites)
- Modify: `src/commands/serve.ts` (1 site)
- Modify: `src/commands/completions.ts` (1 site)
- Modify: `src/commands/server.ts` (1 site)
- Modify: `src/index.ts` (add top-level error handler)

**Step 1: Add top-level error handler in index.ts**

In `src/index.ts`, wrap the `program.parseAsync()` call (or add a `.exitOverride()` and catch):

```typescript
// At the bottom of index.ts, ensure the catch handler converts OptaError to exit codes:
try {
  await program.parseAsync();
} catch (err) {
  if (err instanceof OptaError) {
    console.error(formatError(err));
    process.exit(err.code);
  }
  throw err;
}
```

**Step 2: Convert one file at a time, starting with models.ts**

Replace each `process.exit(EXIT.MISUSE)` with `throw new OptaError('message', EXIT.MISUSE)`. For example:

```typescript
// Before:
console.error(chalk.red('Error: No model specified'));
process.exit(EXIT.MISUSE);

// After:
throw new OptaError('No model specified', EXIT.MISUSE);
```

**Step 3: Run tests after each file conversion**

Run: `npm run typecheck && npm test`

**Step 4: Commit per file or per batch**

```bash
git commit -m "refactor(cli): replace process.exit with thrown OptaError in models command"
git commit -m "refactor(cli): replace process.exit with thrown OptaError in sessions command"
# etc.
```

---

## Phase 4: P3 — Agent.ts Refactor (Tasks 15-18)

Do these together in one focused session. The goal: `agentLoop()` becomes a ~150-line orchestrator.

---

### Task 15: Extract `agent-streaming.ts`

**Files:**
- Create: `src/core/agent-streaming.ts`
- Modify: `src/core/agent.ts`

**Step 1: Move these functions to agent-streaming.ts**

- `isRetryableError` (lines 276-290)
- `createStreamWithRetry` (lines 292-329)
- `collectStream` (lines 333-403)
- `ToolCallAccum` type
- Related imports (`ThinkingRenderer`, `StatusBar`, `stripThinkTags`, `OnStreamCallbacks`, `debug`)

**Step 2: Export them and import from agent.ts**

```typescript
// src/core/agent-streaming.ts
export { isRetryableError, createStreamWithRetry, collectStream };
export type { ToolCallAccum };

// src/core/agent.ts
import { createStreamWithRetry, collectStream, type ToolCallAccum } from './agent-streaming.js';
```

**Step 3: Verify**

Run: `npm run typecheck && npm test`

**Step 4: Commit**

```bash
git add src/core/agent-streaming.ts src/core/agent.ts
git commit -m "refactor(cli): extract agent-streaming module — retry and stream collection"
```

---

### Task 16: Extract `agent-permissions.ts`

**Files:**
- Create: `src/core/agent-permissions.ts`
- Create: `tests/core/agent-permissions.test.ts`
- Modify: `src/core/agent.ts`

**Step 1: Move these to agent-permissions.ts**

- `PermissionResponse` type (line 407)
- `promptToolApproval` function (lines 409-448)

**Step 2: Write a test for promptToolApproval**

```typescript
// tests/core/agent-permissions.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('promptToolApproval', () => {
  it('returns deny in non-TTY environment', async () => {
    // Save and restore stdin.isTTY
    const original = process.stdin.isTTY;
    Object.defineProperty(process.stdin, 'isTTY', { value: false, writable: true });

    const { promptToolApproval } = await import('../src/core/agent-permissions.js');
    const result = await promptToolApproval('edit_file', { path: '/test' });
    expect(result).toBe('deny');

    Object.defineProperty(process.stdin, 'isTTY', { value: original, writable: true });
  });
});
```

**Step 3: Verify**

Run: `npm run typecheck && npm test`

**Step 4: Commit**

```bash
git add src/core/agent-permissions.ts tests/core/agent-permissions.test.ts src/core/agent.ts
git commit -m "refactor(cli): extract agent-permissions module — approval flow now independently testable"
```

---

### Task 17: Extract `agent-execution.ts`

**Files:**
- Create: `src/core/agent-execution.ts`
- Modify: `src/core/agent.ts`

**Step 1: Identify the execution block**

The parallel tool execution section (~lines 806-877) includes:
- Semaphore-bounded parallel dispatch
- Per-tool permission checking
- Result collection and formatting
- Checkpoint creation after write tools
- Insight engine tool events

**Step 2: Extract as a function**

```typescript
// src/core/agent-execution.ts
export async function executeToolCalls(
  toolCalls: ToolCallAccum[],
  options: {
    config: OptaConfig;
    executeTool: (call: ToolCallAccum) => Promise<string>;
    checkPermission: (toolName: string) => Promise<boolean>;
    onToolStart?: (name: string) => void;
    onToolEnd?: (name: string, result: string) => void;
    maxParallel: number;
  }
): Promise<ToolResult[]> {
  // ... move the parallel execution logic here
}
```

**Step 3: Import and use in agentLoop**

Replace the inline execution block with a call to `executeToolCalls()`.

**Step 4: Verify**

Run: `npm run typecheck && npm test`

**Step 5: Commit**

```bash
git add src/core/agent-execution.ts src/core/agent.ts
git commit -m "refactor(cli): extract agent-execution module — parallel tool dispatch with semaphore"
```

---

### Task 18: Extract `agent-setup.ts`

**Files:**
- Create: `src/core/agent-setup.ts`
- Modify: `src/core/agent.ts`

**Step 1: Move setup logic**

Extract from `agentLoop` (lines ~100-250):
- `buildSystemPrompt` function (already exists, lines 78-200)
- Client creation / provider selection logic
- OPIS loading
- Tool schema filtering based on agent profile
- Sub-agent config derivation

**Step 2: Export a setup function**

```typescript
// src/core/agent-setup.ts
export async function prepareAgentLoop(
  config: OptaConfig,
  options?: AgentLoopOptions
): Promise<{
  client: ProviderClient;
  systemPrompt: string;
  tools: ToolSchema[];
  // ... other setup products
}> {
  // ... consolidated setup logic
}
```

**Step 3: Verify**

Run: `npm run typecheck && npm test`

**Step 4: Commit**

```bash
git add src/core/agent-setup.ts src/core/agent.ts
git commit -m "refactor(cli): extract agent-setup module — init, prompts, and config derivation"
```

---

### Task 18b: Final verification

**Step 1: Full test suite**

Run: `npm run typecheck && npm run lint && npm test`
Expected: All pass

**Step 2: Verify agent.ts line count**

Run: `wc -l src/core/agent.ts`
Expected: ~150-200 lines (down from 947)

**Step 3: Build check**

Run: `npm run build`
Expected: Clean build

**Step 4: Final commit**

```bash
git add -A
git commit -m "refactor(cli): complete agent.ts decomposition — 947 lines → 6 focused modules"
```

---

## Execution Checklist

| Phase | Tasks | Est. Time | Commit Count |
|-------|-------|-----------|-------------|
| P0 | 1-5 | ~1.5 hr | 5 commits |
| P1 | 6-11 | ~2 hr | 6 commits |
| P2 | 12-14 | ~4.5 hr | 5 commits |
| P3 | 15-18 | ~4.5 hr | 5 commits |
| **Total** | **18 tasks** | **~12.5 hr** | **21 commits** |

All tasks are independent within their phase. Tasks in later phases may depend on utilities created in earlier phases (e.g., Task 13 uses `estimateMessageTokens` from Task 2).
