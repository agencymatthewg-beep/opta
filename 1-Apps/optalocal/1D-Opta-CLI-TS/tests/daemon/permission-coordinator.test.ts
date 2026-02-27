import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionCoordinator } from '../../src/daemon/permission-coordinator.js';

describe('PermissionCoordinator', () => {
  let coordinator: PermissionCoordinator;

  beforeEach(() => {
    vi.useFakeTimers();
    coordinator = new PermissionCoordinator(5_000); // 5s timeout for test speed
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // request()
  // -----------------------------------------------------------------------

  describe('request', () => {
    it('returns a PermissionRequestRecord with a generated requestId', () => {
      const { request } = coordinator.request('sess-1', 'edit_file', { path: '/foo.ts' });
      expect(request.requestId).toMatch(/^perm_/);
      expect(request.sessionId).toBe('sess-1');
      expect(request.toolName).toBe('edit_file');
      expect(request.args).toEqual({ path: '/foo.ts' });
      expect(request.createdAt).toBeDefined();
    });

    it('returns a pending decision promise', () => {
      const { decision } = coordinator.request('sess-1', 'write_file', { path: '/bar.ts' });
      expect(decision).toBeInstanceOf(Promise);
    });

    it('generates unique requestIds for each call', () => {
      const r1 = coordinator.request('sess-1', 'edit_file', {});
      const r2 = coordinator.request('sess-1', 'edit_file', {});
      expect(r1.request.requestId).not.toBe(r2.request.requestId);
    });

    it('tracks the request in has()', () => {
      const { request } = coordinator.request('sess-1', 'run_command', { cmd: 'ls' });
      expect(coordinator.has(request.requestId)).toBe(true);
    });

    it('preserves full args object', () => {
      const args = { path: '/deep/nested/file.ts', content: 'hello world', line: 42 };
      const { request } = coordinator.request('sess-2', 'write_file', args);
      expect(request.args).toEqual(args);
    });
  });

  // -----------------------------------------------------------------------
  // resolve()
  // -----------------------------------------------------------------------

  describe('resolve', () => {
    it('resolves decision promise with "allow"', async () => {
      const { request, decision } = coordinator.request('sess-1', 'edit_file', {});
      const result = coordinator.resolve(request.requestId, 'allow');

      expect(result.ok).toBe(true);
      expect(result.conflict).toBe(false);
      expect(result.message).toBeUndefined();

      const resolved = await decision;
      expect(resolved).toBe('allow');
    });

    it('resolves decision promise with "deny"', async () => {
      const { request, decision } = coordinator.request('sess-1', 'write_file', {});
      const result = coordinator.resolve(request.requestId, 'deny');

      expect(result.ok).toBe(true);
      expect(result.conflict).toBe(false);

      const resolved = await decision;
      expect(resolved).toBe('deny');
    });

    it('removes pending entry after resolution', () => {
      const { request } = coordinator.request('sess-1', 'edit_file', {});
      expect(coordinator.has(request.requestId)).toBe(true);
      coordinator.resolve(request.requestId, 'allow');
      expect(coordinator.has(request.requestId)).toBe(false);
    });

    it('returns conflict when resolving the same request twice', () => {
      const { request } = coordinator.request('sess-1', 'edit_file', {});
      coordinator.resolve(request.requestId, 'allow');

      const duplicate = coordinator.resolve(request.requestId, 'deny');
      expect(duplicate.ok).toBe(false);
      expect(duplicate.conflict).toBe(true);
      expect(duplicate.message).toBe('Permission request already resolved');
    });

    it('returns unknown for a requestId that was never created', () => {
      const result = coordinator.resolve('perm_nonexistent', 'allow');
      expect(result.ok).toBe(false);
      expect(result.conflict).toBe(false);
      expect(result.message).toBe('Unknown permission request');
    });
  });

  // -----------------------------------------------------------------------
  // timeout behavior
  // -----------------------------------------------------------------------

  describe('timeout', () => {
    it('auto-denies after timeout expires', async () => {
      const { request, decision } = coordinator.request('sess-1', 'run_command', { cmd: 'rm -rf' });
      expect(coordinator.has(request.requestId)).toBe(true);

      // Advance past the timeout
      vi.advanceTimersByTime(5_001);

      const resolved = await decision;
      expect(resolved).toBe('deny');
      expect(coordinator.has(request.requestId)).toBe(false);
    });

    it('does not auto-deny before timeout', () => {
      const { request } = coordinator.request('sess-1', 'edit_file', {});

      vi.advanceTimersByTime(4_999);
      expect(coordinator.has(request.requestId)).toBe(true);
    });

    it('resolving before timeout prevents auto-deny', async () => {
      const { request, decision } = coordinator.request('sess-1', 'write_file', {});

      coordinator.resolve(request.requestId, 'allow');

      // Advance past timeout -- should not change the decision
      vi.advanceTimersByTime(6_000);

      const resolved = await decision;
      expect(resolved).toBe('allow');
    });

    it('uses default 120_000ms when no timeout specified', async () => {
      const defaultCoordinator = new PermissionCoordinator();
      const { request, decision } = defaultCoordinator.request('sess-1', 'edit_file', {});

      // Not yet timed out at 119s
      vi.advanceTimersByTime(119_999);
      expect(defaultCoordinator.has(request.requestId)).toBe(true);

      // Timed out at 120s
      vi.advanceTimersByTime(2);
      const resolved = await decision;
      expect(resolved).toBe('deny');
    });
  });

  // -----------------------------------------------------------------------
  // has()
  // -----------------------------------------------------------------------

  describe('has', () => {
    it('returns false for unknown requestId', () => {
      expect(coordinator.has('perm_unknown')).toBe(false);
    });

    it('returns true for pending request', () => {
      const { request } = coordinator.request('sess-1', 'edit_file', {});
      expect(coordinator.has(request.requestId)).toBe(true);
    });

    it('returns false after resolution', () => {
      const { request } = coordinator.request('sess-1', 'edit_file', {});
      coordinator.resolve(request.requestId, 'allow');
      expect(coordinator.has(request.requestId)).toBe(false);
    });

    it('returns false after timeout', () => {
      const { request } = coordinator.request('sess-1', 'run_command', {});
      vi.advanceTimersByTime(5_001);
      expect(coordinator.has(request.requestId)).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Multi-client / concurrent scenarios
  // -----------------------------------------------------------------------

  describe('multi-client scenarios', () => {
    it('handles multiple concurrent permission requests independently', async () => {
      const r1 = coordinator.request('sess-1', 'edit_file', { path: '/a.ts' });
      const r2 = coordinator.request('sess-1', 'write_file', { path: '/b.ts' });
      const r3 = coordinator.request('sess-2', 'run_command', { cmd: 'ls' });

      expect(coordinator.has(r1.request.requestId)).toBe(true);
      expect(coordinator.has(r2.request.requestId)).toBe(true);
      expect(coordinator.has(r3.request.requestId)).toBe(true);

      coordinator.resolve(r1.request.requestId, 'allow');
      coordinator.resolve(r2.request.requestId, 'deny');
      coordinator.resolve(r3.request.requestId, 'allow');

      expect(await r1.decision).toBe('allow');
      expect(await r2.decision).toBe('deny');
      expect(await r3.decision).toBe('allow');
    });

    it('one request timing out does not affect others', async () => {
      const r1 = coordinator.request('sess-1', 'edit_file', {});
      const r2 = coordinator.request('sess-1', 'write_file', {});

      // Resolve r2 first, then let r1 timeout
      coordinator.resolve(r2.request.requestId, 'allow');
      vi.advanceTimersByTime(5_001);

      expect(await r1.decision).toBe('deny'); // timed out
      expect(await r2.decision).toBe('allow'); // resolved before timeout
    });

    it('permits exactly one winner under concurrent resolve races', async () => {
      const { request, decision } = coordinator.request('sess-1', 'run_command', { command: 'echo race' });

      const [first, second] = await Promise.all([
        Promise.resolve().then(() => coordinator.resolve(request.requestId, 'allow')),
        Promise.resolve().then(() => coordinator.resolve(request.requestId, 'deny')),
      ]);

      const successes = [first, second].filter((r) => r.ok);
      const conflicts = [first, second].filter((r) => r.conflict);
      expect(successes).toHaveLength(1);
      expect(conflicts).toHaveLength(1);
      await expect(decision).resolves.toBe(successes[0] === first ? 'allow' : 'deny');
    });

    it('recently resolved requests are tracked for conflict detection', () => {
      const { request } = coordinator.request('sess-1', 'edit_file', {});
      coordinator.resolve(request.requestId, 'allow');

      // Immediately attempt to resolve again -- should detect conflict
      const result = coordinator.resolve(request.requestId, 'deny');
      expect(result.conflict).toBe(true);
      expect(result.ok).toBe(false);
    });

    it('recently resolved entries are garbage collected after timeout period', () => {
      const { request } = coordinator.request('sess-1', 'edit_file', {});
      coordinator.resolve(request.requestId, 'allow');

      // Should be conflict immediately
      expect(coordinator.resolve(request.requestId, 'deny').conflict).toBe(true);

      // Advance past GC timeout
      vi.advanceTimersByTime(5_001);

      // Now it should be unknown (GC cleaned up the recently-resolved entry)
      const result = coordinator.resolve(request.requestId, 'deny');
      expect(result.conflict).toBe(false);
      expect(result.message).toBe('Unknown permission request');
    });
  });

  // -----------------------------------------------------------------------
  // Late resolution after timeout
  // -----------------------------------------------------------------------

  describe('late resolution after timeout', () => {
    it('treats late resolution after timeout as unknown (not conflict)', async () => {
      const { request, decision } = coordinator.request('sess-1', 'write_file', { path: 'late.txt' });

      vi.advanceTimersByTime(5_001);
      await expect(decision).resolves.toBe('deny');

      // The timeout callback deletes from pending. Then the recently-resolved GC timer
      // for timeout is not set, so requestId won't be in recentlyResolved either.
      // However, in the timeout handler, the entry is deleted from this.pending
      // but NOT added to recentlyResolved. So a late resolve returns 'Unknown'.
      const late = coordinator.resolve(request.requestId, 'allow');
      expect(late.ok).toBe(false);
      // After timeout, the request is deleted from pending but not added to recentlyResolved,
      // so it's unknown, not conflict.
      expect(late.message).toContain('Unknown permission request');
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles empty args', () => {
      const { request } = coordinator.request('sess-1', 'edit_file', {});
      expect(request.args).toEqual({});
    });

    it('handles different sessions with same tool', async () => {
      const r1 = coordinator.request('sess-A', 'edit_file', {});
      const r2 = coordinator.request('sess-B', 'edit_file', {});

      expect(r1.request.sessionId).toBe('sess-A');
      expect(r2.request.sessionId).toBe('sess-B');

      coordinator.resolve(r1.request.requestId, 'allow');
      coordinator.resolve(r2.request.requestId, 'deny');

      expect(await r1.decision).toBe('allow');
      expect(await r2.decision).toBe('deny');
    });

    it('handles rapid sequential requests and resolutions', async () => {
      const results: string[] = [];
      for (let i = 0; i < 20; i++) {
        const { request, decision } = coordinator.request('sess-1', 'edit_file', { i });
        const d = i % 2 === 0 ? 'allow' : 'deny';
        coordinator.resolve(request.requestId, d as 'allow' | 'deny');
        results.push(await decision);
      }
      expect(results).toHaveLength(20);
      expect(results.filter((r) => r === 'allow')).toHaveLength(10);
      expect(results.filter((r) => r === 'deny')).toHaveLength(10);
    });
  });
});
