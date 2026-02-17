import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { FocusProvider, useFocusPanel } from '../../src/tui/FocusContext.js';
import { Text } from 'ink';

function TestComponent() {
  const { activePanel } = useFocusPanel();
  return <Text>Active: {activePanel}</Text>;
}

describe('FocusContext', () => {
  it('should default to input panel', () => {
    const { lastFrame } = render(
      <FocusProvider>
        <TestComponent />
      </FocusProvider>
    );
    expect(lastFrame()).toContain('Active: input');
  });
});
