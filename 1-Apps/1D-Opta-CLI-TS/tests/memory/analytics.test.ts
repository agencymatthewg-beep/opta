import { describe, it, expect } from 'vitest';
import { SessionAnalytics } from '../../src/memory/analytics.js';

describe('SessionAnalytics', () => {
  it('should compute basic stats from sessions', () => {
    const analytics = new SessionAnalytics([
      { id: '1', model: 'Qwen2.5-72B', created: '2026-02-17', messageCount: 10, toolCallCount: 5, title: 'Test 1' },
      { id: '2', model: 'Qwen2.5-72B', created: '2026-02-16', messageCount: 20, toolCallCount: 8, title: 'Test 2' },
      { id: '3', model: 'GLM-5', created: '2026-02-16', messageCount: 5, toolCallCount: 2, title: 'Test 3' },
    ]);
    expect(analytics.totalSessions).toBe(3);
    expect(analytics.totalMessages).toBe(35);
    expect(analytics.totalToolCalls).toBe(15);
    expect(analytics.avgMessagesPerSession).toBeCloseTo(11.67, 1);
  });

  it('should compute model usage breakdown', () => {
    const analytics = new SessionAnalytics([
      { id: '1', model: 'Qwen2.5-72B', created: '2026-02-17', messageCount: 10, toolCallCount: 5, title: '' },
      { id: '2', model: 'Qwen2.5-72B', created: '2026-02-16', messageCount: 20, toolCallCount: 8, title: '' },
      { id: '3', model: 'GLM-5', created: '2026-02-16', messageCount: 5, toolCallCount: 2, title: '' },
    ]);
    const breakdown = analytics.modelBreakdown;
    expect(breakdown['Qwen2.5-72B']).toBe(2);
    expect(breakdown['GLM-5']).toBe(1);
  });

  it('should compute daily activity', () => {
    const analytics = new SessionAnalytics([
      { id: '1', model: 'M', created: '2026-02-17', messageCount: 10, toolCallCount: 5, title: '' },
      { id: '2', model: 'M', created: '2026-02-17', messageCount: 20, toolCallCount: 8, title: '' },
      { id: '3', model: 'M', created: '2026-02-16', messageCount: 5, toolCallCount: 2, title: '' },
    ]);
    expect(analytics.sessionsToday('2026-02-17')).toBe(2);
  });

  it('should find the most used model', () => {
    const analytics = new SessionAnalytics([
      { id: '1', model: 'Qwen2.5-72B', created: '2026-02-17', messageCount: 10, toolCallCount: 5, title: '' },
      { id: '2', model: 'Qwen2.5-72B', created: '2026-02-16', messageCount: 20, toolCallCount: 8, title: '' },
      { id: '3', model: 'GLM-5', created: '2026-02-16', messageCount: 5, toolCallCount: 2, title: '' },
    ]);
    expect(analytics.mostUsedModel).toBe('Qwen2.5-72B');
  });

  it('should handle empty sessions', () => {
    const analytics = new SessionAnalytics([]);
    expect(analytics.totalSessions).toBe(0);
    expect(analytics.totalMessages).toBe(0);
    expect(analytics.avgMessagesPerSession).toBe(0);
    expect(analytics.mostUsedModel).toBe('none');
  });
});
