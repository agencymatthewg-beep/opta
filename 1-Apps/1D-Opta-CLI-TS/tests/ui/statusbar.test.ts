import { describe, it, expect } from 'vitest';
import { StatusBar } from '../../src/ui/statusbar.js';

describe('StatusBar', () => {
  it('should track cumulative tokens', () => {
    const bar = new StatusBar({ model: 'test', sessionId: '123' });
    bar.markStart();
    bar.setPromptTokens(100);
    bar.update(50);
    bar.finalizeTurn();
    expect(bar.getCumulativeTokens()).toBe(150);
  });

  it('should track cumulative tools', () => {
    const bar = new StatusBar({ model: 'test', sessionId: '123' });
    bar.addToolCall();
    bar.addToolCall();
    expect(bar.getCumulativeTools()).toBe(2);
  });

  it('should format summary with cost', () => {
    const bar = new StatusBar({ model: 'Qwen2.5-72B', sessionId: '123' });
    bar.markStart();
    bar.setPromptTokens(1000);
    bar.update(500);
    bar.finalizeTurn();
    const summary = bar.getSummaryString();
    expect(summary).toContain('1.5K');
    expect(summary).toContain('$0.00');
  });

  it('should accumulate across multiple turns', () => {
    const bar = new StatusBar({ model: 'test', sessionId: '123' });

    // Turn 1
    bar.newTurn();
    bar.markStart();
    bar.setPromptTokens(100);
    bar.update(50);
    bar.finalizeTurn();

    // Turn 2
    bar.newTurn();
    bar.markStart();
    bar.setPromptTokens(200);
    bar.update(100);
    bar.finalizeTurn();

    expect(bar.getCumulativeTokens()).toBe(450); // 150 + 300
  });

  it('should reset per-turn stats on newTurn', () => {
    const bar = new StatusBar({ model: 'test', sessionId: '123' });
    bar.markStart();
    bar.setPromptTokens(100);
    bar.update(50);
    bar.finalizeTurn();

    bar.newTurn();
    bar.markStart();
    bar.setPromptTokens(10);
    bar.update(5);
    bar.finalizeTurn();

    const summary = bar.getSummaryString();
    // Per-turn should show 15 tokens (not cumulative 165)
    expect(summary).toContain('15 tokens');
  });
});
