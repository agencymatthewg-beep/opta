import { describe, it, expect } from 'vitest';
import { parseLineRange, extractFileRefParts } from '../../src/core/fileref.js';

describe('line range parsing', () => {
  it('should parse file:10-20 syntax', () => {
    const result = parseLineRange('src/agent.ts:10-20');
    expect(result).toEqual({ path: 'src/agent.ts', startLine: 10, endLine: 20 });
  });

  it('should parse file:10 single line', () => {
    const result = parseLineRange('src/agent.ts:10');
    expect(result).toEqual({ path: 'src/agent.ts', startLine: 10, endLine: 10 });
  });

  it('should return null for no line range', () => {
    const result = parseLineRange('src/agent.ts');
    expect(result).toEqual({ path: 'src/agent.ts', startLine: null, endLine: null });
  });

  it('should extract @file:range from message', () => {
    const parts = extractFileRefParts('@src/agent.ts:10-20');
    expect(parts).toEqual({ original: '@src/agent.ts:10-20', path: 'src/agent.ts', startLine: 10, endLine: 20 });
  });
});
