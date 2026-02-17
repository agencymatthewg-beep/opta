import { describe, it, expect } from 'vitest';
import { OptaError, EXIT, formatError, ensureModel } from '../../src/core/errors.js';

describe('errors', () => {
  it('defines POSIX-compatible exit codes', () => {
    expect(EXIT.SUCCESS).toBe(0);
    expect(EXIT.ERROR).toBe(1);
    expect(EXIT.MISUSE).toBe(2);
    expect(EXIT.SIGINT).toBe(130);
  });

  it('creates OptaError with all fields', () => {
    const err = new OptaError(
      'Something went wrong',
      EXIT.NO_CONNECTION,
      ['cause one', 'cause two'],
      ['try this', 'try that']
    );
    expect(err.message).toBe('Something went wrong');
    expect(err.code).toBe(3);
    expect(err.causes).toHaveLength(2);
    expect(err.suggestions).toHaveLength(2);
    expect(err.name).toBe('OptaError');
  });

  it('formats error with context-problem-solution pattern', () => {
    const err = new OptaError(
      'Cannot connect',
      EXIT.NO_CONNECTION,
      ['Server is down'],
      ['Check the server']
    );
    const formatted = formatError(err);
    expect(formatted).toContain('Cannot connect');
    expect(formatted).toContain('Server is down');
    expect(formatted).toContain('Check the server');
    expect(formatted).toContain('Try:');
  });

  it('formats error without causes/suggestions', () => {
    const err = new OptaError('Simple error');
    const formatted = formatError(err);
    expect(formatted).toContain('Simple error');
    expect(formatted).not.toContain('Try:');
  });
});

describe('ensureModel', () => {
  it('does not throw when model is provided', () => {
    expect(() => ensureModel('qwen2.5-72b')).not.toThrow();
  });

  it('throws OptaError when model is undefined', () => {
    expect(() => ensureModel(undefined)).toThrow(OptaError);
  });

  it('throws with NO_CONNECTION exit code', () => {
    try {
      ensureModel(undefined);
    } catch (err) {
      expect(err).toBeInstanceOf(OptaError);
      expect((err as OptaError).code).toBe(EXIT.NO_CONNECTION);
    }
  });

  it('throws with actionable suggestions', () => {
    try {
      ensureModel(undefined);
    } catch (err) {
      expect((err as OptaError).suggestions).toBeDefined();
      expect((err as OptaError).suggestions!.length).toBeGreaterThan(0);
      expect((err as OptaError).suggestions!.join(' ')).toContain('opta connect');
    }
  });

  it('throws when model is empty string', () => {
    // Empty string is falsy, should be caught
    expect(() => ensureModel('')).toThrow(OptaError);
  });
});
