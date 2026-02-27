import { describe, it, expect } from 'vitest';
import { estimateTokens, estimateMessageTokens, formatTokens } from '../../src/utils/tokens.js';

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('returns 1 for 1-4 chars', () => {
    expect(estimateTokens('a')).toBe(1);
    expect(estimateTokens('ab')).toBe(1);
    expect(estimateTokens('abc')).toBe(1);
    expect(estimateTokens('abcd')).toBe(1);
  });

  it('rounds up for partial tokens', () => {
    expect(estimateTokens('abcde')).toBe(2); // 5 chars -> ceil(5/4) = 2
    expect(estimateTokens('abcdefg')).toBe(2); // 7 chars -> ceil(7/4) = 2
  });

  it('handles longer text', () => {
    const text = 'a'.repeat(100);
    expect(estimateTokens(text)).toBe(25);
  });

  it('handles 1000 chars', () => {
    const text = 'x'.repeat(1000);
    expect(estimateTokens(text)).toBe(250);
  });
});

describe('estimateMessageTokens', () => {
  it('returns 0 for empty messages array', () => {
    expect(estimateMessageTokens([])).toBe(0);
  });

  it('sums content tokens from multiple messages', () => {
    const messages = [
      { role: 'user', content: 'abcd' },       // 1 token
      { role: 'assistant', content: 'abcdefgh' }, // 2 tokens
    ];
    expect(estimateMessageTokens(messages)).toBe(3);
  });

  it('handles null/undefined content', () => {
    const messages = [
      { role: 'assistant', content: null },
      { role: 'assistant' },
    ];
    expect(estimateMessageTokens(messages)).toBe(0);
  });

  it('accounts for tool_calls JSON overhead', () => {
    const toolCalls = [{ id: 'call_1', function: { name: 'read_file', arguments: '{"path":"/a"}' } }];
    const messages = [
      { role: 'assistant', content: 'text', tool_calls: toolCalls },
    ];
    const result = estimateMessageTokens(messages);
    const expectedContent = estimateTokens('text');
    const expectedToolCalls = estimateTokens(JSON.stringify(toolCalls));
    expect(result).toBe(expectedContent + expectedToolCalls);
  });

  it('skips tool_calls overhead when not present', () => {
    const messages = [
      { role: 'user', content: 'hello world' },
    ];
    expect(estimateMessageTokens(messages)).toBe(estimateTokens('hello world'));
  });
});

describe('formatTokens', () => {
  it('returns raw number below 1000', () => {
    expect(formatTokens(0)).toBe('0');
    expect(formatTokens(1)).toBe('1');
    expect(formatTokens(500)).toBe('500');
    expect(formatTokens(999)).toBe('999');
  });

  it('formats with one decimal at 1000', () => {
    expect(formatTokens(1000)).toBe('1.0K');
  });

  it('formats with one decimal between 1000 and 100000', () => {
    expect(formatTokens(1500)).toBe('1.5K');
    expect(formatTokens(10000)).toBe('10.0K');
    expect(formatTokens(99999)).toBe('100.0K');
  });

  it('formats without decimal at 100000+', () => {
    expect(formatTokens(100000)).toBe('100K');
    expect(formatTokens(200000)).toBe('200K');
    expect(formatTokens(1000000)).toBe('1000K');
  });
});
