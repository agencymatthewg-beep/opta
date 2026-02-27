import { describe, it, expect } from 'vitest';
import { estimateCost, formatCost } from '../../src/utils/pricing.js';

describe('estimateCost', () => {
  it('returns zero cost for local inference', () => {
    const cost = estimateCost(1000, 500, 'lmx');
    expect(cost.isLocal).toBe(true);
    expect(cost.totalCost).toBe(0);
    expect(cost.inputCost).toBe(0);
    expect(cost.outputCost).toBe(0);
  });

  it('calculates Anthropic Sonnet pricing', () => {
    // 1M input tokens at $3/M = $3, 1M output tokens at $15/M = $15
    const cost = estimateCost(1_000_000, 1_000_000, 'anthropic', 'claude-sonnet-4-5-20250929');
    expect(cost.isLocal).toBe(false);
    expect(cost.inputCost).toBeCloseTo(3);
    expect(cost.outputCost).toBeCloseTo(15);
    expect(cost.totalCost).toBeCloseTo(18);
  });

  it('uses default pricing for unknown Anthropic models', () => {
    const cost = estimateCost(1_000_000, 1_000_000, 'anthropic', 'claude-unknown-model');
    expect(cost.isLocal).toBe(false);
    // Default is Sonnet pricing: $3/M input, $15/M output
    expect(cost.inputCost).toBeCloseTo(3);
    expect(cost.outputCost).toBeCloseTo(15);
  });

  it('handles small token counts', () => {
    // 100 input tokens, 50 output tokens with Sonnet pricing
    const cost = estimateCost(100, 50, 'anthropic', 'claude-sonnet-4-5');
    expect(cost.totalCost).toBeGreaterThan(0);
    expect(cost.totalCost).toBeLessThan(0.01);
  });
});

describe('formatCost', () => {
  it('returns "Free" for local cost', () => {
    const cost = estimateCost(1000, 500, 'lmx');
    expect(formatCost(cost)).toBe('Free');
  });

  it('formats small costs with ~ or < prefix', () => {
    // 10 input + 5 output tokens at default Anthropic pricing:
    // (10/1M)*3 + (5/1M)*15 = 0.000105, which is > 0.0001
    const cost = estimateCost(10, 5, 'anthropic');
    expect(formatCost(cost)).toBe('~$0.0001');
  });

  it('formats very small costs with < prefix', () => {
    // 1 input + 1 output token: (1/1M)*3 + (1/1M)*15 = 0.000018
    const cost = estimateCost(1, 1, 'anthropic');
    expect(formatCost(cost)).toBe('<$0.0001');
  });

  it('formats normal costs with ~ prefix', () => {
    const cost = estimateCost(100_000, 50_000, 'anthropic');
    expect(formatCost(cost)).toMatch(/^~\$/);
  });
});
