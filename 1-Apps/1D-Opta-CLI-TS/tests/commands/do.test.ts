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

  it('should include error field in JSON output on failure', () => {
    const result: DoResult = {
      response: '',
      toolCallCount: 0,
      model: 'Qwen2.5-72B',
      exitCode: 3,
      error: 'No model configured',
    };
    const json = formatDoResult(result, 'json');
    const parsed = JSON.parse(json);
    expect(parsed.error).toBe('No model configured');
    expect(parsed.exit_code).toBe(3);
  });

  it('should omit error field in JSON output on success', () => {
    const result: DoResult = {
      response: 'All done.',
      toolCallCount: 1,
      model: 'Qwen2.5-72B',
      exitCode: 0,
    };
    const json = formatDoResult(result, 'json');
    const parsed = JSON.parse(json);
    expect(parsed).not.toHaveProperty('error');
  });

  it('JSON output must contain no ANSI escape codes', () => {
    const result: DoResult = {
      response: 'Fixed the bug in auth.ts',
      toolCallCount: 5,
      model: 'Qwen2.5-72B',
      exitCode: 0,
    };
    const json = formatDoResult(result, 'json');

    // No ANSI escape sequences
    // eslint-disable-next-line no-control-regex
    expect(json).not.toMatch(/\x1b\[/);

    // Must be valid parseable JSON
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('JSON output has all required fields from spec', () => {
    const result: DoResult = {
      response: 'Task complete.',
      toolCallCount: 7,
      model: 'DeepSeek-R1-70B',
      exitCode: 0,
    };
    const json = formatDoResult(result, 'json');
    const parsed = JSON.parse(json);

    // Spec: { result, tool_calls, model, exit_code }
    expect(parsed).toHaveProperty('result');
    expect(parsed).toHaveProperty('tool_calls');
    expect(parsed).toHaveProperty('model');
    expect(parsed).toHaveProperty('exit_code');
    expect(typeof parsed.result).toBe('string');
    expect(typeof parsed.tool_calls).toBe('number');
    expect(typeof parsed.model).toBe('string');
    expect(typeof parsed.exit_code).toBe('number');
  });
});
