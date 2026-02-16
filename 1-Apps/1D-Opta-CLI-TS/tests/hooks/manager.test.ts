import { describe, it, expect } from 'vitest';
import { HookManager, NoOpHookManager } from '../../src/hooks/manager.js';

describe('HookManager', () => {
  // Task 1: No-op path
  describe('no-op path', () => {
    it('returns non-cancelled when no hooks configured', async () => {
      const mgr = HookManager.create();
      const r = await mgr.fire('session.start', {
        event: 'session.start',
        session_id: 't',
        cwd: '/tmp',
      });
      expect(r.cancelled).toBe(false);
    });

    it('create([]) returns no-op manager', async () => {
      const mgr = HookManager.create([]);
      const r = await mgr.fire('tool.pre', {
        event: 'tool.pre',
        session_id: 't',
        cwd: '/tmp',
        tool_name: 'x',
      });
      expect(r.cancelled).toBe(false);
    });

    it('create() without args returns NoOpHookManager', () => {
      const mgr = HookManager.create();
      expect(mgr).toBeInstanceOf(NoOpHookManager);
    });

    it('create([]) returns NoOpHookManager', () => {
      const mgr = HookManager.create([]);
      expect(mgr).toBeInstanceOf(NoOpHookManager);
    });
  });

  // Task 2: Execution + env vars
  describe('execution + env vars', () => {
    it('fires hook and passes env vars', async () => {
      const mgr = HookManager.create([
        { event: 'session.start', command: 'echo "$OPTA_EVENT"' },
      ]);
      const r = await mgr.fire('session.start', {
        event: 'session.start',
        session_id: 's42',
        cwd: '/tmp',
      });
      expect(r.cancelled).toBe(false);
    });

    it('skips hooks for non-matching events', async () => {
      const mgr = HookManager.create([
        { event: 'session.end', command: 'exit 1' },
      ]);
      const r = await mgr.fire('session.start', {
        event: 'session.start',
        session_id: 't',
        cwd: '/tmp',
      });
      expect(r.cancelled).toBe(false);
    });

    it('create with definitions returns HookManager (not NoOp)', () => {
      const mgr = HookManager.create([
        { event: 'session.start', command: 'echo hi' },
      ]);
      expect(mgr).toBeInstanceOf(HookManager);
      expect(mgr).not.toBeInstanceOf(NoOpHookManager);
    });
  });

  // Task 3: Matcher patterns
  describe('matcher patterns', () => {
    it('matcher regex filters by tool name', async () => {
      const mgr = HookManager.create([
        { event: 'tool.pre', matcher: 'edit_file|write_file', command: 'exit 1' },
      ]);
      expect(
        (
          await mgr.fire('tool.pre', {
            event: 'tool.pre',
            session_id: 't',
            cwd: '/tmp',
            tool_name: 'edit_file',
          })
        ).cancelled,
      ).toBe(true);
      expect(
        (
          await mgr.fire('tool.pre', {
            event: 'tool.pre',
            session_id: 't',
            cwd: '/tmp',
            tool_name: 'read_file',
          })
        ).cancelled,
      ).toBe(false);
    });

    it('matches MCP tool names with mcp__.*', async () => {
      const mgr = HookManager.create([
        { event: 'tool.pre', matcher: 'mcp__.*', command: 'exit 1' },
      ]);
      const r = await mgr.fire('tool.pre', {
        event: 'tool.pre',
        session_id: 't',
        cwd: '/tmp',
        tool_name: 'mcp__mem__save',
      });
      expect(r.cancelled).toBe(true);
    });

    it('does not match when tool_name is absent', async () => {
      const mgr = HookManager.create([
        { event: 'tool.pre', matcher: 'edit_file', command: 'exit 1' },
      ]);
      const r = await mgr.fire('tool.pre', {
        event: 'tool.pre',
        session_id: 't',
        cwd: '/tmp',
      });
      expect(r.cancelled).toBe(false);
    });
  });

  // Task 4: tool.pre cancellation
  describe('tool.pre cancellation', () => {
    it('non-zero exit on tool.pre cancels with stderr reason', async () => {
      const mgr = HookManager.create([
        { event: 'tool.pre', command: 'echo "Blocked" >&2 && exit 1' },
      ]);
      const r = await mgr.fire('tool.pre', {
        event: 'tool.pre',
        session_id: 't',
        cwd: '/tmp',
        tool_name: 'run_command',
      });
      expect(r.cancelled).toBe(true);
      expect(r.reason).toContain('Blocked');
    });

    it('non-zero exit on tool.post does NOT cancel', async () => {
      const mgr = HookManager.create([
        { event: 'tool.post', command: 'exit 1' },
      ]);
      const r = await mgr.fire('tool.post', {
        event: 'tool.post',
        session_id: 't',
        cwd: '/tmp',
        tool_name: 'edit_file',
      });
      expect(r.cancelled).toBe(false);
    });

    it('non-zero exit on session.start does NOT cancel', async () => {
      const mgr = HookManager.create([
        { event: 'session.start', command: 'exit 1' },
      ]);
      const r = await mgr.fire('session.start', {
        event: 'session.start',
        session_id: 't',
        cwd: '/tmp',
      });
      expect(r.cancelled).toBe(false);
    });
  });

  // Task 5: Timeout protection
  describe('timeout', () => {
    it('kills hooks exceeding timeout', async () => {
      const mgr = HookManager.create([
        { event: 'session.start', command: 'sleep 60', timeout: 200 },
      ]);
      const start = Date.now();
      await mgr.fire('session.start', {
        event: 'session.start',
        session_id: 't',
        cwd: '/tmp',
      });
      expect(Date.now() - start).toBeLessThan(2000);
    });

    it('timed-out tool.pre does not cancel', async () => {
      const mgr = HookManager.create([
        { event: 'tool.pre', command: 'sleep 60', timeout: 200 },
      ]);
      const r = await mgr.fire('tool.pre', {
        event: 'tool.pre',
        session_id: 't',
        cwd: '/tmp',
        tool_name: 'edit_file',
      });
      // Timeout errors are swallowed, not treated as cancellation
      expect(r.cancelled).toBe(false);
    });
  });

  // Task 6: Background hooks
  describe('background hooks', () => {
    it('background hooks do not block', async () => {
      const mgr = HookManager.create([
        { event: 'session.end', command: 'sleep 5', background: true },
      ]);
      const start = Date.now();
      await mgr.fire('session.end', {
        event: 'session.end',
        session_id: 't',
        cwd: '/tmp',
      });
      expect(Date.now() - start).toBeLessThan(1000);
    });

    it('background hook errors are swallowed', async () => {
      const mgr = HookManager.create([
        { event: 'session.end', command: 'exit 1', background: true },
      ]);
      // Should not throw
      const r = await mgr.fire('session.end', {
        event: 'session.end',
        session_id: 't',
        cwd: '/tmp',
      });
      expect(r.cancelled).toBe(false);
    });
  });
});
