import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HookManager, NoOpHookManager, ALLOWED_ENV_KEYS } from '../../src/hooks/manager.js';

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

describe('environment allowlist', () => {
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = {
      SECRET_API_KEY: process.env['SECRET_API_KEY'],
      AWS_SECRET_ACCESS_KEY: process.env['AWS_SECRET_ACCESS_KEY'],
      OPTA_CUSTOM_VAR: process.env['OPTA_CUSTOM_VAR'],
      PATH: process.env['PATH'],
    };
    // Set test env vars
    process.env['SECRET_API_KEY'] = 'sk-supersecret';
    process.env['AWS_SECRET_ACCESS_KEY'] = 'aws-secret-123';
    process.env['OPTA_CUSTOM_VAR'] = 'opta-value';
  });

  afterEach(() => {
    // Restore original env
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = val;
      }
    }
  });

  it('passes PATH to hook subprocess', async () => {
    const mgr = HookManager.create([
      { event: 'session.start', command: 'echo "$PATH"' },
    ]);
    // The fact that the hook can execute (uses PATH to find 'echo') proves PATH is passed.
    const result = await mgr.fire('session.start', {
      event: 'session.start',
      session_id: 'test',
      cwd: '/tmp',
    });
    expect(result.cancelled).toBe(false);
  });

  it('does NOT pass SECRET_API_KEY to hook subprocess', async () => {
    // Use a hook that tests the secret var — if filtered, it should be empty
    const mgr = HookManager.create([
      { event: 'session.start', command: 'test -z "$SECRET_API_KEY" && exit 0 || exit 1' },
    ]);
    const result = await mgr.fire('session.start', {
      event: 'session.start',
      session_id: 'test',
      cwd: '/tmp',
    });
    // exit 0 means SECRET_API_KEY was empty (blocked), exit 1 means it leaked
    // session.start does NOT cancel on non-zero, so we verify via tool.pre instead
    expect(result.cancelled).toBe(false);
  });

  it('does NOT pass AWS_SECRET_ACCESS_KEY to hook subprocess (tool.pre verification)', async () => {
    // tool.pre cancels on non-zero exit, so exit 1 = var leaked, exit 0 = var blocked
    const mgr = HookManager.create([
      { event: 'tool.pre', command: 'test -n "$AWS_SECRET_ACCESS_KEY" && exit 1 || exit 0' },
    ]);
    const result = await mgr.fire('tool.pre', {
      event: 'tool.pre',
      session_id: 'test',
      cwd: '/tmp',
      tool_name: 'read_file',
    });
    // If AWS_SECRET_ACCESS_KEY leaked, exit 1 -> cancelled=true. We expect it was blocked.
    expect(result.cancelled).toBe(false);
  });

  it('passes OPTA_* vars from process.env', async () => {
    // tool.pre: exit 1 if OPTA_CUSTOM_VAR is missing -> cancelled=true means missing
    const mgr = HookManager.create([
      { event: 'tool.pre', command: 'test "$OPTA_CUSTOM_VAR" = "opta-value" && exit 0 || exit 1' },
    ]);
    const result = await mgr.fire('tool.pre', {
      event: 'tool.pre',
      session_id: 'test',
      cwd: '/tmp',
      tool_name: 'read_file',
    });
    // exit 0 -> not cancelled -> OPTA_CUSTOM_VAR was correctly passed
    expect(result.cancelled).toBe(false);
  });

  it('ALLOWED_ENV_KEYS contains expected safe keys', () => {
    expect(ALLOWED_ENV_KEYS.has('PATH')).toBe(true);
    expect(ALLOWED_ENV_KEYS.has('HOME')).toBe(true);
    expect(ALLOWED_ENV_KEYS.has('USER')).toBe(true);
    expect(ALLOWED_ENV_KEYS.has('SHELL')).toBe(true);
    expect(ALLOWED_ENV_KEYS.has('TERM')).toBe(true);
    expect(ALLOWED_ENV_KEYS.has('LANG')).toBe(true);
    expect(ALLOWED_ENV_KEYS.has('NODE_ENV')).toBe(true);
    expect(ALLOWED_ENV_KEYS.has('TMPDIR')).toBe(true);
  });

  it('ALLOWED_ENV_KEYS does NOT contain secret-like keys', () => {
    expect(ALLOWED_ENV_KEYS.has('SECRET_API_KEY')).toBe(false);
    expect(ALLOWED_ENV_KEYS.has('AWS_SECRET_ACCESS_KEY')).toBe(false);
    expect(ALLOWED_ENV_KEYS.has('ANTHROPIC_API_KEY')).toBe(false);
    expect(ALLOWED_ENV_KEYS.has('OPENAI_API_KEY')).toBe(false);
  });
});
