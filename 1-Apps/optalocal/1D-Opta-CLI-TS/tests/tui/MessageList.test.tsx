import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { MessageList, computeMessageLayoutWidths } from '../../src/tui/MessageList.js';
import { sanitizeTerminalText, visibleTextWidth } from '../../src/utils/text.js';

describe('MessageList', () => {
  it('computes consistent layout widths from terminal width', () => {
    expect(computeMessageLayoutWidths(20)).toEqual({
      scrollContentWidth: 18,
      messageContentWidth: 17,
      assistantBodyWidth: 12,
      safeAssistantBodyWidth: 15,
    });
  });

  it('clamps computed layout widths to avoid negative/zero rendering math', () => {
    expect(computeMessageLayoutWidths(1)).toEqual({
      scrollContentWidth: 1,
      messageContentWidth: 1,
      assistantBodyWidth: 1,
      safeAssistantBodyWidth: 1,
    });
  });

  it('caps markdown body width on ultra-wide terminals for readable formatting', () => {
    const widths = computeMessageLayoutWidths(542);
    expect(widths.scrollContentWidth).toBe(540);
    expect(widths.messageContentWidth).toBe(539);
    expect(widths.assistantBodyWidth).toBe(128);
    expect(widths.safeAssistantBodyWidth).toBe(128);
  });

  it('keeps markdown horizontal rules bounded on ultra-wide terminals', () => {
    const messages = [
      {
        role: 'assistant',
        content:
          '## Capability Summary\n\n---\n\n| Tool | Status |\n| --- | --- |\n| find_files | Working |',
      },
    ];
    const { lastFrame } = render(
      <MessageList messages={messages} terminalWidth={542} height={20} thinkingExpanded={false} />
    );
    const frame = sanitizeTerminalText(lastFrame() ?? '');
    const hrWidths = frame
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^-{12,}$/.test(line))
      .map((line) => visibleTextWidth(line));
    if (hrWidths.length > 0) {
      expect(Math.max(...hrWidths)).toBeLessThanOrEqual(128);
    }
  });

  it('should render messages', () => {
    const messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ];
    const { lastFrame } = render(<MessageList messages={messages} />);
    expect(lastFrame()).toContain('Hello');
    expect(lastFrame()).toContain('Hi there!');
  });

  it('labels separators with the upcoming turn number', () => {
    const messages = [
      { role: 'user', content: 'Turn one prompt' },
      { role: 'assistant', content: 'Turn one response' },
      { role: 'user', content: 'Turn two prompt' },
      { role: 'assistant', content: 'Turn two response' },
    ];
    const { lastFrame } = render(<MessageList messages={messages} terminalWidth={96} />);
    const frame = sanitizeTerminalText(lastFrame() ?? '');
    expect(frame).toContain('Turn 2');
    expect(frame).not.toContain('Turn 1');
  });

  it('should show welcome screen when no messages exist', () => {
    const { lastFrame } = render(<MessageList messages={[]} />);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('QUICK START');
    expect(frame).toContain('KEYBINDINGS');
  });

  it('should render assistant markdown content', () => {
    const messages = [{ role: 'assistant', content: '**bold** and `code`' }];
    const { lastFrame } = render(<MessageList messages={messages} />);
    // Should contain the text (with ANSI styling applied by marked-terminal)
    expect(lastFrame()).toContain('Opta');
    expect(lastFrame()).toContain('bold');
    expect(lastFrame()).toContain('code');
  });

  it('renders per-response completion telemetry on assistant messages', () => {
    const messages = [
      {
        role: 'assistant',
        content: 'Completed requested analysis and implementation plan.',
        responseMeta: {
          elapsedSec: 8.3,
          tokensPerSecond: 18.2,
          intent: 'Synthesized an investigation task using 2 tool calls; evidence verified.',
        },
      },
    ];
    const { lastFrame } = render(<MessageList messages={messages} terminalWidth={110} />);
    const frame = sanitizeTerminalText(lastFrame() ?? '');
    expect(frame).toContain('8.3s · 18.2 t/s');
    expect(frame).toContain('evidence verified');
  });

  it('applies assistant premium formatting for inline markdown headings', () => {
    const messages = [{ role: 'assistant', content: 'Intro ## Section' }];
    const { lastFrame } = render(<MessageList messages={messages} />);
    const frame = sanitizeTerminalText(lastFrame() ?? '');
    expect(frame).toContain('Intro');
    expect(frame).toContain('Section');
    expect(frame).not.toContain('Intro ## Section');
  });

  it('should render user messages as plain text', () => {
    const messages = [{ role: 'user', content: '**not rendered as markdown**' }];
    const { lastFrame } = render(<MessageList messages={messages} />);
    // User messages stay raw — no markdown processing
    expect(lastFrame()).toContain('**not rendered as markdown**');
  });

  it('preserves preformatted system blocks without wrap corruption', () => {
    const messages = [
      {
        role: 'system',
        content: '┌────────────┐\n│ model scan │\n└────────────┘',
      },
    ];
    const { lastFrame } = render(<MessageList messages={messages} />);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('┌────────────┐');
    expect(frame).toContain('│ model scan │');
    expect(frame).toContain('└────────────┘');
  });

  it('should accept streamingIdx prop', () => {
    const messages = [{ role: 'assistant', content: 'Hello' }];
    const { lastFrame } = render(<MessageList messages={messages} streamingIdx={0} />);
    expect(lastFrame()).toContain('Hello');
  });
});
