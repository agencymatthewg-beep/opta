import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { OptimiserPanel } from '../../src/tui/OptimiserPanel.js';

describe('OptimiserPanel', () => {
  it('renders compact goal + flow intent model', () => {
    const { lastFrame } = render(
      <OptimiserPanel
        goal="Stabilize Opta TUI formatting and menu interactions."
        flowSteps={['Research LMX', 'Analyse codebase', 'Plan implementation']}
        turnPhase="waiting"
      />,
    );

    const frame = lastFrame() ?? '';
    expect(frame).toContain('Opta Intent');
    expect(frame).toContain('Goal');
    expect(frame).toContain('Flow');
    expect(frame).toContain('Research LMX -> Analyse codebase -> Plan implementation');
  });

  it('keeps safe mode output as one compact line', () => {
    const { lastFrame } = render(
      <OptimiserPanel
        goal="Run a small benchmark verification pass."
        flowSteps={['Execute benchmark', 'Verify output']}
        turnPhase="streaming"
        safeMode={true}
      />,
    );

    const frame = lastFrame() ?? '';
    expect(frame).toContain('Intent');
    expect(frame).toContain('synthesizing');
    expect(frame).toContain('Run a small benchmark verification pass.');
  });
});
