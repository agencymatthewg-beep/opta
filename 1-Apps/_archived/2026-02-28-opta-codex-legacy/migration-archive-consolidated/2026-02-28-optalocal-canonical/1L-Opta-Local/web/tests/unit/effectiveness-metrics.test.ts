import { describe, expect, it } from 'vitest';

import { computeEffectivenessMetrics } from '@/lib/learning/effectiveness-metrics';

describe('computeEffectivenessMetrics', () => {
  it('tracks success rate, retries, mttr, and recurring failure signatures', () => {
    const metrics = computeEffectivenessMetrics([
      {
        capability: '/v1/responses',
        status: 'success',
        durationMs: 400,
        retryCount: 0,
      },
      {
        capability: '/v1/responses',
        status: 'failed',
        durationMs: 1000,
        retryCount: 1,
        failureSignature: 'timeout',
      },
      {
        capability: '/v1/responses',
        status: 'failed',
        durationMs: 800,
        retryCount: 1,
        failureSignature: 'timeout',
      },
      {
        capability: '/v1/skills/echo/execute',
        status: 'success',
        durationMs: 200,
        retryCount: 0,
      },
    ]);

    const responsesMetric = metrics.find((m) => m.capability === '/v1/responses');
    expect(responsesMetric).toBeTruthy();
    expect(responsesMetric?.successRate).toBeCloseTo(1 / 3);
    expect(responsesMetric?.retryCount).toBe(2);
    expect(responsesMetric?.meanTimeToResolutionMs).toBeCloseTo((400 + 1000 + 800) / 3);
    expect(responsesMetric?.recurringFailureSignatures).toEqual(['timeout']);
  });
});

