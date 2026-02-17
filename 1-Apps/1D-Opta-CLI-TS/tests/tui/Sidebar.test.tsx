import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { Sidebar } from '../../src/tui/Sidebar.js';

describe('Sidebar', () => {
  it('should show session info', () => {
    const { lastFrame } = render(
      <Sidebar
        model="Qwen2.5-72B"
        sessionId="abc12345"
        tokens={{ prompt: 1000, completion: 500, total: 1500 }}
        tools={3}
        cost="$0.00"
        mode="normal"
        elapsed={12.5}
      />
    );
    expect(lastFrame()).toContain('Qwen2.5-72B');
    expect(lastFrame()).toContain('abc12345');
    expect(lastFrame()).toContain('1.5K');
  });

  it('should show mode', () => {
    const { lastFrame } = render(
      <Sidebar
        model="test"
        sessionId="abc"
        tokens={{ prompt: 0, completion: 0, total: 0 }}
        tools={0}
        cost="$0.00"
        mode="plan"
        elapsed={0}
      />
    );
    expect(lastFrame()).toContain('plan');
  });
});
