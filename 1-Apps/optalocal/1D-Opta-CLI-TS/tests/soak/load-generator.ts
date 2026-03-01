/**
 * Soak test load generator utility.
 *
 * Runs a user-supplied async function concurrently for a fixed duration,
 * collects per-request latencies, and returns aggregated statistics.
 * Import this from daemon-soak.test.ts and any future soak tests.
 */

export interface SoakConfig {
  concurrency: number;
  durationMs: number;
  requestFn: () => Promise<void>;
}

export interface SoakResult {
  totalRequests: number;
  errors: number;
  p50Ms: number;
  p99Ms: number;
  throughputRps: number;
}

export async function runSoak(config: SoakConfig): Promise<SoakResult> {
  const latencies: number[] = [];
  let errors = 0;
  const end = Date.now() + config.durationMs;

  async function worker(): Promise<void> {
    while (Date.now() < end) {
      const start = Date.now();
      try {
        await config.requestFn();
        latencies.push(Date.now() - start);
      } catch {
        errors++;
      }
    }
  }

  await Promise.all(Array.from({ length: config.concurrency }, worker));

  const sorted = [...latencies].sort((a, b) => a - b);
  const p = (pct: number) =>
    sorted[Math.floor((pct / 100) * (sorted.length - 1))] ?? 0;

  return {
    totalRequests: latencies.length + errors,
    errors,
    p50Ms: p(50),
    p99Ms: p(99),
    throughputRps: (latencies.length + errors) / (config.durationMs / 1000),
  };
}
