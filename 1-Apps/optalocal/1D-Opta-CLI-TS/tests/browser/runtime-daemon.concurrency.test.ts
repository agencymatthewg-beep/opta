import { describe, expect, it } from 'vitest';
import type { NativeSessionManager } from '../../src/browser/native-session-manager.js';
import { BrowserRuntimeDaemon } from '../../src/browser/runtime-daemon.js';
import type {
  BrowserAction,
  BrowserActionResult,
  BrowserSession,
  BrowserSnapshotData,
  BrowserScreenshotData,
} from '../../src/browser/types.js';

interface FakeSessionManagerHarness {
  manager: NativeSessionManager;
  calls: {
    openSession: number;
    closeSession: number;
    navigate: number;
    click: number;
    type: number;
    snapshot: number;
    screenshot: number;
  };
}

function createFakeSessionManager(harnessOptions: { openDelayMs?: number; navigateDelayMs?: number } = {}): FakeSessionManagerHarness {
  const calls = {
    openSession: 0,
    closeSession: 0,
    navigate: 0,
    click: 0,
    type: 0,
    snapshot: 0,
    screenshot: 0,
  };
  const sessions = new Map<string, BrowserSession>();
  let actionSequence = 0;
  let clockSeconds = 0;

  const nextTimestamp = (): string => {
    const value = new Date(Date.UTC(2026, 1, 23, 12, 0, clockSeconds)).toISOString();
    clockSeconds += 1;
    return value;
  };

  const createAction = (
    sessionId: string,
    type: BrowserAction['type'],
    input: Record<string, unknown>,
  ): BrowserAction => {
    actionSequence += 1;
    return {
      id: `fake-action-${String(actionSequence).padStart(6, '0')}`,
      sessionId,
      type,
      createdAt: nextTimestamp(),
      input,
    };
  };

  const fail = <T>(action: BrowserAction, code: string, message: string): BrowserActionResult<T> => ({
    ok: false,
    action,
    error: { code, message },
  });

  const createArtifact = (
    sessionId: string,
    actionId: string,
    kind: 'snapshot' | 'screenshot',
    mimeType: string,
    extension: 'html' | 'png',
  ) => ({
    id: `${kind}-${actionId}`,
    sessionId,
    actionId,
    kind,
    createdAt: nextTimestamp(),
    relativePath: `${sessionId}/${kind}-${actionId}.${extension}`,
    absolutePath: `/virtual/${sessionId}/${kind}-${actionId}.${extension}`,
    mimeType,
    sizeBytes: 32,
  });

  const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      const onAbort = () => {
        clearTimeout(timer);
        const err = new Error('cancelled');
        err.name = 'AbortError';
        reject(err);
      };

      if (!signal) return;
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    });

  const manager = {
    async openSession(input: { sessionId?: string; mode?: BrowserSession['mode']; wsEndpoint?: string } = {}) {
      calls.openSession += 1;
      const sessionId = input.sessionId?.trim() || `fake-session-${calls.openSession}`;
      const action = createAction(sessionId, 'openSession', { ...input, sessionId });

      if (sessions.has(sessionId)) {
        return fail<BrowserSession>(action, 'SESSION_EXISTS', `Browser session "${sessionId}" already exists.`);
      }

      if (harnessOptions.openDelayMs && harnessOptions.openDelayMs > 0) {
        await sleep(harnessOptions.openDelayMs);
      }

      const now = nextTimestamp();
      const session: BrowserSession = {
        id: sessionId,
        mode: input.mode ?? 'isolated',
        status: 'open',
        runtime: 'unavailable',
        createdAt: now,
        updatedAt: now,
        artifactsDir: `/virtual/${sessionId}`,
        wsEndpoint: input.wsEndpoint,
      };

      sessions.set(sessionId, session);
      return {
        ok: true,
        action,
        data: { ...session },
      };
    },

    async closeSession(sessionId: string) {
      calls.closeSession += 1;
      const action = createAction(sessionId, 'closeSession', {});
      if (!sessions.has(sessionId)) {
        return fail<{ sessionId: string; status: 'closed' }>(
          action,
          'SESSION_NOT_FOUND',
          `Browser session "${sessionId}" was not found.`,
        );
      }
      sessions.delete(sessionId);
      return {
        ok: true,
        action,
        data: {
          sessionId,
          status: 'closed' as const,
        },
      };
    },

    async navigate(sessionId: string, input: { url: string }, actionOptions?: { signal?: AbortSignal }) {
      calls.navigate += 1;
      const action = createAction(sessionId, 'navigate', { ...input });
      const session = sessions.get(sessionId);
      if (!session) {
        return fail<{ url: string }>(action, 'SESSION_NOT_FOUND', `Browser session "${sessionId}" was not found.`);
      }
      if (actionOptions?.signal?.aborted) {
        return fail<{ url: string }>(
          action,
          'ACTION_CANCELLED',
          'Browser action cancelled by runtime kill signal.',
        );
      }
      if (harnessOptions.navigateDelayMs && harnessOptions.navigateDelayMs > 0) {
        try {
          await sleep(harnessOptions.navigateDelayMs, actionOptions?.signal);
        } catch {
          return fail<{ url: string }>(
            action,
            'ACTION_CANCELLED',
            'Browser action cancelled by runtime kill signal.',
          );
        }
      } else if (actionOptions?.signal && actionOptions.signal.aborted) {
        return fail<{ url: string }>(
          action,
          'ACTION_CANCELLED',
          'Browser action cancelled by runtime kill signal.',
        );
      }
      session.currentUrl = input.url;
      session.updatedAt = nextTimestamp();
      sessions.set(sessionId, session);
      return {
        ok: true,
        action,
        data: { url: input.url },
      };
    },

    async click(sessionId: string, input: { selector: string }) {
      calls.click += 1;
      const action = createAction(sessionId, 'click', { ...input });
      if (!sessions.has(sessionId)) {
        return fail<undefined>(action, 'SESSION_NOT_FOUND', `Browser session "${sessionId}" was not found.`);
      }
      return { ok: true, action };
    },

    async type(sessionId: string, input: { selector: string; text: string }) {
      calls.type += 1;
      const action = createAction(sessionId, 'type', { ...input });
      if (!sessions.has(sessionId)) {
        return fail<undefined>(action, 'SESSION_NOT_FOUND', `Browser session "${sessionId}" was not found.`);
      }
      return { ok: true, action };
    },

    async snapshot(sessionId: string): Promise<BrowserActionResult<BrowserSnapshotData>> {
      calls.snapshot += 1;
      const action = createAction(sessionId, 'snapshot', {});
      if (!sessions.has(sessionId)) {
        return fail<BrowserSnapshotData>(
          action,
          'SESSION_NOT_FOUND',
          `Browser session "${sessionId}" was not found.`,
        );
      }
      return {
        ok: true,
        action,
        data: {
          html: `<html data-session="${sessionId}"></html>`,
          artifact: createArtifact(sessionId, action.id, 'snapshot', 'text/html', 'html'),
        },
      };
    },

    async screenshot(sessionId: string): Promise<BrowserActionResult<BrowserScreenshotData>> {
      calls.screenshot += 1;
      const action = createAction(sessionId, 'screenshot', {});
      if (!sessions.has(sessionId)) {
        return fail<BrowserScreenshotData>(
          action,
          'SESSION_NOT_FOUND',
          `Browser session "${sessionId}" was not found.`,
        );
      }
      return {
        ok: true,
        action,
        data: {
          artifact: createArtifact(sessionId, action.id, 'screenshot', 'image/png', 'png'),
        },
      };
    },
  };

  return {
    manager: manager as unknown as NativeSessionManager,
    calls,
  };
}

describe('BrowserRuntimeDaemon hardening under load-like sequences', () => {
  it('enforces maxSessions across burst open attempts', async () => {
    const fake = createFakeSessionManager({ openDelayMs: 10 });
    const daemon = new BrowserRuntimeDaemon({
      maxSessions: 2,
      persistSessions: false,
      sessionManager: fake.manager,
    });

    await daemon.start();

    const attempts = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        daemon.openSession({ sessionId: `burst-${index + 1}` }),
      ),
    );

    const succeeded = attempts.filter((result) => result.ok);
    const rejectedByLimit = attempts.filter(
      (result) => !result.ok && result.error?.code === 'MAX_SESSIONS_REACHED',
    );

    expect(succeeded).toHaveLength(2);
    expect(rejectedByLimit).toHaveLength(6);
    expect(fake.calls.openSession).toBe(2);
    expect(daemon.health().sessionCount).toBe(2);
  });

  it('supports deterministic close and reopen slot reuse', async () => {
    const fake = createFakeSessionManager();
    const daemon = new BrowserRuntimeDaemon({
      maxSessions: 2,
      persistSessions: false,
      sessionManager: fake.manager,
    });

    await daemon.start();

    expect((await daemon.openSession({ sessionId: 'slot-a' })).ok).toBe(true);
    expect((await daemon.openSession({ sessionId: 'slot-b' })).ok).toBe(true);

    const saturated = await daemon.openSession({ sessionId: 'slot-c' });
    expect(saturated.ok).toBe(false);
    expect(saturated.error?.code).toBe('MAX_SESSIONS_REACHED');

    expect((await daemon.closeSession('slot-a')).ok).toBe(true);
    expect((await daemon.openSession({ sessionId: 'slot-c' })).ok).toBe(true);
    expect(daemon.health().sessions.map((session) => session.sessionId)).toEqual(['slot-b', 'slot-c']);

    expect((await daemon.closeSession('slot-b')).ok).toBe(true);
    expect((await daemon.openSession({ sessionId: 'slot-a' })).ok).toBe(true);

    const finalHealth = daemon.health();
    expect(finalHealth.sessionCount).toBe(2);
    expect(finalHealth.sessions.map((session) => session.sessionId)).toEqual(['slot-a', 'slot-c']);
    expect(fake.calls.openSession).toBe(4);
    expect(fake.calls.closeSession).toBe(2);
  });

  it('keeps pause and kill gates fail-closed under repeated action sequences', async () => {
    const fake = createFakeSessionManager();
    const daemon = new BrowserRuntimeDaemon({
      maxSessions: 3,
      persistSessions: false,
      sessionManager: fake.manager,
    });

    await daemon.start();
    expect((await daemon.openSession({ sessionId: 'gate-1' })).ok).toBe(true);

    daemon.pause();

    const pausedResults = [];
    for (let index = 0; index < 3; index += 1) {
      pausedResults.push(await daemon.openSession({ sessionId: `paused-open-${index}` }));
      pausedResults.push(await daemon.navigate('gate-1', { url: `https://example.com/${index}` }));
      pausedResults.push(await daemon.click('gate-1', { selector: '#submit' }));
      pausedResults.push(await daemon.type('gate-1', { selector: '#input', text: `value-${index}` }));
      pausedResults.push(await daemon.snapshot('gate-1'));
      pausedResults.push(await daemon.screenshot('gate-1'));
    }

    expect(pausedResults.every((result) => !result.ok && result.error?.code === 'DAEMON_PAUSED')).toBe(true);
    expect((await daemon.closeSession('gate-1')).ok).toBe(true);

    daemon.resume();
    expect((await daemon.openSession({ sessionId: 'gate-1' })).ok).toBe(true);

    await daemon.kill();
    const killedResults = await Promise.all([
      daemon.openSession({ sessionId: 'post-kill-open' }),
      daemon.navigate('gate-1', { url: 'https://example.com/after-kill' }),
      daemon.closeSession('gate-1'),
    ]);

    expect(killedResults.every((result) => !result.ok && result.error?.code === 'DAEMON_STOPPED')).toBe(true);

    expect(fake.calls.openSession).toBe(2);
    expect(fake.calls.closeSession).toBe(2);
    expect(fake.calls.navigate).toBe(0);
    expect(fake.calls.click).toBe(0);
    expect(fake.calls.type).toBe(0);
    expect(fake.calls.snapshot).toBe(0);
    expect(fake.calls.screenshot).toBe(0);
  });

  it('cancels in-flight browser actions when kill is triggered', async () => {
    const fake = createFakeSessionManager({ navigateDelayMs: 200 });
    const daemon = new BrowserRuntimeDaemon({
      maxSessions: 1,
      persistSessions: false,
      sessionManager: fake.manager,
    });

    await daemon.start();
    expect((await daemon.openSession({ sessionId: 'cancel-1' })).ok).toBe(true);

    const pendingNavigate = daemon.navigate('cancel-1', { url: 'https://example.com/slow' });
    await new Promise((resolve) => setTimeout(resolve, 20));
    await daemon.kill();
    const result = await pendingNavigate;

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('ACTION_CANCELLED');
    expect(result.error?.retryable).toBe(false);
  });
});
