import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { App } from '../../src/tui/App.js';

describe('App component', () => {
  it('should render without crashing', () => {
    const { lastFrame } = render(<App model="test-model" sessionId="abc123" />);
    expect(lastFrame()).toBeDefined();
  });

  it('should show model name', () => {
    const { lastFrame } = render(<App model="Qwen2.5-72B" sessionId="abc123" />);
    expect(lastFrame()).toContain('Qwen2.5-72B');
  });
});
