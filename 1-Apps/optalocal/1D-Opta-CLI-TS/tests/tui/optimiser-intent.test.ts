import { describe, it, expect } from 'vitest';
import { deriveOptimiserIntent } from '../../src/tui/optimiser-intent.js';

describe('deriveOptimiserIntent', () => {
  it('derives goal from the latest meaningful user prompt', () => {
    const intent = deriveOptimiserIntent({
      sessionTitle: 'Fallback title',
      messages: [
        { role: 'user', content: 'ok' },
        { role: 'user', content: 'Debug the newest formatting issue in Opta CLI' },
      ],
      liveActivity: [],
      turnPhase: 'idle',
    });

    expect(intent.goal).toContain('Debug the newest formatting issue');
  });

  it('describes active tool execution as the current why', () => {
    const intent = deriveOptimiserIntent({
      messages: [{ role: 'user', content: 'run browser flow' }],
      liveActivity: [{ type: 'tool', toolName: 'browser_click', toolStatus: 'running' }],
      turnPhase: 'tool-call',
    });

    expect(intent.why).toContain('browser_click');
    expect(intent.nextSteps[0]).toContain('browser_click');
    expect(intent.flowSteps[0]?.toLowerCase()).toContain('browser click');
  });

  it('always returns exactly five next steps', () => {
    const intent = deriveOptimiserIntent({
      messages: [{ role: 'assistant', content: 'Done.' }],
      liveActivity: [],
      turnPhase: 'idle',
    });

    expect(intent.nextSteps).toHaveLength(5);
    expect(intent.flowSteps.length).toBeGreaterThan(0);
  });
});
