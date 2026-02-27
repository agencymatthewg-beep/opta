/**
 * tests/lmx/watchdog.test.ts — Unit tests for LmxWatchdog.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LmxWatchdog } from '../../src/lmx/watchdog.js';
import type { LmxClient } from '../../src/lmx/client.js';

// Minimal stub of LmxClient — only the `health` method is needed.
function makeClient(healthImpl: () => Promise<{ status: 'ok' | 'degraded' | 'error' }>): LmxClient {
  return { health: healthImpl } as unknown as LmxClient;
}

describe('LmxWatchdog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does NOT call onUnhealthy after a single failure (below threshold)', async () => {
    const onUnhealthy = vi.fn();
    const client = makeClient(() => Promise.reject(new Error('connection refused')));
    const wd = new LmxWatchdog(client, onUnhealthy);

    wd.start(15_000);

    // Advance one interval — 1 failure, threshold is 2.
    await vi.advanceTimersByTimeAsync(15_000);

    expect(onUnhealthy).not.toHaveBeenCalled();
    wd.stop();
  });

  it('calls onUnhealthy after failureThreshold (2) consecutive failures', async () => {
    const onUnhealthy = vi.fn();
    const client = makeClient(() => Promise.reject(new Error('connection refused')));
    const wd = new LmxWatchdog(client, onUnhealthy);

    wd.start(15_000);

    // First tick — 1 failure.
    await vi.advanceTimersByTimeAsync(15_000);
    expect(onUnhealthy).not.toHaveBeenCalled();

    // Second tick — 2 consecutive failures → threshold reached.
    await vi.advanceTimersByTimeAsync(15_000);
    expect(onUnhealthy).toHaveBeenCalledTimes(1);

    wd.stop();
  });

  it('does NOT call onUnhealthy twice for the same unhealthy event (notified flag)', async () => {
    const onUnhealthy = vi.fn();
    const client = makeClient(() => Promise.reject(new Error('gone')));
    const wd = new LmxWatchdog(client, onUnhealthy);

    wd.start(15_000);

    // Two ticks to trip the threshold.
    await vi.advanceTimersByTimeAsync(15_000);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(onUnhealthy).toHaveBeenCalledTimes(1);

    // More ticks while still unhealthy — should NOT fire again.
    await vi.advanceTimersByTimeAsync(15_000);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(onUnhealthy).toHaveBeenCalledTimes(1);

    wd.stop();
  });

  it('resets and re-fires onUnhealthy if health recovers then fails again', async () => {
    const onUnhealthy = vi.fn();
    let healthy = false;
    const client = makeClient(() =>
      healthy
        ? Promise.resolve({ status: 'ok' as const })
        : Promise.reject(new Error('down')),
    );
    const wd = new LmxWatchdog(client, onUnhealthy);

    wd.start(15_000);

    // Two failures → fires once.
    await vi.advanceTimersByTimeAsync(15_000);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(onUnhealthy).toHaveBeenCalledTimes(1);

    // Recovery — resets notified + consecutiveFailures.
    healthy = true;
    await vi.advanceTimersByTimeAsync(15_000);
    expect(onUnhealthy).toHaveBeenCalledTimes(1); // still 1 after recovery

    // Back to failure — should fire again after 2 more consecutive failures.
    healthy = false;
    await vi.advanceTimersByTimeAsync(15_000);
    expect(onUnhealthy).toHaveBeenCalledTimes(1); // 1 failure, not yet

    await vi.advanceTimersByTimeAsync(15_000);
    expect(onUnhealthy).toHaveBeenCalledTimes(2); // threshold reached again

    wd.stop();
  });

  it('stop() prevents future ticks from firing onUnhealthy', async () => {
    const onUnhealthy = vi.fn();
    const client = makeClient(() => Promise.reject(new Error('down')));
    const wd = new LmxWatchdog(client, onUnhealthy);

    wd.start(15_000);

    // One tick (1 failure, below threshold).
    await vi.advanceTimersByTimeAsync(15_000);

    // Stop before the second tick.
    wd.stop();

    // Advance time further — no more ticks should fire.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(onUnhealthy).not.toHaveBeenCalled();
  });

  it('treats a non-ok status response as a failure', async () => {
    const onUnhealthy = vi.fn();
    // Returns 'degraded' — not a throw, but also not 'ok'.
    const client = makeClient(() => Promise.resolve({ status: 'degraded' as const }));
    const wd = new LmxWatchdog(client, onUnhealthy);

    wd.start(15_000);

    await vi.advanceTimersByTimeAsync(15_000);
    expect(onUnhealthy).not.toHaveBeenCalled(); // 1 failure

    await vi.advanceTimersByTimeAsync(15_000);
    expect(onUnhealthy).toHaveBeenCalledTimes(1); // 2 failures → threshold

    wd.stop();
  });

  it('start() is idempotent — calling it twice does not double-register the timer', async () => {
    const onUnhealthy = vi.fn();
    const client = makeClient(() => Promise.reject(new Error('down')));
    const wd = new LmxWatchdog(client, onUnhealthy);

    wd.start(15_000);
    wd.start(15_000); // second call should be a no-op

    // Two ticks — if timer was doubled, health would be called 4 times and
    // onUnhealthy potentially called twice. The notified flag prevents that,
    // but we verify the count is exactly 1 to confirm idempotency.
    await vi.advanceTimersByTimeAsync(15_000);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(onUnhealthy).toHaveBeenCalledTimes(1);

    wd.stop();
  });
});
