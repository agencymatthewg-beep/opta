import { describe, it, expect } from 'vitest';
import { parseDoOutput, formatDoResult, type DoResult } from '../../src/commands/do.js';

describe('non-interactive mode (opta do)', () => {
  it('should format result as JSON', () => {
    const result: DoResult = {
      response: 'Done fixing the bug.',
      toolCallCount: 3,
      model: 'Qwen2.5-72B',
      exitCode: 0,
    };
    const json = formatDoResult(result, 'json');
    const parsed = JSON.parse(json);
    expect(parsed.result).toBe('Done fixing the bug.');
    expect(parsed.tool_calls).toBe(3);
    expect(parsed.model).toBe('Qwen2.5-72B');
    expect(parsed.exit_code).toBe(0);
  });

  it('should format result as text', () => {
    const result: DoResult = {
      response: 'Done fixing the bug.',
      toolCallCount: 3,
      model: 'Qwen2.5-72B',
      exitCode: 0,
    };
    const text = formatDoResult(result, 'text');
    expect(text).toBe('Done fixing the bug.');
  });

  it('should format result as quiet (empty for success)', () => {
    const result: DoResult = {
      response: 'Done fixing the bug.',
      toolCallCount: 3,
      model: 'Qwen2.5-72B',
      exitCode: 0,
    };
    const quiet = formatDoResult(result, 'quiet');
    expect(quiet).toBe('');
  });

  it('should include error in quiet mode on failure', () => {
    const result: DoResult = {
      response: '',
      toolCallCount: 0,
      model: 'Qwen2.5-72B',
      exitCode: 1,
      error: 'Connection failed',
    };
    const quiet = formatDoResult(result, 'quiet');
    expect(quiet).toContain('Connection failed');
  });

  it('should parse valid output options', () => {
    const result = parseDoOutput({ format: 'json', quiet: false, output: undefined });
    expect(result).toBe('json');
  });

  it('should return quiet when quiet flag is set', () => {
    const result = parseDoOutput({ format: undefined, quiet: true, output: undefined });
    expect(result).toBe('quiet');
  });

  it('should default to text format', () => {
    const result = parseDoOutput({ format: undefined, quiet: false, output: undefined });
    expect(result).toBe('text');
  });

  it('should prioritize --quiet over --format', () => {
    const result = parseDoOutput({ format: 'json', quiet: true, output: undefined });
    expect(result).toBe('quiet');
  });
});
