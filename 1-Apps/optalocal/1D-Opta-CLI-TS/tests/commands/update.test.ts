import { describe, expect, it, vi } from 'vitest';
import {
  CLI_UPDATE_BUILD_SCRIPT,
  missingOptaCommands,
  parseComponentList,
  parseRemoteLanGuardMarker,
  remoteConnectFailureStatus,
  resolveRemoteHostCandidates,
  resolveTargets,
  selectReachableRemoteHost,
} from '../../src/commands/update.js';

describe('update command helpers', () => {
  it('runs CLI typecheck before build in update script', () => {
    expect(CLI_UPDATE_BUILD_SCRIPT).toContain('npm run -s typecheck');
    expect(CLI_UPDATE_BUILD_SCRIPT).toContain('npm run -s build');
    expect(CLI_UPDATE_BUILD_SCRIPT.indexOf('npm run -s typecheck'))
      .toBeLessThan(CLI_UPDATE_BUILD_SCRIPT.indexOf('npm run -s build'));
  });

  describe('parseComponentList', () => {
    it('defaults to core components when empty', () => {
      expect(parseComponentList()).toEqual(['cli', 'lmx', 'plus']);
      expect(parseComponentList('')).toEqual(['cli', 'lmx', 'plus']);
    });

    it('parses and de-duplicates valid components', () => {
      expect(parseComponentList('lmx,web,cli,lmx')).toEqual(['lmx', 'web', 'cli']);
    });

    it('throws on invalid component names', () => {
      expect(() => parseComponentList('lmx,ios')).toThrow(/Invalid components/);
      expect(() => parseComponentList('lmx,ios')).toThrow(/cli,lmx,plus,web/);
    });
  });

  describe('resolveTargets', () => {
    it('resolves explicit target modes', () => {
      expect(resolveTargets('local', 'mono512')).toEqual(['local']);
      expect(resolveTargets('remote', 'mono512')).toEqual(['remote']);
      expect(resolveTargets('both', 'mono512')).toEqual(['local', 'remote']);
    });

    it('uses local-only in auto mode for localhost', () => {
      expect(resolveTargets('auto', 'localhost')).toEqual(['local']);
      expect(resolveTargets('auto', '127.0.0.1')).toEqual(['local']);
    });

    it('uses local + remote in auto mode for non-local host', () => {
      expect(resolveTargets('auto', 'Mono512')).toEqual(['local', 'remote']);
    });
  });

  describe('remoteConnectFailureStatus', () => {
    it('uses skip in auto mode to preserve local updates when studio SSH is down', () => {
      expect(remoteConnectFailureStatus('auto')).toBe('skip');
    });

    it('uses fail for explicit remote modes', () => {
      expect(remoteConnectFailureStatus('remote')).toBe('fail');
      expect(remoteConnectFailureStatus('both')).toBe('fail');
      expect(remoteConnectFailureStatus('local')).toBe('fail');
    });
  });

  describe('resolveRemoteHostCandidates', () => {
    it('returns primary first, then fallback hosts in order with case-insensitive dedupe', () => {
      expect(resolveRemoteHostCandidates(' Mono512 ', ['mono512', ' mono513 ', '', 'MONO513', 'mono514']))
        .toEqual(['Mono512', 'mono513', 'mono514']);
    });
  });

  describe('selectReachableRemoteHost', () => {
    it('selects the first reachable host and stops probing', async () => {
      const probe = vi.fn(async (host: string) => {
        if (host === 'backup-a') return { exitCode: 0, stdout: 'connected', stderr: '' };
        return { exitCode: 255, stdout: '', stderr: `${host} unreachable` };
      });

      const result = await selectReachableRemoteHost(['primary', 'backup-a', 'backup-b'], probe);

      expect(result.selectedHost).toBe('backup-a');
      expect(result.probes).toEqual([
        { host: 'primary', exitCode: 255, detail: 'primary unreachable' },
        { host: 'backup-a', exitCode: 0, detail: 'connected' },
      ]);
      expect(probe).toHaveBeenCalledTimes(2);
      expect(probe.mock.calls.map(([host]) => host)).toEqual(['primary', 'backup-a']);
    });

    it('returns null when no hosts are reachable', async () => {
      const probe = vi.fn(async (host: string) => ({
        exitCode: 255,
        stdout: '',
        stderr: `${host} timed out`,
      }));

      const result = await selectReachableRemoteHost(['primary', 'backup-a'], probe);

      expect(result.selectedHost).toBeNull();
      expect(result.probes).toEqual([
        { host: 'primary', exitCode: 255, detail: 'primary timed out' },
        { host: 'backup-a', exitCode: 255, detail: 'backup-a timed out' },
      ]);
      expect(probe).toHaveBeenCalledTimes(2);
      expect(probe.mock.calls.map(([host]) => host)).toEqual(['primary', 'backup-a']);
    });

    it('supports parallel probing while preserving host-priority selection order', async () => {
      const probe = vi.fn(async (host: string) => {
        if (host === 'primary') {
          await new Promise((resolve) => setTimeout(resolve, 30));
          return { exitCode: 255, stdout: '', stderr: 'primary unreachable' };
        }
        if (host === 'backup-a') {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return { exitCode: 0, stdout: 'backup-a connected', stderr: '' };
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { exitCode: 0, stdout: 'backup-b connected', stderr: '' };
      });

      const result = await selectReachableRemoteHost(
        ['primary', 'backup-a', 'backup-b'],
        probe,
        { parallel: true },
      );

      expect(result.selectedHost).toBe('backup-a');
      expect(result.probes).toEqual([
        { host: 'primary', exitCode: 255, detail: 'primary unreachable' },
        { host: 'backup-a', exitCode: 0, detail: 'backup-a connected' },
        { host: 'backup-b', exitCode: 0, detail: 'backup-b connected' },
      ]);
      expect(probe).toHaveBeenCalledTimes(3);
      expect(probe.mock.calls.map(([host]) => host)).toEqual(['primary', 'backup-a', 'backup-b']);
    });
  });

  describe('parseRemoteLanGuardMarker', () => {
    it('parses LAN guard markers from command output', () => {
      const parsed = parseRemoteLanGuardMarker('__LAN_GUARD__:dual_ip:192.168.1.10:192.168.1.10:On');
      expect(parsed).toEqual({
        state: 'dual_ip',
        ethernetIp: '192.168.1.10',
        wifiIp: '192.168.1.10',
        wifiPower: 'On',
      });
    });

    it('returns null when marker is not present', () => {
      expect(parseRemoteLanGuardMarker('connected')).toBeNull();
    });

    it('parses marker from multiline output', () => {
      const output = [
        'some log line',
        '__LAN_GUARD__:ok:192.168.188.11::Off',
        'done',
      ].join('\n');

      expect(parseRemoteLanGuardMarker(output)).toEqual({
        state: 'ok',
        ethernetIp: '192.168.188.11',
        wifiIp: '',
        wifiPower: 'Off',
      });
    });
  });

  describe('missingOptaCommands', () => {
    it('returns empty when required commands are present in help output', () => {
      const help = `
Commands:
  chat
  tui
  do
  benchmark
  status
  models
  config
  sessions
  mcp
  serve
  server
  daemon
  update
  doctor
  completions
`;
      expect(missingOptaCommands(help)).toEqual([]);
    });

    it('returns missing commands when help output is incomplete', () => {
      const help = `
Commands:
  chat
  do
  status
`;
      expect(missingOptaCommands(help)).toContain('update');
      expect(missingOptaCommands(help)).toContain('benchmark');
      expect(missingOptaCommands(help)).toContain('daemon');
      expect(missingOptaCommands(help)).toContain('completions');
    });
  });
});
