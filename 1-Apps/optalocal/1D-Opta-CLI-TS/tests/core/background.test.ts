import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CircularBuffer, ProcessManager, type ProcessStatus } from '../../src/core/background.js';

describe('CircularBuffer', () => {
  it('stores and retrieves lines', () => {
    const buf = new CircularBuffer(1024);
    buf.append('line one\n');
    buf.append('line two\n');
    expect(buf.getLines(10)).toEqual(['line one', 'line two']);
  });

  it('returns last N lines', () => {
    const buf = new CircularBuffer(1024);
    buf.append('a\nb\nc\nd\ne\n');
    expect(buf.getLines(2)).toEqual(['d', 'e']);
  });

  it('evicts oldest data when full', () => {
    const buf = new CircularBuffer(20); // tiny buffer
    buf.append('aaaaaaaaaa\n'); // 11 bytes
    buf.append('bbbbbbbbbb\n'); // 11 bytes -- pushes out 'a' line
    const lines = buf.getLines(10);
    expect(lines).not.toContain('aaaaaaaaaa');
    expect(lines).toContain('bbbbbbbbbb');
  });

  it('tracks total bytes written', () => {
    const buf = new CircularBuffer(1024);
    buf.append('hello\n');
    expect(buf.totalBytesWritten).toBe(6);
  });

  it('returns lines since offset', () => {
    const buf = new CircularBuffer(1024);
    buf.append('line1\nline2\n');
    const offset1 = buf.currentOffset;
    buf.append('line3\nline4\n');
    expect(buf.getLinesSince(offset1)).toEqual(['line3', 'line4']);
  });

  it('handles partial lines (no trailing newline)', () => {
    const buf = new CircularBuffer(1024);
    buf.append('complete\npartial');
    expect(buf.getLines(10)).toEqual(['complete', 'partial']);
  });

  it('returns empty array for empty buffer', () => {
    const buf = new CircularBuffer(1024);
    expect(buf.getLines(10)).toEqual([]);
  });

  it('handles multiple appends building up lines', () => {
    const buf = new CircularBuffer(1024);
    buf.append('hel');
    buf.append('lo\nwor');
    buf.append('ld\n');
    expect(buf.getLines(10)).toEqual(['hello', 'world']);
  });

  it('getLinesSince returns empty when no new lines', () => {
    const buf = new CircularBuffer(1024);
    buf.append('line1\nline2\n');
    const offset = buf.currentOffset;
    expect(buf.getLinesSince(offset)).toEqual([]);
  });
});

describe('ProcessManager', () => {
  let pm: ProcessManager;

  beforeEach(() => {
    pm = new ProcessManager({ maxConcurrent: 3, defaultTimeout: 5000, maxBufferSize: 1024 });
  });

  afterEach(async () => {
    await pm.killAll();
  });

  it('starts a process and returns a handle', async () => {
    const handle = await pm.start('echo hello');
    expect(handle.id).toBeTruthy();
    expect(handle.id.length).toBe(8);
    expect(handle.pid).toBeGreaterThan(0);
  });

  it('completes with exit code 0 for successful command', async () => {
    const handle = await pm.start('echo done');
    // Wait for completion
    await new Promise((r) => setTimeout(r, 200));
    const status = pm.status(handle.id) as ProcessStatus;
    expect(status.state).toBe('completed');
    expect(status.exitCode).toBe(0);
  });

  it('captures stdout', async () => {
    const handle = await pm.start('echo hello');
    await new Promise((r) => setTimeout(r, 200));
    const output = pm.output(handle.id, { lines: 10 });
    expect(output.stdout).toContain('hello');
  });

  it('captures stderr', async () => {
    const handle = await pm.start('echo err >&2');
    await new Promise((r) => setTimeout(r, 200));
    const output = pm.output(handle.id, { lines: 10, stream: 'stderr' });
    expect(output.stderr).toContain('err');
  });

  it('rejects when maxConcurrent reached', async () => {
    await pm.start('sleep 10');
    await pm.start('sleep 10');
    await pm.start('sleep 10');
    await expect(pm.start('sleep 10')).rejects.toThrow('concurrent');
  });

  it('kills a running process', async () => {
    const handle = await pm.start('sleep 30');
    const killed = await pm.kill(handle.id);
    expect(killed).toBe(true);
    await new Promise((r) => setTimeout(r, 100));
    const status = pm.status(handle.id) as ProcessStatus;
    expect(status.state).toBe('killed');
  });

  it('returns status for unknown id', () => {
    expect(() => pm.status('bogus')).toThrow('not found');
  });

  it('tracks failed processes', async () => {
    const handle = await pm.start('exit 1');
    await new Promise((r) => setTimeout(r, 200));
    const status = pm.status(handle.id) as ProcessStatus;
    expect(status.state).toBe('failed');
    expect(status.exitCode).toBe(1);
  });

  it('lists all processes', async () => {
    await pm.start('echo first');
    await pm.start('echo second');
    await new Promise((r) => setTimeout(r, 200));
    const all = pm.status() as ProcessStatus[];
    expect(all).toHaveLength(2);
  });
});

describe('ProcessManager.output', () => {
  it('returns new output since last read by default', async () => {
    const pm = new ProcessManager({ maxConcurrent: 5, defaultTimeout: 5000, maxBufferSize: 4096 });
    const h = await pm.start('echo line1 && sleep 0.1 && echo line2');

    await new Promise((r) => setTimeout(r, 50));
    const first = pm.output(h.id, { sinceLastRead: true });
    expect(first.stdout).toContain('line1');

    await new Promise((r) => setTimeout(r, 300));
    const second = pm.output(h.id, { sinceLastRead: true });
    expect(second.stdout).toContain('line2');
    expect(second.stdout).not.toContain('line1'); // already read

    await pm.killAll();
  });

  it('returns tail lines when sinceLastRead is false', async () => {
    const pm = new ProcessManager({ maxConcurrent: 5, defaultTimeout: 5000, maxBufferSize: 4096 });
    const h = await pm.start('seq 1 20');
    await new Promise((r) => setTimeout(r, 200));

    const out = pm.output(h.id, { lines: 5, sinceLastRead: false });
    const lines = out.stdout.trim().split('\n');
    expect(lines.length).toBeLessThanOrEqual(5);
    expect(lines).toContain('20');

    await pm.killAll();
  });

  it('returns empty when no new output since last read', async () => {
    const pm = new ProcessManager({ maxConcurrent: 5, defaultTimeout: 5000, maxBufferSize: 4096 });
    const h = await pm.start('echo hello');
    await new Promise((r) => setTimeout(r, 200));

    pm.output(h.id, { sinceLastRead: true }); // consume all
    const second = pm.output(h.id, { sinceLastRead: true });
    expect(second.stdout).toBe('');

    await pm.killAll();
  });

  it('only returns stderr when stream is stderr', async () => {
    const pm = new ProcessManager({ maxConcurrent: 5, defaultTimeout: 5000, maxBufferSize: 4096 });
    const h = await pm.start('echo out && echo err >&2');
    await new Promise((r) => setTimeout(r, 200));

    const out = pm.output(h.id, { stream: 'stderr', sinceLastRead: false });
    expect(out.stderr).toContain('err');
    expect(out.stdout).toBe('');

    await pm.killAll();
  });
});

describe('ProcessManager.kill', () => {
  it('sends SIGTERM then SIGKILL after grace period', async () => {
    const pm = new ProcessManager({ maxConcurrent: 5, defaultTimeout: 60000, maxBufferSize: 1024 });
    // trap SIGTERM so process doesn't die immediately
    const h = await pm.start('trap "" TERM; sleep 30');
    await new Promise((r) => setTimeout(r, 100));

    const killed = await pm.kill(h.id, 'SIGTERM');
    expect(killed).toBe(true);

    // After 6 seconds, SIGKILL should have fired
    await new Promise((r) => setTimeout(r, 6000));
    const status = pm.status(h.id) as ProcessStatus;
    expect(status.state).not.toBe('running');

    await pm.killAll();
  }, 10000);

  it('killAll terminates all running processes', async () => {
    const pm = new ProcessManager({ maxConcurrent: 5, defaultTimeout: 60000, maxBufferSize: 1024 });
    await pm.start('sleep 30');
    await pm.start('sleep 30');
    expect(pm.activeCount).toBe(2);

    await pm.killAll();
    await new Promise((r) => setTimeout(r, 200));
    expect(pm.activeCount).toBe(0);
  });

  it('returns false for already-dead process', async () => {
    const pm = new ProcessManager({ maxConcurrent: 5, defaultTimeout: 5000, maxBufferSize: 1024 });
    const h = await pm.start('echo done');
    await new Promise((r) => setTimeout(r, 200));

    const killed = await pm.kill(h.id);
    expect(killed).toBe(false);

    await pm.killAll();
  });

  it('throws for unknown process id', async () => {
    const pm = new ProcessManager({ maxConcurrent: 5, defaultTimeout: 5000, maxBufferSize: 1024 });
    await expect(pm.kill('bogus')).rejects.toThrow('not found');
  });
});

describe('ProcessManager.timeout', () => {
  it('auto-kills process after timeout', async () => {
    const pm = new ProcessManager({ maxConcurrent: 5, defaultTimeout: 500, maxBufferSize: 1024 });
    const h = await pm.start('sleep 30'); // default timeout = 500ms

    await new Promise((r) => setTimeout(r, 1500));
    const status = pm.status(h.id) as ProcessStatus;
    expect(status.state).toBe('timeout');

    await pm.killAll();
  }, 5000);

  it('respects per-process timeout override', async () => {
    const pm = new ProcessManager({ maxConcurrent: 5, defaultTimeout: 60000, maxBufferSize: 1024 });
    const h = await pm.start('sleep 30', { timeout: 500 });

    await new Promise((r) => setTimeout(r, 1500));
    const status = pm.status(h.id) as ProcessStatus;
    expect(status.state).toBe('timeout');

    await pm.killAll();
  }, 5000);

  it('no timeout when timeout is 0', async () => {
    const pm = new ProcessManager({ maxConcurrent: 5, defaultTimeout: 0, maxBufferSize: 1024 });
    const h = await pm.start('sleep 0.3');

    await new Promise((r) => setTimeout(r, 500));
    const status = pm.status(h.id) as ProcessStatus;
    // Should complete naturally, not timeout
    expect(status.state).toBe('completed');

    await pm.killAll();
  });
});

describe('ProcessManager.error handling', () => {
  it('transitions to failed state on child error event', async () => {
    const pm = new ProcessManager({ maxConcurrent: 5, defaultTimeout: 60000, maxBufferSize: 1024 });
    const handle = await pm.start('sleep 30');
    // Access internal state to simulate an error event
    const procs = (pm as unknown as { processes: Map<string, { child: { emit: (e: string, err: Error) => void }; state: string }> }).processes;
    const proc = procs.get(handle.id)!;
    proc.child.emit('error', new Error('test spawn error'));
    expect(proc.state).toBe('failed');
    await pm.killAll();
  });

  it('cleanup awaits killAll and clears processes', async () => {
    const pm = new ProcessManager({ maxConcurrent: 5, defaultTimeout: 60000, maxBufferSize: 1024 });
    await pm.start('sleep 30');
    await pm.start('sleep 30');
    expect(pm.activeCount).toBe(2);
    await pm.cleanup();
    expect(pm.activeCount).toBe(0);
  });
});
