import { describe, it, expect } from 'vitest';
import { maskOldObservations } from '../../src/core/context.js';
import type { AgentMessage } from '../../src/core/agent.js';

describe('maskOldObservations', () => {
  it('masks tool results beyond window size', () => {
    const messages: AgentMessage[] = [
      { role: 'system', content: 'You are Opta' },
      { role: 'user', content: 'Read the file' },
      { role: 'assistant', content: null, tool_calls: [{ id: 't1', type: 'function', function: { name: 'read_file', arguments: '{"path":"a.ts"}' } }] },
      { role: 'tool', content: 'A'.repeat(500), tool_call_id: 't1' },
      { role: 'user', content: 'Read another' },
      { role: 'assistant', content: null, tool_calls: [{ id: 't2', type: 'function', function: { name: 'read_file', arguments: '{"path":"b.ts"}' } }] },
      { role: 'tool', content: 'B'.repeat(500), tool_call_id: 't2' },
      { role: 'user', content: 'Read one more' },
      { role: 'assistant', content: null, tool_calls: [{ id: 't3', type: 'function', function: { name: 'read_file', arguments: '{"path":"c.ts"}' } }] },
      { role: 'tool', content: 'C'.repeat(500), tool_call_id: 't3' },
    ];

    const masked = maskOldObservations(messages, 2); // keep last 2 tool results

    // First tool result should be masked
    expect(masked[3]!.content).toContain('[Tool result truncated');
    expect(masked[3]!.content!.length).toBeLessThan(200);

    // Last 2 tool results should be preserved
    expect(masked[6]!.content).toBe('B'.repeat(500));
    expect(masked[9]!.content).toBe('C'.repeat(500));
  });

  it('preserves short tool results even outside window', () => {
    const messages: AgentMessage[] = [
      { role: 'system', content: 'You are Opta' },
      { role: 'assistant', content: null, tool_calls: [{ id: 't1', type: 'function', function: { name: 'edit_file', arguments: '{}' } }] },
      { role: 'tool', content: 'File edited: a.ts', tool_call_id: 't1' },
      { role: 'assistant', content: null, tool_calls: [{ id: 't2', type: 'function', function: { name: 'read_file', arguments: '{}' } }] },
      { role: 'tool', content: 'D'.repeat(500), tool_call_id: 't2' },
    ];

    const masked = maskOldObservations(messages, 1);

    // Short result preserved (under 200 chars)
    expect(masked[2]!.content).toBe('File edited: a.ts');
    // Last tool result in window preserved
    expect(masked[4]!.content).toBe('D'.repeat(500));
  });

  it('returns unchanged messages when fewer tool results than window', () => {
    const messages: AgentMessage[] = [
      { role: 'system', content: 'You are Opta' },
      { role: 'tool', content: 'X'.repeat(500), tool_call_id: 't1' },
    ];

    const masked = maskOldObservations(messages, 4);
    expect(masked[1]!.content).toBe('X'.repeat(500));
  });
});
