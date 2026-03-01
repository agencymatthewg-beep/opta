/**
 * TUI Render Performance Budget
 *
 * Measures render time for key TUI components under simulated load.
 * - MessageList budget: < 16ms median render (60fps-equivalent smoke target)
 * - StatusBar budget: < 50ms median render (CI-safe envelope)
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { MessageList } from '../../src/tui/MessageList.js';
import { InkStatusBar } from '../../src/tui/StatusBar.js';

const MESSAGE_LIST_RENDER_BUDGET_MS = 16;
const MESSAGE_LIST_WARN_THRESHOLD_MS = 8;
const EMPTY_MESSAGE_LIST_RENDER_BUDGET_MS = 14;
const STATUS_BAR_RENDER_BUDGET_MS = 50;
const SAMPLE_COUNT = 6;
const WARMUP_COUNT = 1;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

function measureRender(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

function measureMedianRenderDuration(run: () => void): number {
  const samples: number[] = [];

  for (let i = 0; i < WARMUP_COUNT + SAMPLE_COUNT; i++) {
    const duration = measureRender(run);
    if (i >= WARMUP_COUNT) {
      samples.push(duration);
    }
  }

  return median(samples);
}

describe('TUI render performance budget', () => {
  it('MessageList with 50 messages renders under budget', () => {
    const messages = Array.from({ length: 50 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${index}: This is a representative chat payload for render-budget testing.`,
      createdAt: Date.now() + index,
    }));

    const duration = measureMedianRenderDuration(() => {
      const app = render(
        React.createElement(MessageList, {
          messages,
          terminalWidth: 120,
          height: 40,
          thinkingExpanded: false,
        }),
      );
      app.unmount();
    });

    if (duration > MESSAGE_LIST_WARN_THRESHOLD_MS) {
      // eslint-disable-next-line no-console
      console.warn(
        `[perf] MessageList render ${duration.toFixed(1)}ms exceeds warning threshold ${MESSAGE_LIST_WARN_THRESHOLD_MS}ms`,
      );
    }

    expect(duration).toBeLessThan(MESSAGE_LIST_RENDER_BUDGET_MS);
  });

  it('empty MessageList render stays fast', () => {
    const duration = measureMedianRenderDuration(() => {
      const app = render(
        React.createElement(MessageList, {
          messages: [],
          terminalWidth: 120,
          height: 40,
          thinkingExpanded: false,
        }),
      );
      app.unmount();
    });

    expect(duration).toBeLessThan(EMPTY_MESSAGE_LIST_RENDER_BUDGET_MS);
  });

  it('InkStatusBar renders under budget', () => {
    const duration = measureMedianRenderDuration(() => {
      const app = render(
        React.createElement(InkStatusBar, {
          model: 'llama-3.3-70b',
          tokens: 1024,
          cost: '$0.00',
          tools: 5,
          speed: 35.5,
          connectionState: 'connected' as const,
        })
      );
      app.unmount();
    });

    expect(duration).toBeLessThan(STATUS_BAR_RENDER_BUDGET_MS);
  });

  it('InkStatusBar with all optional props renders under budget', () => {
    const duration = measureMedianRenderDuration(() => {
      const app = render(
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
        })
      );
      app.unmount();
    });

    expect(duration).toBeLessThan(STATUS_BAR_RENDER_BUDGET_MS);
  });

  it('multiple consecutive InkStatusBar renders stay under cumulative budget', () => {
    const ITERATIONS = 10;
    const start = performance.now();

    for (let i = 0; i < ITERATIONS; i++) {
      const app = render(
        React.createElement(InkStatusBar, {
          model: `model-${i}`,
          tokens: i * 100,
          cost: `$${(i * 0.01).toFixed(2)}`,
          tools: i,
          speed: i * 3.5,
          connectionState: 'connected' as const,
        })
      );
      app.unmount();
    }

    const total = performance.now() - start;
    const average = total / ITERATIONS;

    expect(average).toBeLessThan(STATUS_BAR_RENDER_BUDGET_MS);
  });
});
