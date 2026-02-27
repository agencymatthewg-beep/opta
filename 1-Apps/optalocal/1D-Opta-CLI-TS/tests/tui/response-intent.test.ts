import { describe, expect, it } from 'vitest';
import {
  deriveResponseIntentOutcome,
  deriveResponseIntentSentence,
  isResponseIntentTone,
} from '../../src/tui/response-intent.js';

describe('response-intent', () => {
  it('builds verified technical intent without echoing raw prompt text', () => {
    const intent = deriveResponseIntentSentence({
      promptText: 'Investigate LMX crash and secret=abcd1234',
      tone: 'technical',
      toolCallCount: 2,
      failedToolCallCount: 0,
      hasVisibleOutput: true,
    });

    expect(intent).toContain('evidence verified');
    expect(intent).not.toContain('abcd1234');
    expect(intent).not.toContain('Investigate LMX crash');
  });

  it('builds concise direct intent when no tools ran', () => {
    const intent = deriveResponseIntentSentence({
      promptText: 'Explain this output',
      tone: 'concise',
      toolCallCount: 0,
      failedToolCallCount: 0,
      hasVisibleOutput: true,
    });

    expect(intent).toBe('Completed an explanation task.');
  });

  it('builds partial product intent when tools fail', () => {
    const intent = deriveResponseIntentSentence({
      promptText: 'Fix benchmark regressions',
      tone: 'product',
      toolCallCount: 3,
      failedToolCallCount: 1,
      hasVisibleOutput: true,
    });

    expect(intent).toContain('partial evidence');
    expect(intent).toContain('(1/3 tool calls failed)');
  });

  it('classifies slash commands without quoting input', () => {
    const intent = deriveResponseIntentSentence({
      promptText: '/browser trends 24 10',
      tone: 'technical',
      toolCallCount: 1,
      failedToolCallCount: 0,
      hasVisibleOutput: true,
    });

    expect(intent).toContain('slash command task');
    expect(intent).not.toContain('/browser trends 24 10');
  });

  it('validates tone values and derives outcomes', () => {
    expect(isResponseIntentTone('technical')).toBe(true);
    expect(isResponseIntentTone('casual')).toBe(false);

    expect(deriveResponseIntentOutcome({
      toolCallCount: 0,
      failedToolCallCount: 0,
      hasVisibleOutput: true,
    })).toBe('direct');

    expect(deriveResponseIntentOutcome({
      toolCallCount: 2,
      failedToolCallCount: 0,
      hasVisibleOutput: true,
    })).toBe('verified');

    expect(deriveResponseIntentOutcome({
      toolCallCount: 2,
      failedToolCallCount: 1,
      hasVisibleOutput: true,
    })).toBe('partial');
  });
});
