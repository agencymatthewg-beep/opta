import { describe, it, expect } from 'vitest';
import { connectToProvider } from '../../src/providers/manager.js';
import { OptaError } from '../../src/core/errors.js';

describe('connectToProvider', () => {
  it('throws OptaError with actionable message when host is unreachable', async () => {
    try {
      await connectToProvider('127.0.0.1', 19999);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(OptaError);
      const optaErr = err as OptaError;
      expect(optaErr.message).toContain('Cannot reach LM Studio');
      expect(optaErr.code).toBe(3); // EXIT.NO_CONNECTION
      expect(optaErr.causes).toBeDefined();
      expect(optaErr.suggestions).toBeDefined();
      expect(optaErr.suggestions?.some((s) => s.includes('ping'))).toBe(true);
    }
  }, 5000);
});
