import { describe, it, expect } from 'vitest';
import type { AgentMessage, ContentPart } from '../../src/core/agent.js';

describe('multimodal message format', () => {
  it('accepts string content', () => {
    const msg: AgentMessage = { role: 'user', content: 'hello' };
    expect(msg.content).toBe('hello');
  });

  it('accepts content array with text and image', () => {
    const parts: ContentPart[] = [
      { type: 'text', text: 'What is this?' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,abc' } },
    ];
    const msg: AgentMessage = { role: 'user', content: parts };
    expect(Array.isArray(msg.content)).toBe(true);
    expect((msg.content as ContentPart[])[0]!.type).toBe('text');
  });

  it('accepts null content', () => {
    const msg: AgentMessage = { role: 'assistant', content: null };
    expect(msg.content).toBeNull();
  });
});
