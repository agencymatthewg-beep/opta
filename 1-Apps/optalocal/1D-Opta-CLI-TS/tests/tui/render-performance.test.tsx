/**
 * TUI Render Performance Budget
 *
 * Measures render time for key TUI components under simulated load.
 * Budget: < 50ms per render in test environment (CI machines are slower
 * than dev machines, so we use a conservative budget).
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { InkStatusBar } from '../../src/tui/StatusBar.js';

const RENDER_BUDGET_MS = 50;

function measureRender(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

describe('TUI render performance budget', () => {
  it('InkStatusBar renders under budget', () => {
    const duration = measureRender(() => {
      render(
        React.createElement(InkStatusBar, {
          model: 'llama-3.3-70b',
          tokens: 1024,
          cost: '$0.00',
          tools: 5,
          speed: 35.5,
          connectionState: 'connected' as const,
        }),
      );
    });

    expect(duration).toBeLessThan(RENDER_BUDGET_MS);
  });

  it('InkStatusBar with all optional props renders under budget', () => {
    const duration = measureRender(() => {
      render(
        React.createElement(InkStatusBar, {
          model: 'llama-3.3-70b',
          tokens: 5000,
          cost: '$1.50',
          tools: 42,
          speed: 42.7,
          connectionState: 'connected' as const,
          turnElapsed: 12.5,
          turnPhase: 'streaming',
          promptTokens: 2000,
          completionTokens: 3000,
          contextUsed: 8000,
          contextTotal: 16000,
          highestPendingApprovalRisk: 'low' as const,
          activeHost: '192.168.188.11',
          primaryHost: '192.168.188.11',
        }),
      );
    });

    expect(duration).toBeLessThan(RENDER_BUDGET_MS);
  });

  it('multiple consecutive InkStatusBar renders stay under cumulative budget', () => {
    const ITERATIONS = 10;
    const start = performance.now();

    for (let i = 0; i < ITERATIONS; i++) {
      render(
        React.createElement(InkStatusBar, {
          model: `model-${i}`,
          tokens: i * 100,
          cost: `$${(i * 0.01).toFixed(2)}`,
          tools: i,
          speed: i * 3.5,
          connectionState: 'connected' as const,
        }),
      );
    }

    const total = performance.now() - start;
    const average = total / ITERATIONS;

    expect(average).toBeLessThan(RENDER_BUDGET_MS);
  });
});
