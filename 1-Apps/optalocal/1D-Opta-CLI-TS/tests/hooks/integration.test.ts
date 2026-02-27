import { describe, it, expect } from 'vitest';
import {
  createHookManager,
  fireSessionStart,
  fireSessionEnd,
  fireToolPre,
  fireToolPost,
  fireCompact,
  fireError,
} from '../../src/hooks/integration.js';
import { NoOpHookManager } from '../../src/hooks/manager.js';

describe('hook integration helpers', () => {
  it('createHookManager returns NoOpHookManager for empty config', () => {
    const mgr = createHookManager({ hooks: [] });
    expect(mgr).toBeInstanceOf(NoOpHookManager);
  });

  it('createHookManager returns NoOpHookManager for undefined hooks', () => {
    const mgr = createHookManager({});
    expect(mgr).toBeInstanceOf(NoOpHookManager);
  });

  it('createHookManager creates real manager when hooks present', () => {
    const mgr = createHookManager({
      hooks: [{ event: 'session.start', command: 'echo hi' }],
    });
    expect(mgr).not.toBeInstanceOf(NoOpHookManager);
  });

  it('fireSessionStart fires session.start event', async () => {
    const mgr = createHookManager({
      hooks: [{ event: 'session.start', command: 'echo test' }],
    });
    const r = await fireSessionStart(mgr, { sessionId: 's1', cwd: '/tmp', model: 'qwen' });
    expect(r.cancelled).toBe(false);
  });

  it('fireSessionEnd fires session.end event', async () => {
    const mgr = createHookManager({
      hooks: [{ event: 'session.end', command: 'echo test' }],
    });
    const r = await fireSessionEnd(mgr, { sessionId: 's1', cwd: '/tmp', model: 'qwen' });
    expect(r.cancelled).toBe(false);
  });

  it('fireToolPre fires tool.pre and can cancel', async () => {
    const mgr = createHookManager({
      hooks: [{ event: 'tool.pre', command: 'echo "No" >&2 && exit 1' }],
    });
    const r = await fireToolPre(mgr, 'run_command', '{"command":"rm -rf /"}', {
      sessionId: 's1',
      cwd: '/tmp',
      model: 'qwen',
    });
    expect(r.cancelled).toBe(true);
    expect(r.reason).toContain('No');
  });

  it('fireToolPost fires tool.post event', async () => {
    const mgr = createHookManager({
      hooks: [{ event: 'tool.post', command: 'echo done' }],
    });
    const r = await fireToolPost(mgr, 'edit_file', '{"path":"a.ts"}', 'OK', {
      sessionId: 's1',
      cwd: '/tmp',
      model: 'qwen',
    });
    expect(r.cancelled).toBe(false);
  });

  it('fireCompact fires compact event', async () => {
    const mgr = createHookManager({
      hooks: [{ event: 'compact', command: 'echo compact' }],
    });
    const r = await fireCompact(mgr, { sessionId: 's1', cwd: '/tmp', model: 'qwen' });
    expect(r.cancelled).toBe(false);
  });

  it('fireError fires error event', async () => {
    const mgr = createHookManager({
      hooks: [{ event: 'error', command: 'echo error' }],
    });
    const r = await fireError(mgr, 'Something went wrong', {
      sessionId: 's1',
      cwd: '/tmp',
      model: 'qwen',
    });
    expect(r.cancelled).toBe(false);
  });
});
