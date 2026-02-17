import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { InkStatusBar } from '../../src/tui/StatusBar.js';

describe('InkStatusBar', () => {
  it('should show model name', () => {
    const { lastFrame } = render(
      <InkStatusBar model="Qwen2.5-72B" tokens={0} cost="$0.00" tools={0} speed={0} />
    );
    expect(lastFrame()).toContain('Qwen2.5-72B');
  });

  it('should show token count', () => {
    const { lastFrame } = render(
      <InkStatusBar model="test" tokens={1500} cost="$0.00" tools={3} speed={45} />
    );
    expect(lastFrame()).toContain('1.5K');
  });
});
