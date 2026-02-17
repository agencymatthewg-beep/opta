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

  it('should show empty state', () => {
    const { lastFrame } = render(<MessageList messages={[]} />);
    expect(lastFrame()).toContain('Start typing');
  });
});
