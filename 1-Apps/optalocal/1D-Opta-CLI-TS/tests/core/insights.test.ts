import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InsightEngine, type Insight, type InsightCategory } from '../../src/core/insights.js';

describe('InsightEngine', () => {
  let insights: Insight[];
  let engine: InsightEngine;

  beforeEach(() => {
    insights = [];
    engine = new InsightEngine((insight) => insights.push(insight));
    engine.setModel('qwen2.5-coder-32b');
    engine.setContextLimit(32768);
  });

  describe('firstToken', () => {
    it('emits perf insight with latency qualifier', () => {
      engine.turnStart();
      engine.firstToken(150);

      expect(insights).toHaveLength(1);
      expect(insights[0]!.category).toBe('perf');
      expect(insights[0]!.text).toContain('150ms');
      expect(insights[0]!.text).toContain('instant');
    });

    it('classifies slow first-token as cold start', () => {
      engine.turnStart();
      engine.firstToken(2000);

      expect(insights[0]!.text).toContain('cold start');
    });

    it('classifies fast first-token correctly', () => {
      engine.turnStart();
      engine.firstToken(400);
      expect(insights[0]!.text).toContain('fast');
    });

    it('does nothing without turnStart', () => {
      engine.firstToken(100);
      expect(insights).toHaveLength(0);
    });
  });

  describe('contextUpdate', () => {
    it('emits context insight when usage exceeds 60%', () => {
      engine.contextUpdate(20000); // 61% of 32768
      expect(insights).toHaveLength(1);
      expect(insights[0]!.category).toBe('context');
      expect(insights[0]!.text).toContain('61%');
    });

    it('emits compaction warning at 80%+', () => {
      engine.contextUpdate(27000); // 82%
      expect(insights[0]!.text).toContain('compaction imminent');
    });

    it('does not emit below 60%', () => {
      engine.contextUpdate(10000); // 30%
      expect(insights).toHaveLength(0);
    });
  });

  describe('compaction', () => {
    it('emits context insight with message count and recovery', () => {
      engine.turnStart();
      engine.compaction(14, 5000);

      expect(insights).toHaveLength(1);
      expect(insights[0]!.category).toBe('context');
      expect(insights[0]!.text).toContain('14 messages');
      expect(insights[0]!.text).toContain('5.0k');
    });
  });

  describe('toolStart', () => {
    it('emits tool insight with brief description', () => {
      engine.turnStart();
      engine.toolStart('edit_file', JSON.stringify({ path: 'src/core/agent.ts', old_text: 'foo', new_text: 'bar' }));

      expect(insights).toHaveLength(1);
      expect(insights[0]!.category).toBe('tool');
      expect(insights[0]!.text).toContain('edit_file');
      expect(insights[0]!.text).toContain('agent.ts');
    });

    it('handles run_command with command preview', () => {
      engine.turnStart();
      engine.toolStart('run_command', JSON.stringify({ command: 'npm test' }));

      expect(insights[0]!.text).toContain('$ npm test');
    });

    it('handles search_files with pattern', () => {
      engine.turnStart();
      engine.toolStart('search_files', JSON.stringify({ pattern: 'InsightEngine' }));

      expect(insights[0]!.text).toContain('"InsightEngine"');
    });
  });

  describe('toolEnd', () => {
    it('emits insight for large results', () => {
      engine.turnStart();
      // Simulate a tool returning > 5000 chars
      engine.toolEnd('read_file', 'id1', 'x'.repeat(6000));

      expect(insights).toHaveLength(1);
      expect(insights[0]!.text).toContain('tokens of context');
    });

    it('does not emit for small results', () => {
      engine.turnStart();
      engine.toolEnd('read_file', 'id1', 'small result');
      expect(insights).toHaveLength(0);
    });
  });

  describe('connectionStatus', () => {
    it('emits reconnection insight', () => {
      engine.turnStart();
      engine.connectionStatus('reconnecting', 2);

      expect(insights).toHaveLength(1);
      expect(insights[0]!.category).toBe('connection');
      expect(insights[0]!.text).toContain('attempt 2');
    });

    it('emits reconnected insight after recovery', () => {
      engine.turnStart();
      engine.connectionStatus('reconnecting', 1);
      engine.connectionStatus('connected');

      expect(insights).toHaveLength(2);
      expect(insights[1]!.text).toContain('Reconnected after 1 attempt');
    });

    it('emits disconnected insight', () => {
      engine.turnStart();
      engine.connectionStatus('disconnected');

      expect(insights[0]!.text).toContain('connection lost');
    });
  });

  describe('turnEnd', () => {
    it('emits summary insight', () => {
      engine.turnStart();
      engine.turnEnd({
        tokens: 500,
        toolCalls: 3,
        elapsed: 4.2,
        speed: 119,
        firstTokenLatencyMs: 200,
      });

      expect(insights).toHaveLength(1);
      expect(insights[0]!.category).toBe('summary');
      expect(insights[0]!.text).toContain('500 tokens');
      expect(insights[0]!.text).toContain('3 tools');
      expect(insights[0]!.text).toContain('4.2s');
      expect(insights[0]!.text).toContain('119 tok/s');
    });

    it('includes compacted flag when applicable', () => {
      engine.turnStart();
      engine.compaction(10, 3000);
      insights.length = 0; // clear compaction insight

      engine.turnEnd({
        tokens: 200,
        toolCalls: 0,
        elapsed: 2.0,
        speed: 100,
        firstTokenLatencyMs: null,
      });

      expect(insights[0]!.text).toContain('compacted');
    });
  });

  describe('progress', () => {
    it('does not emit below token threshold', () => {
      engine.turnStart();
      engine.progress(30, 45, 1.0);
      expect(insights).toHaveLength(0);
    });

    it('emits speed insight above token threshold', () => {
      engine.turnStart();
      engine.progress(100, 45, 2.0);

      expect(insights).toHaveLength(1);
      expect(insights[0]!.category).toBe('perf');
      expect(insights[0]!.text).toContain('45.0 tok/s');
      expect(insights[0]!.text).toContain('strong');
    });

    it('does not spam speed insights within interval', () => {
      engine.turnStart();
      engine.progress(100, 45, 2.0);
      engine.progress(200, 50, 3.0); // within 5s interval

      expect(insights).toHaveLength(1); // only the first one
    });

    it('classifies speed tiers correctly', () => {
      engine.turnStart();

      // Blazing
      engine.progress(100, 90, 1.0);
      expect(insights[0]!.text).toContain('blazing');
    });
  });

  describe('model name shortening', () => {
    it('strips mlx-community prefix', () => {
      const e = new InsightEngine((i) => insights.push(i));
      e.setModel('mlx-community/qwen2.5-32b');
      e.setContextLimit(32768);
      e.turnStart();
      e.progress(100, 50, 2.0);

      expect(insights.at(-1)!.text).toContain('qwen2.5-32b');
      expect(insights.at(-1)!.text).not.toContain('mlx-community');
    });
  });
});
