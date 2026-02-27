import { existsSync } from 'node:fs';
import { dirname, join, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { execa } from 'execa';
import { loadConfig } from '../core/config.js';
import { ExitError, EXIT } from '../core/errors.js';
import { createSegmentedStepProgressTracker } from '../ui/progress.js';
import { colorizeOptaWord } from '../ui/brand.js';
import { writeUpdateLog } from '../journal/update-log.js';

export type UpdateComponent = 'cli' | 'lmx' | 'plus' | 'web';
export type UpdateTarget = 'local' | 'remote';
export type UpdateTargetMode = 'auto' | 'local' | 'remote' | 'both';

type StepStatus = 'ok' | 'skip' | 'fail';

export interface UpdateOptions {
  components?: string;
  target?: UpdateTargetMode;
  remoteHost?: string;
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

export const CLI_UPDATE_BUILD_SCRIPT =
  'npm run -s typecheck && (npm run -s build || (npm install --no-fund --no-audit && npm run -s typecheck && npm run -s build))';

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

function quoteSh(input: string): string {
  return `'${input.replace(/'/g, `'"'"'`)}'`;
}

function expandHome(input: string): string {
  if (!input.startsWith('~')) return input;
  const home = process.env['HOME'] ?? '';
  return input.replace(/^~(?=$|\/)/, home);
}

function isLocalHost(host: string): boolean {
  const lower = host.trim().toLowerCase();
  return lower === 'localhost' || lower === '127.0.0.1';
}

export function parseComponentList(raw?: string): UpdateComponent[] {
  // Default update scope intentionally excludes web to keep the primary
  // desktop/local runtime path fast (CLI + LMX + Plus).
  if (!raw || raw.trim() === '') return ['cli', 'lmx', 'plus'];
  const parts = raw
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);

  const allowed: UpdateComponent[] = ['cli', 'lmx', 'plus', 'web'];
  const invalid = parts.filter((p) => !allowed.includes(p as UpdateComponent));
  if (invalid.length > 0) {
    throw new Error(`Invalid components: ${invalid.join(', ')}. Use: cli,lmx,plus,web`);
  }

  return [...new Set(parts as UpdateComponent[])];
}

export function resolveTargets(mode: UpdateTargetMode, remoteHost: string): UpdateTarget[] {
  switch (mode) {
    case 'local':
      return ['local'];
    case 'remote':
      return ['remote'];
    case 'both':
      return ['local', 'remote'];
    case 'auto':
    default:
      return isLocalHost(remoteHost) ? ['local'] : ['local', 'remote'];
  }
}

export function remoteConnectFailureStatus(mode: UpdateTargetMode): StepStatus {
  return mode === 'auto' ? 'skip' : 'fail';
}

export function resolveRemoteHostCandidates(primaryHost: string, fallbackHosts: readonly string[] = []): string[] {
  const hosts = [primaryHost, ...fallbackHosts]
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

export async function selectReachableRemoteHost(
  hosts: readonly string[],
  probeHost: (host: string) => Promise<CommandResult>,
  options: SelectReachableRemoteHostOptions = {},
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
      }),
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

    if (
      existsSync(join(resolved, '1D-Opta-CLI-TS')) &&
      existsSync(join(resolved, '1M-Opta-LMX'))
    ) {
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

function componentRepoPath(component: UpdateComponent, appsRoot: string): string {
  switch (component) {
    case 'cli':
      return join(appsRoot, '1D-Opta-CLI-TS');
    case 'lmx':
      return join(appsRoot, '1M-Opta-LMX');
    case 'plus':
      return join(appsRoot, '1I-OptaPlus');
    case 'web':
      return join(appsRoot, '1L-Opta-Local');
  }
}

async function runLocalCommand(command: string, cwd?: string, dryRun = false): Promise<CommandResult> {
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

async function runRemoteCommand(ssh: SshConfig, command: string, dryRun = false): Promise<CommandResult> {
  if (dryRun) {
    return { exitCode: 0, stdout: `[dry-run][${ssh.host}] ${command}`, stderr: '' };
  }

  const commandWithPath = `export PATH=/opt/homebrew/bin:/usr/local/bin:$PATH; ${command}`;
  const args: string[] = [
    '-o', 'BatchMode=yes',
    '-o', `ConnectTimeout=${SSH_CONNECT_TIMEOUT_SECONDS}`,
    '-o', 'ServerAliveInterval=5',
    '-o', 'ServerAliveCountMax=2',
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

async function verifyRemoteCliCommands(ssh: SshConfig, dryRun: boolean): Promise<{ status: StepStatus; message: string }> {
  if (dryRun) {
    return { status: 'ok', message: 'dry-run remote command verification' };
  }

  const commandList = REQUIRED_OPTA_COMMANDS.join(' ');
  const script = [
    'if ! command -v node >/dev/null 2>&1; then echo "__ERR__:missing-node"; exit 40; fi',
    'if ! command -v opta >/dev/null 2>&1; then echo "__ERR__:missing-opta"; exit 41; fi',
    'help="$(opta --help 2>/dev/null)" || { echo "__ERR__:help-failed"; exit 42; }',
    `missing=""; for c in ${commandList}; do echo "$help" | grep -Eq "(^|[[:space:]])$c([[:space:]]|$)" || missing="$missing $c"; done`,
    'if [ -n "$missing" ]; then echo "__MISSING__:$missing"; exit 43; fi',
    'version="$(opta --version 2>/dev/null || true)"',
    'echo "__VERSION__:$version"',
  ].join('; ');

  const result = await runRemoteCommand(ssh, script, false);
  if (result.exitCode === 40) {
    return { status: 'fail', message: 'node runtime missing on remote host (install Node.js so /opt/homebrew/bin/opta can run)' };
  }
  if (result.exitCode === 41) {
    return { status: 'fail', message: 'opta command not found in PATH on remote host' };
  }
  if (result.exitCode === 42) {
    return { status: 'fail', message: 'opta --help failed on remote host' };
  }
  if (result.exitCode === 43) {
    const marker = result.stdout.split('\n').find((line) => line.startsWith('__MISSING__:'));
    const missing = marker?.replace('__MISSING__:', '').trim() ?? 'unknown';
    return { status: 'fail', message: `missing command entries in remote opta --help: ${missing}` };
  }
  if (result.exitCode !== 0) {
    return { status: 'fail', message: result.stderr || result.stdout || 'remote command verification failed' };
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
  dryRun: boolean,
  mode: UpdateTargetMode,
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

  const failureStatus = remoteConnectFailureStatus(mode);
  const fixDetail = summarizeOutput(fix.stderr || fix.stdout);
  const verifyDetail = summarizeOutput(verify.stderr || verify.stdout);
  const modeHint = mode === 'auto'
    ? 'auto mode skipped Studio updates; use --target remote once SSH is stable'
    : 'fix network path and rerun update';

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

function handleGitPullFailure(result: CommandResult, prefix: string): { status: StepStatus; message: string } {
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

async function updateGitLocal(repoPath: string, noPull: boolean, dryRun: boolean): Promise<{ status: StepStatus; message: string }> {
  if (!existsSync(repoPath)) {
    return { status: 'skip', message: `repo missing: ${repoPath}` };
  }
  if (!existsSync(join(repoPath, '.git'))) {
    return { status: 'skip', message: 'not a git repository (skipped pull)' };
  }

  const hasHead = await runLocalCommand('git rev-parse --verify HEAD >/dev/null 2>&1', repoPath, dryRun);
  if (hasHead.exitCode !== 0) {
    return { status: 'skip', message: 'invalid git metadata (missing HEAD, skipped pull)' };
  }

  const dirty = await runLocalCommand('git status --porcelain', repoPath, dryRun);
  if (dirty.exitCode !== 0) {
    return { status: 'skip', message: `git status unavailable (skipped pull): ${summarizeOutput(dirty.stderr || dirty.stdout)}` };
  }
  if (!dryRun && dirty.stdout.trim().length > 0) {
    return { status: 'skip', message: 'dirty working tree (skipped pull)' };
  }

  if (noPull) {
    return { status: 'ok', message: 'git pull skipped (--no-pull)' };
  }

  const pull = await runLocalCommand('git fetch --all --prune && git pull --ff-only', repoPath, dryRun);
  if (pull.exitCode !== 0) {
    return handleGitPullFailure(pull, 'git pull');
  }

  return { status: 'ok', message: dryRun ? 'dry-run git sync' : 'git sync complete' };
}

async function updateGitRemote(repoPath: string, noPull: boolean, ssh: SshConfig, dryRun: boolean): Promise<{ status: StepStatus; message: string }> {
  const script = [
    `if [ ! -d ${quoteSh(repoPath)} ]; then exit 24; fi`,
    `if [ ! -d ${quoteSh(join(repoPath, '.git'))} ]; then exit 26; fi`,
    `git -C ${quoteSh(repoPath)} rev-parse --verify HEAD >/dev/null 2>&1 || exit 27`,
    `status_out="$(git -C ${quoteSh(repoPath)} status --porcelain 2>/dev/null)" || exit 28`,
    'if [ -n "$status_out" ]; then exit 25; fi',
    noPull ? ':' : `git -C ${quoteSh(repoPath)} fetch --all --prune && git -C ${quoteSh(repoPath)} pull --ff-only`,
  ].join('; ');

  const result = await runRemoteCommand(ssh, script, dryRun);

  if (result.exitCode === 24) return { status: 'skip', message: `repo missing: ${repoPath}` };
  if (result.exitCode === 26) return { status: 'skip', message: 'not a git repository (skipped pull)' };
  if (result.exitCode === 27) return { status: 'skip', message: 'invalid git metadata (missing HEAD, skipped pull)' };
  if (result.exitCode === 28) return { status: 'skip', message: 'git status unavailable (skipped pull)' };
  if (result.exitCode === 25) return { status: 'skip', message: 'dirty working tree (skipped pull)' };
  if (result.exitCode !== 0) {
    return handleGitPullFailure(result, 'git sync');
  }

  return { status: 'ok', message: noPull ? 'git pull skipped (--no-pull)' : (dryRun ? 'dry-run git sync' : 'git sync complete') };
}

async function runComponentBuildLocal(component: UpdateComponent, repoPath: string, dryRun: boolean, lmxPort: number): Promise<{ status: StepStatus; message: string }> {
  switch (component) {
    case 'cli': {
      const cmd = CLI_UPDATE_BUILD_SCRIPT;
      const result = await runLocalCommand(cmd, repoPath, dryRun);
      if (result.exitCode !== 0) return { status: 'fail', message: result.stderr || result.stdout };
      return { status: 'ok', message: dryRun ? 'dry-run typecheck + build' : 'npm typecheck + build complete' };
    }
    case 'lmx': {
      const installCmd = [
        `if [ -x ${quoteSh(join(repoPath, '.venv/bin/python'))} ]; then PIPY=${quoteSh(join(repoPath, '.venv/bin/python'))};`,
        'else PIPY=python3; fi;',
        `"$PIPY" -m pip install -e ${quoteSh(repoPath)} --no-deps || "$PIPY" -m pip install ${quoteSh(repoPath)} --no-deps`,
      ].join(' ');

      const install = await runLocalCommand(installCmd, repoPath, dryRun);
      if (install.exitCode !== 0) return { status: 'fail', message: install.stderr || install.stdout };

      const restartCmd = [
        'pkill -f "python -m opta_lmx.main" >/dev/null 2>&1 || true;',
        'pkill -f "python -m opta_lmx" >/dev/null 2>&1 || true;',
        `if [ -x ${quoteSh(join(repoPath, '.venv/bin/python'))} ]; then PY=${quoteSh(join(repoPath, '.venv/bin/python'))};`,
        'else PY=python3; fi;',
        `nohup env LMX_LOGGING__FILE=/tmp/opta-lmx.log "$PY" -m opta_lmx.main --host 0.0.0.0 --port ${lmxPort} >/tmp/opta-lmx.log 2>&1 &`,
        'ok=0;',
        `for i in $(seq 1 45); do code=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${lmxPort}/healthz || true);`,
        'if [ "$code" = "200" ] || [ "$code" = "401" ] || [ "$code" = "403" ]; then ok=1; break; fi;',
        'sleep 1;',
        'done;',
        'if [ "$ok" = "1" ]; then true; else pgrep -f "python -m opta_lmx.main" >/dev/null 2>&1 || pgrep -f "python -m opta_lmx" >/dev/null 2>&1; fi',
      ].join(' ');

      const restart = await runLocalCommand(restartCmd, repoPath, dryRun);
      if (restart.exitCode !== 0) {
        return { status: 'fail', message: `install ok, restart/health failed: ${restart.stderr || restart.stdout}` };
      }

      return { status: 'ok', message: dryRun ? 'dry-run install/restart' : 'install + restart + health check complete' };
    }
    case 'plus': {
      const result = await runLocalCommand('swift build', repoPath, dryRun);
      if (result.exitCode !== 0) return { status: 'fail', message: result.stderr || result.stdout };
      return { status: 'ok', message: dryRun ? 'dry-run swift build' : 'swift build complete' };
    }
    case 'web': {
      const result = await runLocalCommand(
        'if command -v pnpm >/dev/null 2>&1; then pnpm -C web run build || (pnpm -C web install --no-frozen-lockfile && pnpm -C web run build); else npm --prefix web run build || (npm --prefix web install --no-fund --no-audit && npm --prefix web run build); fi',
        repoPath,
        dryRun,
      );
      if (result.exitCode !== 0) return { status: 'fail', message: result.stderr || result.stdout };
      return { status: 'ok', message: dryRun ? 'dry-run build' : 'web build complete' };
    }
  }
}

async function runComponentBuildRemote(component: UpdateComponent, repoPath: string, dryRun: boolean, ssh: SshConfig, lmxPort: number, lmxPythonPath: string): Promise<{ status: StepStatus; message: string }> {
  let command: string;

  switch (component) {
    case 'cli':
      command = `cd ${quoteSh(repoPath)} && (${CLI_UPDATE_BUILD_SCRIPT})`;
      break;
    case 'lmx':
      command = [
        `cd ${quoteSh(repoPath)}`,
        '&& {',
        `if [ -x ${quoteSh(join(repoPath, '.venv/bin/python'))} ]; then PIPY=${quoteSh(join(repoPath, '.venv/bin/python'))};`,
        'else PIPY=python3; fi;',
        `"$PIPY" -m pip install -e ${quoteSh(repoPath)} --no-deps || "$PIPY" -m pip install ${quoteSh(repoPath)} --no-deps;`,
        `pkill -f "python -m opta_lmx.main" >/dev/null 2>&1 || true;`,
        `pkill -f "python -m opta_lmx" >/dev/null 2>&1 || true;`,
        `if [ -x ${quoteSh(lmxPythonPath)} ] && ${quoteSh(lmxPythonPath)} -c "import opta_lmx" >/dev/null 2>&1; then PY=${quoteSh(lmxPythonPath)};`,
        'elif command -v "$PIPY" >/dev/null 2>&1; then PY="$PIPY";',
        'else PY=python3; fi;',
        `nohup env LMX_LOGGING__FILE=/tmp/opta-lmx.log "$PY" -m opta_lmx.main --host 0.0.0.0 --port ${lmxPort} >/tmp/opta-lmx.log 2>&1 &`,
        'ok=0;',
        `for i in $(seq 1 45); do code=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${lmxPort}/healthz || true);`,
        'if [ "$code" = "200" ] || [ "$code" = "401" ] || [ "$code" = "403" ]; then ok=1; break; fi;',
        'sleep 1;',
        'done;',
        'if [ "$ok" = "1" ]; then true; else pgrep -f "python -m opta_lmx.main" >/dev/null 2>&1 || pgrep -f "python -m opta_lmx" >/dev/null 2>&1; fi;',
        '}',
      ].join(' ');
      break;
    case 'plus':
      command = `cd ${quoteSh(repoPath)} && swift build`;
      break;
    case 'web':
      command = [
        `cd ${quoteSh(repoPath)}`,
        '&& if command -v pnpm >/dev/null 2>&1;',
        'then pnpm -C web run build || (pnpm -C web install --no-frozen-lockfile && pnpm -C web run build);',
        'else npm --prefix web run build || (npm --prefix web install --no-fund --no-audit && npm --prefix web run build);',
        'fi',
      ].join(' ');
      break;
  }

  const result = await runRemoteCommand(ssh, command, dryRun);
  if (result.exitCode !== 0) {
    return { status: 'fail', message: result.stderr || result.stdout || 'remote command failed' };
  }

  const okMessage = component === 'lmx'
    ? (dryRun ? 'dry-run install/restart' : 'install + restart + health check complete')
    : component === 'cli'
      ? (dryRun ? 'dry-run typecheck + build' : 'typecheck + build complete')
    : (dryRun ? 'dry-run build' : 'build complete');
  return { status: 'ok', message: okMessage };
}

function printHumanSummary(results: StepResult[]): void {
  console.log('');
  console.log(chalk.bold(colorizeOptaWord('Opta Update Summary')));

  for (const result of results) {
    const prefix = result.status === 'ok'
      ? chalk.green('✓')
      : result.status === 'skip'
        ? chalk.yellow('!')
        : chalk.red('✗');

    const targetLabel = result.target === 'remote' && result.host
      ? `${result.target}@${result.host}`
      : result.target;

    console.log(`${prefix} [${targetLabel}] ${result.component}:${result.step} — ${result.message}`);
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
  host?: string,
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
  const mode = opts.target ?? 'auto';
  const remoteHost = opts.remoteHost ?? config.connection.host;
  const targets = resolveTargets(mode, remoteHost);
  let remoteHostUsed: string | null = null;

  const results: StepResult[] = [];
  const dryRun = Boolean(opts.dryRun);
  const noBuild = opts.build === false;
  const noPull = opts.pull === false;

  const localAppsRoot = opts.localRoot
    ? expandHome(opts.localRoot)
    : detectAppsRoot(process.cwd());

  const remoteAppsRoot = opts.remoteRoot
    ? expandHome(opts.remoteRoot)
    : deriveRemoteAppsRootFromLmxPath(config.connection.ssh.lmxPath);

  const verifyStepCount = targets.includes('remote') && components.includes('cli') && !isLocalHost(remoteHost)
    ? 1
    : 0;
  const remoteGuardStepCount = targets.includes('remote') && !isLocalHost(remoteHost)
    ? 1
    : 0;
  const localStepCount = targets.includes('local')
    ? (localAppsRoot ? components.length * 2 : 1)
    : 0;
  const remoteStepCount = targets.includes('remote')
    ? (
        isLocalHost(remoteHost)
          ? components.length
          : (components.length * 2 + verifyStepCount + remoteGuardStepCount)
      )
    : 0;
  const progress = createSegmentedStepProgressTracker(
    [
      ...(localStepCount > 0 ? [{ key: 'local', label: 'Local', totalSteps: localStepCount }] : []),
      ...(remoteStepCount > 0 ? [{ key: 'remote', label: 'Studio', totalSteps: remoteStepCount }] : []),
    ],
    'Update progress',
    !opts.json,
  );
  const pushResult = (result: StepResult): void => {
    results.push(result);
    const hostSuffix = result.target === 'remote' && result.host
      ? `@${result.host}`
      : '';
    const scope = result.target === 'remote' ? 'studio' : 'local';
    progress.tick(result.target, `[${scope}] ${result.component}:${result.step}${hostSuffix} ${result.status}`);
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

        const buildResult = await runComponentBuildLocal(component, repoPath, dryRun, config.connection.port);
        pushResult(componentStep('local', component, 'build', buildResult));
      }
    }
  }

  if (targets.includes('remote')) {
    if (isLocalHost(remoteHost)) {
      remoteHostUsed = remoteHost;
      for (const component of components) {
        pushResult({
          target: 'remote',
          component,
          step: 'connect',
          status: 'skip',
          message: `remote host ${remoteHost} resolves to local; skipped`,
          host: remoteHost,
        });
      }
    } else {
      const baseSshConfig: SshConfig = {
        host: remoteHost,
        user: opts.remoteUser ?? config.connection.ssh.user,
        identityFile: expandHome(opts.identityFile ?? config.connection.ssh.identityFile),
      };

      const remoteCandidates = resolveRemoteHostCandidates(remoteHost, config.connection.fallbackHosts);
      const selection = await selectReachableRemoteHost(remoteCandidates, (candidateHost) => runRemoteCommand({
        ...baseSshConfig,
        host: candidateHost,
      }, 'echo connected', dryRun), { parallel: true });

      if (!selection.selectedHost) {
        const connectStatus = remoteConnectFailureStatus(mode);
        const attemptDetail = selection.probes.length > 0
          ? selection.probes.map((probe) => `${probe.host}: ${summarizeOutput(probe.detail)}`).join('; ')
          : 'ssh failed';
        const attemptedHosts = remoteCandidates.length > 0 ? remoteCandidates.join(', ') : remoteHost;
        const connectDetail = `ssh failed for hosts (${attemptedHosts}) — ${attemptDetail}`;
        const connectMessage = mode === 'auto'
          ? `${connectDetail} (auto mode skipped Studio updates; use --target remote once SSH is reachable)`
          : connectDetail;
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
        remoteHostUsed = selection.selectedHost;
        const sshConfig: SshConfig = {
          ...baseSshConfig,
          host: selection.selectedHost,
        };

        const guardComponent = components[0] ?? 'cli';
        const guard = await runRemoteLanStabilityGuard(sshConfig, dryRun, mode);
        pushResult(componentStep('remote', guardComponent, 'network', {
          status: guard.status,
          message: guard.message,
        }, sshConfig.host));

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
        } else {
          for (const component of components) {
            const repoPath = component === 'lmx'
              ? config.connection.ssh.lmxPath
              : remoteAppsRoot
                ? componentRepoPath(component, remoteAppsRoot)
                : '';

            if (!repoPath) {
              pushResult({
                target: 'remote',
                component,
                step: 'discover-root',
                status: 'skip',
                message: 'remote path unavailable; set --remote-root for cli/plus/web',
                host: sshConfig.host,
              });
              continue;
            }

            const gitResult = await updateGitRemote(repoPath, noPull, sshConfig, dryRun);
            pushResult(componentStep('remote', component, 'git', gitResult, sshConfig.host));

            if (!canProceedToBuild(gitResult)) {
              continue;
            }

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
              const buildResult = await runComponentBuildRemote(
                component,
                repoPath,
                dryRun,
                sshConfig,
                config.connection.port,
                config.connection.ssh.pythonPath,
              );
              pushResult(componentStep('remote', component, 'build', buildResult, sshConfig.host));
            }

            if (component === 'cli') {
              const verify = await verifyRemoteCliCommands(sshConfig, dryRun);
              pushResult(componentStep('remote', component, 'verify', verify, sshConfig.host));
            }
          }
        }
      }
    }
  }

  progress.done('all update steps finished');

  if (opts.json) {
    console.log(JSON.stringify({
      mode,
      components,
      targets,
      dryRun,
      noBuild,
      noPull,
      localAppsRoot,
      remoteHost,
      remoteHostUsed,
      remoteAppsRoot,
      results,
    }, null, 2));
  } else {
    printHumanSummary(results);
  }

  let updateLogPath: string | null = null;
  const journal = config.journal;
  if (journal?.enabled !== false) {
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
          localAppsRoot: localAppsRoot ?? '(auto-detect failed)',
          remoteHost,
          remoteHostUsed: remoteHostUsed ?? '(none)',
          remoteAppsRoot: remoteAppsRoot ?? '(auto)',
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
