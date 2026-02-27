import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_CONFIG, type OptaConfig } from '../../src/core/config.js';
import type { TurnErrorPayload } from '../../src/protocol/v3/types.js';

const storeMocks = {
  appendSessionEvent: vi.fn(async () => {}),
  hasSessionStore: vi.fn(async () => false),
  listStoredSessions: vi.fn(async () => []),
  readSessionEventsAfter: vi.fn(async () => []),
  readSessionSnapshot: vi.fn(async () => null),
  writeSessionSnapshot: vi.fn(async () => {}),
};

vi.mock('../../src/daemon/session-store.js', () => ({
  appendSessionEvent: storeMocks.appendSessionEvent,
  hasSessionStore: storeMocks.hasSessionStore,
  listStoredSessions: storeMocks.listStoredSessions,
  readSessionEventsAfter: storeMocks.readSessionEventsAfter,
  readSessionSnapshot: storeMocks.readSessionSnapshot,
  writeSessionSnapshot: storeMocks.writeSessionSnapshot,
}));

let lastSignal: AbortSignal | undefined;
const lmxModelsMock = vi.fn(async () => ({
  models: [{ model_id: 'minimax-m2.5', status: 'loaded' as const }],
}));

function abortError(): Error {
  const err = new Error('cancelled');
  err.name = 'AbortError';
  return err;
}

vi.mock('../../src/core/agent.js', () => ({
  agentLoop: vi.fn(async (_task: string, _config: unknown, options?: { signal?: AbortSignal }) => {
    const signal = options?.signal;
    lastSignal = signal;
    if (!signal) throw new Error('Expected abort signal');

    await new Promise<void>((_resolve, reject) => {
      if (signal.aborted) {
        reject(abortError());
        return;
      }
      signal.addEventListener('abort', () => reject(abortError()), { once: true });
      // Keep pending until cancelled.
    });
    return {
      messages: [],
      toolCallCount: 0,
    };
  }),
}));

vi.mock('../../src/lmx/client.js', () => ({
  LmxClient: vi.fn(() => ({
    models: lmxModelsMock,
  })),
}));

async function waitFor(predicate: () => boolean, timeoutMs = 200): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('Timed out waiting for condition');
}

function makeConfig(): OptaConfig {
  return {
    ...DEFAULT_CONFIG,
    model: {
      ...DEFAULT_CONFIG.model,
      default: 'minimax-m2.5',
    },
  };
}

describe('SessionManager cancellation', () => {
  beforeEach(() => {
    lastSignal = undefined;
    vi.clearAllMocks();
    lmxModelsMock.mockResolvedValue({
      models: [{ model_id: 'minimax-m2.5', status: 'loaded' as const }],
    });
  });

  it('aborts an active turn when cancelled by writer', async () => {
    const { SessionManager } = await import('../../src/daemon/session-manager.js');
    const manager = new SessionManager('daemon_test', async () => makeConfig());

    await manager.createSession({ sessionId: 'sess-1', model: 'minimax-m2.5' });
    const emitted: Array<{ event: string; payload: unknown }> = [];
    const unsubscribe = manager.subscribe('sess-1', (event) => {
      emitted.push({ event: event.event, payload: event.payload });
    });

    await manager.submitTurn('sess-1', {
      clientId: 'client-a',
      writerId: 'writer-a',
      content: 'hello',
      mode: 'chat',
    });

    await waitFor(() => !!lastSignal);
    expect(lastSignal?.aborted).toBe(false);

    const cancelled = await manager.cancelSessionTurns('sess-1', { writerId: 'writer-a' });
    expect(cancelled).toBe(1);
    expect(lastSignal?.aborted).toBe(true);
    await waitFor(() => emitted.some((e) => e.event === 'turn.error'));
    expect(emitted.some((e) => e.event === 'session.cancelled')).toBe(true);
    expect(emitted.some((e) => e.event === 'turn.error' && (e.payload as { message?: string }).message === 'Turn cancelled')).toBe(true);
    const turnErrorPayload = emitted.find((e) => e.event === 'turn.error')?.payload as TurnErrorPayload | undefined;
    expect(turnErrorPayload?.code).toBeUndefined();
    unsubscribe();
  });
});
