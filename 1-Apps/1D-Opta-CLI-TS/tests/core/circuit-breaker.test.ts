import { describe, it, expect } from 'vitest';
import { OptaConfigSchema } from '../../src/core/config.js';

describe('circuit breaker config', () => {
  it('has progressive defaults', () => {
    const config = OptaConfigSchema.parse({});
    expect(config.safety.circuitBreaker.warnAt).toBe(20);
    expect(config.safety.circuitBreaker.pauseAt).toBe(40);
    expect(config.safety.circuitBreaker.hardStopAt).toBe(100);
  });

  it('accepts custom thresholds', () => {
    const config = OptaConfigSchema.parse({
      safety: { circuitBreaker: { pauseAt: 10, hardStopAt: 50 } },
    });
    expect(config.safety.circuitBreaker.pauseAt).toBe(10);
    expect(config.safety.circuitBreaker.hardStopAt).toBe(50);
  });

  it('backward-compat: maxToolCalls still accepted', () => {
    const config = OptaConfigSchema.parse({
      safety: { maxToolCalls: 25 },
    });
    expect(config.safety.maxToolCalls).toBe(25);
  });
});
