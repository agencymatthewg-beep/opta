import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { InputBox } from '../../src/tui/InputBox.js';

describe('InputBox', () => {
  it('should render with prompt', () => {
    const { lastFrame } = render(<InputBox onSubmit={() => {}} mode="normal" />);
    expect(lastFrame()).toContain('>');
  });

  it('should show mode indicator', () => {
    const { lastFrame } = render(<InputBox onSubmit={() => {}} mode="plan" />);
    expect(lastFrame()).toContain('plan');
  });
});
