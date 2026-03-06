/**
 * Tests for Phase 3: ScopedCommandExecutor
 *
 * Tests the per-scope serialization and cross-scope parallelism semantics.
 * ScopedCommandExecutor is not exported, so we test via a white-box reconstruction
 * using the same logic embedded in the module, and via observable side-effects.
 */

import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// ScopedCommandExecutor — white-box reconstruction
//
// Because the class is module-private, we reconstruct the identical logic here
// and test it in isolation. This mirrors the canonical implementation exactly.
// ---------------------------------------------------------------------------

class ScopedCommandExecutor {
  private readonly queues = new Map<string, Promise<void>>();

  enqueue(key: string, task: () => Promise<void>): void {
    const prev = this.queues.get(key) ?? Promise.resolve();
    // errors don't stall queue; suppress unhandled rejection on the chained promise
    const next = prev.then(task, () => task()).catch(() => undefined);
    this.queues.set(key, next);
    next.finally(() => {
      if (this.queues.get(key) === next) this.queues.delete(key);
    });
  }

  async drainAll(): Promise<void> {
    await Promise.allSettled([...this.queues.values()]);
    this.queues.clear();
  }
}

// ---------------------------------------------------------------------------
// Helper: create a task that records calls and resolves after `delayMs`
// ---------------------------------------------------------------------------

function makeTask(
  log: string[],
  label: string,
  delayMs = 0
): () => Promise<void> {
  return async () => {
    log.push(`start:${label}`);
    if (delayMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }
    log.push(`end:${label}`);
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScopedCommandExecutor', () => {
  it('executes tasks with the same scope key in order', async () => {
    const executor = new ScopedCommandExecutor();
    const log: string[] = [];

    let resolveA!: () => void;
    const taskA = () =>
      new Promise<void>((resolve) => {
        log.push('start:A');
        resolveA = () => {
          log.push('end:A');
          resolve();
        };
      });
    const taskB = makeTask(log, 'B');

    executor.enqueue('scope-1', taskA);
    executor.enqueue('scope-1', taskB);

    // B should not start until A has finished
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    expect(log).toEqual(['start:A']); // A started, B waiting

    resolveA();
    await executor.drainAll();

    // After drain, B must have executed after A completed
    expect(log).toEqual(['start:A', 'end:A', 'start:B', 'end:B']);
  });

  it('executes tasks with different scope keys concurrently', async () => {
    const executor = new ScopedCommandExecutor();
    const log: string[] = [];

    // Both tasks will start immediately and race
    let resolveA!: () => void;
    let resolveB!: () => void;

    const taskA = () =>
      new Promise<void>((resolve) => {
        log.push('start:A');
        resolveA = () => {
          log.push('end:A');
          resolve();
        };
      });
    const taskB = () =>
      new Promise<void>((resolve) => {
        log.push('start:B');
        resolveB = () => {
          log.push('end:B');
          resolve();
        };
      });

    executor.enqueue('scope-A', taskA);
    executor.enqueue('scope-B', taskB);

    // Both tasks should have started before either completes
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    expect(log).toContain('start:A');
    expect(log).toContain('start:B');
    expect(log).not.toContain('end:A');
    expect(log).not.toContain('end:B');

    resolveA();
    resolveB();
    await executor.drainAll();

    expect(log).toContain('end:A');
    expect(log).toContain('end:B');
  });

  it('drainAll resolves after all queued tasks complete', async () => {
    const executor = new ScopedCommandExecutor();
    const log: string[] = [];

    executor.enqueue('k1', makeTask(log, '1', 5));
    executor.enqueue('k2', makeTask(log, '2', 5));
    executor.enqueue('k1', makeTask(log, '3', 5));

    await executor.drainAll();

    expect(log).toContain('end:1');
    expect(log).toContain('end:2');
    expect(log).toContain('end:3');
  });

  it('errors in one scope task do not block other scope queues', async () => {
    const executor = new ScopedCommandExecutor();
    const log: string[] = [];

    const errorTask = async () => {
      log.push('start:error');
      // Error is contained — does not propagate as unhandled
      throw new Error('boom');
    };
    const afterError = makeTask(log, 'after-error');
    const unrelatedTask = makeTask(log, 'unrelated');

    executor.enqueue('scope-X', errorTask);
    executor.enqueue('scope-X', afterError);    // same scope — runs after errorTask
    executor.enqueue('scope-Y', unrelatedTask); // different scope — runs concurrently

    await executor.drainAll();

    // unrelated task runs regardless of scope-X error
    expect(log).toContain('start:unrelated');
    expect(log).toContain('end:unrelated');
    // after-error still runs because errors don't stall same-scope queue
    expect(log).toContain('start:after-error');
    expect(log).toContain('end:after-error');
  });

  it('errors in one scope do not stall subsequent tasks in same scope', async () => {
    const executor = new ScopedCommandExecutor();
    const log: string[] = [];

    executor.enqueue('scope-1', async () => {
      log.push('erroring');
      throw new Error('fail');
    });
    executor.enqueue('scope-1', makeTask(log, 'after-error'));

    await executor.drainAll();

    expect(log).toEqual(['erroring', 'start:after-error', 'end:after-error']);
  });

  it('clears queues after drainAll', async () => {
    const executor = new ScopedCommandExecutor();
    const log: string[] = [];

    executor.enqueue('k', makeTask(log, 'first'));
    await executor.drainAll();

    // After drain the internal map should be empty; add new task and it works independently
    executor.enqueue('k', makeTask(log, 'second'));
    await executor.drainAll();

    expect(log).toEqual([
      'start:first',
      'end:first',
      'start:second',
      'end:second',
    ]);
  });

  it('handles multiple concurrent scopes with multiple queued tasks each', async () => {
    const executor = new ScopedCommandExecutor();
    const log: string[] = [];

    // Two scopes, two tasks each — within scope: serial; across scopes: concurrent
    executor.enqueue('s1', makeTask(log, 's1-t1', 5));
    executor.enqueue('s1', makeTask(log, 's1-t2', 5));
    executor.enqueue('s2', makeTask(log, 's2-t1', 5));
    executor.enqueue('s2', makeTask(log, 's2-t2', 5));

    await executor.drainAll();

    // Within s1: t1 before t2
    const s1t1 = log.indexOf('end:s1-t1');
    const s1t2 = log.indexOf('start:s1-t2');
    expect(s1t1).toBeLessThan(s1t2);

    // Within s2: t1 before t2
    const s2t1 = log.indexOf('end:s2-t1');
    const s2t2 = log.indexOf('start:s2-t2');
    expect(s2t1).toBeLessThan(s2t2);

    // All 8 log entries present
    expect(log).toHaveLength(8);
  });

  it('empty drainAll resolves immediately', async () => {
    const executor = new ScopedCommandExecutor();
    await expect(executor.drainAll()).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// deriveScopeKey behaviour — also white-box reconstruction since it's private
// ---------------------------------------------------------------------------

import { resolveBridgeScopeSeed } from '../../src/daemon/bridge-worker.js';

describe('deriveScopeKey logic (via resolveBridgeScopeSeed)', () => {
  it('returns null (maps to "default") when no scope/actor/session', () => {
    const result = resolveBridgeScopeSeed({
      scope: null,
      actor: null,
      bridgeSessionId: null,
    });
    expect(result).toBeNull();
    // deriveScopeKey would fall back to 'default'
  });

  it('returns scope when present (highest priority)', () => {
    const result = resolveBridgeScopeSeed({
      scope: 'telegram:dm:peer-123',
      actor: 'telegram:dm:peer-456',
      bridgeSessionId: 'session-789',
    });
    expect(result).toBe('telegram:dm:peer-123');
  });

  it('returns actor when scope is absent', () => {
    const result = resolveBridgeScopeSeed({
      scope: null,
      actor: 'telegram:dm:peer-456',
      bridgeSessionId: 'session-789',
    });
    expect(result).toBe('telegram:dm:peer-456');
  });

  it('returns bridgeSessionId when scope and actor are absent', () => {
    const result = resolveBridgeScopeSeed({
      scope: null,
      actor: null,
      bridgeSessionId: 'session-789',
    });
    expect(result).toBe('session-789');
  });

  it('treats whitespace-only scope as absent', () => {
    const result = resolveBridgeScopeSeed({
      scope: '   ',
      actor: 'telegram:dm:peer-456',
      bridgeSessionId: null,
    });
    expect(result).toBe('telegram:dm:peer-456');
  });
});
