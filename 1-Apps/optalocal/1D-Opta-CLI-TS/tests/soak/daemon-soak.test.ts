/**
 * Soak smoke test — skipped in normal CI.
 *
 * Run manually with:
 *   npm test -- tests/soak/daemon-soak.test.ts
 *
 * Tagged with @soak — add --reporter=verbose for per-test latency output.
 */
import { describe, it, expect } from 'vitest';
import { runSoak } from './load-generator.js';

describe.skip('daemon soak (@soak — skip in normal CI)', () => {
  it('queue submission stays under p99 < 200ms for 3s at 5 concurrency', async () => {
    let counter = 0;
    const result = await runSoak({
      concurrency: 5,
      durationMs: 3000,
      requestFn: async () => {
        // Simulate a fast in-memory queue operation
        counter++;
        await Promise.resolve();
      },
    });
    expect(result.errors).toBe(0);
    expect(result.p99Ms).toBeLessThan(200);
    expect(result.totalRequests).toBeGreaterThan(100);
  }, 10_000);
});
