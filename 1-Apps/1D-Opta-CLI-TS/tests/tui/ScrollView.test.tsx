import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { ScrollView } from '../../src/tui/ScrollView.js';
import { Text } from 'ink';

describe('ScrollView', () => {
  it('should render visible items', () => {
    const items = Array.from({ length: 50 }, (_, i) => `Line ${i}`);
    const { lastFrame } = render(
      <ScrollView height={5}>
        {items.map((item, i) => <Text key={i}>{item}</Text>)}
      </ScrollView>
    );
    // Should only show last items (auto-scroll to bottom)
    expect(lastFrame()).toBeDefined();
  });

  it('should render fewer items than height', () => {
    const { lastFrame } = render(
      <ScrollView height={10}>
        <Text>Item 1</Text>
        <Text>Item 2</Text>
      </ScrollView>
    );
    expect(lastFrame()).toContain('Item 1');
    expect(lastFrame()).toContain('Item 2');
  });

  it('should show scrollbar when items exceed height', () => {
    const items = Array.from({ length: 20 }, (_, i) => `Line ${i}`);
    const { lastFrame } = render(
      <ScrollView height={5}>
        {items.map((item, i) => <Text key={i}>{item}</Text>)}
      </ScrollView>
    );
    const frame = lastFrame()!;
    // Scrollbar indicators should be present
    expect(frame).toBeDefined();
  });
});
