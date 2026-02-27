import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runBrowserControlAction } from '../../src/browser/control-surface.js';
import { DEFAULT_CONFIG } from '../../src/core/config.js';
import { resetSharedBrowserRuntimeDaemonForTests } from '../../src/browser/runtime-daemon.js';

let testDir = '';

afterEach(async () => {
  vi.restoreAllMocks();
  await resetSharedBrowserRuntimeDaemonForTests();
  if (testDir) {
    await rm(testDir, { recursive: true, force: true });
    testDir = '';
  }
});

describe('browser control surface', () => {
  it('status does not implicitly start the runtime daemon', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-control-'));
    vi.spyOn(process, 'cwd').mockReturnValue(testDir);

    const config = structuredClone(DEFAULT_CONFIG);
    const result = await runBrowserControlAction('status', config);

    expect(result.ok).toBe(true);
    expect(result.health.running).toBe(false);
    expect(result.health.killed).toBe(false);
  });

  it('kill path is explicit and remains visible through status checks', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-control-'));
    vi.spyOn(process, 'cwd').mockReturnValue(testDir);

    const config = structuredClone(DEFAULT_CONFIG);

    const killed = await runBrowserControlAction('kill', config);
    expect(killed.ok).toBe(true);
    expect(killed.health.running).toBe(false);
    expect(killed.health.killed).toBe(true);

    const status = await runBrowserControlAction('status', config);
    expect(status.health.running).toBe(false);
    expect(status.health.killed).toBe(true);
  });

  it('pause returns a non-success result when runtime is not running', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-control-'));
    vi.spyOn(process, 'cwd').mockReturnValue(testDir);

    const config = structuredClone(DEFAULT_CONFIG);
    const paused = await runBrowserControlAction('pause', config);

    expect(paused.ok).toBe(false);
    expect(paused.message).toContain('not running');
  });

  it('stop is idempotent when runtime is already stopped', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-control-'));
    vi.spyOn(process, 'cwd').mockReturnValue(testDir);

    const config = structuredClone(DEFAULT_CONFIG);
    const stopped = await runBrowserControlAction('stop', config);

    expect(stopped.ok).toBe(true);
    expect(stopped.health.running).toBe(false);
    expect(stopped.message).toContain('already stopped');
  });
});
