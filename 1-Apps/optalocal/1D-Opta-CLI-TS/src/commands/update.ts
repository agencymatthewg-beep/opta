import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { execa } from 'execa';
import { loadConfig } from '../core/config.js';
import { ExitError, EXIT } from '../core/errors.js';
import { createSegmentedStepProgressTracker } from '../ui/progress.js';
import { colorizeOptaWord } from '../ui/brand.js';
import { writeUpdateLog } from '../journal/update-log.js';
import { homedir, isWindows } from '../platform/index.js';

export type UpdateComponent = 'cli' | 'daemon';
export type UpdateTarget = 'local' | 'remote';
export type UpdateTargetMode = UpdateTarget;

type StepStatus = 'ok' | 'skip' | 'fail';

export interface UpdateOptions {
  components?: string;
  target?: UpdateTargetMode;
  remoteHost?: string;
  remoteAll?: boolean;
  remoteHosts?: string;
  remoteUser?: string;
  identityFile?: string;
  localRoot?: string;
  remoteRoot?: string;
  dryRun?: boolean;
  build?: boolean;
  pull?: boolean;
  json?: boolean;
}

const SSH_CONNECT_TIMEOUT_SECONDS = 25;

interface StepResult {
  target: UpdateTarget;
  component: UpdateComponent;
  step: string;
  status: StepStatus;
  message: string;
  host?: string;
}

interface SshConfig {
  host: string;
  user: string;
  identityFile?: string;
}

export interface RemoteLanGuardProbe {
  state: 'ok' | 'dual_ip' | 'unsupported';
  ethernetIp: string;
  wifiIp: string;
  wifiPower: string;
}

interface RemoteLanGuardResult {
  status: StepStatus;
  message: string;
  canProceed: boolean;
}

interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

interface LocalCliPackArtifact {
  tarballPath: string;
  tempDir: string;
}

export interface RemoteHostProbe {
  host: string;
  exitCode: number;
  detail: string;
}

export interface RemoteHostSelection {
  selectedHost: string | null;
  probes: RemoteHostProbe[];
}

export interface SelectReachableRemoteHostOptions {
  parallel?: boolean;
}

interface DiscoveredRemoteHostCandidate {
  host: string;
  source: 'mdns' | 'sweep';
  latencyMs: number;
}

export const CLI_UPDATE_BUILD_SCRIPT =
  '((npm run -s typecheck && npm run -s build) || (npm install --no-fund --no-audit && npm run -s typecheck && npm run -s build)) && (npm link --force || npm link)';

const REQUIRED_OPTA_COMMANDS = [
  'chat',
  'tui',
  'do',
  'benchmark',
  'status',
  'models',
  'config',
  'sessions',
  'mcp',
  'serve',
  'server',
  'daemon',
  'health',
  'settings',
  'update',
  'doctor',
  'completions',
] as const;

export function missingOptaCommands(helpOutput: string): string[] {
  const lines = helpOutput.toLowerCase();
  return REQUIRED_OPTA_COMMANDS.filter((command) => {
    const pattern = new RegExp(`(^|\\s)${command}(\\s|$)`, 'm');
    return !pattern.test(lines);
  });
}

function parseMissingCommandList(raw: string): string[] {
  return raw
    .split(/\s+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function summarizeMissingCommandSurface(
  rawMissing: string,
  scope: 'local' | 'remote'
): string {
  const missing = parseMissingCommandList(rawMissing);
  const missingLabel = missing.length > 0 ? missing.join(' ') : 'unknown';
  const prefix = `missing command entries in ${scope} opta --help: ${missingLabel}`;
  const modernSurface = new Set(['health', 'settings', 'update', 'doctor']);
  const isLikelyStaleSurface = missing.some((command) => modernSurface.has(command));
  if (!isLikelyStaleSurface) return prefix;

  const hint =
    scope === 'remote'
      ? 'remote CLI appears older than this workspace; update that host from latest source, then rerun opta update --target remote'
      : 'local CLI appears older than this workspace; run npm run -s build && npm link in 1D-Opta-CLI-TS';
  return `${prefix} (${hint})`;
}

function quoteSh(input: string): string {
  return `'${input.replace(/'/g, `'"'"'`)}'`;
}

function expandHome(input: string): string {
  if (!input.startsWith('~')) return input;
  return homedir() + input.slice(1);
}

function isLocalHost(host: string): boolean {
  const lower = host.trim().toLowerCase();
  return lower === 'localhost' || lower === '127.0.0.1';
}

export function parseComponentList(raw?: string): UpdateComponent[] {
  // Canonical order keeps dependency flow deterministic:
  // CLI build/verify first, then daemon restart/verification.
  const componentOrder: UpdateComponent[] = ['cli', 'daemon'];
  if (!raw || raw.trim() === '') return [...componentOrder];
  const parts = raw
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);

  const allowed: UpdateComponent[] = ['cli', 'daemon'];
  const invalid = parts.filter((p) => !allowed.includes(p as UpdateComponent));
  if (invalid.length > 0) {
    throw new Error(`Invalid components: ${invalid.join(', ')}. Use: cli,daemon`);
  }

  const selected = new Set(parts as UpdateComponent[]);
  return componentOrder.filter((component) => selected.has(component));
}

export function parseTargetMode(raw?: string): UpdateTargetMode {
  const value = (raw ?? '').trim().toLowerCase();
  if (value === 'local' || value === 'remote') return value;
  throw new Error(`Invalid target mode: ${raw ?? ''}. Use: local,remote`);
}

export function resolveTargets(mode: UpdateTargetMode): UpdateTarget[] {
  return [mode];
}

export function remoteConnectFailureStatus(): StepStatus {
  return 'fail';
}

export function resolveRemoteHostCandidates(
  primaryHost: string,
  fallbackHosts: readonly string[] = [],
  discoveredHosts: readonly string[] = []
): string[] {
  const hosts = [primaryHost, ...fallbackHosts, ...discoveredHosts]
    .map((host) => host.trim())
    .filter((host) => host.length > 0);

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const host of hosts) {
    const key = host.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(host);
  }

  return deduped;
}

export function parseRemoteHostList(raw?: string): string[] {
  if (!raw || raw.trim().length === 0) return [];
  const parts = raw
    .split(',')
    .map((host) => host.trim())
    .filter((host) => host.length > 0);

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const host of parts) {
    const key = host.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(host);
  }
  return deduped;
}

export function resolveRolloutHosts(
  reachableHosts: readonly string[],
  selectedHost: string | null,
  rolloutAll: boolean,
  explicitHosts: readonly string[] = []
): string[] {
  const reachable = new Set(reachableHosts.map((host) => host.toLowerCase()));
  if (explicitHosts.length > 0) {
    return explicitHosts.filter((host) => reachable.has(host.toLowerCase()));
  }
  if (rolloutAll) {
    return [...reachableHosts];
  }
  return selectedHost ? [selectedHost] : [];
}

export function extractReachableRemoteHosts(probes: readonly RemoteHostProbe[]): string[] {
  const seen = new Set<string>();
  const hosts: string[] = [];

  for (const probe of probes) {
    if (probe.exitCode !== 0) continue;
    const key = probe.host.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    hosts.push(probe.host);
  }

  return hosts;
}

export async function selectReachableRemoteHost(
  hosts: readonly string[],
  probeHost: (host: string) => Promise<CommandResult>,
  options: SelectReachableRemoteHostOptions = {}
): Promise<RemoteHostSelection> {
  if (options.parallel) {
    const settled = await Promise.all(
      hosts.map(async (host) => {
        const result = await probeHost(host);
        const detail = result.stderr || result.stdout || 'ssh failed';
        return {
          host,
          exitCode: result.exitCode,
          detail,
        } satisfies RemoteHostProbe;
      })
    );

    const selected = settled.find((entry) => entry.exitCode === 0);
    return {
      selectedHost: selected?.host ?? null,
      probes: settled,
    };
  }

  const probes: RemoteHostProbe[] = [];

  for (const host of hosts) {
    const result = await probeHost(host);
    const detail = result.stderr || result.stdout || 'ssh failed';
    probes.push({
      host,
      exitCode: result.exitCode,
      detail,
    });

    if (result.exitCode === 0) {
      return {
        selectedHost: host,
        probes,
      };
    }
  }

  return {
    selectedHost: null,
    probes,
  };
}

function canPromptForRemoteHostSelection(opts: Pick<UpdateOptions, 'json'>): boolean {
  return (
    !opts.json &&
    Boolean(process.stdin.isTTY) &&
    Boolean(process.stdout.isTTY) &&
    process.env['CI'] !== 'true'
  );
}

async function promptForRemoteHostSelection(
  reachableHosts: readonly string[],
  discoveredHosts: readonly DiscoveredRemoteHostCandidate[]
): Promise<string> {
  const discoveredByHost = new Map<string, DiscoveredRemoteHostCandidate>();
  for (const host of discoveredHosts) {
    discoveredByHost.set(host.host.toLowerCase(), host);
  }

  const { select } = await import('@inquirer/prompts');
  const chosen = (await select({
    message: 'Select a reachable remote device to update',
    choices: reachableHosts.map((host) => {
      const discovered = discoveredByHost.get(host.toLowerCase());
      const sourceLabel = discovered ? (discovered.source === 'mdns' ? 'LAN mDNS' : 'LAN sweep') : 'configured';
      const latencyLabel = discovered ? `, ${discovered.latencyMs}ms` : '';
      return {
        name: `${host} (${sourceLabel}${latencyLabel})`,
        value: host,
      };
    }),
  })) as string;

  return chosen;
}

function canPromptForTargetSelection(opts: Pick<UpdateOptions, 'json'>): boolean {
  return canPromptForRemoteHostSelection(opts);
}

async function promptForUpdateTarget(): Promise<UpdateTarget> {
  const { select } = await import('@inquirer/prompts');
  const choice = (await select({
    message: 'Where should Opta update run?',
    choices: [
      {
        name: 'Local (this device)',
        value: 'local',
      },
      {
        name: 'Remote (choose a reachable device)',
        value: 'remote',
      },
    ],
  })) as UpdateTarget;
  return choice;
}

function detectAppsRoot(startCwd: string): string | null {
  const moduleProjectRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
  const candidates = new Set<string>([
    startCwd,
    dirname(startCwd),
    resolve(startCwd, '..', '..'),
    moduleProjectRoot,
    dirname(moduleProjectRoot),
    resolve(moduleProjectRoot, '..', '..'),
  ]);

  for (const candidate of candidates) {
    const resolved = resolve(candidate);

    if (basename(resolved) === '1-Apps') {
      return resolved;
    }

    if (basename(resolved) === '1D-Opta-CLI-TS' && basename(dirname(resolved)) === '1-Apps') {
      return dirname(resolved);
    }

    const asApps = join(resolved, '1-Apps');
    if (existsSync(asApps) && existsSync(join(asApps, '1D-Opta-CLI-TS'))) {
      return asApps;
    }

    if (existsSync(join(resolved, '1D-Opta-CLI-TS')) && existsSync(join(resolved, '1M-Opta-LMX'))) {
      return resolved;
    }
  }

  return null;
}

function deriveRemoteAppsRootFromLmxPath(lmxPath: string): string | null {
  const resolved = resolve(lmxPath);
  if (basename(resolved) === '1M-Opta-LMX') return dirname(resolved);
  const marker = '/1M-Opta-LMX';
  const idx = resolved.indexOf(marker);
  if (idx > 0) return resolved.slice(0, idx);
  return null;
}

function dedupePaths(paths: readonly (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const path of paths) {
    if (!path) continue;
    const trimmed = path.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function buildRemoteAppsRootCandidates(params: {
  explicitRoot?: string;
  derivedRoot?: string | null;
  localAppsRoot?: string | null;
  remoteUser: string;
}): string[] {
  const localUser = basename(homedir());
  const derivedOptalocal =
    params.derivedRoot && basename(params.derivedRoot).toLowerCase() !== 'optalocal'
      ? join(params.derivedRoot, 'optalocal')
      : null;

  return dedupePaths([
    params.explicitRoot,
    params.derivedRoot,
    derivedOptalocal,
    params.localAppsRoot,
    `/Users/${params.remoteUser}/Synced/Opta/1-Apps/optalocal`,
    `/Users/${params.remoteUser}/Synced/Opta/1-Apps`,
    `/Users/${params.remoteUser}/Opta/1-Apps/optalocal`,
    `/Users/${params.remoteUser}/Opta/1-Apps`,
    `/home/${params.remoteUser}/Synced/Opta/1-Apps/optalocal`,
    `/home/${params.remoteUser}/Synced/Opta/1-Apps`,
    `/home/${params.remoteUser}/Opta/1-Apps/optalocal`,
    `/home/${params.remoteUser}/Opta/1-Apps`,
    `/Users/${localUser}/Synced/Opta/1-Apps/optalocal`,
    `/Users/${localUser}/Synced/Opta/1-Apps`,
    '/Users/Shared/312/Opta/1-Apps/optalocal',
    '/Users/Shared/312/Opta/1-Apps',
  ]);
}

async function resolveRemoteAppsRootOnHost(
  ssh: SshConfig,
  candidates: readonly string[],
  dryRun: boolean
): Promise<{ root: string | null; tried: string[] }> {
  if (candidates.length === 0) {
    return { root: null, tried: [] };
  }
  if (dryRun) {
    return { root: candidates[0] ?? null, tried: [...candidates] };
  }

  const checks = candidates.map(
    (candidate) =>
      `if [ -d ${quoteSh(join(candidate, '1D-Opta-CLI-TS'))} ]; then echo "__APPS_ROOT__:${candidate}"; exit 0; fi`
  );
  const probeCommand = `${checks.join('; ')}; exit 24`;
  const result = await runRemoteCommand(ssh, probeCommand, false);
  if (result.exitCode !== 0) {
    return { root: null, tried: [...candidates] };
  }

  const marker = result.stdout
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('__APPS_ROOT__:'));
  const resolvedRoot = marker?.replace('__APPS_ROOT__:', '').trim() ?? null;
  return { root: resolvedRoot, tried: [...candidates] };
}

function componentRepoPath(component: UpdateComponent, appsRoot: string): string {
  switch (component) {
    case 'cli':
    case 'daemon':
      return join(appsRoot, '1D-Opta-CLI-TS');
  }
}

async function runLocalCommand(
  command: string,
  cwd?: string,
  dryRun = false
): Promise<CommandResult> {
  if (dryRun) {
    return { exitCode: 0, stdout: `[dry-run] ${command}`, stderr: '' };
  }

  const result = await execa('bash', ['-lc', command], {
    cwd,
    reject: false,
  });

  return {
    exitCode: result.exitCode ?? 1,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

async function runRemoteCommand(
  ssh: SshConfig,
  command: string,
  dryRun = false
): Promise<CommandResult> {
  if (dryRun) {
    return { exitCode: 0, stdout: `[dry-run][${ssh.host}] ${command}`, stderr: '' };
  }

  const commandWithPath = `export PATH=/opt/homebrew/bin:/usr/local/bin:$PATH; ${command}`;
  const args: string[] = [
    '-o',
    'BatchMode=yes',
    '-o',
    `ConnectTimeout=${SSH_CONNECT_TIMEOUT_SECONDS}`,
    '-o',
    'ServerAliveInterval=5',
    '-o',
    'ServerAliveCountMax=2',
  ];
  if (ssh.identityFile) {
    args.push('-i', ssh.identityFile);
  }
  args.push(`${ssh.user}@${ssh.host}`, `bash -lc ${quoteSh(commandWithPath)}`);

  const result = await execa('ssh', args, { reject: false });
  return {
    exitCode: result.exitCode ?? 1,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

async function runScpUpload(
  ssh: SshConfig,
  localPath: string,
  remotePath: string,
  dryRun = false
): Promise<CommandResult> {
  if (dryRun) {
    return { exitCode: 0, stdout: `[dry-run][${ssh.host}] scp ${localPath} ${remotePath}`, stderr: '' };
  }

  const args: string[] = [
    '-o',
    'BatchMode=yes',
    '-o',
    `ConnectTimeout=${SSH_CONNECT_TIMEOUT_SECONDS}`,
    '-o',
    'ServerAliveInterval=5',
    '-o',
    'ServerAliveCountMax=2',
  ];
  if (ssh.identityFile) {
    args.push('-i', ssh.identityFile);
  }
  args.push(localPath, `${ssh.user}@${ssh.host}:${remotePath}`);

  const result = await execa('scp', args, { reject: false });
  return {
    exitCode: result.exitCode ?? 1,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

async function createLocalCliPackArtifact(localCliRepoPath: string): Promise<{
  status: StepStatus;
  message: string;
  artifact?: LocalCliPackArtifact;
}> {
  if (!existsSync(localCliRepoPath)) {
    return { status: 'fail', message: `local CLI repo missing: ${localCliRepoPath}` };
  }

  const tempDir = mkdtempSync(join(tmpdir(), 'opta-cli-pack-'));
  const packResult = await runLocalCommand(
    `npm pack --silent --pack-destination ${quoteSh(tempDir)}`,
    localCliRepoPath,
    false
  );
  if (packResult.exitCode !== 0) {
    rmSync(tempDir, { recursive: true, force: true });
    return {
      status: 'fail',
      message: `npm pack failed: ${summarizeOutput(packResult.stderr || packResult.stdout)}`,
    };
  }

  const tarballName =
    packResult.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .at(-1) ?? '';
  const tarballPath = join(tempDir, tarballName);
  if (!tarballName || !existsSync(tarballPath)) {
    rmSync(tempDir, { recursive: true, force: true });
    return {
      status: 'fail',
      message: 'npm pack did not produce a tarball',
    };
  }

  return {
    status: 'ok',
    message: `packed CLI artifact ${tarballName}`,
    artifact: { tarballPath, tempDir },
  };
}

function cleanupLocalCliPackArtifact(artifact: LocalCliPackArtifact | null): void {
  if (!artifact) return;
  rmSync(artifact.tempDir, { recursive: true, force: true });
}

async function installLocalCliPackOnRemote(
  ssh: SshConfig,
  artifact: LocalCliPackArtifact,
  dryRun: boolean
): Promise<{ status: StepStatus; message: string }> {
  const remoteTarballPath = `/tmp/opta-cli-update-${Date.now()}.tgz`;
  const upload = await runScpUpload(ssh, artifact.tarballPath, remoteTarballPath, dryRun);
  if (upload.exitCode !== 0) {
    return {
      status: 'fail',
      message: `failed to upload CLI package: ${summarizeOutput(upload.stderr || upload.stdout)}`,
    };
  }

  if (dryRun) {
    return { status: 'ok', message: 'dry-run packaged CLI upload + install' };
  }

  const install = await runRemoteCommand(
    ssh,
    [
      'if ! command -v npm >/dev/null 2>&1; then echo "__ERR__:missing-npm"; exit 44; fi',
      `npm install -g ${quoteSh(remoteTarballPath)} --no-fund --no-audit`,
      'rc=$?',
      `rm -f ${quoteSh(remoteTarballPath)}`,
      'exit "$rc"',
    ].join('; '),
    false
  );

  if (install.exitCode === 44) {
    return {
      status: 'fail',
      message: 'npm is not installed on remote host (cannot install packaged CLI)',
    };
  }
  if (install.exitCode !== 0) {
    const detail = summarizeOutput(install.stderr || install.stdout);
    if (detail.toLowerCase().includes('eacces')) {
      return {
        status: 'fail',
        message: `packaged CLI install failed due permissions (${detail})`,
      };
    }
    return {
      status: 'fail',
      message: `packaged CLI install failed: ${detail}`,
    };
  }
  return { status: 'ok', message: 'installed packaged CLI from local workspace' };
}

async function verifyRemoteCliCommands(
  ssh: SshConfig,
  dryRun: boolean
): Promise<{ status: StepStatus; message: string }> {
  if (dryRun) {
    return { status: 'ok', message: 'dry-run remote command verification' };
  }

  const commandList = REQUIRED_OPTA_COMMANDS.join(' ');
  const script = [
    'if ! command -v node >/dev/null 2>&1; then echo "__ERR__:missing-node"; exit 40; fi',
    'if ! command -v opta >/dev/null 2>&1; then echo "__ERR__:missing-opta"; exit 41; fi',
    'help="$(opta --help 2>&1)" || { echo "__ERR__:help-failed"; echo "$help"; exit 42; }',
    `missing=""; for c in ${commandList}; do echo "$help" | grep -Eq "(^|[[:space:]])$c([[:space:]]|$)" || missing="$missing $c"; done`,
    'if [ -n "$missing" ]; then echo "__MISSING__:$missing"; exit 43; fi',
    'version="$(opta --version 2>/dev/null || true)"',
    'echo "__VERSION__:$version"',
  ].join('; ');

  const result = await runRemoteCommand(ssh, script, false);
  if (result.exitCode === 40) {
    return {
      status: 'fail',
      message:
        'node runtime missing on remote host (install Node.js so /opt/homebrew/bin/opta can run)',
    };
  }
  if (result.exitCode === 41) {
    return { status: 'fail', message: 'opta command not found in PATH on remote host' };
  }
  if (result.exitCode === 42) {
    return {
      status: 'fail',
      message: `opta --help failed on remote host: ${summarizeOutput(result.stdout || result.stderr)}`,
    };
  }
  if (result.exitCode === 43) {
    const marker = result.stdout.split('\n').find((line) => line.startsWith('__MISSING__:'));
    const missing = marker?.replace('__MISSING__:', '').trim() ?? 'unknown';
    return { status: 'fail', message: summarizeMissingCommandSurface(missing, 'remote') };
  }
  if (result.exitCode !== 0) {
    return {
      status: 'fail',
      message: result.stderr || result.stdout || 'remote command verification failed',
    };
  }

  const versionMarker = result.stdout.split('\n').find((line) => line.startsWith('__VERSION__:'));
  const version = versionMarker?.replace('__VERSION__:', '').trim() || 'unknown';
  return { status: 'ok', message: `opta command available (${version})` };
}

function formatLocalCliHelpFailure(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('cannot find module') && lower.includes('dist/index.js')) {
    return (
      'opta command points to a missing dist/index.js (likely linked local install). ' +
      'run npm run build && npm link, or reinstall globally with npm i -g @opta/opta-cli'
    );
  }
  return summarizeOutput(raw);
}

async function verifyLocalCliCommands(dryRun: boolean): Promise<{ status: StepStatus; message: string }> {
  if (dryRun) {
    return { status: 'ok', message: 'dry-run local command verification' };
  }

  const commandList = REQUIRED_OPTA_COMMANDS.join(' ');
  const script = [
    'if ! command -v node >/dev/null 2>&1; then echo "__ERR__:missing-node"; exit 40; fi',
    'if ! command -v opta >/dev/null 2>&1; then echo "__ERR__:missing-opta"; exit 41; fi',
    'help="$(opta --help 2>&1)" || { echo "__ERR__:help-failed"; echo "$help"; exit 42; }',
    `missing=""; for c in ${commandList}; do echo "$help" | grep -Eq "(^|[[:space:]])$c([[:space:]]|$)" || missing="$missing $c"; done`,
    'if [ -n "$missing" ]; then echo "__MISSING__:$missing"; exit 43; fi',
    'version="$(opta --version 2>/dev/null || true)"',
    'echo "__VERSION__:$version"',
  ].join('; ');

  const result = await runLocalCommand(script, undefined, false);
  if (result.exitCode === 40) {
    return {
      status: 'fail',
      message: 'node runtime missing locally (install Node.js so opta can run)',
    };
  }
  if (result.exitCode === 41) {
    return { status: 'fail', message: 'opta command not found in PATH locally' };
  }
  if (result.exitCode === 42) {
    return {
      status: 'fail',
      message: `opta --help failed locally: ${formatLocalCliHelpFailure(result.stdout || result.stderr)}`,
    };
  }
  if (result.exitCode === 43) {
    const marker = result.stdout.split('\n').find((line) => line.startsWith('__MISSING__:'));
    const missing = marker?.replace('__MISSING__:', '').trim() ?? 'unknown';
    return { status: 'fail', message: summarizeMissingCommandSurface(missing, 'local') };
  }
  if (result.exitCode !== 0) {
    return {
      status: 'fail',
      message: result.stderr || result.stdout || 'local command verification failed',
    };
  }

  const versionMarker = result.stdout.split('\n').find((line) => line.startsWith('__VERSION__:'));
  const version = versionMarker?.replace('__VERSION__:', '').trim() || 'unknown';
  return { status: 'ok', message: `opta command available (${version})` };
}

function summarizeOutput(raw: string): string {
  const firstLine = raw
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  return firstLine ?? 'unknown error';
}

export function parseRemoteLanGuardMarker(output: string): RemoteLanGuardProbe | null {
  for (const rawLine of output.split('\n')) {
    const line = rawLine.trim();
    const match = /^__LAN_GUARD__:(ok|dual_ip|unsupported):([^:]*):([^:]*):([^:]*)$/.exec(line);
    if (!match) continue;

    return {
      state: match[1] as RemoteLanGuardProbe['state'],
      ethernetIp: match[2] ?? '',
      wifiIp: match[3] ?? '',
      wifiPower: match[4] ?? '',
    };
  }

  return null;
}

function formatRemoteLanGuardContext(probe: RemoteLanGuardProbe): string {
  const ethernetIp = probe.ethernetIp || 'none';
  const wifiIp = probe.wifiIp || 'none';
  const wifiPower = probe.wifiPower || 'unknown';
  return `en0=${ethernetIp}, en1=${wifiIp}, wifi=${wifiPower}`;
}

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function runRemoteLanStabilityGuard(
  ssh: SshConfig,
  dryRun: boolean
): Promise<RemoteLanGuardResult> {
  if (dryRun) {
    return {
      status: 'ok',
      message: 'dry-run LAN guard skipped',
      canProceed: true,
    };
  }

  const probeScript = [
    'if ! command -v ipconfig >/dev/null 2>&1 || ! command -v networksetup >/dev/null 2>&1; then',
    'echo "__LAN_GUARD__:unsupported:::"; exit 0;',
    'fi;',
    'eth_ip="$(ipconfig getifaddr en0 2>/dev/null || true)";',
    'wifi_ip="$(ipconfig getifaddr en1 2>/dev/null || true)";',
    'wifi_power="$(networksetup -getairportpower en1 2>/dev/null | sed -E "s/^.*: //")";',
    'if [ -n "$eth_ip" ] && [ -n "$wifi_ip" ] && [ "$eth_ip" = "$wifi_ip" ] && [ "$wifi_power" = "On" ]; then',
    'echo "__LAN_GUARD__:dual_ip:$eth_ip:$wifi_ip:$wifi_power";',
    'else',
    'echo "__LAN_GUARD__:ok:$eth_ip:$wifi_ip:$wifi_power";',
    'fi',
  ].join(' ');

  const probe = await runRemoteCommand(ssh, probeScript, false);
  const probePayload = `${probe.stdout}\n${probe.stderr}`;
  const parsed = parseRemoteLanGuardMarker(probePayload);

  if (probe.exitCode !== 0 && !parsed) {
    return {
      status: 'skip',
      message: `LAN guard probe unavailable: ${summarizeOutput(probe.stderr || probe.stdout)}`,
      canProceed: true,
    };
  }

  if (!parsed) {
    return {
      status: 'skip',
      message: 'LAN guard marker missing; continuing without network remediation',
      canProceed: true,
    };
  }

  if (parsed.state === 'unsupported') {
    return {
      status: 'skip',
      message: 'LAN guard unsupported on remote host (missing macOS network tools)',
      canProceed: true,
    };
  }

  const context = formatRemoteLanGuardContext(parsed);
  if (parsed.state === 'ok') {
    return {
      status: 'ok',
      message: `LAN guard ok (${context})`,
      canProceed: true,
    };
  }

  const fixScript = [
    'networksetup -setairportpower en1 off;',
    'networksetup -setdhcp "Wi-Fi";',
    'echo "__LAN_GUARD_FIX__:applied"',
  ].join(' ');

  const fix = await runRemoteCommand(ssh, fixScript, false);
  let verify: CommandResult = { exitCode: 1, stdout: '', stderr: '' };
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (attempt > 0) {
      await delayMs(1500);
    }
    verify = await runRemoteCommand(ssh, 'echo "__LAN_GUARD_VERIFY__:ok"', false);
    if (verify.exitCode === 0) break;
  }

  if (verify.exitCode === 0 && fix.exitCode === 0) {
    return {
      status: 'ok',
      message: `detected dual-IP conflict (${context}); disabled Wi-Fi and reset Wi-Fi DHCP`,
      canProceed: true,
    };
  }

  if (verify.exitCode === 0 && fix.exitCode !== 0) {
    return {
      status: 'skip',
      message: `detected dual-IP conflict (${context}); connectivity recovered but fix command reported an error: ${summarizeOutput(fix.stderr || fix.stdout)}`,
      canProceed: true,
    };
  }

  const failureStatus = remoteConnectFailureStatus();
  const fixDetail = summarizeOutput(fix.stderr || fix.stdout);
  const verifyDetail = summarizeOutput(verify.stderr || verify.stdout);
  const modeHint = 'fix network path and rerun update';

  return {
    status: failureStatus,
    message: `dual-IP conflict detected (${context}); attempted auto-fix but SSH verification failed (fix=${fixDetail}; verify=${verifyDetail}) (${modeHint})`,
    canProceed: false,
  };
}

function isRecoverableGitFailure(raw: string): boolean {
  const value = raw.toLowerCase();
  return (
    value.includes('permission denied (publickey)') ||
    value.includes('could not read from remote repository') ||
    value.includes('bad object head') ||
    value.includes('repository not found')
  );
}

function handleGitPullFailure(
  result: CommandResult,
  prefix: string
): { status: StepStatus; message: string } {
  const detail = result.stderr || result.stdout;
  if (isRecoverableGitFailure(detail)) {
    return {
      status: 'skip',
      message: `${prefix} unavailable (skipped): ${summarizeOutput(detail)}`,
    };
  }

  return {
    status: 'fail',
    message: `${prefix} failed: ${detail}`,
  };
}

async function updateGitLocal(
  repoPath: string,
  noPull: boolean,
  dryRun: boolean
): Promise<{ status: StepStatus; message: string }> {
  if (!existsSync(repoPath)) {
    return { status: 'skip', message: `repo missing: ${repoPath}` };
  }
  if (!existsSync(join(repoPath, '.git'))) {
    return { status: 'skip', message: 'not a git repository (skipped pull)' };
  }

  const hasHead = await runLocalCommand(
    'git rev-parse --verify HEAD >/dev/null 2>&1',
    repoPath,
    dryRun
  );
  if (hasHead.exitCode !== 0) {
    return { status: 'skip', message: 'invalid git metadata (missing HEAD, skipped pull)' };
  }

  const dirty = await runLocalCommand('git status --porcelain', repoPath, dryRun);
  if (dirty.exitCode !== 0) {
    return {
      status: 'skip',
      message: `git status unavailable (skipped pull): ${summarizeOutput(dirty.stderr || dirty.stdout)}`,
    };
  }
  if (!dryRun && dirty.stdout.trim().length > 0) {
    return { status: 'skip', message: 'dirty working tree (skipped pull)' };
  }

  if (noPull) {
    return { status: 'ok', message: 'git pull skipped (--no-pull)' };
  }

  const pull = await runLocalCommand(
    'git fetch --all --prune && git pull --ff-only',
    repoPath,
    dryRun
  );
  if (pull.exitCode !== 0) {
    return handleGitPullFailure(pull, 'git pull');
  }

  return { status: 'ok', message: dryRun ? 'dry-run git sync' : 'git sync complete' };
}

async function updateGitRemote(
  repoPath: string,
  noPull: boolean,
  ssh: SshConfig,
  dryRun: boolean
): Promise<{ status: StepStatus; message: string }> {
  const script = [
    `if [ ! -d ${quoteSh(repoPath)} ]; then exit 24; fi`,
    `if [ ! -d ${quoteSh(join(repoPath, '.git'))} ]; then exit 26; fi`,
    `git -C ${quoteSh(repoPath)} rev-parse --verify HEAD >/dev/null 2>&1 || exit 27`,
    `status_out="$(git -C ${quoteSh(repoPath)} status --porcelain 2>/dev/null)" || exit 28`,
    'if [ -n "$status_out" ]; then exit 25; fi',
    noPull
      ? ':'
      : `git -C ${quoteSh(repoPath)} fetch --all --prune && git -C ${quoteSh(repoPath)} pull --ff-only`,
  ].join('; ');

  const result = await runRemoteCommand(ssh, script, dryRun);

  if (result.exitCode === 24) return { status: 'skip', message: `repo missing: ${repoPath}` };
  if (result.exitCode === 26)
    return { status: 'skip', message: 'not a git repository (skipped pull)' };
  if (result.exitCode === 27)
    return { status: 'skip', message: 'invalid git metadata (missing HEAD, skipped pull)' };
  if (result.exitCode === 28)
    return { status: 'skip', message: 'git status unavailable (skipped pull)' };
  if (result.exitCode === 25)
    return { status: 'skip', message: 'dirty working tree (skipped pull)' };
  if (result.exitCode !== 0) {
    return handleGitPullFailure(result, 'git sync');
  }

  return {
    status: 'ok',
    message: noPull
      ? 'git pull skipped (--no-pull)'
      : dryRun
        ? 'dry-run git sync'
        : 'git sync complete',
  };
}

async function runComponentBuildLocal(
  component: UpdateComponent,
  repoPath: string,
  dryRun: boolean
): Promise<{ status: StepStatus; message: string }> {
  switch (component) {
    case 'cli': {
      const cmd = CLI_UPDATE_BUILD_SCRIPT;
      const result = await runLocalCommand(cmd, repoPath, dryRun);
      if (result.exitCode !== 0) return { status: 'fail', message: result.stderr || result.stdout };
      return {
        status: 'ok',
        message: dryRun ? 'dry-run typecheck + build' : 'npm typecheck + build complete',
      };
    }
    case 'daemon': {
      const cmd = [
        'if ! command -v opta >/dev/null 2>&1; then echo "__ERR__:missing-opta"; exit 41; fi',
        'opta daemon stop >/dev/null 2>&1 || true',
        'opta daemon start --json >/dev/null 2>&1 || opta daemon start >/dev/null 2>&1',
        'status_json="$(opta daemon status --json 2>/dev/null || true)"',
        'echo "$status_json"',
        'echo "$status_json" | grep -Eq \'"running"[[:space:]]*:[[:space:]]*true\' || exit 42',
      ].join('; ');
      const result = await runLocalCommand(cmd, repoPath, dryRun);
      if (result.exitCode === 41) {
        return {
          status: 'fail',
          message: 'opta command not found in PATH locally (cannot manage daemon)',
        };
      }
      if (result.exitCode === 42) {
        return {
          status: 'fail',
          message: 'daemon did not report healthy status after restart',
        };
      }
      if (result.exitCode !== 0) return { status: 'fail', message: result.stderr || result.stdout };
      return {
        status: 'ok',
        message: dryRun ? 'dry-run daemon restart' : 'daemon restart + health check complete',
      };
    }
  }
}

async function runComponentBuildRemote(
  component: UpdateComponent,
  repoPath: string,
  dryRun: boolean,
  ssh: SshConfig
): Promise<{ status: StepStatus; message: string }> {
  let command: string;

  switch (component) {
    case 'cli':
      command = `cd ${quoteSh(repoPath)} && (${CLI_UPDATE_BUILD_SCRIPT})`;
      break;
    case 'daemon':
      command = [
        'if ! command -v opta >/dev/null 2>&1; then echo "__ERR__:missing-opta"; exit 41; fi',
        'opta daemon stop >/dev/null 2>&1 || true',
        'opta daemon start --json >/dev/null 2>&1 || opta daemon start >/dev/null 2>&1',
        'status_json="$(opta daemon status --json 2>/dev/null || true)"',
        'echo "$status_json"',
        'echo "$status_json" | grep -Eq \'"running"[[:space:]]*:[[:space:]]*true\' || exit 42',
      ].join('; ');
      break;
  }

  const result = await runRemoteCommand(ssh, command, dryRun);
  if (component === 'daemon' && result.exitCode === 41) {
    return {
      status: 'fail',
      message: 'opta command not found in PATH on remote host (cannot manage daemon)',
    };
  }
  if (component === 'daemon' && result.exitCode === 42) {
    return {
      status: 'fail',
      message: 'remote daemon did not report healthy status after restart',
    };
  }
  if (result.exitCode !== 0) {
    return { status: 'fail', message: result.stderr || result.stdout || 'remote command failed' };
  }

  const okMessage =
    component === 'daemon'
      ? dryRun
        ? 'dry-run daemon restart'
        : 'daemon restart + health check complete'
      : dryRun
        ? 'dry-run typecheck + build'
        : 'typecheck + build complete';
  return { status: 'ok', message: okMessage };
}

function printHumanSummary(results: StepResult[]): void {
  console.log('');
  console.log(chalk.bold(colorizeOptaWord('Opta Update Summary')));

  for (const result of results) {
    const prefix =
      result.status === 'ok'
        ? chalk.green('✓')
        : result.status === 'skip'
          ? chalk.yellow('!')
          : chalk.red('✗');

    const targetLabel =
      result.target === 'remote' && result.host ? `${result.target}@${result.host}` : result.target;

    console.log(
      `${prefix} [${targetLabel}] ${result.component}:${result.step} — ${result.message}`
    );
  }

  const failures = results.filter((r) => r.status === 'fail').length;
  const skips = results.filter((r) => r.status === 'skip').length;
  const ok = results.filter((r) => r.status === 'ok').length;

  console.log('');
  console.log(chalk.dim(`ok=${ok} skip=${skips} fail=${failures}`));
}

function componentStep(
  target: UpdateTarget,
  component: UpdateComponent,
  step: string,
  outcome: { status: StepStatus; message: string },
  host?: string
): StepResult {
  return {
    target,
    component,
    step,
    status: outcome.status,
    message: outcome.message,
    host,
  };
}

function canProceedToBuild(gitResult: { status: StepStatus; message: string }): boolean {
  if (gitResult.status === 'fail') return false;
  if (gitResult.message.startsWith('repo missing:')) return false;
  return true;
}

export async function updateCommand(opts: UpdateOptions): Promise<void> {
  const config = await loadConfig();
  const components = parseComponentList(opts.components);
  const mode = opts.target
    ? parseTargetMode(opts.target)
    : canPromptForTargetSelection(opts)
      ? await promptForUpdateTarget()
      : 'local';
  const remoteHost = opts.remoteHost ?? config.connection.host;
  const configFallbackHosts = Array.isArray(config.connection.fallbackHosts)
    ? config.connection.fallbackHosts
    : [];
  const targets = resolveTargets(mode);

  // Windows can run local updates but not SSH-based remote updates.
  if (isWindows && targets.includes('remote')) {
    throw new (await import('../core/errors.js')).OptaError(
      'Remote updates via SSH are not supported on Windows.\n\n' +
        'Use --target local to update local components, or run remote updates from a macOS/Linux host.'
    );
  }
  if (isWindows && targets.includes('local')) {
    throw new (await import('../core/errors.js')).OptaError(
      'Local updates currently require a POSIX shell.\n\n' +
        'Run local updates from macOS/Linux (or WSL), or install/update manually on Windows.'
    );
  }
  let remoteHostUsed: string | null = null;

  const results: StepResult[] = [];
  const dryRun = Boolean(opts.dryRun);
  const noBuild = opts.build === false;
  const noPull = opts.pull === false;
  const rolloutAllReachable = Boolean(opts.remoteAll);
  const explicitRolloutHosts = parseRemoteHostList(opts.remoteHosts);

  const localAppsRoot = opts.localRoot ? expandHome(opts.localRoot) : detectAppsRoot(process.cwd());

  const remoteAppsRootHint = opts.remoteRoot
    ? expandHome(opts.remoteRoot)
    : deriveRemoteAppsRootFromLmxPath(config.connection.ssh.lmxPath);

  const verifyStepCount = targets.includes('remote') && components.includes('cli') ? 1 : 0;
  const remoteGuardStepCount = targets.includes('remote') ? 1 : 0;
  const configuredRemoteHosts = resolveRemoteHostCandidates(
    isLocalHost(remoteHost) ? '' : remoteHost,
    [...explicitRolloutHosts, ...configFallbackHosts].filter((host) => !isLocalHost(host))
  );
  const expectedRemoteHosts =
    explicitRolloutHosts.length > 0
      ? explicitRolloutHosts.length
      : rolloutAllReachable
        ? Math.max(1, configuredRemoteHosts.length)
        : 1;
  const localCliVerifySteps =
    targets.includes('local') && components.includes('cli') && !noBuild ? 1 : 0;
  const localStepCount = targets.includes('local')
    ? localAppsRoot
      ? components.length * 2 + localCliVerifySteps
      : 1
    : 0;
  const remoteStepCount = targets.includes('remote')
    ? (components.length * 2 + verifyStepCount + remoteGuardStepCount) * expectedRemoteHosts
    : 0;
  const progress = createSegmentedStepProgressTracker(
    [
      ...(localStepCount > 0 ? [{ key: 'local', label: 'Local', totalSteps: localStepCount }] : []),
      ...(remoteStepCount > 0
        ? [{ key: 'remote', label: 'Remote', totalSteps: remoteStepCount }]
        : []),
    ],
    'Update progress',
    !opts.json
  );
  const pushResult = (result: StepResult): void => {
    results.push(result);
    const hostSuffix = result.target === 'remote' && result.host ? `@${result.host}` : '';
    const scope = result.target === 'remote' ? 'remote' : 'local';
    progress.tick(
      result.target,
      `[${scope}] ${result.component}:${result.step}${hostSuffix} ${result.status}`
    );
  };

  if (targets.includes('local')) {
    if (!localAppsRoot) {
      pushResult({
        target: 'local',
        component: 'cli',
        step: 'discover-root',
        status: 'fail',
        message: 'could not determine local 1-Apps root; use --local-root',
      });
    } else {
      for (const component of components) {
        const repoPath = componentRepoPath(component, localAppsRoot);
        const gitResult = await updateGitLocal(repoPath, noPull, dryRun);
        pushResult(componentStep('local', component, 'git', gitResult));

        if (!canProceedToBuild(gitResult) || noBuild) {
          if (noBuild) {
            pushResult({
              target: 'local',
              component,
              step: 'build',
              status: 'skip',
              message: 'skipped (--no-build)',
            });
          }
          continue;
        }

        const buildResult = await runComponentBuildLocal(
          component,
          repoPath,
          dryRun
        );
        pushResult(componentStep('local', component, 'build', buildResult));

        if (component === 'cli' && buildResult.status === 'ok') {
          const verify = await verifyLocalCliCommands(dryRun);
          pushResult(componentStep('local', component, 'verify', verify));
        }
      }
    }
  }

  if (targets.includes('remote')) {
    const baseSshConfig: SshConfig = {
      host: remoteHost,
      user: opts.remoteUser ?? config.connection.ssh.user,
      identityFile: expandHome(opts.identityFile ?? config.connection.ssh.identityFile),
    };

    let discoveredRemoteHosts: DiscoveredRemoteHostCandidate[] = [];
    const shouldDiscoverRemoteHosts =
      !opts.remoteHost && (explicitRolloutHosts.length === 0 || config.connection.autoDiscover);
    if (shouldDiscoverRemoteHosts) {
      try {
        const { discoverLmxHosts } = await import('../lmx/mdns-discovery.js');
        const discovered = await discoverLmxHosts(2_500);
        const byHost = new Map<string, DiscoveredRemoteHostCandidate>();
        for (const entry of discovered) {
          const host = entry.host.trim();
          if (!host || isLocalHost(host)) continue;
          const key = host.toLowerCase();
          if (byHost.has(key)) continue;
          byHost.set(key, {
            host,
            source: entry.source,
            latencyMs: entry.latencyMs,
          });
        }
        discoveredRemoteHosts = Array.from(byHost.values());
      } catch {
        // Discovery is best-effort and should never block updates.
      }
    }

    const explicitRemoteHosts = explicitRolloutHosts.filter((host) => !isLocalHost(host));
    const configuredFallbackHosts = configFallbackHosts.filter((host) => !isLocalHost(host));
    const remoteCandidates = resolveRemoteHostCandidates(
      isLocalHost(remoteHost) ? '' : remoteHost,
      [...explicitRemoteHosts, ...configuredFallbackHosts],
      discoveredRemoteHosts.map((entry) => entry.host)
    );
    const selection = await selectReachableRemoteHost(
      remoteCandidates,
      (candidateHost) =>
        runRemoteCommand(
          {
            ...baseSshConfig,
            host: candidateHost,
          },
          'echo connected',
          dryRun
        ),
      { parallel: true }
    );
    const reachableHosts = extractReachableRemoteHosts(selection.probes);
    let selectedRemoteHost = selection.selectedHost;
    if (
      reachableHosts.length > 0 &&
      explicitRemoteHosts.length === 0 &&
      !rolloutAllReachable &&
      !opts.remoteHost &&
      canPromptForRemoteHostSelection(opts)
    ) {
      selectedRemoteHost = await promptForRemoteHostSelection(reachableHosts, discoveredRemoteHosts);
    }
    const rolloutHosts = resolveRolloutHosts(
      reachableHosts,
      selectedRemoteHost,
      rolloutAllReachable,
      explicitRemoteHosts
    );

    if (rolloutHosts.length === 0) {
      const connectStatus = remoteConnectFailureStatus();
      const attemptDetail =
        selection.probes.length > 0
          ? selection.probes
              .map((probe) => `${probe.host}: ${summarizeOutput(probe.detail)}`)
              .join('; ')
          : 'ssh failed';
      const attemptedHosts = remoteCandidates.length > 0 ? remoteCandidates.join(', ') : '(none)';
      const explicitHostHint =
        explicitRolloutHosts.length > 0
          ? `; requested hosts=${explicitRolloutHosts.join(', ')}`
          : '';
      const connectDetail =
        remoteCandidates.length === 0
          ? 'no remote hosts resolved (set --remote-host/--remote-hosts or enable auto-discovery)'
          : `ssh failed for hosts (${attemptedHosts}) — ${attemptDetail}`;
      const connectMessage = `${connectDetail}${explicitHostHint}`;
      for (const component of components) {
        pushResult({
          target: 'remote',
          component,
          step: 'connect',
          status: connectStatus,
          message: connectMessage,
          host: remoteHost,
        });
      }
    } else {
      remoteHostUsed = rolloutHosts.join(',');

      const reachableHostKeySet = new Set(reachableHosts.map((host) => host.toLowerCase()));
      const unreachableExplicitHosts = explicitRemoteHosts.filter(
        (host) => !reachableHostKeySet.has(host.toLowerCase())
      );
      for (const missingHost of unreachableExplicitHosts) {
        pushResult({
          target: 'remote',
          component: components[0] ?? 'cli',
          step: 'connect',
          status: remoteConnectFailureStatus(),
          message: `requested remote host not reachable: ${missingHost}`,
          host: missingHost,
        });
      }

      const localOnlyExplicitHosts = explicitRolloutHosts.filter((host) => isLocalHost(host));
      for (const skippedHost of localOnlyExplicitHosts) {
        pushResult({
          target: 'remote',
          component: components[0] ?? 'cli',
          step: 'connect',
          status: remoteConnectFailureStatus(),
          message: `requested remote host resolves local and was ignored: ${skippedHost}`,
          host: skippedHost,
        });
      }

      const remoteAppsRootCandidates = buildRemoteAppsRootCandidates({
        explicitRoot: opts.remoteRoot ? expandHome(opts.remoteRoot) : undefined,
        derivedRoot: remoteAppsRootHint,
        localAppsRoot,
        remoteUser: baseSshConfig.user,
      });

      for (const rolloutHost of rolloutHosts) {
        const sshConfig: SshConfig = {
          ...baseSshConfig,
          host: rolloutHost,
        };

        const guardComponent = components[0] ?? 'cli';
        const guard = await runRemoteLanStabilityGuard(sshConfig, dryRun);
        pushResult(
          componentStep(
            'remote',
            guardComponent,
            'network',
            {
              status: guard.status,
              message: guard.message,
            },
            sshConfig.host
          )
        );

        if (!guard.canProceed) {
          const gatedMessage = 'skipped due LAN guard failure';
          for (const component of components) {
            pushResult({
              target: 'remote',
              component,
              step: 'git',
              status: 'skip',
              message: gatedMessage,
              host: sshConfig.host,
            });

            if (noBuild) {
              pushResult({
                target: 'remote',
                component,
                step: 'build',
                status: 'skip',
                message: 'skipped (--no-build)',
                host: sshConfig.host,
              });
            } else {
              pushResult({
                target: 'remote',
                component,
                step: 'build',
                status: 'skip',
                message: gatedMessage,
                host: sshConfig.host,
              });
            }

            if (component === 'cli') {
              pushResult({
                target: 'remote',
                component,
                step: 'verify',
                status: 'skip',
                message: gatedMessage,
                host: sshConfig.host,
              });
            }
          }
          continue;
        }

        const remoteRootResolution = await resolveRemoteAppsRootOnHost(
          sshConfig,
          remoteAppsRootCandidates,
          dryRun
        );
        const resolvedRemoteAppsRoot = remoteRootResolution.root;
        if (!resolvedRemoteAppsRoot) {
          const discoveryMessage =
            remoteRootResolution.tried.length === 0
              ? 'remote path unavailable; set --remote-root for cli/daemon'
              : `remote path unavailable; tried ${remoteRootResolution.tried.join(', ')} (set --remote-root for cli/daemon)`;
          for (const component of components) {
            pushResult({
              target: 'remote',
              component,
              step: 'discover-root',
              status: remoteConnectFailureStatus(),
              message: discoveryMessage,
              host: sshConfig.host,
            });
          }
          continue;
        }

        for (const component of components) {
          const repoPath = componentRepoPath(component, resolvedRemoteAppsRoot);

          const gitResult = await updateGitRemote(repoPath, noPull, sshConfig, dryRun);
          pushResult(componentStep('remote', component, 'git', gitResult, sshConfig.host));

          if (!canProceedToBuild(gitResult)) {
            pushResult({
              target: 'remote',
              component,
              step: 'build',
              status: 'skip',
              message: `skipped due git step (${gitResult.message})`,
              host: sshConfig.host,
            });
            if (component === 'cli') {
              pushResult({
                target: 'remote',
                component,
                step: 'verify',
                status: 'skip',
                message: 'skipped because CLI build did not run',
                host: sshConfig.host,
              });
            }
            continue;
          }

          let buildStatus: StepStatus = 'skip';
          if (noBuild) {
            pushResult({
              target: 'remote',
              component,
              step: 'build',
              status: 'skip',
              message: 'skipped (--no-build)',
              host: sshConfig.host,
            });
            buildStatus = 'skip';
          } else {
            const buildResult = await runComponentBuildRemote(
              component,
              repoPath,
              dryRun,
              sshConfig
            );
            pushResult(componentStep('remote', component, 'build', buildResult, sshConfig.host));
            buildStatus = buildResult.status;
          }

          if (component === 'cli') {
            if (noBuild) {
              pushResult({
                target: 'remote',
                component,
                step: 'verify',
                status: 'skip',
                message: 'skipped (--no-build)',
                host: sshConfig.host,
              });
              continue;
            }
            if (buildStatus !== 'ok') {
              pushResult({
                target: 'remote',
                component,
                step: 'verify',
                status: 'skip',
                message: 'skipped because CLI build failed',
                host: sshConfig.host,
              });
              continue;
            }
            let verify = await verifyRemoteCliCommands(sshConfig, dryRun);
            const shouldFallbackPack =
              !dryRun &&
              verify.status === 'fail' &&
              verify.message.includes('missing command entries in remote opta --help') &&
              Boolean(localAppsRoot);

            if (shouldFallbackPack && localAppsRoot) {
              const localCliRepoPath = componentRepoPath('cli', localAppsRoot);
              let artifact: LocalCliPackArtifact | null = null;
              try {
                const pack = await createLocalCliPackArtifact(localCliRepoPath);
                if (pack.status !== 'ok' || !pack.artifact) {
                  verify = {
                    status: 'fail',
                    message: `${verify.message}; packaged CLI fallback unavailable: ${pack.message}`,
                  };
                } else {
                  artifact = pack.artifact;
                  const install = await installLocalCliPackOnRemote(sshConfig, artifact, false);
                  if (install.status !== 'ok') {
                    verify = {
                      status: 'fail',
                      message: `${verify.message}; packaged CLI fallback failed: ${install.message}`,
                    };
                  } else {
                    const reverify = await verifyRemoteCliCommands(sshConfig, false);
                    verify =
                      reverify.status === 'ok'
                        ? {
                            status: 'ok',
                            message: `${reverify.message}; recovered via packaged CLI fallback`,
                          }
                        : {
                            status: 'fail',
                            message: `${verify.message}; packaged CLI fallback installed but verify still failed: ${reverify.message}`,
                          };
                  }
                }
              } finally {
                cleanupLocalCliPackArtifact(artifact);
              }
            }

            pushResult(componentStep('remote', component, 'verify', verify, sshConfig.host));
          }
        }
      }
    }
  }

  progress.done('all update steps finished');

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          mode,
          components,
          targets,
          dryRun,
          noBuild,
          noPull,
          rolloutAllReachable,
          explicitRolloutHosts,
          localAppsRoot,
          remoteHost,
          remoteHostUsed,
          remoteAppsRoot: remoteAppsRootHint,
          results,
        },
        null,
        2
      )
    );
  } else {
    printHumanSummary(results);
  }

  let updateLogPath: string | null = null;
  const journal = config.journal;
  if (journal?.enabled) {
    try {
      const written = await writeUpdateLog({
        summary: `opta update (${mode}) — ${components.join(', ')}`,
        commandInputs: {
          components,
          mode,
          targets,
          dryRun,
          noBuild,
          noPull,
          rolloutAllReachable,
          explicitRolloutHosts,
          localAppsRoot: localAppsRoot ?? '(auto-detect failed)',
          remoteHost,
          remoteHostUsed: remoteHostUsed ?? '(none)',
          remoteAppsRoot: remoteAppsRootHint ?? '(auto)',
          json: Boolean(opts.json),
        },
        steps: results.map((result) => ({
          target: result.target,
          component: result.component,
          step: result.step,
          status: result.status,
          message: result.host ? `[${result.host}] ${result.message}` : result.message,
        })),
        cwd: process.cwd(),
        logsDir: journal?.updateLogsDir,
        timezone: journal?.timezone,
        author: journal?.author,
        rangeStart: 200,
        rangeEnd: 299,
        promoted: true,
        category: 'sync',
      });
      updateLogPath = written.path;
    } catch {
      // Fail-open by design: update command must not fail due to logging errors.
    }
  }

  if (!opts.json && updateLogPath) {
    console.log(chalk.dim(`Update log: ${updateLogPath}`));
  }

  const hasFailure = results.some((r) => r.status === 'fail');
  if (hasFailure) {
    throw new ExitError(EXIT.ERROR);
  }
}
