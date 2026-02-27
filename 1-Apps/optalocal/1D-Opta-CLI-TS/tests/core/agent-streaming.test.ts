import { describe, it, expect } from 'vitest';
import { collectStream } from '../../src/core/agent-streaming.js';

describe('collectStream', () => {
  it('sanitizes streamed token content before emitting and storing', async () => {
    const stream = (async function* () {
      yield {
        choices: [
          {
            delta: { content: '\u001B[35mHello\u001B[0m\u0007' },
            finish_reason: null,
          },
        ],
      };
      yield {
        choices: [
          {
            delta: {},
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 2 },
      };
    })();

    const visible: string[] = [];
    const result = await collectStream(
      stream as AsyncIterable<any>,
      (chunk) => visible.push(chunk),
    );

    expect(visible.join('')).toBe('Hello');
    expect(result.text).toBe('Hello');
    expect(result.usage).toEqual({ promptTokens: 1, completionTokens: 2 });
    expect(result.finishReason).toBe('stop');
  });
});
