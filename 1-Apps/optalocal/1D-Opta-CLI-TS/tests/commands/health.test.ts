import { beforeEach, describe, expect, it, vi } from 'vitest';

const { execaMock, daemonStatusMock } = vi.hoisted(() => ({
  execaMock: vi.fn(),
  daemonStatusMock: vi.fn(),
}));

vi.mock('execa', () => ({
  execa: execaMock,
}));

vi.mock('../../src/daemon/lifecycle.js', () => ({
  daemonStatus: daemonStatusMock,
}));

import { runHealth } from '../../src/commands/health.js';
import { ExitError } from '../../src/core/errors.js';

describe('runHealth', () => {
  beforeEach(() => {
    execaMock.mockReset();
    daemonStatusMock.mockReset();
  });

  it('emits JSON summary and does not fail on warnings-only state', async () => {
    execaMock
      .mockResolvedValueOnce({ exitCode: 0, stdout: '/usr/local/bin/opta', stderr: '' }) // command -v
      .mockResolvedValueOnce({ exitCode: 0, stdout: '0.5.0-alpha.1', stderr: '' }) // --version
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: 'Commands:\n  daemon\n  health\n  doctor\n  settings\n  update\n',
        stderr: '',
      }); // --help
    daemonStatusMock.mockResolvedValue({
      running: false,
      state: null,
      logsPath: '/tmp/opta-daemon.log',
    });

    const out: string[] = [];
    const logSpy = vi.spyOn(console, 'log').mockImplementation((value?: unknown) => {
      out.push(String(value ?? ''));
    });

    await runHealth({ json: true });

    logSpy.mockRestore();
    expect(out.length).toBeGreaterThan(0);
    const payload = JSON.parse(out.join('\n'));
    expect(payload.summary).toMatchObject({
      passed: 1,
      warnings: 1,
      failures: 0,
    });
  });

  it('throws ExitError when a failing health check is present', async () => {
    execaMock.mockResolvedValueOnce({ exitCode: 1, stdout: '', stderr: 'not found' }); // command -v
    daemonStatusMock.mockResolvedValue({
      running: false,
      state: null,
      logsPath: '/tmp/opta-daemon.log',
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await expect(runHealth({ json: true })).rejects.toBeInstanceOf(ExitError);
    logSpy.mockRestore();
  });
});
