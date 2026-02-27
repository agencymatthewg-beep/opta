import { describe, it, expect } from 'vitest';
import { errorMessage } from '../../src/utils/errors.js';

describe('errorMessage', () => {
  it('extracts message from Error instance', () => {
    expect(errorMessage(new Error('fail'))).toBe('fail');
  });
  it('converts non-Error to string', () => {
    expect(errorMessage('raw string')).toBe('raw string');
    expect(errorMessage(42)).toBe('42');
    expect(errorMessage(null)).toBe('null');
    expect(errorMessage(undefined)).toBe('undefined');
  });
  it('handles Error subclasses', () => {
    expect(errorMessage(new TypeError('type fail'))).toBe('type fail');
  });
});
