import { describe, expect, it } from 'vitest';

import { RunOrchestrator } from '@/lib/orchestrator/run-orchestrator';

describe('RunOrchestrator', () => {
  it('enforces registered capabilities and full lifecycle transitions', () => {
    const orchestrator = new RunOrchestrator(['/v1/agents/runs']);

    orchestrator.queueRun({
      id: 'run-1',
      capability: '/v1/agents/runs',
      at: 1000,
    });

    orchestrator.transition('run-1', 'running', { at: 1100 });
    orchestrator.transition('run-1', 'waiting_input', { at: 1200 });
    orchestrator.transition('run-1', 'running', { at: 1300 });
    orchestrator.transition('run-1', 'retrying', { at: 1400 });
    orchestrator.transition('run-1', 'running', { at: 1500 });
    orchestrator.transition('run-1', 'completed', { at: 1600 });

    const run = orchestrator.getRun('run-1');
    expect(run?.state).toBe('completed');
    expect(run?.retryCount).toBe(1);
    expect(run?.transitions).toHaveLength(6);
  });

  it('tracks blocked and cancelled statuses', () => {
    const orchestrator = new RunOrchestrator(['/v1/skills']);
    orchestrator.queueRun({ id: 'run-2', capability: '/v1/skills', at: 1000 });
    orchestrator.transition('run-2', 'running', { at: 1100 });
    orchestrator.transition('run-2', 'blocked', { at: 1200 });
    orchestrator.transition('run-2', 'cancelled', { at: 1300 });

    const run = orchestrator.getRun('run-2');
    expect(run?.state).toBe('cancelled');
  });

  it('returns contextually valid actions from state + capability map', () => {
    const orchestrator = new RunOrchestrator(['/v1/skills']);
    orchestrator.queueRun({ id: 'run-3', capability: '/v1/skills' });

    expect(orchestrator.availableActions('run-3')).toEqual(['start', 'cancel']);

    orchestrator.transition('run-3', 'running');
    expect(orchestrator.availableActions('run-3')).toEqual([
      'retry',
      'complete',
      'fail',
      'cancel',
    ]);
  });

  it('rejects invalid transitions and unknown capabilities', () => {
    const orchestrator = new RunOrchestrator(['/v1/skills']);

    expect(() =>
      orchestrator.queueRun({ id: 'bad-1', capability: '/not-registered' }),
    ).toThrow('Capability not registered');

    orchestrator.queueRun({ id: 'bad-2', capability: '/v1/skills' });
    expect(() => orchestrator.transition('bad-2', 'completed')).toThrow(
      'Invalid run transition',
    );
  });
});
