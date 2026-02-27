import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { ThinkingBlock } from '../../src/tui/ThinkingBlock.js';

describe('ThinkingBlock', () => {
  it('should render nothing when text is empty', () => {
    const { lastFrame } = render(
      <ThinkingBlock text="" expanded={false} tokenCount={0} />
    );
    expect(lastFrame()).toBe('');
  });

  it('should show token count in collapsed mode', () => {
    const { lastFrame } = render(
      <ThinkingBlock text="Let me think about this problem carefully." expanded={false} tokenCount={42} />
    );
    const output = lastFrame();
    expect(output).toContain('thinking');
    expect(output).toContain('42');
    expect(output).toContain('tokens');
    expect(output).toContain('Ctrl+T');
  });

  it('should estimate tokens when tokenCount is not provided', () => {
    // "Hello world" = 11 chars, ceil(11/4) = 3 tokens
    const { lastFrame } = render(
      <ThinkingBlock text="Hello world" expanded={false} />
    );
    const output = lastFrame();
    expect(output).toContain('3');
    expect(output).toContain('tokens');
  });

  it('should show full thinking text in expanded mode', () => {
    const thinkingText = 'First I need to check the file.\nThen I will analyze the output.';
    const { lastFrame } = render(
      <ThinkingBlock text={thinkingText} expanded={true} tokenCount={20} />
    );
    const output = lastFrame();
    expect(output).toContain('First I need to check the file.');
    expect(output).toContain('Then I will analyze the output.');
    expect(output).toContain('20');
    expect(output).toContain('tokens');
  });

  it('should show border prefix in expanded mode', () => {
    const { lastFrame } = render(
      <ThinkingBlock text="Some thinking content" expanded={true} tokenCount={10} />
    );
    const output = lastFrame();
    // Should contain the border character
    expect(output).toContain('\u2502');
  });

  it('should not show expand hint in expanded mode', () => {
    const { lastFrame } = render(
      <ThinkingBlock text="Some thinking" expanded={true} tokenCount={5} />
    );
    const output = lastFrame();
    expect(output).not.toContain('Ctrl+T');
  });

  it('should show Ctrl+T hint in collapsed mode', () => {
    const { lastFrame } = render(
      <ThinkingBlock text="Some thinking" expanded={false} tokenCount={5} />
    );
    const output = lastFrame();
    expect(output).toContain('Ctrl+T to expand');
  });

  it('should display token count correctly for larger text', () => {
    // 400 chars -> ceil(400/4) = 100 tokens
    const longText = 'a'.repeat(400);
    const { lastFrame } = render(
      <ThinkingBlock text={longText} expanded={false} tokenCount={100} />
    );
    const output = lastFrame();
    expect(output).toContain('100');
    expect(output).toContain('tokens');
  });
});
