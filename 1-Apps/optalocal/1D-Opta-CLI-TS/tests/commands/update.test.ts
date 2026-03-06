import { describe, expect, it, vi } from 'vitest';
import {
  CLI_UPDATE_BUILD_SCRIPT,
  extractReachableRemoteHosts,
  missingOptaCommands,
  parseComponentList,
  parseTargetMode,
  parseRemoteHostList,
  parseRemoteLanGuardMarker,
  remoteConnectFailureStatus,
  resolveRemoteHostCandidates,
  resolveRolloutHosts,
  resolveTargets,
  summarizeMissingCommandSurface,
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
      expect(parseComponentList()).toEqual(['cli', 'daemon']);
      expect(parseComponentList('')).toEqual(['cli', 'daemon']);
    });

    it('parses and de-duplicates valid components', () => {
      expect(parseComponentList('daemon,cli,daemon')).toEqual(['cli', 'daemon']);
    });

    it('throws on invalid component names', () => {
      expect(() => parseComponentList('daemon,ios')).toThrow(/Invalid components/);
      expect(() => parseComponentList('daemon,ios')).toThrow(/cli,daemon/);
    });
  });

  describe('resolveTargets', () => {
    it('resolves only explicit local/remote modes', () => {
      expect(resolveTargets('local')).toEqual(['local']);
      expect(resolveTargets('remote')).toEqual(['remote']);
    });
  });

  describe('parseTargetMode', () => {
    it('accepts local and remote values', () => {
      expect(parseTargetMode('local')).toBe('local');
      expect(parseTargetMode('remote')).toBe('remote');
      expect(parseTargetMode(' Local ')).toBe('local');
    });

    it('throws on invalid values', () => {
      expect(() => parseTargetMode('auto')).toThrow(/Use: local,remote/);
      expect(() => parseTargetMode('both')).toThrow(/Use: local,remote/);
    });
  });

  describe('remoteConnectFailureStatus', () => {
    it('always fails when remote connectivity cannot be established', () => {
      expect(remoteConnectFailureStatus()).toBe('fail');
    });
  });

  describe('resolveRemoteHostCandidates', () => {
    it('returns primary first, then fallback hosts in order with case-insensitive dedupe', () => {
      expect(resolveRemoteHostCandidates(' remote-lab ', ['remote-lab', ' backup-a ', '', 'BACKUP-A', 'backup-b']))
        .toEqual(['remote-lab', 'backup-a', 'backup-b']);
    });

    it('appends discovered LAN hosts after configured hosts with case-insensitive dedupe', () => {
      expect(resolveRemoteHostCandidates('remote-lab', ['backup-a'], ['10.0.0.11', 'backup-a', '10.0.0.11']))
        .toEqual(['remote-lab', 'backup-a', '10.0.0.11']);
    });
  });

  describe('parseRemoteHostList', () => {
    it('parses comma-separated host list with trim and dedupe', () => {
      expect(parseRemoteHostList(' lmx-a.local, lmx-b.local ,LMX-A.local,,'))
        .toEqual(['lmx-a.local', 'lmx-b.local']);
    });

    it('returns empty list for empty values', () => {
      expect(parseRemoteHostList('')).toEqual([]);
      expect(parseRemoteHostList()).toEqual([]);
    });
  });

  describe('resolveRolloutHosts', () => {
    it('prefers explicit host list when provided', () => {
      expect(resolveRolloutHosts(
        ['lmx-a.local', 'lmx-b.local'],
        'lmx-a.local',
        false,
        ['lmx-b.local', 'lmx-missing.local'],
      )).toEqual(['lmx-b.local']);
    });

    it('returns all reachable hosts in rollout-all mode', () => {
      expect(resolveRolloutHosts(
        ['lmx-a.local', 'lmx-b.local'],
        'lmx-a.local',
        true,
      )).toEqual(['lmx-a.local', 'lmx-b.local']);
    });

    it('falls back to selected host for default behavior', () => {
      expect(resolveRolloutHosts(
        ['lmx-a.local', 'lmx-b.local'],
        'lmx-b.local',
        false,
      )).toEqual(['lmx-b.local']);
    });
  });

  describe('extractReachableRemoteHosts', () => {
    it('returns unique hosts that passed SSH probe in probe order', () => {
      expect(extractReachableRemoteHosts([
        { host: 'remote-lab', exitCode: 255, detail: 'timed out' },
        { host: 'backup-a', exitCode: 0, detail: 'connected' },
        { host: 'backup-b', exitCode: 0, detail: 'connected' },
        { host: 'BACKUP-A', exitCode: 0, detail: 'connected' },
      ])).toEqual(['backup-a', 'backup-b']);
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
        '__LAN_GUARD__:ok:10.0.0.11::Off',
        'done',
      ].join('\n');

      expect(parseRemoteLanGuardMarker(output)).toEqual({
        state: 'ok',
        ethernetIp: '10.0.0.11',
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
  health
  settings
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

  describe('summarizeMissingCommandSurface', () => {
    it('adds stale-surface guidance for remote when modern commands are missing', () => {
      const message = summarizeMissingCommandSurface('settings doctor', 'remote');
      expect(message).toContain('missing command entries in remote opta --help');
      expect(message).toContain('remote CLI appears older than this workspace');
    });

    it('keeps message compact when missing commands are non-critical', () => {
      const message = summarizeMissingCommandSurface('chat do', 'local');
      expect(message).toBe('missing command entries in local opta --help: chat do');
    });
  });

});
