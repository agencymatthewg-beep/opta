---
status: completed
---

# Opta CLI v1.0 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Harden Opta CLI from v0.5.0-alpha.1 into production-quality v1.0: zero-config install, daemon stability, complete test coverage, security gates, and user-facing docs.

> **Status: COMPLETE (verified 2026-02-27)** — All 10 tasks implemented and verified.

**Architecture:** The 10 tasks below are ordered by priority — critical blockers first (Tasks 1–3), production gates second (Tasks 4–7), and polish last (Tasks 8–10). Each task is independently mergeable. Run `npm run typecheck && npm test` after every task before committing.

**Tech Stack:** TypeScript 5, Node.js 20+, Ink/React 19 (TUI), Vitest, Fastify, Playwright, Commander

---

## Current State (pre-plan baseline)

- **Tests:** 1,527 passing across 168 files
- **TypeScript:** clean (zero errors)
- **Branch:** main
- **Remote:** agencymatthewg-beep/opta-cli
- **Critical gaps:** Zero-config mode, daemon crash recovery, thin integration tests, incomplete doctor

---

## Task 1: Zero-Config Anthropic Mode

**What:** When `ANTHROPIC_API_KEY` is set and LMX is not reachable (or not configured), Opta should auto-use Anthropic directly instead of hard-failing.

**Why this is critical:** External users who only have an Anthropic API key cannot use Opta at all today. LMX failure → immediate exit with no recovery path.

**Root cause:** `provider.fallbackOnFailure` defaults to `false`. `FallbackProvider` already implements the fallback logic — it just isn't auto-enabled.

**Files:**
- Modify: `src/providers/manager.ts`
- Modify: `src/commands/doctor.ts`
- Modify: `tests/providers/manager.test.ts` (create if missing)
- Create: `tests/providers/zero-config.test.ts`

---

### Task 1, Step 1: Write the failing test

Create `tests/providers/zero-config.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resetProviderCache } from '../../src/providers/manager.js';

describe('zero-config Anthropic mode', () => {
  beforeEach(() => {
    resetProviderCache();
  });

  it('uses Anthropic when ANTHROPIC_API_KEY is set and no LMX host configured', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-test-key';
    delete process.env['OPTA_HOST'];

    const { getProvider } = await import('../../src/providers/manager.js');
    const config = {
      connection: { host: 'localhost', port: 1234, fallbackHosts: [], protocol: 'http' as const },
      provider: { active: 'lmx' as const, fallbackOnFailure: false },
    } as any;

    // With auto-detect: provider.name should be 'lmx+fallback' or 'anthropic'
    const provider = await getProvider(config);
    expect(['anthropic', 'lmx+fallback']).toContain(provider.name);

    delete process.env['ANTHROPIC_API_KEY'];
  });

  it('uses Anthropic directly when provider.active is explicitly anthropic', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-test-key';

    const { getProvider } = await import('../../src/providers/manager.js');
    const config = {
      connection: { host: 'localhost', port: 1234, fallbackHosts: [], protocol: 'http' as const },
      provider: { active: 'anthropic' as const },
    } as any;

    const provider = await getProvider(config);
    expect(provider.name).toBe('anthropic');

    delete process.env['ANTHROPIC_API_KEY'];
  });
});
```

### Task 1, Step 2: Run test to verify it fails

```bash
npm test -- tests/providers/zero-config.test.ts
```

Expected: FAIL — first test may pass already (if FallbackProvider is selected by name check), but behavior needs verification.

### Task 1, Step 3: Implement auto-detect in manager.ts

In `src/providers/manager.ts`, modify `getProvider()` to auto-enable fallback when `ANTHROPIC_API_KEY` is present:

```typescript
export async function getProvider(config: OptaConfig): Promise<ProviderClient> {
  const key = providerCacheKey(config);
  if (cachedProvider && cachedProviderKey === key) {
    return cachedProvider;
  }

  const active = config.provider?.active ?? 'lmx';

  if (active === 'anthropic') {
    const { AnthropicProvider } = await import('./anthropic.js');
    cachedProvider = new AnthropicProvider(config);
  } else {
    const { LmxProvider } = await import('./lmx.js');
    const lmx = new LmxProvider(config);

    // Auto-enable fallback when ANTHROPIC_API_KEY is present and fallback not explicitly disabled
    const hasAnthropicKey = !!(config.provider?.anthropic?.apiKey || process.env['ANTHROPIC_API_KEY']);
    const fallbackEnabled = config.provider?.fallbackOnFailure ?? hasAnthropicKey;

    if (fallbackEnabled) {
      const { FallbackProvider } = await import('./fallback.js');
      cachedProvider = new FallbackProvider(lmx, config);
    } else {
      cachedProvider = lmx;
    }
  }

  cachedProviderKey = key;
  return cachedProvider;
}
```

### Task 1, Step 4: Add Anthropic check to doctor

In `src/commands/doctor.ts`, add after `checkConfig`:

```typescript
export async function checkAnthropicProvider(): Promise<CheckResult> {
  const apiKey = process.env['ANTHROPIC_API_KEY'] || '';
  if (!apiKey) {
    return {
      name: 'Anthropic',
      status: 'pass', // Not required — LMX is primary
      message: 'ANTHROPIC_API_KEY not set (LMX-only mode)',
    };
  }

  // Validate key format
  if (!apiKey.startsWith('sk-ant-')) {
    return {
      name: 'Anthropic',
      status: 'warn',
      message: 'ANTHROPIC_API_KEY set but format looks invalid',
      detail: 'Anthropic API keys start with sk-ant-...',
    };
  }

  return {
    name: 'Anthropic',
    status: 'pass',
    message: `ANTHROPIC_API_KEY set (${apiKey.slice(0, 10)}...) — fallback enabled`,
  };
}
```

Add `checkAnthropicProvider()` to the `Promise.all` in `runDoctor()` and include the result in `results[]`.

### Task 1, Step 5: Run all tests

```bash
npm run typecheck && npm test
```

Expected: All 1,527+ tests passing.

### Task 1, Step 6: Commit

```bash
git add src/providers/manager.ts src/commands/doctor.ts tests/providers/zero-config.test.ts
git commit -m "feat(providers): auto-enable Anthropic fallback when ANTHROPIC_API_KEY is set"
git push
```

---

## Task 2: Daemon Crash Recovery

**What:** The daemon (HTTP + WebSocket server) must survive crashes and reconnect gracefully. Today: unhandled promise rejections in `session-manager.ts` kill the process; clients get `ECONNRESET` with no recovery.

**Files:**
- Modify: `src/daemon/http-server.ts`
- Modify: `src/daemon/session-manager.ts`
- Create: `tests/daemon/crash-recovery.test.ts`

---

### Task 2, Step 1: Write the failing test

Create `tests/daemon/crash-recovery.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { SessionManager } from '../../src/daemon/session-manager.js';

describe('daemon crash recovery', () => {
  it('session manager survives an unhandled turn error without crashing', async () => {
    const sm = new SessionManager('test-daemon');

    // Create a session
    const session = await sm.createSession({ model: 'test-model', title: 'Test' });

    // Simulate a catastrophic error in the agent loop mid-turn
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Submit a turn that will fail (no LMX available)
    const submitResult = sm.submitTurn(session.sessionId, {
      role: 'user',
      content: 'trigger error',
    }).catch(() => { /* expected */ });

    await submitResult;

    // Session manager should still be alive — not crashed
    const sessions = sm.listSessions();
    expect(sessions).toBeDefined();

    errorSpy.mockRestore();
  });

  it('session manager isolates per-session failures', async () => {
    const sm = new SessionManager('test-daemon');

    const s1 = await sm.createSession({ model: 'test', title: 'S1' });
    const s2 = await sm.createSession({ model: 'test', title: 'S2' });

    // Kill s1 with an error
    sm.deleteSession(s1.sessionId);

    // s2 should still be accessible
    const all = sm.listSessions();
    expect(all.some((s) => s.sessionId === s2.sessionId)).toBe(true);
  });
});
```

### Task 2, Step 2: Run test to verify

```bash
npm test -- tests/daemon/crash-recovery.test.ts
```

Expected: Some assertions fail if `submitTurn` API doesn't exist or session manager crashes.

### Task 2, Step 3: Add uncaught error isolation in session-manager.ts

In `src/daemon/session-manager.ts`, wrap the agent loop execution in a try-catch that emits error events to subscribers rather than propagating:

Find the method that runs agent turns (look for `agentLoop(` call). Wrap its outer async execution:

```typescript
// In the method that dispatches turns (likely executeTurn or similar):
private async runTurn(session: ManagedSession, turn: QueuedTurn): Promise<void> {
  try {
    // ... existing agent loop call ...
  } catch (err) {
    const errorCode = (err as CodedTurnError).turnErrorCode ?? 'agent_error';
    const payload: TurnErrorPayload = {
      code: errorCode,
      message: errorMessage(err),
    };
    this.emitToSubscribers(session.sessionId, makeEnvelope('turn_error', payload, session.seq));
    // Log but don't rethrow — isolate the session error
    console.error(`[daemon] Session ${session.sessionId} turn error:`, errorMessage(err));
  }
}
```

### Task 2, Step 4: Add graceful shutdown in http-server.ts

In `src/daemon/http-server.ts`, ensure the Fastify server handles `SIGTERM` and `SIGINT` gracefully. Find the `createHttpServer` or equivalent function and add:

```typescript
// After server.listen() resolves:
const shutdown = async (signal: string) => {
  console.error(`[daemon] Received ${signal}, shutting down gracefully...`);
  try {
    await app.close();
    await writeDaemonState({ status: 'stopped', pid: process.pid, port, host, daemonId, token: '', startedAt: new Date().toISOString() });
  } catch {
    // Ignore close errors
  }
  process.exit(0);
};

process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
process.once('SIGINT', () => { void shutdown('SIGINT'); });
process.on('uncaughtException', (err) => {
  console.error('[daemon] Uncaught exception (daemon will continue):', err.message);
  // Do NOT exit — daemon survives
});
process.on('unhandledRejection', (reason) => {
  console.error('[daemon] Unhandled rejection (daemon will continue):', reason);
  // Do NOT exit — daemon survives
});
```

### Task 2, Step 5: Run all tests

```bash
npm run typecheck && npm test
```

Expected: All tests pass + new crash-recovery tests pass.

### Task 2, Step 6: Commit

```bash
git add src/daemon/http-server.ts src/daemon/session-manager.ts tests/daemon/crash-recovery.test.ts
git commit -m "fix(daemon): isolate per-session errors, graceful shutdown on SIGTERM"
git push
```

---

## Task 3: Integration Test Expansion

**What:** `tests/integration/` currently has only 2 narrow tests. Add: (a) full chat session end-to-end, (b) daemon multi-client scenario.

**Why:** Confidence floor for v1.0. These tests catch regressions that unit tests miss.

**Files:**
- Create: `tests/integration/chat-session-full-flow.test.ts`
- Create: `tests/integration/daemon-multi-client.test.ts`
- Modify: `tests/integration/browser-autonomous-flow.test.ts` (verify it passes cleanly — no changes if already passing)

---

### Task 3, Step 1: Write chat session integration test

Create `tests/integration/chat-session-full-flow.test.ts`:

```typescript
/**
 * Integration: Full chat session lifecycle.
 *
 * Tests the agent loop end-to-end using an Anthropic API key (if available)
 * or a mock provider. Verifies: session create → message → response → session close.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

const HAVE_ANTHROPIC = !!process.env['ANTHROPIC_API_KEY'];

describe.skipIf(!HAVE_ANTHROPIC)('chat session full flow (requires ANTHROPIC_API_KEY)', () => {
  it('completes a single-turn chat with a real model response', async () => {
    const { loadConfig } = await import('../../src/core/config.js');
    const { agentLoop } = await import('../../src/core/agent.js');

    const config = await loadConfig({ provider: { active: 'anthropic' } } as any);
    const messages: any[] = [];
    let gotResponse = false;

    await agentLoop({
      config,
      messages: [{ role: 'user', content: 'Reply with exactly: OPTA_OK' }],
      onMessage: (msg) => {
        messages.push(msg);
        if (msg.role === 'assistant' && msg.content?.includes('OPTA_OK')) {
          gotResponse = true;
        }
      },
      onToolCall: async () => ({ result: '' }),
      signal: AbortSignal.timeout(30_000),
    });

    expect(gotResponse).toBe(true);
  }, 35_000);
});

describe('chat session full flow (mock provider)', () => {
  it('creates a session, processes a turn, and terminates cleanly', async () => {
    const { MemoryStore } = await import('../../src/memory/store.js');
    const store = new MemoryStore();

    const sessionId = await store.create({ title: 'Integration Test', model: 'mock' });
    expect(sessionId).toBeTruthy();

    await store.appendMessage(sessionId, { role: 'user', content: 'hello' });
    await store.appendMessage(sessionId, { role: 'assistant', content: 'world' });

    const session = await store.read(sessionId);
    expect(session.messages).toHaveLength(2);
    expect(session.messages[1]?.content).toBe('world');

    await store.delete(sessionId);
    const gone = await store.read(sessionId).catch(() => null);
    expect(gone).toBeNull();
  });
});
```

### Task 3, Step 2: Write daemon multi-client integration test

Create `tests/integration/daemon-multi-client.test.ts`:

```typescript
/**
 * Integration: Daemon handles multiple concurrent clients.
 *
 * Starts the HTTP server in-process, connects two clients via fetch,
 * verifies both get correct session isolation.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { createHttpServer } from '../../src/daemon/http-server.js';
import { SessionManager } from '../../src/daemon/session-manager.js';

describe('daemon multi-client', () => {
  let server: Awaited<ReturnType<typeof createHttpServer>>;
  const TOKEN = 'test-token-abc';

  beforeAll(async () => {
    const sm = new SessionManager('test-daemon-mc');
    server = await createHttpServer({
      daemonId: 'test-daemon-mc',
      host: '127.0.0.1',
      port: 0, // OS-assigned port
      token: TOKEN,
      sessionManager: sm,
    });
  });

  afterAll(async () => {
    await server.close();
  });

  it('two clients get independent sessions', async () => {
    const base = `http://${server.host}:${server.port}`;
    const headers = { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

    const [r1, r2] = await Promise.all([
      fetch(`${base}/v3/sessions`, { method: 'POST', headers, body: JSON.stringify({ model: 'test', title: 'Client1' }) }),
      fetch(`${base}/v3/sessions`, { method: 'POST', headers, body: JSON.stringify({ model: 'test', title: 'Client2' }) }),
    ]);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);

    const s1 = await r1.json() as { sessionId: string };
    const s2 = await r2.json() as { sessionId: string };

    expect(s1.sessionId).toBeTruthy();
    expect(s2.sessionId).toBeTruthy();
    expect(s1.sessionId).not.toBe(s2.sessionId);
  });

  it('unauthorized request is rejected with 401', async () => {
    const base = `http://${server.host}:${server.port}`;
    const r = await fetch(`${base}/v3/sessions`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer wrong-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'test' }),
    });
    expect(r.status).toBe(401);
  });
});
```

### Task 3, Step 3: Run integration tests

```bash
npm test -- tests/integration/
```

Expected: Mock-based tests PASS. Anthropic live test SKIP (unless `ANTHROPIC_API_KEY` is set).

### Task 3, Step 4: Verify existing integration tests still pass

```bash
npm test -- tests/integration/browser-artifact-completeness-gate.test.ts
npm test -- tests/integration/browser-autonomous-flow.test.ts
```

Expected: Both PASS (or SKIP if browser daemon not available in test environment).

### Task 3, Step 5: Run full suite

```bash
npm run typecheck && npm test
```

Expected: All tests pass.

### Task 3, Step 6: Commit

```bash
git add tests/integration/chat-session-full-flow.test.ts tests/integration/daemon-multi-client.test.ts
git commit -m "test(integration): add chat session and daemon multi-client integration tests"
git push
```

---

## Task 4: opta doctor Completeness

**What:** `opta doctor` currently checks: Node, LMX, ActiveModel, Config, OPIS, MCP, Git, Sessions. Missing: Playwright install, daemon health, Anthropic key validity.

**Files:**
- Modify: `src/commands/doctor.ts`
- Modify: `tests/commands/doctor.test.ts`

---

### Task 4, Step 1: Check what checks doctor currently exposes

Read `tests/commands/doctor.test.ts` to understand existing test coverage before adding:

```bash
npm test -- tests/commands/doctor.test.ts
```

Expected: Passes. Note which check functions are tested.

### Task 4, Step 2: Add Playwright check

In `src/commands/doctor.ts`, add after `checkDiskUsage`:

```typescript
export async function checkPlaywright(): Promise<CheckResult> {
  try {
    const { execaCommand } = await import('execa');
    const result = await execaCommand('npx playwright --version', { timeout: 5000 });
    const version = result.stdout.trim();
    return {
      name: 'Playwright',
      status: 'pass',
      message: `Playwright ${version} available`,
    };
  } catch {
    return {
      name: 'Playwright',
      status: 'warn',
      message: 'Playwright not installed (browser automation unavailable)',
      detail: "Run 'npx playwright install chromium' to enable browser automation",
    };
  }
}
```

### Task 4, Step 3: Add daemon health check

In `src/commands/doctor.ts`, add:

```typescript
export async function checkDaemon(): Promise<CheckResult> {
  try {
    const { readDaemonState } = await import('../daemon/lifecycle.js');
    const state = await readDaemonState();

    if (!state || state.status !== 'running') {
      return {
        name: 'Daemon',
        status: 'warn',
        message: 'Daemon not running (background tasks unavailable)',
        detail: "Run 'opta serve' to start the background daemon",
      };
    }

    // Ping the daemon
    const pingUrl = `http://${state.host}:${state.port}/healthz`;
    const response = await fetch(pingUrl, { signal: AbortSignal.timeout(2000) });
    if (response.ok) {
      return {
        name: 'Daemon',
        status: 'pass',
        message: `Daemon running on port ${state.port} (pid ${state.pid})`,
      };
    }

    return {
      name: 'Daemon',
      status: 'warn',
      message: `Daemon state file exists but not responding on port ${state.port}`,
      detail: "Run 'opta serve --restart' to restart the daemon",
    };
  } catch {
    return {
      name: 'Daemon',
      status: 'warn',
      message: 'Daemon not running (background tasks unavailable)',
      detail: "Run 'opta serve' to start the background daemon",
    };
  }
}
```

### Task 4, Step 4: Wire new checks into runDoctor()

In `runDoctor()`, add the two new checks to the `Promise.all`:

```typescript
const [
  nodeResult,
  lmxSnapshot,
  configResult,
  opisResult,
  mcpResult,
  gitResult,
  diskResult,
  anthropicResult,    // NEW
  playwrightResult,   // NEW
  daemonResult,       // NEW
] = await Promise.all([
  checkNode(),
  collectLmxDoctorSnapshot(host, port, adminKey, config.connection.fallbackHosts),
  checkConfig(config),
  checkOpis(cwd),
  checkMcpServers(/* ... */),
  checkGit(cwd),
  checkDiskUsage(),
  checkAnthropicProvider(),   // NEW (from Task 1)
  checkPlaywright(),           // NEW
  checkDaemon(),               // NEW
]);
```

Add all three to `results[]`.

### Task 4, Step 5: Write tests for new checks

In `tests/commands/doctor.test.ts`, add:

```typescript
describe('checkPlaywright', () => {
  it('returns warn when playwright is not installed', async () => {
    vi.mock('execa', () => ({
      execaCommand: vi.fn().mockRejectedValue(new Error('not found')),
    }));
    const result = await checkPlaywright();
    expect(result.status).toBe('warn');
    expect(result.name).toBe('Playwright');
  });
});

describe('checkDaemon', () => {
  it('returns warn when no daemon state file', async () => {
    const result = await checkDaemon();
    expect(result.status).toBe('warn');
    expect(result.name).toBe('Daemon');
  });
});
```

### Task 4, Step 6: Run and commit

```bash
npm run typecheck && npm test
git add src/commands/doctor.ts tests/commands/doctor.test.ts
git commit -m "feat(doctor): add Anthropic, Playwright, and daemon health checks"
git push
```

---

## Task 5: Shell Injection Formal Audit

**What:** Verify every code path in `src/core/tools/executors.ts` that touches shell execution uses direct `spawn` (not `sh -c` with user input). Document findings.

**Files:**
- Read: `src/core/tools/executors.ts`
- Create: `tests/security/shell-injection.test.ts`
- Create: `docs/SECURITY-AUDIT.md`

---

### Task 5, Step 1: Read executors.ts and identify all spawn/exec calls

```bash
grep -n "spawn\|exec\|execaCommand\|sh -c\|bash -c" src/core/tools/executors.ts
```

Expected output: Should show `spawn` calls (safe) not `sh -c` with user input (unsafe). If any `sh -c` appears with unsanitized user input, it's a critical finding.

### Task 5, Step 2: Write injection test for run_command executor

Create `tests/security/shell-injection.test.ts`:

```typescript
/**
 * Security: Shell injection prevention in run_command executor.
 *
 * Verifies that user-provided command strings are passed to spawn() directly
 * without interpolation into shell metacharacters.
 */
import { describe, it, expect } from 'vitest';
import { executeRunCommand } from '../../src/core/tools/executors.js';

describe('shell injection prevention', () => {
  it('does not execute injected shell commands via semicolons', async () => {
    // If vulnerable: "echo safe; touch /tmp/injected" would create /tmp/injected
    // Safe: the whole string is treated as literal args
    const result = await executeRunCommand({
      command: 'echo safe; touch /tmp/opta-injection-test',
    }, { cwd: process.cwd(), timeout: 5000 }).catch((e) => ({ error: String(e) }));

    // Injection file should NOT exist
    const { access } = await import('node:fs/promises');
    await expect(access('/tmp/opta-injection-test')).rejects.toThrow();

    // Cleanup (in case it was created — treat as test failure evidence)
    await import('node:fs/promises').then((fs) => fs.rm('/tmp/opta-injection-test').catch(() => {}));
  });

  it('handles backtick injection safely', async () => {
    const result = await executeRunCommand({
      command: 'echo `id`',
    }, { cwd: process.cwd(), timeout: 5000 }).catch(() => ({ error: 'expected' }));
    // Should either return the literal string "`id`" or fail cleanly
    // Should NOT execute id command and return uid=...
    if ('output' in result) {
      expect(result.output).not.toMatch(/uid=\d+/);
    }
  });
});
```

### Task 5, Step 3: Run the security tests

```bash
npm test -- tests/security/shell-injection.test.ts
```

Expected: Tests PASS (confirms no injection). If they FAIL, the executor is vulnerable and must be fixed before proceeding.

### Task 5, Step 4: Create SECURITY-AUDIT.md

Create `docs/SECURITY-AUDIT.md`:

```markdown
# Opta CLI Security Audit

**Date:** 2026-02-26
**Auditor:** Implementation plan review
**Status:** IN PROGRESS

## Shell Injection

### Scope
`src/core/tools/executors.ts` — `run_command` executor

### Findings

| Path | Pattern | Risk | Status |
|------|---------|------|--------|
| `executeRunCommand` | spawn with parsed args | None — uses parseShellCommand() | ✅ Safe |

### Verification
`tests/security/shell-injection.test.ts` — 2 tests covering semicolon and backtick injection.

## API Key Handling

### Scope
`src/lmx/api-key.ts`, `src/core/config.ts`, `src/lmx/endpoints.ts`

### Findings
- API keys stored in `~/.config/opta/config.json` (plaintext) — see Task 6 for keychain migration
- Keys are masked in logs via `maskKey()` — ✅ Safe
- Keys not printed to stdout — ✅ Safe

## Future Audits

- [x] Browser policy cross-origin credential access (Task 7)
- [x] MCP server stdio injection
- [x] LSP server command injection
```

### Task 5, Step 5: Commit

```bash
git add tests/security/shell-injection.test.ts docs/SECURITY-AUDIT.md
git commit -m "security: formal shell injection audit with regression tests"
git push
```

---

## Task 6: API Key → OS Keychain

**What:** Move LMX API key and Anthropic API key storage from `~/.config/opta/config.json` (plaintext JSON) to OS keychain (macOS Keychain, Linux libsecret, Windows Credential Manager) using `keytar`.

**Files:**
- Create: `src/core/keychain.ts`
- Modify: `src/lmx/api-key.ts`
- Modify: `src/commands/doctor.ts` (add keychain check)
- Create: `tests/core/keychain.test.ts`

**Note:** `keytar` requires a native module. Add to package.json dependencies: `"keytar": "^7.9.0"`.

---

### Task 6, Step 1: Add keytar dependency

```bash
npm install keytar
npm install --save-dev @types/keytar
```

Verify install:
```bash
node -e "require('keytar')" && echo "keytar OK"
```

### Task 6, Step 2: Write failing keychain tests

Create `tests/core/keychain.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

// Mock keytar to avoid OS keychain access in tests
vi.mock('keytar', () => ({
  getPassword: vi.fn().mockResolvedValue(null),
  setPassword: vi.fn().mockResolvedValue(undefined),
  deletePassword: vi.fn().mockResolvedValue(false),
}));

describe('keychain', () => {
  it('getKey returns null when no key stored', async () => {
    const { getKey } = await import('../../src/core/keychain.js');
    const result = await getKey('lmx-api-key');
    expect(result).toBeNull();
  });

  it('setKey stores a key and getKey retrieves it', async () => {
    const keytar = await import('keytar');
    vi.mocked(keytar.getPassword).mockResolvedValueOnce('sk-test-key');

    const { setKey, getKey } = await import('../../src/core/keychain.js');
    await setKey('lmx-api-key', 'sk-test-key');
    const result = await getKey('lmx-api-key');
    expect(result).toBe('sk-test-key');
  });

  it('deleteKey removes a stored key', async () => {
    const keytar = await import('keytar');
    vi.mocked(keytar.deletePassword).mockResolvedValueOnce(true);

    const { deleteKey } = await import('../../src/core/keychain.js');
    const deleted = await deleteKey('lmx-api-key');
    expect(deleted).toBe(true);
  });

  it('falls back gracefully when keytar is unavailable', async () => {
    const keytar = await import('keytar');
    vi.mocked(keytar.getPassword).mockRejectedValueOnce(new Error('keychain unavailable'));

    const { getKey } = await import('../../src/core/keychain.js');
    const result = await getKey('lmx-api-key');
    // Should return null, not throw
    expect(result).toBeNull();
  });
});
```

### Task 6, Step 3: Implement keychain.ts

Create `src/core/keychain.ts`:

```typescript
/**
 * Keychain — OS-native secret storage for Opta API keys.
 *
 * Wraps `keytar` with graceful fallback to null when the OS keychain
 * is unavailable (CI, headless, Docker). Callers must handle null
 * and fall back to config file or environment variable.
 */

const SERVICE_NAME = 'opta-cli';

async function getKeytar() {
  try {
    return await import('keytar');
  } catch {
    return null;
  }
}

/** Retrieve a key from OS keychain. Returns null if not found or keychain unavailable. */
export async function getKey(account: string): Promise<string | null> {
  const keytar = await getKeytar();
  if (!keytar) return null;
  try {
    return await keytar.getPassword(SERVICE_NAME, account);
  } catch {
    return null;
  }
}

/** Store a key in OS keychain. Silently no-ops if keychain unavailable. */
export async function setKey(account: string, value: string): Promise<void> {
  const keytar = await getKeytar();
  if (!keytar) return;
  try {
    await keytar.setPassword(SERVICE_NAME, account, value);
  } catch {
    // Keychain unavailable — caller should warn user
  }
}

/** Delete a key from OS keychain. Returns true if deleted, false otherwise. */
export async function deleteKey(account: string): Promise<boolean> {
  const keytar = await getKeytar();
  if (!keytar) return false;
  try {
    return await keytar.deletePassword(SERVICE_NAME, account);
  } catch {
    return false;
  }
}
```

### Task 6, Step 4: Update api-key.ts to check keychain first

In `src/lmx/api-key.ts`, update `resolveLmxApiKey()`:

```typescript
import { getKey } from '../core/keychain.js';

export async function resolveLmxApiKeyWithKeychain(
  connection: { apiKey?: string; host?: string }
): Promise<string> {
  // 1. Explicit config value
  if (connection.apiKey) return connection.apiKey;
  // 2. OS keychain
  const keychainKey = await getKey('lmx-api-key');
  if (keychainKey) return keychainKey;
  // 3. Environment variable
  const envKey = process.env['OPTA_API_KEY'] ?? process.env['LMX_API_KEY'];
  if (envKey) return envKey;
  // 4. Default (LMX may not require a key on LAN)
  return '';
}
```

Note: Keep `resolveLmxApiKey` (sync) intact for backwards compatibility. Add the async variant for new call sites.

### Task 6, Step 5: Run tests and commit

```bash
npm run typecheck && npm test -- tests/core/keychain.test.ts
npm test
git add src/core/keychain.ts src/lmx/api-key.ts tests/core/keychain.test.ts package.json package-lock.json
git commit -m "feat(security): OS keychain storage for API keys via keytar"
git push
```

---

## Task 7: Browser Policy Defaults Audit

**What:** Review `src/browser/policy-engine.ts` default rules. Ensure cross-origin credential access is denied by default and that the policy engine correctly blocks known bad patterns.

**Files:**
- Read: `src/browser/policy-engine.ts`
- Create: `tests/security/browser-policy.test.ts`
- Modify: `docs/SECURITY-AUDIT.md` (add browser policy section)

---

### Task 7, Step 1: Read current policy defaults

```bash
grep -n "default\|allow\|deny\|credential\|cookie\|password" src/browser/policy-engine.ts | head -40
```

Document what the defaults are.

### Task 7, Step 2: Write policy tests

Create `tests/security/browser-policy.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { PolicyEngine, type BrowserAction } from '../../src/browser/policy-engine.js';

describe('browser policy — security defaults', () => {
  let engine: PolicyEngine;

  beforeEach(() => {
    engine = new PolicyEngine(); // default config
  });

  it('denies cross-origin credential access by default', () => {
    const action: BrowserAction = {
      type: 'read_cookies',
      url: 'https://evil.example.com',
      context: { originUrl: 'https://opta.app' },
    };
    const decision = engine.evaluate(action);
    expect(decision.allowed).toBe(false);
  });

  it('denies password field access on external domains', () => {
    const action: BrowserAction = {
      type: 'read_input_value',
      selector: 'input[type="password"]',
      url: 'https://external.bank.com',
      context: { originUrl: 'https://opta.app' },
    };
    const decision = engine.evaluate(action);
    expect(decision.allowed).toBe(false);
  });

  it('allows screenshot on same-origin navigation', () => {
    const action: BrowserAction = {
      type: 'screenshot',
      url: 'https://opta.app/dashboard',
      context: { originUrl: 'https://opta.app' },
    };
    const decision = engine.evaluate(action);
    expect(decision.allowed).toBe(true);
  });
});
```

### Task 7, Step 3: Run policy tests

```bash
npm test -- tests/security/browser-policy.test.ts
```

If tests fail because policy types don't match (`BrowserAction.type` has different names), adjust test to match actual type definitions from `src/browser/policy-engine.ts`.

### Task 7, Step 4: Harden any found defaults

If the audit finds credential access is `allow` by default, change to `deny` in the `PolicyEngine` constructor default config. Document the change in `docs/SECURITY-AUDIT.md`.

### Task 7, Step 5: Commit

```bash
git add tests/security/browser-policy.test.ts docs/SECURITY-AUDIT.md
git commit -m "security: browser policy audit with credential access regression tests"
git push
```

---

## Task 8: Public User-Facing README

**What:** Write `README.md` that covers install, quick start, and common workflows. Separate from `CLAUDE.md` (which is for Claude Code context).

**Files:**
- Modify: `README.md` (currently may contain old Python Aider content — overwrite)

---

### Task 8, Step 1: Check current README state

```bash
head -20 README.md
```

### Task 8, Step 2: Write new README

Overwrite `README.md`:

```markdown
# Opta CLI

Agentic AI assistant for software development. Runs in your terminal with full-screen TUI, browser automation, and local LLM support via Opta-LMX.

## Install

```bash
npm install -g opta-cli
```

Requires Node.js 20+.

## Quick Start

### With Opta-LMX (local inference)

```bash
# Configure your LMX server
opta config set connection.host 192.168.1.100

# Start a chat session
opta chat
```

### With Anthropic API (zero-config)

```bash
export ANTHROPIC_API_KEY=sk-ant-your-key-here
opta chat
```

## Commands

| Command | Description |
|---------|-------------|
| `opta chat` | Interactive chat session |
| `opta do "task"` | Single-shot task execution |
| `opta models` | List and manage models |
| `opta config` | View and edit configuration |
| `opta doctor` | Diagnose connection and config issues |
| `opta status` | Check LMX server health |
| `opta init` | Set up project intelligence (APP.md) |

## TUI Controls

Launch the full-screen TUI:

```bash
opta chat --tui
```

Key bindings:
- `Ctrl+K` — Opta menu (models, settings, browser)
- `Ctrl+H` — Help overlay (all keybindings)
- `Ctrl+Shift+S` — Settings overlay
- `Ctrl+/` — Slash command menu
- `/` — Slash commands (type in input)
- `@file` — Attach file reference
- `!cmd` — Run shell command

## Configuration

```bash
# View all settings
opta config list

# Set LMX server
opta config set connection.host 192.168.1.100
opta config set connection.port 1234

# Set default model
opta models use llama-3.3-70b
```

Config is stored in `~/.config/opta/config.json`.

## Troubleshooting

```bash
opta doctor
```

This runs all health checks and prints actionable fix suggestions.
```

### Task 8, Step 3: Commit

```bash
git add README.md
git commit -m "docs: write public-facing README with install, quick start, and commands"
git push
```

---

## Task 9: TUI Performance Budget

**What:** Measure and enforce a render latency target. Opta's TUI should render frames under 16ms (60fps equivalent). Add a performance smoke test that catches regressions.

**Files:**
- Create: `tests/tui/render-performance.test.tsx`

---

### Task 9, Step 1: Write render performance test

Create `tests/tui/render-performance.test.tsx`:

```typescript
/**
 * TUI Render Performance Budget
 *
 * Measures render time for key components under simulated load.
 * Budget: < 16ms per render (60fps equivalent).
 * Warning threshold: > 8ms (allows 2x headroom before budget breach).
 */
import { describe, it, expect } from 'vitest';
import { renderToString } from 'ink-testing-library';
import React from 'react';
import { MessageList } from '../../src/tui/MessageList.js';

const RENDER_BUDGET_MS = 16;
const WARN_THRESHOLD_MS = 8;

function measureRender(component: React.ReactElement): number {
  const start = performance.now();
  renderToString(component);
  return performance.now() - start;
}

describe('TUI render performance budget', () => {
  it('MessageList with 50 messages renders under budget', () => {
    const messages = Array.from({ length: 50 }, (_, i) => ({
      id: `msg-${i}`,
      role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
      content: `Message ${i}: This is a typical chat message with some content.`,
      timestamp: Date.now(),
    }));

    const duration = measureRender(
      React.createElement(MessageList, {
        messages,
        isStreaming: false,
        scrollOffset: 0,
        maxHeight: 40,
      })
    );

    if (duration > WARN_THRESHOLD_MS) {
      console.warn(`[perf] MessageList render: ${duration.toFixed(1)}ms (warn threshold: ${WARN_THRESHOLD_MS}ms)`);
    }
    expect(duration).toBeLessThan(RENDER_BUDGET_MS);
  });

  it('empty MessageList renders near-instantly', () => {
    const duration = measureRender(
      React.createElement(MessageList, {
        messages: [],
        isStreaming: false,
        scrollOffset: 0,
        maxHeight: 40,
      })
    );
    expect(duration).toBeLessThan(5); // Should be < 5ms with no content
  });
});
```

### Task 9, Step 2: Run performance tests

```bash
npm test -- tests/tui/render-performance.test.tsx
```

Expected: PASS. If > 16ms, investigate MessageList for unnecessary re-renders (useMemo opportunities).

### Task 9, Step 3: Commit

```bash
git add tests/tui/render-performance.test.tsx
git commit -m "perf(tui): add render performance budget tests (16ms target)"
git push
```

---

## Task 10: CI Clean Environment Verification

**What:** Verify the full test suite passes on a clean Node 20 and Node 22 environment. Add GitHub Actions workflow if not already present.

**Files:**
- Check: `.github/workflows/` (already exists based on git status — verify content)
- Modify: `.github/workflows/ci.yml` if needed

---

### Task 10, Step 1: Check existing CI workflow

```bash
cat .github/workflows/ci.yml
```

Expected: Find a workflow that runs `npm test`. If it runs `pytest` (old Python content), replace it.

### Task 10, Step 2: Verify/create CI workflow

Ensure `.github/workflows/ci.yml` contains:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    name: Test (Node ${{ matrix.node-version }})
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: ['20', '22']

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      - name: Test
        run: npm test
        env:
          CI: true
```

### Task 10, Step 3: Run CI locally to simulate

```bash
CI=true npm run typecheck && CI=true npm run lint && CI=true npm test
```

Expected: All pass. In CI mode, all `'ask'` permissions become `'deny'` — tests should handle this.

### Task 10, Step 4: Commit

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add Node 20+22 matrix CI workflow for TypeScript test suite"
git push
```

---

## Execution Order Summary

| Priority | Task | Blocker for v1.0 | Status |
|----------|------|------------------|--------|
| 1 | Zero-config Anthropic mode | 🔴 YES — external users blocked | ✅ DONE |
| 2 | Daemon crash recovery | 🔴 YES — 24h stability | ✅ DONE |
| 3 | Integration test expansion | 🔴 YES — confidence floor | ✅ DONE |
| 4 | opta doctor completeness | 🟠 YES — install bar | ✅ DONE |
| 5 | Shell injection audit | 🟠 YES — security bar | ✅ DONE |
| 6 | API key → OS keychain | 🟠 YES — security bar | ✅ DONE |
| 7 | Browser policy audit | 🟠 YES — security bar | ✅ DONE |
| 8 | Public README | 🟡 NICE — polish | ✅ DONE |
| 9 | TUI performance budget | 🟡 NICE — polish | ✅ DONE |
| 10 | CI verification | 🟡 NICE — polish | ✅ DONE |

## v1.0 Gate

**Status: ALL TASKS COMPLETE** — Verified 2026-02-27.

- Tests: 1,755 passing (186 files)
- TypeScript: clean (zero errors)

```bash
git tag v1.0.0
git push origin v1.0.0
```
