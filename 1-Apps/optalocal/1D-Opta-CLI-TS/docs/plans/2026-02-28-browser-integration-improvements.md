# Browser Integration Improvements — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Nine targeted improvements to the Opta CLI browser automation stack: six quick wins hardening correctness/performance, plus parallel tab orchestration, real-time WebSocket event streaming with visual Opta Border, and a default browser home page.

**Architecture:** All changes extend the existing MCP interceptor pipeline (`mcp-interceptor.ts`), corpus adaptation signal (`adaptation.ts`/`run-corpus.ts`), and the V3 daemon WebSocket event bus. No new npm dependencies except `sharp` (optional, behind dynamic import guard) for screenshot compression.

**Tech Stack:** TypeScript ESM (`.js` imports), Vitest, Playwright MCP via `@playwright/mcp`, Fastify + `ws` daemon, existing `retry-taxonomy.ts` / `approval-log.ts` / `artifacts.ts` / `policy-engine.ts`.

---

## Task 1: Auto-retry for flaky Playwright actions

**Files:**
- Modify: `src/browser/mcp-interceptor.ts`
- Test: `tests/browser/mcp-interceptor.test.ts`

### Step 1: Write the failing tests

Add to the bottom of `tests/browser/mcp-interceptor.test.ts`:

```typescript
describe('auto-retry on retryable errors', () => {
  it('retries a timeout error and succeeds on second attempt', async () => {
    const timeoutErr = Object.assign(new Error('Timeout exceeded'), { code: 'ETIMEDOUT' });
    let calls = 0;
    const execute = vi.fn().mockImplementation(() => {
      calls++;
      if (calls === 1) return Promise.reject(timeoutErr);
      return Promise.resolve({ ok: true });
    });

    const result = await interceptBrowserMcpCall(
      'browser_click',
      { selector: '#btn' },
      { policyConfig: { allowedHosts: ['*'] }, sessionId: 'retry-test', maxRetries: 1, retryBackoffMs: 0 },
      execute,
    );

    expect(result).toEqual({ ok: true });
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('does not retry a non-retryable policy-denied error', async () => {
    // policy-deny comes from the interceptor itself, not execute()
    // So test that a selector error (non-retryable per taxonomy) stops after 1 try
    const selectorErr = new Error('waiting for selector "#missing" failed');
    const execute = vi.fn().mockRejectedValue(selectorErr);

    await expect(interceptBrowserMcpCall(
      'browser_click',
      { selector: '#missing' },
      { policyConfig: { allowedHosts: ['*'] }, sessionId: 'no-retry-test', maxRetries: 2, retryBackoffMs: 0 },
      execute,
    )).rejects.toThrow('waiting for selector');

    // selector category is non-retryable — only 1 attempt
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('exhausts retries and throws last error', async () => {
    const netErr = Object.assign(new Error('net::ERR_CONNECTION_REFUSED'), { code: 'ECONNREFUSED' });
    const execute = vi.fn().mockRejectedValue(netErr);

    await expect(interceptBrowserMcpCall(
      'browser_navigate',
      { url: 'http://localhost:9999' },
      { policyConfig: { allowedHosts: ['*'] }, sessionId: 'exhaust-test', maxRetries: 2, retryBackoffMs: 0 },
      execute,
    )).rejects.toThrow('net::ERR_CONNECTION_REFUSED');

    expect(execute).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });
});
```

### Step 2: Run to verify tests fail

```bash
cd optalocal/1D-Opta-CLI-TS
npm test -- tests/browser/mcp-interceptor.test.ts
```

Expected: FAIL — `maxRetries` property not recognised, execute called once even when retries configured.

### Step 3: Add `maxRetries` + `retryBackoffMs` to config and wrap execute()

In `src/browser/mcp-interceptor.ts`:

**Add to `BrowserMcpInterceptorConfig`:**
```typescript
/** Max number of retry attempts for retryable Playwright errors. Default: 0 (no retry). */
maxRetries?: number;
/** Milliseconds to wait between retries. Default: 300. */
retryBackoffMs?: number;
```

**Replace the final `return execute();` line** with:
```typescript
const { classifyBrowserRetryTaxonomy } = await import('./retry-taxonomy.js');
const maxRetries = config.maxRetries ?? 0;
const backoffMs = config.retryBackoffMs ?? 300;
let lastError: unknown;

for (let attempt = 0; attempt <= maxRetries; attempt++) {
  try {
    return await execute();
  } catch (err) {
    lastError = err;
    if (attempt >= maxRetries) break;
    const code = (err as NodeJS.ErrnoException | undefined)?.code ?? '';
    const message = (err as Error | undefined)?.message ?? '';
    const taxonomy = classifyBrowserRetryTaxonomy(code, message);
    if (!taxonomy.retryable) break;
    if (backoffMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, backoffMs * (attempt + 1)));
    }
  }
}
throw lastError;
```

### Step 4: Run tests to verify they pass

```bash
npm test -- tests/browser/mcp-interceptor.test.ts
```

Expected: all tests PASS (including the 3 new retry tests).

### Step 5: Typecheck and commit

```bash
npm run typecheck
git add src/browser/mcp-interceptor.ts tests/browser/mcp-interceptor.test.ts
git commit -m "feat(browser): auto-retry flaky Playwright actions via retry-taxonomy

Adds optional maxRetries + retryBackoffMs to BrowserMcpInterceptorConfig.
Retryable categories (timeout, network, transient) are retried with
linear backoff. Non-retryable categories (policy, selector, invalid-input)
short-circuit immediately. Default: 0 retries (no change to existing behaviour).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Corpus → policy feedback loop (MCP risk weighting)

**Files:**
- Modify: `src/browser/run-corpus.ts` — add `highRiskMcpTools` flag to entries
- Modify: `src/browser/adaptation.ts` — apply extra investigate weight for high-risk entries
- Test: `tests/browser/adaptation.test.ts`

### Step 1: Read the BrowserRunCorpusEntry type

Before writing tests, check the current shape of `BrowserRunCorpusEntry` in `src/browser/run-corpus.ts`:

```bash
grep -n "interface.*Entry\|toolName\|tool_name\|highRisk" src/browser/run-corpus.ts | head -30
```

### Step 2: Add `highRiskMcpToolsPresent` to corpus entry and summary

In `src/browser/run-corpus.ts`, find `BrowserRunCorpusEntry` (or equivalent entry type) and add:
```typescript
/** True if any step in this session used a high-risk MCP tool (browser_evaluate, browser_file_upload). */
highRiskMcpToolsPresent?: boolean;
```

In the function that builds/scans corpus entries (look for the loop that increments `actionCount` / `failureCount`), add:

```typescript
import { isMcpHighRiskTool } from './adaptation.js';

// Inside the step-scanning loop:
if (isMcpHighRiskTool(step.toolName ?? '')) {
  entry.highRiskMcpToolsPresent = true;
}
```

### Step 3: Write failing adaptation test

Add to `tests/browser/adaptation.test.ts`:

```typescript
describe('MCP high-risk tool feedback weighting', () => {
  it('elevates investigate count for sessions with high-risk MCP tools that had failures', () => {
    const summary: BrowserRunCorpusSummary = {
      generatedAt: new Date().toISOString(),
      assessedSessionCount: 4,
      regressionSessionCount: 0,
      investigateSessionCount: 1,
      meanRegressionScore: 0,
      maxRegressionScore: 0,
      entries: [
        { sessionId: 's1', actionCount: 5, failureCount: 2, highRiskMcpToolsPresent: true },
        { sessionId: 's2', actionCount: 3, failureCount: 0, highRiskMcpToolsPresent: false },
        { sessionId: 's3', actionCount: 2, failureCount: 0 },
        { sessionId: 's4', actionCount: 1, failureCount: 0 },
      ],
    };

    const hint = deriveBrowserRunCorpusAdaptationHint(summary, {
      enabled: true,
      minAssessedSessions: 3,
      regressionPressureThreshold: 0.35,
      meanRegressionScoreThreshold: 0.9,
      failureRateThreshold: 0.9,
      investigateWeight: 0.5,
      intentRoutePenalty: 2,
      highRiskMcpWeight: 0.75, // additional weight for high-risk tool sessions
    });

    // s1 has highRiskMcpToolsPresent=true + failures → contributes more to pressure
    // Without the weight: investigateSessionCount=1, regressionSessionCount=0
    // pressure = (0 + 1*0.5) / 4 = 0.125
    // With s1 high-risk bonus: pressure = (0 + 1*0.5 + 1*0.75) / 4 = 0.3125 (still <0.35)
    expect(hint.regressionPressure).toBeGreaterThan(0.1);
    expect(hint.regressionPressure).toBeLessThan(0.35);
  });
});
```

### Step 4: Implement in adaptation.ts

Add `highRiskMcpWeight?: number` to `BrowserAdaptationConfig`:
```typescript
/** Additional pressure contribution per session that involved high-risk MCP tools and had failures. Default: 0.5 */
highRiskMcpWeight?: number;
```

In `normalizeBrowserAdaptationConfig`, add:
```typescript
highRiskMcpWeight: normalizedRatio(input?.highRiskMcpWeight ?? 0.5),
```

In `deriveBrowserRunCorpusAdaptationHint`, count high-risk-with-failures sessions and include in pressure:
```typescript
const highRiskFailureSessions = (summary?.entries ?? [])
  .filter((e) => e.highRiskMcpToolsPresent && (e.failureCount ?? 0) > 0)
  .length;

const regressionPressure = assessedSessionCount > 0
  ? normalizedRatio(
      (
        (summary?.regressionSessionCount ?? 0)
        + ((summary?.investigateSessionCount ?? 0) * config.investigateWeight)
        + (highRiskFailureSessions * config.highRiskMcpWeight)
      )
      / assessedSessionCount,
    )
  : 0;
```

### Step 5: Run tests

```bash
npm test -- tests/browser/adaptation.test.ts
```

Expected: PASS.

### Step 6: Commit

```bash
git add src/browser/run-corpus.ts src/browser/adaptation.ts tests/browser/adaptation.test.ts
git commit -m "feat(browser): MCP high-risk tool feedback loop in corpus adaptation

Sessions involving browser_evaluate or browser_file_upload that also had
failures now contribute extra weight (highRiskMcpWeight, default 0.5) to
the corpus regression pressure signal. This feeds back observed MCP risk
into the adaptation engine, tightening policy escalation when high-risk
tools are used recklessly.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Screenshot compression pipeline

**Files:**
- Create: `src/browser/screenshot-compress.ts`
- Modify: `src/browser/mcp-interceptor.ts`
- Test: `tests/browser/screenshot-compress.test.ts`

### Step 1: Write the failing tests

Create `tests/browser/screenshot-compress.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { compressBrowserScreenshot, isScreenshotResult } from '../../src/browser/screenshot-compress.js';

describe('isScreenshotResult', () => {
  it('returns true for object with base64 image string', () => {
    expect(isScreenshotResult({ image: 'iVBORw0KGgo=' })).toBe(true);
  });
  it('returns false for non-objects and objects without image', () => {
    expect(isScreenshotResult(null)).toBe(false);
    expect(isScreenshotResult({ text: 'hello' })).toBe(false);
    expect(isScreenshotResult('string')).toBe(false);
  });
});

describe('compressBrowserScreenshot', () => {
  it('returns original result when sharp is unavailable', async () => {
    const original = { image: 'abc123==', mimeType: 'image/png' };
    // sharp is not installed in test env — falls back to original
    const result = await compressBrowserScreenshot(original, { maxWidthPx: 800, quality: 70 });
    expect(result).toEqual(original);
  });

  it('passes through non-screenshot results unchanged', async () => {
    const nonScreenshot = { text: 'page snapshot content' };
    const result = await compressBrowserScreenshot(nonScreenshot, { maxWidthPx: 800, quality: 70 });
    expect(result).toEqual(nonScreenshot);
  });
});
```

### Step 2: Run to verify tests fail

```bash
npm test -- tests/browser/screenshot-compress.test.ts
```

Expected: FAIL — module does not exist.

### Step 3: Implement screenshot-compress.ts

Create `src/browser/screenshot-compress.ts`:

```typescript
export interface ScreenshotCompressOptions {
  /** Target maximum width in pixels. Aspect ratio is preserved. Default: 800 */
  maxWidthPx?: number;
  /** JPEG quality 1-100. Default: 70 */
  quality?: number;
}

export interface ScreenshotResult {
  image: string;
  mimeType?: string;
  [key: string]: unknown;
}

export function isScreenshotResult(value: unknown): value is ScreenshotResult {
  return (
    typeof value === 'object'
    && value !== null
    && typeof (value as Record<string, unknown>).image === 'string'
    && (value as ScreenshotResult).image.length > 0
  );
}

/**
 * Attempts to compress a Playwright browser_screenshot result using `sharp`.
 * Falls back to the original result if sharp is not installed or compression fails.
 */
export async function compressBrowserScreenshot(
  result: unknown,
  options: ScreenshotCompressOptions = {},
): Promise<unknown> {
  if (!isScreenshotResult(result)) return result;

  const maxWidthPx = options.maxWidthPx ?? 800;
  const quality = Math.min(100, Math.max(1, options.quality ?? 70));

  try {
    const sharp = (await import('sharp')).default;
    const buffer = Buffer.from(result.image, 'base64');
    const compressed = await sharp(buffer)
      .resize({ width: maxWidthPx, withoutEnlargement: true })
      .jpeg({ quality })
      .toBuffer();
    return {
      ...result,
      image: compressed.toString('base64'),
      mimeType: 'image/jpeg',
    };
  } catch {
    // sharp not installed or compression failed — return original
    return result;
  }
}
```

### Step 4: Wire compression into mcp-interceptor

Add `screenshotCompressOptions?: ScreenshotCompressOptions | false` to `BrowserMcpInterceptorConfig`.

After the `execute()` call (inside the retry loop, where the result is returned), add:

```typescript
import { compressBrowserScreenshot } from './screenshot-compress.js';

// After execute() succeeds:
if (
  toolName === 'browser_screenshot'
  && config.screenshotCompressOptions !== false
) {
  return compressBrowserScreenshot(result, config.screenshotCompressOptions ?? {});
}
return result;
```

### Step 5: Run tests

```bash
npm test -- tests/browser/screenshot-compress.test.ts tests/browser/mcp-interceptor.test.ts
```

Expected: PASS.

### Step 6: Commit

```bash
git add src/browser/screenshot-compress.ts src/browser/mcp-interceptor.ts \
  tests/browser/screenshot-compress.test.ts
git commit -m "feat(browser): screenshot compression pipeline via sharp (optional dep)

Adds compressBrowserScreenshot() that resizes to 800px and converts to
JPEG-70 when sharp is available, saving 70-80% of context tokens on each
browser_screenshot result. Falls back to original if sharp is absent.
Wired into interceptBrowserMcpCall via screenshotCompressOptions config.
Default enabled; set screenshotCompressOptions: false to disable.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Selector healing via auto-snapshot

**Files:**
- Modify: `src/browser/mcp-interceptor.ts` — add `onSelectorFail` hook
- Test: `tests/browser/mcp-interceptor.test.ts`

### Step 1: Write the failing test

Add to `tests/browser/mcp-interceptor.test.ts`:

```typescript
describe('selector healing hook', () => {
  it('calls onSelectorFail with snapshot result when selector error occurs', async () => {
    const selectorErr = new Error('waiting for selector "#old-btn" failed: timeout 30000ms exceeded');
    const snapshotResult = { snapshot: '<html>...</html>' };

    const executeMap: Record<number, () => Promise<unknown>> = {
      0: () => Promise.reject(selectorErr),       // first browser_click → fails
      1: () => Promise.resolve(snapshotResult),   // browser_snapshot → succeeds
    };
    let callIndex = 0;
    const execute = vi.fn().mockImplementation(() => executeMap[callIndex++]!());

    const onSelectorFail = vi.fn().mockResolvedValue(null);

    await expect(
      interceptBrowserMcpCall(
        'browser_click',
        { selector: '#old-btn' },
        {
          policyConfig: { allowedHosts: ['*'] },
          sessionId: 'heal-test',
          maxRetries: 0,
          retryBackoffMs: 0,
          onSelectorFail,
          // Execute is called twice: once for click (fails), once for snapshot
          executeSnapshot: () => execute(),
        },
        execute,
      )
    ).rejects.toThrow('waiting for selector');

    expect(onSelectorFail).toHaveBeenCalledWith('#old-btn', snapshotResult);
  });
});
```

### Step 2: Implement onSelectorFail in mcp-interceptor

Add to `BrowserMcpInterceptorConfig`:
```typescript
/**
 * Called after a selector-category failure on browser_click or browser_type.
 * Receives the original selector string and the result of an automatic browser_snapshot.
 * Return value is ignored — the original error is still thrown.
 * Use this to log the snapshot or trigger a selector-heal workflow in the calling agent.
 */
onSelectorFail?: (selector: string, snapshotResult: unknown) => Promise<void>;
/**
 * Execute function for the auto-snapshot call during selector healing.
 * If not provided, selector healing is skipped.
 */
executeSnapshot?: () => Promise<unknown>;
```

In the catch block after the retry loop, before `throw lastError`:
```typescript
import { classifyBrowserRetryTaxonomy } from './retry-taxonomy.js';

const code = (lastError as NodeJS.ErrnoException | undefined)?.code ?? '';
const message = (lastError as Error | undefined)?.message ?? '';
const taxonomy = classifyBrowserRetryTaxonomy(code, message);

if (
  taxonomy.retryCategory === 'selector'
  && (toolName === 'browser_click' || toolName === 'browser_type')
  && config.onSelectorFail
  && config.executeSnapshot
) {
  try {
    const snapshotResult = await config.executeSnapshot();
    const selector = String(args['selector'] ?? args['element'] ?? '');
    await config.onSelectorFail(selector, snapshotResult);
  } catch {
    // healing is best-effort — don't mask the original error
  }
}
```

### Step 3: Run tests

```bash
npm test -- tests/browser/mcp-interceptor.test.ts
```

Expected: PASS.

### Step 4: Commit

```bash
git add src/browser/mcp-interceptor.ts tests/browser/mcp-interceptor.test.ts
git commit -m "feat(browser): selector healing hook via auto-snapshot on click/type failure

When browser_click or browser_type fail with a selector-category error,
interceptBrowserMcpCall now calls browser_snapshot automatically and
invokes onSelectorFail(selector, snapshot) before re-throwing. The snapshot
gives the calling agent context to suggest an alternative selector, enabling
self-healing browser workflows without full session restart.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Approval log expiry + pruning

**Files:**
- Modify: `src/browser/approval-log.ts`
- Test: `tests/browser/approval-log.test.ts` (new or extend existing)

### Step 1: Check if approval-log tests exist

```bash
ls tests/browser/approval-log*
```

### Step 2: Write failing tests

Create or append to `tests/browser/approval-log.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { pruneOldBrowserApprovalEvents } from '../../src/browser/approval-log.js';
import { readFile, writeFile } from 'node:fs/promises';

vi.mock('node:fs/promises');

const makeEvent = (daysAgo: number) => JSON.stringify({
  tool: 'browser_click',
  sessionId: 's1',
  decision: 'approved',
  actionKey: 'click',
  risk: 'medium',
  timestamp: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
});

describe('pruneOldBrowserApprovalEvents', () => {
  it('removes entries older than maxAgeDays', async () => {
    const lines = [
      makeEvent(40), // old — should be pruned
      makeEvent(10), // recent — keep
      makeEvent(5),  // recent — keep
    ].join('\n') + '\n';

    vi.mocked(readFile).mockResolvedValue(lines as unknown as Buffer);
    vi.mocked(writeFile).mockResolvedValue(undefined);

    const result = await pruneOldBrowserApprovalEvents('/cwd', { maxAgeDays: 30, maxEntries: 1000 });

    expect(result.pruned).toBe(1);
    expect(result.kept).toBe(2);
    const written = vi.mocked(writeFile).mock.calls[0]?.[1] as string;
    expect(written.split('\n').filter(Boolean)).toHaveLength(2);
  });

  it('caps entries at maxEntries keeping the newest', async () => {
    const lines = [
      makeEvent(1),   // newest
      makeEvent(2),
      makeEvent(3),   // oldest of the 3
    ].join('\n') + '\n';

    vi.mocked(readFile).mockResolvedValue(lines as unknown as Buffer);
    vi.mocked(writeFile).mockResolvedValue(undefined);

    const result = await pruneOldBrowserApprovalEvents('/cwd', { maxAgeDays: 365, maxEntries: 2 });

    expect(result.kept).toBe(2);
    expect(result.pruned).toBe(1);
  });

  it('returns {pruned:0, kept:0} when log file is missing (ENOENT)', async () => {
    vi.mocked(readFile).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));

    const result = await pruneOldBrowserApprovalEvents('/cwd', {});
    expect(result.pruned).toBe(0);
    expect(result.kept).toBe(0);
  });
});
```

### Step 3: Run to verify tests fail

```bash
npm test -- tests/browser/approval-log.test.ts
```

Expected: FAIL — `pruneOldBrowserApprovalEvents` not exported.

### Step 4: Implement pruneOldBrowserApprovalEvents

Add to `src/browser/approval-log.ts`:

```typescript
import { readFile, writeFile } from 'node:fs/promises';
// (readFile/writeFile may already be imported — check first)

export interface BrowserApprovalPruneOptions {
  /** Remove entries older than this many days. Default: 30 */
  maxAgeDays?: number;
  /** Keep only the newest N entries after age filtering. Default: 1000 */
  maxEntries?: number;
}

export interface BrowserApprovalPruneResult {
  kept: number;
  pruned: number;
}

export async function pruneOldBrowserApprovalEvents(
  cwd: string,
  options: BrowserApprovalPruneOptions,
): Promise<BrowserApprovalPruneResult> {
  const maxAgeDays = options.maxAgeDays ?? 30;
  const maxEntries = options.maxEntries ?? 1000;
  const logPath = browserApprovalLogPath(cwd);  // reuse existing path helper

  let raw: string;
  try {
    raw = await readFile(logPath, 'utf-8') as unknown as string;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { kept: 0, pruned: 0 };
    }
    throw err;
  }

  const cutoffMs = Date.now() - maxAgeDays * 86_400_000;
  const lines = raw.split(/\r?\n/).filter(Boolean);

  const validLines: { ts: number; line: string }[] = [];
  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as { timestamp?: string };
      const ts = entry.timestamp ? new Date(entry.timestamp).getTime() : Date.now();
      if (Number.isFinite(ts) && ts >= cutoffMs) {
        validLines.push({ ts, line });
      }
    } catch {
      // skip malformed lines
    }
  }

  // Sort newest first, keep up to maxEntries
  validLines.sort((a, b) => b.ts - a.ts);
  const kept = validLines.slice(0, maxEntries);
  // Restore chronological order for the file
  kept.sort((a, b) => a.ts - b.ts);

  await writeFile(logPath, kept.map((e) => e.line).join('\n') + (kept.length > 0 ? '\n' : ''), 'utf-8');

  return { kept: kept.length, pruned: lines.length - kept.length };
}
```

### Step 5: Run tests

```bash
npm test -- tests/browser/approval-log.test.ts
```

Expected: PASS.

### Step 6: Commit

```bash
git add src/browser/approval-log.ts tests/browser/approval-log.test.ts
git commit -m "feat(browser): approval log expiry and count-based pruning

Adds pruneOldBrowserApprovalEvents(cwd, options) to approval-log.ts.
Default policy: discard entries older than 30 days, keep newest 1000.
ENOENT is handled gracefully (returns {pruned:0, kept:0}). Call from a
periodic cleanup task or on daemon startup to prevent unbounded log growth.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Regex URL allowlists

**Files:**
- Modify: `src/browser/policy-engine.ts`
- Modify: `src/core/browser-policy-config.ts`
- Test: `tests/browser/policy-engine.test.ts`

### Step 1: Write failing tests

Add to `tests/browser/policy-engine.test.ts`:

```typescript
describe('regex URL allowlist patterns', () => {
  it('allows a host matching a regex pattern', () => {
    const decision = evaluateBrowserPolicyAction(
      { allowedHosts: ['{ "regex": "^app-[0-9]+\\\\.staging\\\\.example\\\\.com$" }'] },
      { toolName: 'browser_navigate', args: { url: 'https://app-42.staging.example.com/path' } },
    );
    expect(decision.decision).toBe('allow');
  });

  it('denies a host that does not match the regex', () => {
    const decision = evaluateBrowserPolicyAction(
      { allowedHosts: ['{ "regex": "^app-[0-9]+\\\\.staging\\\\.example\\\\.com$" }'] },
      { toolName: 'browser_navigate', args: { url: 'https://evil.com/path' } },
    );
    expect(decision.decision).toBe('deny');
  });

  it('ignores malformed regex patterns gracefully', () => {
    // Should not throw — just skip the invalid pattern
    const decision = evaluateBrowserPolicyAction(
      { allowedHosts: ['{ "regex": "[invalid" }', 'example.com'] },
      { toolName: 'browser_navigate', args: { url: 'https://example.com/page' } },
    );
    expect(decision.decision).toBe('allow');
  });
});
```

### Step 2: Run to verify tests fail

```bash
npm test -- tests/browser/policy-engine.test.ts
```

Expected: FAIL — regex JSON strings cause `wildcardHostMatch` to fail with no match.

### Step 3: Add regex support to policy-engine.ts

In `src/browser/policy-engine.ts`, add a helper before `hostAllowed`:

```typescript
/** Try to parse an allowedHosts entry as a JSON object with a "regex" field. */
function tryParseRegexPattern(pattern: string): RegExp | null {
  const trimmed = pattern.trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    const obj = JSON.parse(trimmed) as unknown;
    if (typeof obj !== 'object' || obj === null) return null;
    const regexStr = (obj as Record<string, unknown>).regex;
    if (typeof regexStr !== 'string') return null;
    return new RegExp(regexStr);
  } catch {
    return null;
  }
}
```

Update `hostAllowed` to try regex before falling back to `wildcardHostMatch`:

```typescript
function hostAllowed(host: string, allowedHosts: string[]): boolean {
  if (allowedHosts.length === 0) return false;
  for (const pattern of allowedHosts) {
    const regex = tryParseRegexPattern(pattern);
    if (regex) {
      try {
        if (regex.test(host)) return true;
      } catch {
        // invalid regex — skip
      }
      continue;
    }
    const parsedPattern = parseHostPattern(pattern);
    if (!parsedPattern) continue;
    if (wildcardHostMatch(host, parsedPattern)) return true;
  }
  return false;
}
```

### Step 4: Run tests

```bash
npm test -- tests/browser/policy-engine.test.ts
```

Expected: PASS.

### Step 5: Commit

```bash
git add src/browser/policy-engine.ts tests/browser/policy-engine.test.ts
git commit -m "feat(browser): regex URL allowlist support in policy engine

allowedHosts entries can now be JSON objects with a 'regex' field:
  { \"regex\": \"^app-[0-9]+\\.staging\\.example\\.com$\" }
Wildcard patterns continue to work unchanged. Malformed JSON and invalid
regex patterns are skipped gracefully without throwing. This enables
dynamic host patterns that glob/wildcard cannot express (e.g. numbered
staging environments, UUID-based subdomains).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 7: Parallel tab orchestration

**Files:**
- Modify: `src/browser/sub-agent-delegator.ts`
- Test: `tests/browser/sub-agent-delegator.test.ts`

### Step 1: Write failing tests

Add to `tests/browser/sub-agent-delegator.test.ts`:

```typescript
describe('delegateToBrowserSubAgentParallel', () => {
  it('executes multiple goals concurrently up to concurrency limit', async () => {
    const spawnSubAgent = vi.fn().mockResolvedValue({ status: 'completed', messages: [] });
    vi.doMock('../../src/core/subagent.js', () => ({
      spawnSubAgent,
      formatSubAgentResult: () => 'done',
      createSubAgentContext: () => ({}),
    }));

    const { delegateToBrowserSubAgentParallel } = await import('../../src/browser/sub-agent-delegator.js');

    const results = await delegateToBrowserSubAgentParallel({
      goals: ['Goal A', 'Goal B', 'Goal C'],
      config: mockConfig,
      concurrency: 2,
    });

    expect(results).toHaveLength(3);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(spawnSubAgent).toHaveBeenCalledTimes(3);
  });

  it('captures individual failures without failing all goals', async () => {
    let callCount = 0;
    vi.doMock('../../src/core/subagent.js', () => ({
      spawnSubAgent: vi.fn().mockImplementation(async () => {
        if (++callCount === 2) throw new Error('Tab 2 crashed');
        return { status: 'completed', messages: [] };
      }),
      formatSubAgentResult: () => 'done',
      createSubAgentContext: () => ({}),
    }));

    const { delegateToBrowserSubAgentParallel } = await import('../../src/browser/sub-agent-delegator.js');

    const results = await delegateToBrowserSubAgentParallel({
      goals: ['Goal A', 'Goal B', 'Goal C'],
      config: mockConfig,
      concurrency: 3,
    });

    expect(results).toHaveLength(3);
    expect(results[0]?.ok).toBe(true);
    expect(results[1]?.ok).toBe(false);
    expect(results[1]?.error).toContain('Tab 2 crashed');
    expect(results[2]?.ok).toBe(true);
  });
});
```

### Step 2: Implement delegateToBrowserSubAgentParallel

Add to `src/browser/sub-agent-delegator.ts`:

```typescript
export interface BrowserSubAgentParallelOptions {
  goals: string[];
  config: OptaConfig;
  /** Max concurrent sub-agents. Default: 3 */
  concurrency?: number;
  inheritedContext?: string;
}

export async function delegateToBrowserSubAgentParallel(
  options: BrowserSubAgentParallelOptions,
): Promise<BrowserSubAgentResult[]> {
  const { goals, config, concurrency = 3, inheritedContext } = options;
  if (goals.length === 0) return [];

  // Process goals in batches of `concurrency`
  const results: BrowserSubAgentResult[] = [];
  for (let batchStart = 0; batchStart < goals.length; batchStart += concurrency) {
    const batch = goals.slice(batchStart, batchStart + concurrency);
    const settled = await Promise.allSettled(
      batch.map((goal, index) =>
        delegateToBrowserSubAgent({
          goal,
          config,
          preferredSessionId: `browser-tab-${batchStart + index}-${Date.now()}`,
          inheritedContext,
        }),
      ),
    );
    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') {
        results.push(outcome.value);
      } else {
        results.push({
          ok: false,
          summary: '',
          artifactPaths: [],
          error: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
        });
      }
    }
  }
  return results;
}
```

### Step 3: Run tests

```bash
npm test -- tests/browser/sub-agent-delegator.test.ts
```

Expected: PASS.

### Step 4: Commit

```bash
git add src/browser/sub-agent-delegator.ts tests/browser/sub-agent-delegator.test.ts
git commit -m "feat(browser): parallel tab orchestration via delegateToBrowserSubAgentParallel

Adds delegateToBrowserSubAgentParallel() that fans goals across N
concurrent browser sub-agents (default concurrency: 3). Uses
Promise.allSettled for fault isolation — one tab failure does not abort
sibling goals. Results array maintains goal order. Useful for parallel
scraping, multi-tab research, or concurrent form interactions.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 8: WebSocket browser event streaming + Opta Border

Two sub-parts: (A) Opta Border visual indicator, (B) real-time WS event streaming.

**Files:**
- Modify: `src/browser/sub-agent-delegator.ts` — Opta Border prompt injection
- Modify: `src/browser/mcp-interceptor.ts` — emit browser stream events
- Modify: `src/protocol/v3/types.ts` — add `browser.action` event type
- Modify: `src/mcp/registry.ts` — wire onBrowserEvent to session event emitter
- Test: `tests/browser/sub-agent-delegator.test.ts`, `tests/browser/mcp-interceptor.test.ts`

### Part A: Opta Border

### Step 1: Write failing test for Opta Border prompt

Add to `tests/browser/sub-agent-delegator.test.ts`:

```typescript
describe('Opta Border injection', () => {
  it('includes border injection instruction in sub-agent task when optaBorder is true', async () => {
    const spawnSubAgent = vi.fn().mockResolvedValue({ status: 'completed', messages: [] });
    vi.doMock('../../src/core/subagent.js', () => ({
      spawnSubAgent,
      formatSubAgentResult: () => 'done',
      createSubAgentContext: () => ({}),
    }));

    const { delegateToBrowserSubAgent } = await import('../../src/browser/sub-agent-delegator.js');

    await delegateToBrowserSubAgent({
      goal: 'Click the login button',
      config: mockConfig,
      optaBorder: true,
    });

    const taskArg = spawnSubAgent.mock.calls[0]?.[0]?.description as string;
    expect(taskArg).toContain('#8b5cf6');
    expect(taskArg).toContain('browser_evaluate');
  });
});
```

### Step 2: Add `optaBorder` to BrowserSubAgentOptions and inject prompt

Add `optaBorder?: boolean` to `BrowserSubAgentOptions`.

In `delegateToBrowserSubAgent`, update `taskDescription` construction:

```typescript
const borderNote = options.optaBorder
  ? `\n\nOPTA VISUAL INDICATOR: As soon as the browser is open (after your first browser_navigate or browser_snapshot), run this browser_evaluate call to show the Opta control indicator:\n  document.body.style.setProperty('outline','3px solid #8b5cf6','important');document.body.style.setProperty('outline-offset','-3px','important');\nThis marks the browser session as Opta-controlled. Do it once, silently.`
  : '';

const taskDescription = `${BROWSER_SPECIALIST_PROMPT}${sessionNote}${contextNote}${borderNote}\n\n---\n\nGoal: ${goal}`;
```

### Part B: WebSocket browser event streaming

### Step 3: Add browser.action event type to V3 protocol

In `src/protocol/v3/types.ts`, find the union type for envelope events and add:

```typescript
export interface BrowserActionEvent {
  event: 'browser.action';
  sessionId: string;
  toolName: string;
  decision: 'allow' | 'gate' | 'deny';
  risk: 'low' | 'medium' | 'high';
  actionKey: string;
  targetOrigin?: string;
  timestamp: string;
}
```

Add `BrowserActionEvent` to the `V3Envelope` discriminated union (or add `'browser.action'` to the event string union if typed differently — match the existing pattern).

### Step 4: Add onBrowserEvent hook to mcp-interceptor

Add to `BrowserMcpInterceptorConfig`:
```typescript
/** Called after each browser action (allow or gate+approved). Enables real-time event streaming. */
onBrowserEvent?: (event: {
  toolName: string;
  decision: 'allow' | 'gate';
  risk: 'low' | 'medium' | 'high';
  actionKey: string;
  targetOrigin?: string;
  timestamp: string;
}) => void;
```

After the execute() result is obtained (just before returning), add:
```typescript
if (config.onBrowserEvent) {
  config.onBrowserEvent({
    toolName,
    decision: policyDecision.decision as 'allow' | 'gate',
    risk: policyDecision.risk,
    actionKey: policyDecision.actionKey,
    targetOrigin: policyDecision.targetOrigin,
    timestamp: new Date().toISOString(),
  });
}
```

### Step 5: Wire onBrowserEvent to session manager in mcp/registry.ts

In `src/mcp/registry.ts`, where `interceptBrowserMcpCall` is called (around line 262-280), add `onBrowserEvent` to the config being passed:

```typescript
// Look for the existing interceptBrowserMcpCall invocation and add:
onBrowserEvent: config.browserEventEmitter
  ? (evt) => config.browserEventEmitter!.emit({
      event: 'browser.action' as const,
      sessionId: config.sessionId ?? 'unknown',
      ...evt,
    })
  : undefined,
```

**Note:** `browserEventEmitter` would be passed from the daemon's operation executor (where `sessionManager` is available). The exact wiring depends on how `config` reaches the registry — trace the call chain from `daemon/operations/execute.ts` → `core/agent.ts` → `mcp/registry.ts` to find the correct injection point.

### Step 6: Write the streaming test

Add to `tests/browser/mcp-interceptor.test.ts`:

```typescript
describe('onBrowserEvent streaming hook', () => {
  it('emits a browser action event after each allowed action', async () => {
    const events: unknown[] = [];
    const execute = vi.fn().mockResolvedValue({ clicked: true });

    await interceptBrowserMcpCall(
      'browser_snapshot',
      {},
      {
        policyConfig: { allowedHosts: ['*'] },
        sessionId: 'stream-test',
        onBrowserEvent: (evt) => events.push(evt),
      },
      execute,
    );

    expect(events).toHaveLength(1);
    expect((events[0] as { toolName: string }).toolName).toBe('browser_snapshot');
    expect((events[0] as { decision: string }).decision).toBe('allow');
  });
});
```

### Step 7: Run all browser tests

```bash
npm test -- tests/browser/
```

Expected: PASS.

### Step 8: Commit

```bash
git add src/browser/sub-agent-delegator.ts src/browser/mcp-interceptor.ts \
  src/protocol/v3/types.ts src/mcp/registry.ts \
  tests/browser/sub-agent-delegator.test.ts tests/browser/mcp-interceptor.test.ts
git commit -m "feat(browser): WebSocket event streaming + Opta Border visual indicator

Opta Border: sub-agent task prompt includes a browser_evaluate instruction
to inject a violet (#8b5cf6) CSS outline. Toggled via optaBorder option.

WS streaming: interceptBrowserMcpCall now fires onBrowserEvent(evt) after
every allowed/approved action. Event shape: { toolName, decision, risk,
actionKey, targetOrigin, timestamp }. Wired into V3 protocol as
'browser.action' envelope events via browserEventEmitter in registry.ts.
Daemon WS clients at /v3/ws receive live browser activity in their session
stream without additional subscriptions.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 9: Default browser home page (lmx.optalocal.com)

**Files:**
- Modify: `src/browser/mcp-bootstrap.ts` — add `startUrl` option
- Modify: `src/browser/sub-agent-delegator.ts` — prepend navigate to home page
- Test: `tests/browser/mcp-bootstrap.test.ts` (new)

### Step 1: Write failing tests

Create `tests/browser/mcp-bootstrap.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createPlaywrightMcpServerConfig } from '../../src/browser/mcp-bootstrap.js';

describe('createPlaywrightMcpServerConfig', () => {
  it('includes --start-url when startUrl is provided', () => {
    const cfg = createPlaywrightMcpServerConfig({
      startUrl: 'http://lmx.optalocal.com',
    });
    expect(cfg.args).toContain('--start-url');
    expect(cfg.args).toContain('http://lmx.optalocal.com');
  });

  it('does not include --start-url when startUrl is omitted', () => {
    const cfg = createPlaywrightMcpServerConfig({});
    expect(cfg.args).not.toContain('--start-url');
  });

  it('trims and skips empty startUrl strings', () => {
    const cfg = createPlaywrightMcpServerConfig({ startUrl: '   ' });
    expect(cfg.args).not.toContain('--start-url');
  });
});
```

### Step 2: Run to verify tests fail

```bash
npm test -- tests/browser/mcp-bootstrap.test.ts
```

Expected: FAIL — `startUrl` not in `PlaywrightMcpBootstrapOptions`.

### Step 3: Add startUrl to mcp-bootstrap.ts

Add `startUrl?: string` to `PlaywrightMcpBootstrapOptions`.

In `createPlaywrightMcpServerConfig`, after the `blockedOrigins` block:

```typescript
const startUrl = options.startUrl?.trim();
if (startUrl) {
  args.push('--start-url', startUrl);
}
```

### Step 4: Wire home page into config + registry

In `src/core/config.ts` (or wherever `BrowserConfig` is defined), add:

```typescript
/** URL to auto-navigate to when a new browser MCP session starts. */
homePage?: string;
```

In `src/mcp/registry.ts`, where `createPlaywrightMcpServerConfig` is called (around line 103), pass the `homePage` config value:

```typescript
mergedServers[PLAYWRIGHT_MCP_SERVER_KEY] = createPlaywrightMcpServerConfig({
  command: browserMcp.command,
  packageName: browserMcp.package,
  mode: browserMode,
  allowedHosts,
  blockedOrigins,
  startUrl: browser.homePage,   // ← add this line
});
```

### Step 5: Run all tests

```bash
npm test -- tests/browser/mcp-bootstrap.test.ts
npm test -- tests/browser/
npm run typecheck
```

Expected: all PASS, typecheck clean.

### Step 6: Verify the default value in docs

Document the default home page in `CLAUDE.md` browser section:

```markdown
**Home page:** `browser.homePage` config key (e.g. `'http://lmx.optalocal.com'`) auto-navigates on browser session start via `--start-url` arg to `@playwright/mcp`.
```

### Step 7: Commit

```bash
git add src/browser/mcp-bootstrap.ts src/core/config.ts src/mcp/registry.ts \
  tests/browser/mcp-bootstrap.test.ts CLAUDE.md
git commit -m "feat(browser): default browser home page via browser.homePage config

Adds startUrl option to PlaywrightMcpBootstrapOptions and threads
browser.homePage config through mcp/registry.ts into the @playwright/mcp
spawn args. When set to 'http://lmx.optalocal.com', every new Playwright
MCP session opens directly on the Opta LMX dashboard instead of a blank
page. Set browser.homePage in .opta/config.json:
  { \"browser\": { \"homePage\": \"http://lmx.optalocal.com\" } }

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Final Verification

```bash
cd optalocal/1D-Opta-CLI-TS

# Full test suite (all 9 tasks should add ~25 tests to the 394 baseline)
npm test

# Type check — zero errors
npm run typecheck

# Confirm no legacy browser tool references in src/core/tools/
grep -r "browser_open\|browser_navigate\|browser_click\|browser_close" src/core/tools/ | grep -v "\.test\." && echo "FAIL: legacy refs found" || echo "OK: no legacy refs"
```

---

## Summary: What Was Built

| Task | Files Changed | Tests Added | Type |
|------|--------------|-------------|------|
| 1. Auto-retry | `mcp-interceptor.ts` | 3 | Quick win |
| 2. Corpus feedback | `run-corpus.ts`, `adaptation.ts` | 1 | Quick win |
| 3. Screenshot compression | `screenshot-compress.ts` (new), `mcp-interceptor.ts` | 3 | Quick win |
| 4. Selector healing | `mcp-interceptor.ts` | 1 | Quick win |
| 5. Approval log pruning | `approval-log.ts` | 3 | Quick win |
| 6. Regex allowlists | `policy-engine.ts` | 3 | Quick win |
| 7. Parallel tabs | `sub-agent-delegator.ts` | 2 | Feature |
| 8. WS streaming + Border | `mcp-interceptor.ts`, `sub-agent-delegator.ts`, `protocol/v3/types.ts`, `mcp/registry.ts` | 2 | Feature |
| 9. Home page | `mcp-bootstrap.ts`, `config.ts`, `mcp/registry.ts` | 3 | Feature |
