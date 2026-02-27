import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BackgroundManager, type BackgroundManagerEvent } from '../../src/daemon/background-manager.js';

async function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Timed out waiting for condition');
}

describe('BackgroundManager', () => {
  let manager: BackgroundManager;

  beforeEach(() => {
    manager = new BackgroundManager({
      maxConcurrent: 4,
      defaultTimeout: 5_000,
      maxBufferSize: 16_384,
    });
  });

  afterEach(async () => {
    await manager.close('SIGKILL');
  });

  it('captures stdout/stderr output and terminal status', async () => {
    const events: BackgroundManagerEvent[] = [];
    const unsubscribe = manager.subscribe((event) => {
      events.push(event);
    });

    const started = await manager.start({
      sessionId: 'sess-1',
      command: 'node -e "console.log(\'alpha\'); console.error(\'omega\')"',
    });

    await waitFor(() => {
      const status = manager.status(started.processId);
      return !!status && status.state !== 'running';
    });

    const status = manager.status(started.processId);
    expect(status?.state).toBe('completed');

    const output = manager.output(started.processId, {
      afterSeq: 0,
      limit: 20,
      stream: 'both',
    });

    expect(output?.chunks.some((chunk) => chunk.stream === 'stdout' && chunk.text.includes('alpha'))).toBe(true);
    expect(output?.chunks.some((chunk) => chunk.stream === 'stderr' && chunk.text.includes('omega'))).toBe(true);
    expect(events.some((event) => event.type === 'status' && event.payload.reason === 'started')).toBe(true);
    expect(events.some((event) => event.type === 'output')).toBe(true);
    unsubscribe();
  });

  it('kills a running process', async () => {
    const started = await manager.start({
      sessionId: 'sess-1',
      command: 'node -e "setInterval(() => {}, 1000)"',
      timeoutMs: 0,
    });

    const killResult = await manager.kill(started.processId, 'SIGTERM');
    expect(killResult?.killed).toBe(true);

    await waitFor(() => {
      const status = manager.status(started.processId);
      return !!status && status.state !== 'running';
    });

    expect(manager.status(started.processId)?.state).toBe('killed');
  });
});
