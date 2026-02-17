import { describe, it, expect } from 'vitest';
import { ThinkingRenderer } from '../../src/ui/thinking.js';

describe('ThinkingRenderer', () => {
  it('should process thinking tags', () => {
    const renderer = new ThinkingRenderer();
    const result = renderer.process('<think>reasoning here</think>actual output');
    expect(result).toContain('actual output');
  });

  it('should track thinking content for toggle', () => {
    const renderer = new ThinkingRenderer();
    renderer.process('<think>my reasoning</think>output');
    expect(renderer.getThinkingText()).toContain('my reasoning');
    expect(renderer.hasThinking()).toBe(true);
  });

  it('should generate collapsed summary', () => {
    const renderer = new ThinkingRenderer();
    renderer.process('<think>a long reasoning process</think>output');
    const summary = renderer.getCollapsedSummary();
    expect(summary).toContain('thinking');
    expect(summary).toContain('tokens');
  });

  it('should generate expanded view', () => {
    const renderer = new ThinkingRenderer();
    renderer.process('<think>detailed reasoning</think>output');
    const expanded = renderer.getExpandedView();
    expect(expanded).toContain('detailed reasoning');
  });

  it('should report no thinking when none exists', () => {
    const renderer = new ThinkingRenderer();
    // Feed enough content to trigger the 2000-char buffer release
    renderer.process('x'.repeat(2100));
    expect(renderer.hasThinking()).toBe(false);
    expect(renderer.getThinkingText()).toBe('');
  });

  it('should handle flush without think tags', () => {
    const renderer = new ThinkingRenderer();
    renderer.process('normal content');
    const flushed = renderer.flush();
    expect(flushed).toContain('normal content');
    expect(renderer.hasThinking()).toBe(false);
  });
});
