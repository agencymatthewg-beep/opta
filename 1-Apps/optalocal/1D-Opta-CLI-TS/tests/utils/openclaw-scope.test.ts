import { describe, expect, it } from 'vitest';
import { deriveOpenClawAgentId, normalizeOpenClawScope } from '../../src/utils/openclaw-scope.js';

describe('openclaw scope helpers', () => {
  it('normalizes non-empty scopes and rejects blank values', () => {
    expect(normalizeOpenClawScope('  telegram:dm:1001  ')).toBe('telegram:dm:1001');
    expect(normalizeOpenClawScope('   ')).toBeNull();
    expect(normalizeOpenClawScope(undefined)).toBeNull();
  });

  it('derives deterministic agent ids from scope strings', () => {
    const first = deriveOpenClawAgentId('telegram:dm:1001');
    const second = deriveOpenClawAgentId('telegram:dm:1001');
    const different = deriveOpenClawAgentId('telegram:dm:1002');

    expect(first).toBe(second);
    expect(different).not.toBe(first);
    expect(first).toMatch(/^opta-bridge-[a-f0-9]{24}$/);
  });
});
