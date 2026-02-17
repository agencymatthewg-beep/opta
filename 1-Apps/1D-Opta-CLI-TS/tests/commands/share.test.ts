import { describe, it, expect } from 'vitest';
import { formatSessionExport } from '../../src/commands/share.js';

describe('session export', () => {
  it('should export as markdown', () => {
    const result = formatSessionExport({
      id: 'test-123',
      model: 'Qwen2.5-72B',
      messages: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi there' },
      ],
    }, 'markdown');
    expect(result).toContain('# Opta CLI Session');
    expect(result).toContain('hello');
  });

  it('should export as JSON', () => {
    const result = formatSessionExport({
      id: 'test-123',
      model: 'Qwen2.5-72B',
      messages: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi there' },
      ],
    }, 'json');
    const parsed = JSON.parse(result);
    expect(parsed.id).toBe('test-123');
    expect(parsed.messages).toHaveLength(2);
  });

  it('should export as text', () => {
    const result = formatSessionExport({
      id: 'test-123',
      model: 'Qwen2.5-72B',
      messages: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi there' },
      ],
    }, 'text');
    expect(result).toContain('User: hello');
    expect(result).toContain('Assistant: hi there');
  });

  it('should filter out system messages', () => {
    const result = formatSessionExport({
      id: 'test-123',
      model: 'Qwen2.5-72B',
      messages: [
        { role: 'system', content: 'you are a helper' },
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi there' },
      ],
    }, 'json');
    const parsed = JSON.parse(result);
    expect(parsed.messages).toHaveLength(2);
    expect(parsed.messages[0].role).toBe('user');
  });
});
