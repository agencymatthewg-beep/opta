import { describe, it, expect } from 'vitest';
import { TurnQueue, type QueuedTurn } from '../../src/daemon/turn-queue.js';

function makeTurn(overrides: Partial<QueuedTurn> = {}): QueuedTurn {
  return {
    turnId: overrides.turnId ?? 'turn-1',
    ingressSeq: overrides.ingressSeq ?? 1,
    sessionId: overrides.sessionId ?? 'session-1',
    clientId: overrides.clientId ?? 'client-1',
    writerId: overrides.writerId ?? 'writer-1',
    content: overrides.content ?? 'hello',
    mode: overrides.mode ?? 'chat',
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    metadata: overrides.metadata,
  };
}

describe('TurnQueue', () => {
  it('orders queued turns by ingress sequence', () => {
    const q = new TurnQueue();
    q.enqueue(makeTurn({ turnId: 'b', ingressSeq: 20 }));
    q.enqueue(makeTurn({ turnId: 'a', ingressSeq: 10 }));
    q.enqueue(makeTurn({ turnId: 'c', ingressSeq: 30 }));

    expect(q.dequeue()?.turnId).toBe('a');
    expect(q.dequeue()?.turnId).toBe('b');
    expect(q.dequeue()?.turnId).toBe('c');
  });

  it('cancels queued turns by writer', () => {
    const q = new TurnQueue();
    q.enqueue(makeTurn({ turnId: 't1', writerId: 'w1', ingressSeq: 1 }));
    q.enqueue(makeTurn({ turnId: 't2', writerId: 'w2', ingressSeq: 2 }));
    q.enqueue(makeTurn({ turnId: 't3', writerId: 'w1', ingressSeq: 3 }));

    const cancelled = q.cancelByWriter('w1');
    expect(cancelled).toBe(2);
    expect(q.size).toBe(1);
    expect(q.dequeue()?.turnId).toBe('t2');
  });
});
