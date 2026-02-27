import { beforeEach, describe, expect, it, vi } from 'vitest';
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

const agentLoopMock = vi.fn(async () => ({
  messages: [{ role: 'assistant', content: 'ok' }],
  toolCallCount: 0,
}));

const lmxModelsMock = vi.fn(async () => ({
  models: [{ model_id: 'minimax-m2.5', status: 'loaded' as const }],
}));

vi.mock('../../src/daemon/session-store.js', () => ({
  appendSessionEvent: storeMocks.appendSessionEvent,
  hasSessionStore: storeMocks.hasSessionStore,
  listStoredSessions: storeMocks.listStoredSessions,
  readSessionEventsAfter: storeMocks.readSessionEventsAfter,
  readSessionSnapshot: storeMocks.readSessionSnapshot,
  writeSessionSnapshot: storeMocks.writeSessionSnapshot,
}));

vi.mock('../../src/core/agent.js', () => ({
  agentLoop: agentLoopMock,
}));

vi.mock('../../src/lmx/client.js', () => ({
  LmxClient: vi.fn(() => ({
    models: lmxModelsMock,
  })),
}));

async function waitFor(predicate: () => boolean, timeoutMs = 500): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('Timed out waiting for condition');
}

function getTurnErrorPayload(
  emitted: Array<{ event: string; payload: unknown }>
): TurnErrorPayload | undefined {
  return emitted.find((event) => event.event === 'turn.error')?.payload as TurnErrorPayload | undefined;
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

describe('SessionManager model preflight', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    agentLoopMock.mockResolvedValue({
      messages: [{ role: 'assistant', content: 'ok' }],
      toolCallCount: 0,
    });
    lmxModelsMock.mockResolvedValue({
      models: [{ model_id: 'minimax-m2.5', status: 'loaded' as const }],
    });
  });

  it('emits turn.error without starting a turn when no models are loaded', async () => {
    lmxModelsMock.mockResolvedValue({ models: [] });
    const { SessionManager } = await import('../../src/daemon/session-manager.js');
    const manager = new SessionManager('daemon_test', async () => makeConfig());

    await manager.createSession({ sessionId: 'sess-missing', model: 'minimax-m2.5' });

    const emitted: Array<{ event: string; payload: unknown }> = [];
    const unsubscribe = manager.subscribe('sess-missing', (event) => {
      emitted.push({ event: event.event, payload: event.payload });
    });

    await manager.submitTurn('sess-missing', {
      clientId: 'client-a',
      writerId: 'writer-a',
      content: 'hello',
      mode: 'chat',
    });

    await waitFor(() => emitted.some((event) => event.event === 'turn.error'));
    const errorPayload = getTurnErrorPayload(emitted);

    expect(errorPayload?.code).toBe('no-model-loaded');
    expect(errorPayload?.message).toContain('No Model Loaded - Use Opta Menu to begin');
    expect(emitted.some((event) => event.event === 'turn.start')).toBe(false);
    expect(agentLoopMock).not.toHaveBeenCalled();

    unsubscribe();
    await manager.close();
  });

  it('emits lmx-connection-refused code on preflight connection refusal', async () => {
    const err = new Error('connect ECONNREFUSED 127.0.0.1:1234') as Error & { code?: string };
    err.code = 'ECONNREFUSED';
    lmxModelsMock.mockRejectedValue(err);

    const { SessionManager } = await import('../../src/daemon/session-manager.js');
    const manager = new SessionManager('daemon_test', async () => makeConfig());

    await manager.createSession({ sessionId: 'sess-refused', model: 'minimax-m2.5' });
    const emitted: Array<{ event: string; payload: unknown }> = [];
    const unsubscribe = manager.subscribe('sess-refused', (event) => {
      emitted.push({ event: event.event, payload: event.payload });
    });

    await manager.submitTurn('sess-refused', {
      clientId: 'client-a',
      writerId: 'writer-a',
      content: 'hello',
      mode: 'chat',
    });

    await waitFor(() => emitted.some((event) => event.event === 'turn.error'));
    const errorPayload = getTurnErrorPayload(emitted);

    expect(errorPayload?.code).toBe('lmx-connection-refused');
    expect(errorPayload?.message).toContain('LMX preflight failed');
    expect(errorPayload?.message).toContain('ECONNREFUSED');
    expect(agentLoopMock).not.toHaveBeenCalled();

    unsubscribe();
    await manager.close();
  });

  it('emits lmx-timeout code on preflight timeout failures', async () => {
    const err = new Error('request timed out after 8000ms') as Error & { code?: string };
    err.code = 'ETIMEDOUT';
    lmxModelsMock.mockRejectedValue(err);

    const { SessionManager } = await import('../../src/daemon/session-manager.js');
    const manager = new SessionManager('daemon_test', async () => makeConfig());

    await manager.createSession({ sessionId: 'sess-timeout', model: 'minimax-m2.5' });
    const emitted: Array<{ event: string; payload: unknown }> = [];
    const unsubscribe = manager.subscribe('sess-timeout', (event) => {
      emitted.push({ event: event.event, payload: event.payload });
    });

    await manager.submitTurn('sess-timeout', {
      clientId: 'client-a',
      writerId: 'writer-a',
      content: 'hello',
      mode: 'chat',
    });

    await waitFor(() => emitted.some((event) => event.event === 'turn.error'));
    const errorPayload = getTurnErrorPayload(emitted);

    expect(errorPayload?.code).toBe('lmx-timeout');
    expect(errorPayload?.message).toContain('LMX preflight failed');
    expect(agentLoopMock).not.toHaveBeenCalled();

    unsubscribe();
    await manager.close();
  });

  it('emits lmx-ws-closed code on preflight websocket closures', async () => {
    const err = new Error('websocket closed unexpectedly');
    lmxModelsMock.mockRejectedValue(err);

    const { SessionManager } = await import('../../src/daemon/session-manager.js');
    const manager = new SessionManager('daemon_test', async () => makeConfig());

    await manager.createSession({ sessionId: 'sess-ws-closed', model: 'minimax-m2.5' });
    const emitted: Array<{ event: string; payload: unknown }> = [];
    const unsubscribe = manager.subscribe('sess-ws-closed', (event) => {
      emitted.push({ event: event.event, payload: event.payload });
    });

    await manager.submitTurn('sess-ws-closed', {
      clientId: 'client-a',
      writerId: 'writer-a',
      content: 'hello',
      mode: 'chat',
    });

    await waitFor(() => emitted.some((event) => event.event === 'turn.error'));
    const errorPayload = getTurnErrorPayload(emitted);

    expect(errorPayload?.code).toBe('lmx-ws-closed');
    expect(errorPayload?.message).toContain('LMX preflight failed');
    expect(agentLoopMock).not.toHaveBeenCalled();

    unsubscribe();
    await manager.close();
  });

  it('runs normally when model is loaded and persists canonical model id', async () => {
    lmxModelsMock.mockResolvedValue({
      models: [{ model_id: 'minimax/MiniMax-M2.5', status: 'loaded' as const }],
    });

    const { SessionManager } = await import('../../src/daemon/session-manager.js');
    const manager = new SessionManager('daemon_test', async () => makeConfig());

    await manager.createSession({ sessionId: 'sess-loaded', model: 'minimax-m2.5' });

    const emitted: string[] = [];
    const unsubscribe = manager.subscribe('sess-loaded', (event) => {
      emitted.push(event.event);
    });

    await manager.submitTurn('sess-loaded', {
      clientId: 'client-a',
      writerId: 'writer-a',
      content: 'hello',
      mode: 'chat',
    });

    await waitFor(() => emitted.includes('turn.done'));

    expect(emitted).toContain('turn.start');
    expect(emitted).toContain('turn.done');
    expect(agentLoopMock).toHaveBeenCalledTimes(1);

    const snapshot = await manager.getSession('sess-loaded');
    expect(snapshot?.model).toBe('minimax/MiniMax-M2.5');

    const persistedModels = storeMocks.writeSessionSnapshot.mock.calls.map((call) => {
      const snapshotArg = call[0] as { model: string };
      return snapshotArg.model;
    });
    expect(persistedModels).toContain('minimax/MiniMax-M2.5');

    unsubscribe();
    await manager.close();
  });
});
