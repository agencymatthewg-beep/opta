import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { SplitPane } from '../../src/tui/SplitPane.js';
import { Text } from 'ink';

describe('SplitPane', () => {
  it('should render main and sidebar', () => {
    const { lastFrame } = render(
      <SplitPane
        main={<Text>Main content</Text>}
        sidebar={<Text>Sidebar</Text>}
        sidebarWidth={20}
      />
    );
    expect(lastFrame()).toContain('Main content');
    expect(lastFrame()).toContain('Sidebar');
  });

  it('should hide sidebar when collapsed', () => {
    const { lastFrame } = render(
      <SplitPane
        main={<Text>Main content</Text>}
        sidebar={<Text>Sidebar</Text>}
        sidebarWidth={20}
        sidebarVisible={false}
      />
    );
    expect(lastFrame()).toContain('Main content');
    expect(lastFrame()).not.toContain('Sidebar');
  });
});
