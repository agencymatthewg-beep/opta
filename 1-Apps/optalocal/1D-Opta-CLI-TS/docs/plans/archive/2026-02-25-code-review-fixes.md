---
status: archived
---

# Code Review Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all 7 critical/security issues and high-priority improvements identified in the Atpo+Opta code review, across two parallel waves.

> **Status: COMPLETE (verified 2026-02-27)** — All 21 tasks across Wave 1 + Wave 2 implemented. App.tsx decomposed from 2,928 to 786 lines.

**Architecture:** Wave 1 runs 3 independent agents in parallel (security hardening, mechanical quick wins, shared utils extraction). Wave 2 runs 2 independent agents in parallel (App.tsx custom hooks decomposition, TUI render optimization). Each agent owns non-overlapping files.

**Tech Stack:** TypeScript ESM, Ink/React TUI, Node.js 20+, Commander, Zod, vitest

---

## Wave 1 — Parallel (all 3 agents run simultaneously)

---

### Task 1A: Security Hardening

**Files:**
- Modify: `src/daemon/background-manager.ts:165`
- Modify: `src/commands/key.ts:427–435` and `src/commands/key.ts:156–244`
- Modify: `src/commands/account.ts:19–23` + wherever `--password` flag is registered
- Modify: `src/core/autonomy.ts:347`

---

#### 1A-1: Fix Shell Injection in BackgroundManager

**Problem:** `spawn('sh', ['-c', input.command])` at line 165 passes unsanitized strings to shell.

**Step 1:** Read `src/daemon/background-manager.ts` fully.

**Step 2:** Replace `spawn('sh', ['-c', input.command], ...)` with a shell-parser approach. Use a simple whitespace tokenizer or the `shell-quote` package if available. If no shell parser is available, add a `parseShellCommand` utility that handles quoted args:

```typescript
function parseShellCommand(cmd: string): [string, string[]] {
  // Simple tokenizer: handles single/double quotes and backslash escapes
  const tokens: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i];
    if (ch === "'" && !inDouble) { inSingle = !inSingle; continue; }
    if (ch === '"' && !inSingle) { inDouble = !inDouble; continue; }
    if (ch === '\\' && !inSingle && i + 1 < cmd.length) { current += cmd[++i]; continue; }
    if ((ch === ' ' || ch === '\t') && !inSingle && !inDouble) {
      if (current) { tokens.push(current); current = ''; }
      continue;
    }
    current += ch;
  }
  if (current) tokens.push(current);
  const [exe = '', ...args] = tokens;
  return [exe, args];
}
```

Then replace:
```typescript
// Before:
const child = spawn('sh', ['-c', input.command], { ... });

// After:
const [exe, args] = parseShellCommand(input.command);
const child = spawn(exe, args, { ... });
```

**Step 3:** Run `npm run typecheck` — must pass.

**Step 4:** Run `npm test -- tests/daemon/background-manager.test.ts` — must pass.

**Step 5:** Commit: `fix(daemon): replace sh -c shell injection with direct spawn`

---

#### 1A-2: Mask API Key in Stdout

**Problem:** `console.log('API Key:  ${key}')` at key.ts:435 exposes full key.

**Step 1:** Read `src/commands/key.ts` fully.

**Step 2:** Add a masking helper near the top of the file:

```typescript
function maskKey(key: string): string {
  if (key.length <= 12) return '****';
  return key.slice(0, 8) + '...' + key.slice(-4);
}
```

**Step 3:** Replace plain display line:
```typescript
// Before:
console.log(`API Key:  ${key}`);

// After:
console.log(`API Key:  ${maskKey(key)}`);
console.log(chalk.dim('(Full key copied to clipboard — paste it now, it will not be shown again)'));
```

**Step 4:** For the JSON output path, also mask:
```typescript
// Before (in JSON output):
console.log(JSON.stringify(output, null, 2));

// After: mask key in output before serializing
const safeOutput = { ...output, key: output.key ? maskKey(output.key) : output.key };
console.log(JSON.stringify(safeOutput, null, 2));
```

**Step 5:** For `applyRemoteInferenceKey` (lines 156–244), change key transport: instead of interpolating the key into the remote Python script string, write the key to stdin of the SSH process:

```typescript
// Instead of building a Python script with the key interpolated,
// pass the key via stdin using a heredoc equivalent:
// scp-style: write key to temp env var and read from environment
// Or simply: pipe key on stdin, read sys.stdin.readline() in Python
```

The safest minimal fix is to base64-encode the key before shell-interpolation to eliminate all shell-special-character risk:
```typescript
const b64Key = Buffer.from(key).toString('base64');
// In the Python script, decode it:
// key = base64.b64decode(os.environ.get('OPTA_KEY_B64', '')).decode()
// And pass via: SSH env var -o SendEnv ... or wrap in env KEY=val
```

If the remote SSH approach is too complex to safely refactor, add a prominent `// TODO: C3 - key still interpolated; tracked in code review` comment and move on.

**Step 6:** Run `npm run typecheck` — must pass.

**Step 7:** Commit: `fix(key): mask API key in stdout output`

---

#### 1A-3: Remove `--password` CLI Flag from Account Command

**Problem:** `password?: string` in `AccountAuthOptions` means `--password` is visible in `ps aux`.

**Step 1:** Read `src/commands/account.ts` fully.

**Step 2:** Remove `password?: string` from `AccountAuthOptions`.

**Step 3:** Find where the command is registered (likely in `src/index.ts` or within `account.ts`). Remove the `.option('--password <password>', ...)` registration.

**Step 4:** Add a `promptPassword()` helper:
```typescript
import { createInterface } from 'readline';

async function promptPassword(prompt: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  process.stdout.write(prompt);
  // Hide input
  const oldWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = () => true;
  return new Promise((resolve) => {
    rl.question('', (answer) => {
      process.stdout.write = oldWrite;
      process.stdout.write('\n');
      rl.close();
      resolve(answer);
    });
  });
}
```

**Step 5:** Where the command was previously using `opts.password`, replace with:
```typescript
const password = await promptPassword('Password: ');
```

**Step 6:** Run `npm run typecheck`. Run `npm test -- tests/commands/account.test.ts`.

**Step 7:** Commit: `fix(account): replace --password flag with interactive prompt`

---

#### 1A-4: Fix Autonomy Level Rounding (Math.round → Math.floor)

**Problem:** `Math.round(numeric)` at autonomy.ts:347 can round 2.5 → 3, escalating permissions.

**Step 1:** In `src/core/autonomy.ts`, find line 347:
```typescript
const clamped = Math.min(5, Math.max(1, Math.round(numeric)));
```

**Step 2:** Replace:
```typescript
const clamped = Math.min(5, Math.max(1, Math.floor(numeric)));
```

**Step 3:** Run `npm test -- tests/core/autonomy.test.ts` (create test if missing):
```typescript
it('floors non-integer autonomy levels (does not round up)', () => {
  expect(resolveAutonomyLevel(2.5)).toBe(2);
  expect(resolveAutonomyLevel(2.9)).toBe(2);
  expect(resolveAutonomyLevel(3.0)).toBe(3);
});
```

**Step 4:** Commit: `fix(autonomy): use Math.floor to prevent silent permission escalation`

---

### Task 1B: Mechanical Quick Wins

**Files:**
- Modify: `src/core/agent.ts` (dynamic imports + messages mutation)
- Modify: `src/browser/approval-log.ts` (snake_case → camelCase)
- Modify: `src/core/config.ts` (env var connection spreads)
- Modify: `src/daemon/background-manager.ts` (magic timeouts, process Map cleanup, merge normalize fns)
- Modify: `src/tui/OptimiserPanel.tsx` (remove pointless useMemo)
- Modify: `src/tui/BrowserManagerRail.tsx` (add useMemo for pendingSummary)
- Modify: `src/core/agent-setup.ts` (fix fire-and-forget resetClientCache)

---

#### 1B-1: Hoist Dynamic Imports Out of Agent Loop

**Problem:** `await import('./tool-protocol.js')` and `await import('./tool-compatibility.js')` at agent.ts:557,561 execute inside the `while(true)` loop on every iteration that detects pseudo-tool markup.

**Step 1:** Read `src/core/agent.ts` fully.

**Step 2:** Find the section near lines 160–176 where other dynamic imports are hoisted (look for `const { ... } = await import(...)` near the function top, before the while loop).

**Step 3:** Add the two missing hoisted imports alongside the existing ones (before the while loop):
```typescript
const { detectPseudoToolMarkup, buildPseudoToolCorrectionMessage } = await import('./tool-protocol.js');
const { recordToolCompatibilityEvent } = await import('./tool-compatibility.js');
```

**Step 4:** Remove the duplicate inline `await import(...)` calls at the previous locations (lines ~557, 561, 669). The variables are now in scope.

**Step 5:** Run `npm run typecheck`. Run `npm test -- tests/core/agent.test.ts`.

**Step 6:** Commit: `perf(agent): hoist tool-protocol and tool-compatibility imports out of hot loop`

---

#### 1B-2: Fix approval-log.ts snake_case → camelCase

**Problem:** `BrowserApprovalEvent` interface uses `snake_case` field names while all sibling interfaces use `camelCase`.

**Step 1:** Read `src/browser/approval-log.ts` fully.

**Step 2:** Rename all snake_case fields in the `BrowserApprovalEvent` interface to camelCase:
- `session_id` → `sessionId`
- `action_key` → `actionKey`
- `target_host` → `targetHost`
- `policy_reason` → `policyReason`
- `risk_evidence` → `riskEvidence`

**Step 3:** Update the manual mapping in `appendBrowserApprovalEvent` to use the new camelCase names.

**Step 4:** Search for any consumers of this type:
```bash
grep -r "BrowserApprovalEvent" src/ --include="*.ts" --include="*.tsx"
```
Update all consumers.

**Step 5:** Run `npm run typecheck`.

**Step 6:** Commit: `fix(browser): rename BrowserApprovalEvent fields to camelCase`

---

#### 1B-3: Consolidate Config env var Connection Spreads

**Problem:** 4 separate `{ ...raw.connection, newProp }` spreads in config.ts:587–617.

**Step 1:** Read `src/core/config.ts` lines 580–630.

**Step 2:** Replace the 4 separate env var blocks with a single accumulated connection patch:

```typescript
// 3. Environment variable overrides
const connectionPatch: Record<string, unknown> = {};
if (process.env['OPTA_HOST']) connectionPatch.host = process.env['OPTA_HOST'];
if (process.env['OPTA_PORT']) connectionPatch.port = parseInt(process.env['OPTA_PORT'], 10);
if (process.env['OPTA_ADMIN_KEY']) connectionPatch.adminKey = process.env['OPTA_ADMIN_KEY'];
if (process.env['OPTA_API_KEY']) connectionPatch.apiKey = process.env['OPTA_API_KEY'];
if (Object.keys(connectionPatch).length > 0) {
  (raw as Record<string, unknown>).connection = {
    ...((raw as Record<string, Record<string, unknown>>).connection ?? {}),
    ...connectionPatch,
  };
}
```

**Step 3:** Run `npm test -- tests/core/config.test.ts`. Run `npm run typecheck`.

**Step 4:** Commit: `refactor(config): consolidate env var connection overrides into single spread`

---

#### 1B-4: Fix In-Place messages Mutation in Agent Loop

**Problem:** `messages.length = 0; messages.push(...maskedMessages)` mutates array in-place at agent.ts:441–442 and 454–455.

**Step 1:** In `src/core/agent.ts`, find both occurrences of `messages.length = 0`.

**Step 2:** Replace each pair with splice for clarity (or just use a let reference reassignment):
```typescript
// Before:
const maskedMessages = maskOldObservations(messages, 4);
messages.length = 0;
messages.push(...maskedMessages);

// After (safe in-place replacement using splice):
const maskedMessages = maskOldObservations(messages, 4);
messages.splice(0, messages.length, ...maskedMessages);
```

Note: `splice(0, messages.length, ...newItems)` is semantically equivalent and makes the intent clearer. Alternatively, check if `messages` can be converted to a `let` reassignment — if it's declared as `const messages: Message[] = []` and is passed by reference to callbacks, splice is the safer choice.

**Step 3:** Run `npm run typecheck`. Run `npm test -- tests/core/agent.test.ts`.

**Step 4:** Commit: `refactor(agent): replace messages.length=0 mutation with splice`

---

#### 1B-5: BackgroundManager — Named Kill Timeout Constants + Process Map Cleanup

**Problem:** Magic `3000`/`5000` timeouts, and completed processes never removed from `this.processes` Map.

**Step 1:** Read `src/daemon/background-manager.ts` fully.

**Step 2:** Add named constants near the top of the class:
```typescript
private static readonly SIGTERM_TIMEOUT_MS = 3_000;
private static readonly SIGKILL_TIMEOUT_MS = 5_000;
```
Replace magic numbers 3000 and 5000 with these constants.

**Step 3:** In the process exit/completion handler (where a process transitions from 'running' to 'done'/'error'), add:
```typescript
// Clean up completed processes older than 5 minutes
const COMPLETED_RETENTION_MS = 5 * 60 * 1000;
const cutoff = Date.now() - COMPLETED_RETENTION_MS;
for (const [id, proc] of this.processes) {
  if (proc.state !== 'running' && proc.startedAt < cutoff) {
    this.processes.delete(id);
  }
}
```

**Step 4:** Merge the two identical normalize functions:
```typescript
// Before: two separate functions
function normalizeProfilePruneIntervalMs(v: unknown): number { ... }
function normalizeArtifactPruneIntervalMs(v: unknown): number { ... }

// After: one parameterized function
function normalizePruneIntervalMs(v: unknown, defaultMs: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : defaultMs;
}
// Call sites: normalizePruneIntervalMs(v, DEFAULT_PROFILE_PRUNE_INTERVAL_MS)
//             normalizePruneIntervalMs(v, DEFAULT_ARTIFACT_PRUNE_INTERVAL_MS)
```

**Step 5:** Run `npm run typecheck`. Run `npm test -- tests/daemon/background-manager.test.ts`.

**Step 6:** Commit: `fix(daemon): named kill timeouts, process Map cleanup, merge normalize fns`

---

#### 1B-6: Remove Pointless useMemo in OptimiserPanel

**Problem:** `useMemo(() => active ? OPTA_ORBIT_FRAMES[frame] : '...', [active, frame])` recalculates on every animation tick — memo adds overhead without preventing work.

**Step 1:** Read `src/tui/OptimiserPanel.tsx`.

**Step 2:** Replace the `useMemo` with a plain inline expression:
```typescript
// Before:
const headerGlyph = useMemo(() => active ? OPTA_ORBIT_FRAMES[frame] : '...', [active, frame]);

// After:
const headerGlyph = active ? OPTA_ORBIT_FRAMES[frame] : '...';
```

**Step 3:** Run `npm run typecheck`.

**Step 4:** Commit: `perf(tui): remove pointless useMemo from OptimiserPanel animation glyph`

---

#### 1B-7: Add useMemo for pendingSummary in BrowserManagerRail

**Problem:** `summarizePendingByRisk(pendingOrdered)` called on every render outside memoization.

**Step 1:** Read `src/tui/BrowserManagerRail.tsx`.

**Step 2:** Find the two unmemoized calls (`summarizePendingByRisk` and `approvalDecisionSummary`) and wrap:
```typescript
const pendingSummary = useMemo(() => summarizePendingByRisk(pendingOrdered), [pendingOrdered]);
const approvalSummary = useMemo(() => approvalDecisionSummary(recentApprovals), [recentApprovals]);
```

**Step 3:** Run `npm run typecheck`.

**Step 4:** Commit: `perf(tui): memoize pendingSummary and approvalSummary in BrowserManagerRail`

---

#### 1B-8: Fix Fire-and-Forget resetClientCache

**Problem:** `resetClientCache` triggers an async import via `.then().catch(() => {})` — callers can't know if reset completed.

**Step 1:** Read `src/core/agent-setup.ts`.

**Step 2:** Convert `resetClientCache` to `async`:
```typescript
// Before (synchronous, fire-and-forget):
export function resetClientCache(): void {
  import('./config.js').then(({ clearLoadConfigCache }) => {
    clearLoadConfigCache();
  }).catch(() => {});
}

// After (async, awaitable):
export async function resetClientCache(): Promise<void> {
  const { clearLoadConfigCache } = await import('./config.js');
  clearLoadConfigCache();
}
```

**Step 3:** Update all call sites: `await resetClientCache()`.

**Step 4:** Run `npm run typecheck`. Run `npm test`.

**Step 5:** Commit: `fix(agent-setup): make resetClientCache async so callers can await completion`

---

### Task 1C: Shared Utils Extraction

**Files:**
- Create: `src/utils/common.ts`
- Create: `src/tui/browser-formatters.ts`
- Modify: 13 files removing local duplicates + adding imports

---

#### 1C-1: Create src/utils/common.ts

**Step 1:** Create `src/utils/common.ts`:

```typescript
/**
 * Shared utility functions used across multiple modules.
 * Import from here instead of defining locally.
 */

/** Pause execution for the given number of milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Clamp a number between min and max (inclusive). */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Clamp a number to the [0, 1] range. */
export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}
```

**Step 2:** Run `npm run typecheck` (no imports changed yet, just creating the file).

---

#### 1C-2: Create src/tui/browser-formatters.ts

**Step 1:** Read `src/tui/BrowserControlOverlay.tsx` and `src/tui/BrowserManagerRail.tsx` to find the `riskColor` and `riskPriority` implementations.

**Step 2:** Create `src/tui/browser-formatters.ts`:
```typescript
import type { BrowserRiskLevel } from '../browser/types.js';

/** Returns the Ink color string for a given browser risk level. */
export function riskColor(level: BrowserRiskLevel): string {
  // Copy the implementation from BrowserControlOverlay.tsx
}

/** Returns a numeric sort priority for a given browser risk level (higher = more urgent). */
export function riskPriority(level: BrowserRiskLevel): number {
  // Copy the implementation from BrowserControlOverlay.tsx
}
```

---

#### 1C-3: Update All sleep Import Sites (7 files)

For each file below, remove the local `function sleep(ms: number): Promise<void>` definition and replace with `import { sleep } from '../utils/common.js'` (adjust relative path as needed):

1. `src/core/agent-streaming.ts:67`
2. `src/tui/actionHistoryStore.ts:42`
3. `src/lmx/client.ts:382`
4. `src/lmx/model-lifecycle.ts:78`
5. `src/commands/serve.ts:591`
6. `src/learning/ledger.ts:44` (if file exists)
7. Check: `grep -r "function sleep" src/ --include="*.ts"` for any missed sites

**For each file:**
- Remove the local `function sleep` declaration
- Add import at top: `import { sleep } from '../utils/common.js';` (adjust `../` depth)
- Run `npm run typecheck` after each to catch path issues

---

#### 1C-4: Update All clamp Import Sites (6 files)

For each file below, remove the local `function clamp(...)` definition and replace with import:

1. `src/browser/adaptation.ts:56`
2. `src/browser/intent-router.ts:71`
3. `src/lmx/model-lifecycle.ts:82` (also had sleep — consolidate import)
4. `src/tui/BrowserControlOverlay.tsx:85`
5. `src/ui/pane-menu.ts:38`
6. `src/learning/hooks.ts:69` (if exists)
7. `src/browser/visual-diff.ts:22` — replace `clamp01` local with import

**For each file:**
- Remove local `function clamp` / `function clamp01`
- Add `import { clamp, clamp01 } from '../utils/common.js';` as needed

Run `npm run typecheck` after all changes.

---

#### 1C-5: Update riskColor/riskPriority to Use browser-formatters.ts

1. In `src/tui/BrowserControlOverlay.tsx` — remove local `riskColor` and `riskPriority`, add `import { riskColor, riskPriority } from './browser-formatters.js'`
2. In `src/tui/BrowserManagerRail.tsx` — same

**Step:** Run `npm run typecheck`. Run `npm test`.

**Step:** Commit: `refactor(utils): extract sleep, clamp, riskColor to shared utilities`

---

## Wave 2 — Parallel (both agents run simultaneously after Wave 1 complete)

---

### Task 2A: App.tsx Custom Hooks Decomposition

**Approach:** Extract 58 useState calls into 4 domain hooks. App.tsx imports and uses the hooks. Child component props are unchanged — this is purely an App.tsx internal restructuring.

**Files:**
- Create: `src/tui/hooks/useBrowserState.ts`
- Create: `src/tui/hooks/useReplayState.ts`
- Create: `src/tui/hooks/usePermissionState.ts`
- Create: `src/tui/hooks/useSessionState.ts`
- Modify: `src/tui/App.tsx`

---

#### 2A-1: Audit App.tsx State

**Step 1:** Read `src/tui/App.tsx` completely.

**Step 2:** List all 58 useState hooks and categorize them into 4 domains:

- **Browser state** — anything prefixed with `browser`, related to browser sessions, daemon, control pane, replay pane (approx 15–20 hooks)
- **Permission state** — anything related to pending permissions, bypass, permission prompts (approx 8–12 hooks)
- **Session state** — anything related to messages, session ID, model, workflow mode (approx 10–15 hooks)
- **UI/misc state** — remaining state (overlay visibility, scroll position, input, etc.)

---

#### 2A-2: Create useBrowserState Hook

**Step 1:** Create `src/tui/hooks/useBrowserState.ts`:

```typescript
import { useState, useCallback } from 'react';
// Import all browser-related types needed

export function useBrowserState() {
  // Move all browser-related useState calls here
  // Return all state values and setters needed by App.tsx and child components
  return {
    // ... all browser state values and setters
  };
}
```

**Step 2:** Move the identified browser useState hooks from `App.tsx` into this hook.

**Step 3:** In `App.tsx`, replace the individual useState calls with:
```typescript
const browserState = useBrowserState();
// Destructure as needed: const { browserSessionActive, ... } = browserState;
```

**Step 4:** Run `npm run typecheck` — fix all type errors before continuing.

---

#### 2A-3: Create usePermissionState Hook

**Step 1:** Create `src/tui/hooks/usePermissionState.ts`:
```typescript
export function usePermissionState() {
  // Move all permission-related useState hooks
  return { /* permission state values and setters */ };
}
```

**Step 2:** Move identified permission useState hooks from `App.tsx`.

**Step 3:** Update `App.tsx`. Run `npm run typecheck`.

---

#### 2A-4: Create useSessionState Hook

**Step 1:** Create `src/tui/hooks/useSessionState.ts`:
```typescript
export function useSessionState(initialMessages: TuiMessage[]) {
  // Move session-related useState hooks
  return { /* session state */ };
}
```

**Step 2:** Move identified session useState hooks. Update `App.tsx`.

**Step 3:** Run `npm run typecheck`.

---

#### 2A-5: Verify App.tsx Line Count Reduction

**Step 1:** Run `wc -l src/tui/App.tsx` — should be significantly less than 2595.

**Step 2:** Run full test suite: `npm test -- tests/tui/`.

**Step 3:** Commit: `refactor(tui): extract App.tsx state into 4 domain hooks`

---

### Task 2B: TUI Render Optimization

**Files:**
- Modify: `src/tui/StatusBar.tsx` (merge timers)
- Modify: `src/tui/BrowserControlOverlay.tsx` (AgeDisplay leaf component)
- Modify: `src/core/agent-permissions.ts` (cache scanActiveBrowserSessions per turn)
- Modify: `src/tui/InputBox.tsx` (fix InputEditor useMemo deps)

---

#### 2B-1: Merge StatusBar Dual Animation Timers

**Problem:** Two `setInterval` at 90ms and 100ms each call `setState` independently → ~20 re-renders/second during streaming.

**Step 1:** Read `src/tui/StatusBar.tsx` fully.

**Step 2:** Replace the two separate intervals with a single shared interval at their GCD (10ms is too fast — use 90ms and derive pulse from the same tick):

```typescript
// Before: two separate intervals
const [spinFrame, setSpinFrame] = useState(0);
const [pulseFrame, setPulseFrame] = useState(0);
useEffect(() => {
  const t1 = setInterval(() => setSpinFrame(f => (f + 1) % SPIN_FRAMES.length), 100);
  const t2 = setInterval(() => setPulseFrame(f => (f + 1) % PULSE_FRAMES.length), 90);
  return () => { clearInterval(t1); clearInterval(t2); };
}, []);

// After: single interval, both frames derived from one counter
const [tick, setTick] = useState(0);
useEffect(() => {
  const t = setInterval(() => setTick(n => n + 1), 90);
  return () => clearInterval(t);
}, []);
const spinFrame = tick % SPIN_FRAMES.length;
const pulseFrame = tick % PULSE_FRAMES.length;
```

**Step 3:** Run `npm run typecheck`. Run `npm test -- tests/tui/StatusBar.test.ts`.

**Step 4:** Commit: `perf(tui): merge StatusBar dual animation timers into single interval`

---

#### 2B-2: Extract AgeDisplay Leaf Component in BrowserControlOverlay

**Problem:** 1Hz `setInterval` updating `ageNowMs` forces full overlay re-render every second.

**Step 1:** Read `src/tui/BrowserControlOverlay.tsx`.

**Step 2:** Find the `ageNowMs` state and its associated `setInterval`. Extract to a standalone component:

```typescript
// New leaf component — scoped re-renders to just this element
function AgeDisplay({ createdAt }: { createdAt: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    t.unref?.();
    return () => clearInterval(t);
  }, []);
  const ageMs = now - createdAt;
  return <Text>{formatAgeLabel(ageMs)}</Text>;
}
```

**Step 3:** Remove `ageNowMs` useState + its setInterval from the main overlay component.

**Step 4:** Replace all uses of `ageNowMs` with `<AgeDisplay createdAt={session.createdAt} />`.

**Step 5:** Run `npm run typecheck`. Run `npm test -- tests/tui/`.

**Step 6:** Commit: `perf(tui): extract AgeDisplay leaf component to scope 1Hz re-renders`

---

#### 2B-3: Cache scanActiveBrowserSessions Per Turn in agent-permissions.ts

**Problem:** `scanActiveBrowserSessions` called for every browser tool call in a loop, each invoking `daemon.start()`.

**Step 1:** Read `src/core/agent-permissions.ts` fully.

**Step 2:** Find the `for (const call of toolCalls)` loop that calls `scanActiveBrowserSessions`.

**Step 3:** Hoist the call above the loop with lazy initialization:
```typescript
// Hoist before the for loop
let activeBrowserSessionsCache: Awaited<ReturnType<typeof scanActiveBrowserSessions>> | null = null;
const getActiveBrowserSessions = async () => {
  if (!activeBrowserSessionsCache) {
    activeBrowserSessionsCache = await scanActiveBrowserSessions(...);
  }
  return activeBrowserSessionsCache;
};

// Inside loop: replace direct call with:
const activeSessions = await getActiveBrowserSessions();
```

**Step 4:** Run `npm run typecheck`. Run `npm test -- tests/core/agent-permissions.browser-session.test.ts`.

**Step 5:** Commit: `perf(agent): cache scanActiveBrowserSessions per turn to avoid O(n) daemon init`

---

#### 2B-4: Fix InputBox InputEditor useMemo Dependencies

**Problem:** `useMemo(() => new InputEditor({ mode }), [])` — empty deps captures stale `mode`.

**Step 1:** Read `src/tui/InputBox.tsx`.

**Step 2:** Find the `useMemo` creating the `InputEditor` instance.

**Step 3:** Since `InputEditor` is a mutable object with a `setMode` method, keep the `useMemo` with `[]` deps (singleton pattern) but ensure the `useEffect` that calls `editor.setMode(mode)` runs synchronously before the first render. Add a ref-based initialization:

```typescript
// Option: keep singleton but ensure mode is always current via the existing useEffect
// Verify the useEffect runs BEFORE the component renders the editor output

// If not, convert to useRef instead of useMemo:
const editorRef = useRef<InputEditor | null>(null);
if (!editorRef.current) {
  editorRef.current = new InputEditor({ prompt: '>', multiline: true, mode });
}
const editor = editorRef.current;
// The useEffect that syncs mode remains unchanged
```

**Step 4:** Run `npm run typecheck`. Run `npm test -- tests/tui/`.

**Step 5:** Commit: `fix(tui): use useRef for InputEditor singleton to prevent stale mode closure`

---

## Verification Checklist

After both waves complete:

```bash
npm run typecheck   # Must: zero errors
npm run lint        # Must: zero errors
npm test            # Must: all tests pass
wc -l src/tui/App.tsx  # Should be < 800 lines
```

---

## Commit Summary

| Fix | Severity | File(s) |
|-----|----------|---------|
| Shell injection → direct spawn | Critical | background-manager.ts |
| API key masking in stdout | Critical | key.ts |
| Autonomy Math.floor | High | autonomy.ts |
| Remove --password CLI flag | High | account.ts |
| Hoist agent loop dynamic imports | Critical | agent.ts |
| approval-log camelCase | Medium | approval-log.ts |
| Config env spreads consolidation | Medium | config.ts |
| messages.splice mutation | Medium | agent.ts |
| Kill timeouts named constants | Low | background-manager.ts |
| Process Map cleanup | Low | background-manager.ts |
| Merge normalize fns | Low | background-manager.ts |
| Remove pointless useMemo | Low | OptimiserPanel.tsx |
| pendingSummary useMemo | Low | BrowserManagerRail.tsx |
| Async resetClientCache | Low | agent-setup.ts |
| sleep/clamp shared utils | High | 13 files + new utils/common.ts |
| riskColor/riskPriority shared | Medium | 2 files + new browser-formatters.ts |
| App.tsx → 4 domain hooks | Critical | App.tsx + 4 new hook files |
| StatusBar dual timer merge | High | StatusBar.tsx |
| AgeDisplay leaf component | Critical | BrowserControlOverlay.tsx |
| scanActiveBrowserSessions cache | High | agent-permissions.ts |
| InputBox InputEditor useRef | High | InputBox.tsx |
