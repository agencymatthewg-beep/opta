import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { MessageList } from '../../src/tui/MessageList.js';

describe('MessageList', () => {
  it('should render messages', () => {
    const messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ];
    const { lastFrame } = render(<MessageList messages={messages} />);
    expect(lastFrame()).toContain('Hello');
    expect(lastFrame()).toContain('Hi there!');
  });

  it('should show empty state with keybinding hints', () => {
    const { lastFrame } = render(<MessageList messages={[]} />);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Start typing');
    expect(frame).toContain('/help');
    expect(frame).toContain('Ctrl+/');
  });

  it('should render assistant markdown content', () => {
    const messages = [
      { role: 'assistant', content: '**bold** and `code`' },
    ];
    const { lastFrame } = render(<MessageList messages={messages} />);
    // Should contain the text (with ANSI styling applied by marked-terminal)
    expect(lastFrame()).toContain('bold');
    expect(lastFrame()).toContain('code');
  });

  it('should render user messages as plain text', () => {
    const messages = [
      { role: 'user', content: '**not rendered as markdown**' },
    ];
    const { lastFrame } = render(<MessageList messages={messages} />);
    // User messages stay raw — no markdown processing
    expect(lastFrame()).toContain('**not rendered as markdown**');
  });

  it('should accept streamingIdx prop', () => {
    const messages = [
      { role: 'assistant', content: 'Hello' },
    ];
    const { lastFrame } = render(<MessageList messages={messages} streamingIdx={0} />);
    expect(lastFrame()).toContain('Hello');
  });
});
