import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG, type OptaConfig } from '../../src/core/config.js';

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

async function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
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

describe('SessionManager background events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emits and persists background.output/background.status events', async () => {
    const { SessionManager } = await import('../../src/daemon/session-manager.js');
    const manager = new SessionManager('daemon_test', async () => makeConfig());

    await manager.createSession({ sessionId: 'sess-bg', model: 'minimax-m2.5' });

    const emitted: string[] = [];
    const unsubscribe = manager.subscribe('sess-bg', (event) => {
      emitted.push(event.event);
    });

    const process = await manager.startBackgroundProcess({
      sessionId: 'sess-bg',
      command: 'node -e "console.log(\'bg-ok\')"',
    });

    await waitFor(() => emitted.includes('background.output') && emitted.includes('background.status'));
    await waitFor(() => {
      const status = manager.getBackgroundStatus(process.processId);
      return !!status && status.state !== 'running';
    });

    const output = manager.getBackgroundOutput(process.processId, {
      afterSeq: 0,
      limit: 20,
      stream: 'both',
    });
    expect(output?.chunks.some((chunk) => chunk.text.includes('bg-ok'))).toBe(true);

    const persistedEvents = storeMocks.appendSessionEvent.mock.calls
      .map((call) => call[1] as { event?: string })
      .map((envelope) => envelope.event);

    expect(persistedEvents).toContain('background.output');
    expect(persistedEvents).toContain('background.status');

    unsubscribe();
    await manager.close();
  });
});
