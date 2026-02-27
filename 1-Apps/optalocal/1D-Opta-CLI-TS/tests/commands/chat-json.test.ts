import { describe, it, expect } from 'vitest';
import { formatChatJsonLine } from '../../src/commands/chat.js';
import type { AgentMessage } from '../../src/core/agent.js';

describe('chat JSON output (JSONL)', () => {
  it('should format assistant text message as JSONL', () => {
    const messages: AgentMessage[] = [
      { role: 'system', content: 'You are Opta.' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ];

    const line = formatChatJsonLine(messages);
    const parsed = JSON.parse(line);

    expect(parsed.role).toBe('assistant');
    expect(parsed.content).toBe('Hi there!');
    expect(parsed.tool_calls).toEqual([]);
  });

  it('should include tool_calls in JSONL output', () => {
    const messages: AgentMessage[] = [
      { role: 'system', content: 'You are Opta.' },
      { role: 'user', content: 'Read the file' },
      {
        role: 'assistant',
        content: 'Let me read that file.',
        tool_calls: [
          {
            id: 'call_123',
            type: 'function',
            function: { name: 'read_file', arguments: '{"path": "test.ts"}' },
          },
        ],
      },
    ];

    const line = formatChatJsonLine(messages);
    const parsed = JSON.parse(line);

    expect(parsed.role).toBe('assistant');
    expect(parsed.content).toBe('Let me read that file.');
    expect(parsed.tool_calls).toHaveLength(1);
    expect(parsed.tool_calls[0].function.name).toBe('read_file');
  });

  it('should handle empty messages array gracefully', () => {
    const messages: AgentMessage[] = [];
    const line = formatChatJsonLine(messages);
    const parsed = JSON.parse(line);

    expect(parsed.role).toBe('assistant');
    expect(parsed.content).toBe('');
    expect(parsed.tool_calls).toEqual([]);
  });

  it('should use the LAST assistant message', () => {
    const messages: AgentMessage[] = [
      { role: 'system', content: 'You are Opta.' },
      { role: 'user', content: 'First question' },
      { role: 'assistant', content: 'First answer' },
      { role: 'user', content: 'Second question' },
      { role: 'assistant', content: 'Second answer' },
    ];

    const line = formatChatJsonLine(messages);
    const parsed = JSON.parse(line);

    expect(parsed.content).toBe('Second answer');
  });

  it('should output valid JSON with no trailing commas or escape codes', () => {
    const messages: AgentMessage[] = [
      { role: 'assistant', content: 'Response with "quotes" and special chars: <>&' },
    ];

    const line = formatChatJsonLine(messages);

    // Must be valid JSON
    expect(() => JSON.parse(line)).not.toThrow();

    // No ANSI escape codes
    // eslint-disable-next-line no-control-regex
    expect(line).not.toMatch(/\x1b\[/);
  });
});
