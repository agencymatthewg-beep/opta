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

  it('should show all stats when compact is false', () => {
    const { lastFrame } = render(
      <InkStatusBar model="test" tokens={1000} cost="$0.12" tools={5} speed={30} compact={false} />
    );
    const frame = lastFrame() ?? '';
    // tools count was removed from the status bar display in the redesign
    expect(frame).toContain('30 t/s');
    expect(frame).toContain('$0.12');
  });

  it('should hide cost, tools, and speed when compact is true', () => {
    const { lastFrame } = render(
      <InkStatusBar model="test" tokens={1000} cost="$0.12" tools={5} speed={30} compact={true} />
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('test');
    expect(frame).toContain('1.0K');
    expect(frame).not.toContain('5 tools');
    expect(frame).not.toContain('30 t/s');
    expect(frame).not.toContain('$0.12');
  });
});
