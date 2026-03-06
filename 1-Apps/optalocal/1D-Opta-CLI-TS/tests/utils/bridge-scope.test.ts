import { describe, expect, it } from 'vitest';
import { deriveBridgeAgentId, normalizeBridgeScope } from '../../src/utils/bridge-scope.js';

describe('bridge scope helpers', () => {
  it('normalizes non-empty scopes and rejects blank values', () => {
    expect(normalizeBridgeScope('  telegram:dm:1001  ')).toBe('telegram:dm:1001');
    expect(normalizeBridgeScope('   ')).toBeNull();
    expect(normalizeBridgeScope(undefined)).toBeNull();
  });

  it('derives deterministic agent ids from scope strings', () => {
    const first = deriveBridgeAgentId('telegram:dm:1001');
    const second = deriveBridgeAgentId('telegram:dm:1001');
    const different = deriveBridgeAgentId('telegram:dm:1002');

    expect(first).toBe(second);
    expect(different).not.toBe(first);
    expect(first).toMatch(/^opta-bridge-[a-f0-9]{24}$/);
  });
});
