import { describe, expect, it } from 'vitest';

import { DecisionLog } from '@/lib/learning/decision-log';
import { LessonsLog } from '@/lib/learning/lessons-log';

describe('DecisionLog', () => {
  it('stores records with required fields and deterministic ids', () => {
    const log = new DecisionLog();
    const entry = log.add({
      hypothesis: 'Issue is caused by invalid payload shape',
      evidence: 'Integration test failed with 400 on /v1/messages',
      decision: 'Align payload to contract and add test coverage',
      outcome: 'Endpoint returned 200 and tests passed',
      followUpCheckDate: '2026-03-05',
    });

    expect(entry.id).toBe('decision-000001');
    expect(log.list()).toHaveLength(1);
  });

  it('rejects records with missing required fields', () => {
    const log = new DecisionLog();

    expect(() =>
      log.add({
        hypothesis: '',
        evidence: 'observed',
        decision: 'act',
        outcome: 'result',
        followUpCheckDate: '2026-03-05',
      }),
    ).toThrow('hypothesis');

    expect(() =>
      log.add({
        hypothesis: 'valid',
        evidence: 'valid',
        decision: 'valid',
        outcome: 'valid',
        followUpCheckDate: 'invalid-date',
      }),
    ).toThrow('followUpCheckDate');
  });
});

describe('LessonsLog', () => {
  it('stores problem/root cause/prevention entries', () => {
    const log = new LessonsLog();
    const entry = log.add({
      problem: 'Test suite consumed too much memory',
      rootCause: 'Mock returned unstable object causing render loop',
      preventionRule: 'Keep hook return mocks referentially stable',
    });

    expect(entry.id).toBe('lesson-000001');
    expect(log.list()[0]?.preventionRule).toContain('referentially stable');
  });
});

