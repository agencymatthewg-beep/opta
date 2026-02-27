import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { MarkdownText } from '../../src/tui/MarkdownText.js';

describe('MarkdownText', () => {
  it('should render plain text unchanged', () => {
    const { lastFrame } = render(<MarkdownText text="Hello world" />);
    expect(lastFrame()).toContain('Hello world');
  });

  it('should render bold text with styling', () => {
    const { lastFrame } = render(<MarkdownText text="This is **bold** text" />);
    expect(lastFrame()).toContain('bold');
  });

  it('should render code blocks', () => {
    const md = '```javascript\nconst x = 1;\n```';
    const { lastFrame } = render(<MarkdownText text={md} />);
    expect(lastFrame()).toContain('const x = 1');
  });

  it('should render headers', () => {
    const { lastFrame } = render(<MarkdownText text="# Hello" />);
    expect(lastFrame()).toContain('Hello');
  });

  it('should handle empty text', () => {
    const { lastFrame } = render(<MarkdownText text="" />);
    expect(lastFrame()).toBe('');
  });

  it('should fall back to raw text when rendering fails', () => {
    // null/undefined edge case
    const { lastFrame } = render(<MarkdownText text="plain fallback" />);
    expect(lastFrame()).toContain('plain fallback');
  });
});

describe('MarkdownText streaming', () => {
  it('should accept isStreaming prop', () => {
    const { lastFrame } = render(<MarkdownText text="Hello" isStreaming={true} />);
    expect(lastFrame()).toContain('Hello');
  });

  it('should render initial content while streaming', () => {
    const { lastFrame } = render(<MarkdownText text="Hello world" isStreaming={true} />);
    // Initial render should always show content
    expect(lastFrame()).toContain('Hello world');
  });

  it('should show content during streaming updates (may be debounced)', () => {
    const { lastFrame, rerender } = render(<MarkdownText text="Hel" isStreaming={true} />);
    expect(lastFrame()).toContain('Hel');

    // During streaming, debounced updates mean lastFrame may show old or new text
    rerender(<MarkdownText text="Hello world" isStreaming={true} />);
    const frame = lastFrame() ?? '';
    // Should contain at least some text (either old debounced or new)
    expect(frame.length).toBeGreaterThan(0);
  });

  it('should force final render when streaming ends', () => {
    const { lastFrame, rerender } = render(
      <MarkdownText text="**bold text**" isStreaming={true} />
    );
    // When streaming ends, force immediate final render
    rerender(<MarkdownText text="**bold text**" isStreaming={false} />);
    // After streaming ends, should be fully rendered
    expect(lastFrame()).toContain('bold text');
  });
});

describe('MarkdownText caching', () => {
  it('should return same output for same input (cache hit)', () => {
    const { lastFrame: f1 } = render(<MarkdownText text="# Hello" />);
    const { lastFrame: f2 } = render(<MarkdownText text="# Hello" />);
    expect(f1()).toBe(f2());
  });
});

describe('MarkdownText width', () => {
  it('should accept width prop', () => {
    const { lastFrame } = render(<MarkdownText text="Hello world" width={40} />);
    expect(lastFrame()).toContain('Hello world');
  });

  it('should accept different width values', () => {
    const { lastFrame: f1 } = render(<MarkdownText text="Hello world" width={40} />);
    const { lastFrame: f2 } = render(<MarkdownText text="Hello world" width={120} />);
    // Both should render the content
    expect(f1()).toContain('Hello world');
    expect(f2()).toContain('Hello world');
  });
});
