import { execFileSync, spawn } from 'node:child_process';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import chalk from 'chalk';
import { loadConfig } from '../core/config.js';
import { OptaError, ExitError, EXIT } from '../core/errors.js';
import { createSpinner } from '../ui/spinner.js';
import { colorizeOptaWord } from '../ui/brand.js';
import { LmxClient } from '../lmx/client.js';
import { errorMessage } from '../utils/errors.js';
import { sleep } from '../utils/common.js';
import { homedir, requiresPosixPlatform } from '../platform/index.js';

interface ServeOptions {
  json?: boolean;
}

const REMOTE_LAUNCHD_LABEL = 'com.opta.lmx';
const STARTUP_WAIT_MS = 90_000;
const DEFAULT_SSH_CONNECT_TIMEOUT_SECONDS = 25;
const FAST_HEALTH_REQUEST_OPTS = { timeoutMs: 2_000, maxRetries: 0 } as const;

export async function serve(action?: string, opts?: ServeOptions): Promise<void> {
  requiresPosixPlatform('opta serve');
  switch (action) {
    case 'start':
      await serveStart(opts);
      return;
    case 'stop':
      await serveStop(opts);
      return;
    case 'restart':
      await serveStop(opts);
      await serveStart(opts);
      return;
    case 'logs':
      await serveLogs();
      return;
    default:
      await serveStatus(opts);
  }
}

function isRemoteHost(host: string): boolean {
  return host !== '127.0.0.1' && host !== 'localhost';
}

function expandHome(path: string): string {
  if (!path.startsWith('~')) return path;
  return homedir() + path.slice(1);
}

function quoteSh(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

function resolveHostCandidates(
  primaryHost: string,
  fallbackHosts: readonly string[] = []
): string[] {
  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const host of [primaryHost, ...fallbackHosts]) {
    const value = host.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(value);
  }
  return candidates.length > 0 ? candidates : [primaryHost];
}

async function expandSshHostCandidates(
  primaryHost: string,
  fallbackHosts: readonly string[] = []
): Promise<string[]> {
  const base = resolveHostCandidates(primaryHost, fallbackHosts);
  const seen = new Set<string>();
  const candidates: string[] = [];

  const pushUnique = (value: string): void => {
    const normalized = value.trim();
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(normalized);
  };

  const lookupResults = await Promise.allSettled(
    base.map(async (host) => {
      if (isIP(host) !== 0) return [] as string[];
      const addresses = await lookup(host, { all: true, verbatim: false });
      return addresses.map((entry) => entry.address);
    })
  );

  for (let i = 0; i < base.length; i++) {
    const host = base[i]!;
    pushUnique(host);
    const resolved = lookupResults[i];
    if (!resolved || resolved.status !== 'fulfilled') continue;
    for (const address of resolved.value) {
      pushUnique(address);
    }
  }

  return candidates.length > 0 ? candidates : base;
}

function resolveSshConnectTimeoutSeconds(configuredSeconds: number | undefined): number {
  return Math.max(3, Math.floor(configuredSeconds || DEFAULT_SSH_CONNECT_TIMEOUT_SECONDS));
}

function extractExecOutput(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null;
  const stdout = (err as { stdout?: unknown }).stdout;
  const stderr = (err as { stderr?: unknown }).stderr;
  const outText =
    typeof stdout === 'string' ? stdout : Buffer.isBuffer(stdout) ? stdout.toString('utf8') : '';
  const errText =
    typeof stderr === 'string' ? stderr : Buffer.isBuffer(stderr) ? stderr.toString('utf8') : '';
  const merged = [errText.trim(), outText.trim()].filter(Boolean).join('\n');
  return merged || null;
}

function canImportModule(python: string, moduleName: string): boolean {
  try {
    execFileSync(python, ['-c', `import ${moduleName}`], { stdio: 'ignore', timeout: 4_000 });
    return true;
  } catch {
    return false;
  }
}

function canRunModule(python: string, moduleName: string): boolean {
  try {
    execFileSync(python, ['-m', moduleName, '--help'], { stdio: 'ignore', timeout: 6_000 });
    return true;
  } catch {
    return false;
  }
}

function resolveLocalInvocation(): { python: string; module: string } {
  const candidates = [
    process.env['OPTA_PYTHON'],
    '.venv/bin/python',
    `${homedir()}/opta-lmx/.venv/bin/python`,
    `${homedir()}/.opta-lmx/.venv/bin/python`,
    'python3',
    'python',
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim());

  for (const python of candidates) {
    if (canImportModule(python, 'opta_lmx.main')) {
      return { python, module: 'opta_lmx.main' };
    }
  }
  for (const python of candidates) {
    if (canRunModule(python, 'opta_lmx')) {
      return { python, module: 'opta_lmx' };
    }
  }

  throw new Error(
    'No usable Python runtime found for Opta LMX. Tried .venv/bin/python, ~/opta-lmx/.venv/bin/python, python3, python'
  );
}

function buildRemoteStartScript(lmxPath: string, configuredPython: string, port: number): string {
  const repoPython = `${lmxPath}/.venv/bin/python`;
  // Resolve config file: try user-created config.yaml first, then ~/.opta-lmx, then default
  const configCandidates = [
    `${lmxPath}/config/config.yaml`,
    `$HOME/.opta-lmx/config.yaml`,
    `${lmxPath}/config/default-config.yaml`,
  ];

  return [
    'set -e',
    `if command -v launchctl >/dev/null 2>&1 && launchctl print gui/$(id -u)/${REMOTE_LAUNCHD_LABEL} >/dev/null 2>&1; then`,
    `  launchctl kickstart -k gui/$(id -u)/${REMOTE_LAUNCHD_LABEL}`,
    '  exit 0',
    'fi',
    `cd ${quoteSh(lmxPath)}`,
    'PY=""',
    'ENTRY=""',
    `if [ -x ${quoteSh(repoPython)} ] && ${quoteSh(repoPython)} -c "import opta_lmx.main" >/dev/null 2>&1; then`,
    `  PY=${quoteSh(repoPython)}`,
    '  ENTRY="opta_lmx.main"',
    `elif [ -x ${quoteSh(configuredPython)} ] && ${quoteSh(configuredPython)} -c "import opta_lmx.main" >/dev/null 2>&1; then`,
    `  PY=${quoteSh(configuredPython)}`,
    '  ENTRY="opta_lmx.main"',
    `elif [ -x ${quoteSh(configuredPython)} ] && ${quoteSh(configuredPython)} -m opta_lmx --help >/dev/null 2>&1; then`,
    `  PY=${quoteSh(configuredPython)}`,
    '  ENTRY="opta_lmx"',
    'elif command -v python3 >/dev/null 2>&1 && python3 -c "import opta_lmx.main" >/dev/null 2>&1; then',
    '  PY="python3"',
    '  ENTRY="opta_lmx.main"',
    'else',
    `  echo "No usable python runtime for Opta LMX. Tried ${repoPython}, ${configuredPython}, python3" >&2`,
    '  exit 42',
    'fi',
    `CFG=""`,
    `for _candidate in ${configCandidates.map((c) => quoteSh(c)).join(' ')}; do [ -f "$_candidate" ] && CFG="$_candidate" && break; done`,
    `if [ -n "$CFG" ] && [ "$ENTRY" = "opta_lmx.main" ]; then`,
    `  nohup env LMX_LOGGING__FILE=/tmp/opta-lmx.log "$PY" -m "$ENTRY" --config "$CFG" --host 0.0.0.0 --port ${port} >/tmp/opta-lmx.log 2>&1 &`,
    'else',
    `  nohup env LMX_LOGGING__FILE=/tmp/opta-lmx.log "$PY" -m "$ENTRY" --host 0.0.0.0 --port ${port} >/tmp/opta-lmx.log 2>&1 &`,
    'fi',
    'sleep 1',
  ].join('\n');
}

async function serveStatus(opts?: ServeOptions): Promise<void> {
  const config = await loadConfig();
  const { host, port } = config.connection;
  const client = new LmxClient({
    host,
    fallbackHosts: config.connection.fallbackHosts,
    port,
    adminKey: config.connection.adminKey,
  });

  try {
    const health = await client.health(FAST_HEALTH_REQUEST_OPTS);
    const status = await client.status(FAST_HEALTH_REQUEST_OPTS);

    if (opts?.json) {
      console.log(JSON.stringify({ running: true, health, status }, null, 2));
      return;
    }

    console.log(chalk.green('●') + ` ${colorizeOptaWord(`Opta LMX running at ${host}:${port}`)}`);
    if (status.version) console.log(chalk.dim(`  Version: ${status.version}`));
    if (status.uptime_seconds != null)
      console.log(chalk.dim(`  Uptime:  ${formatDuration(status.uptime_seconds)}`));
    console.log(chalk.dim(`  Models:  ${status.models.length} loaded`));
  } catch {
    if (opts?.json) {
      console.log(JSON.stringify({ running: false, host, port }, null, 2));
      return;
    }
    console.log(
      chalk.red('●') + ` ${colorizeOptaWord(`Opta LMX is not reachable at ${host}:${port}`)}`
    );
    console.log(chalk.dim(`  Start it: opta serve start`));
  }
}

async function serveStart(opts?: ServeOptions): Promise<void> {
  const config = await loadConfig();
  const { host, port } = config.connection;
  const client = new LmxClient({
    host,
    fallbackHosts: config.connection.fallbackHosts,
    port,
    adminKey: config.connection.adminKey,
  });
  const spinner = await createSpinner();

  // Check if already running
  try {
    await client.health(FAST_HEALTH_REQUEST_OPTS);
    const activeHost = client.getActiveHost();
    console.log(
      chalk.yellow('!') +
        ` ${colorizeOptaWord(`Opta LMX is already running at ${activeHost}:${port}`)}`
    );
    return;
  } catch {
    // Not running — proceed with start
  }

  const isRemote = isRemoteHost(host);
  let remoteHostCandidates: string[] = [];

  spinner.start(`Starting Opta LMX on ${isRemote ? host : 'localhost'}...`);

  try {
    if (isRemote) {
      const { ssh } = config.connection;
      const identityFile = expandHome(ssh.identityFile);
      const remoteScript = buildRemoteStartScript(ssh.lmxPath, ssh.pythonPath, port);
      const hostCandidates = await expandSshHostCandidates(host, config.connection.fallbackHosts);
      remoteHostCandidates = hostCandidates;
      const sshConnectTimeoutSec = resolveSshConnectTimeoutSeconds(ssh.connectTimeoutSec);
      const failures: string[] = [];
      let startedHost: string | null = null;

      for (const candidate of hostCandidates) {
        const sshTarget = `${ssh.user}@${candidate}`;
        const args = [
          '-o',
          'BatchMode=yes',
          '-o',
          `ConnectTimeout=${sshConnectTimeoutSec}`,
          '-i',
          identityFile,
          sshTarget,
          `bash -lc ${quoteSh(remoteScript)}`,
        ];
        try {
          execFileSync('ssh', args, { timeout: 25_000, stdio: 'pipe' });
          startedHost = candidate;
          break;
        } catch (err) {
          const detail = extractExecOutput(err) ?? errorMessage(err);
          failures.push(`${candidate}: ${detail}`);
        }
      }

      if (!startedHost) {
        throw new OptaError(
          `Failed to start Opta LMX on ${host}`,
          EXIT.NO_CONNECTION,
          ['SSH launch failed on all configured hosts.', ...failures.slice(0, 4)],
          [
            `Check SSH access: ssh -i ${config.connection.ssh.identityFile} ${config.connection.ssh.user}@${host}`,
            config.connection.fallbackHosts.length > 0
              ? `Try fallback hosts: ${config.connection.fallbackHosts.join(', ')}`
              : 'Configure fallback hosts: opta config set connection.fallbackHosts hostA,hostB',
            'Check logs: opta serve logs',
          ]
        );
      }
    } else {
      const invocation = resolveLocalInvocation();
      const child = spawn(
        invocation.python,
        ['-m', invocation.module, '--host', '0.0.0.0', '--port', String(port)],
        { detached: true, stdio: 'ignore' }
      );
      child.unref();
    }

    // Poll for health (up to 90 seconds to allow remote cold starts).
    const maxWait = STARTUP_WAIT_MS;
    const interval = 1_000;
    const deadline = Date.now() + maxWait;

    while (Date.now() < deadline) {
      await sleep(interval);
      try {
        await client.health(FAST_HEALTH_REQUEST_OPTS);
        const activeHost = client.getActiveHost();
        spinner.succeed(`Opta LMX started at ${activeHost}:${port}`);

        if (opts?.json) {
          console.log(JSON.stringify({ started: true, host: activeHost, port }, null, 2));
        }
        return;
      } catch {
        // Not ready yet
      }
    }

    if (isRemote) {
      const { ssh } = config.connection;
      const identityFile = expandHome(ssh.identityFile);
      const sshConnectTimeoutSec = resolveSshConnectTimeoutSeconds(ssh.connectTimeoutSec);
      const verifyCandidates =
        remoteHostCandidates.length > 0
          ? remoteHostCandidates
          : await expandSshHostCandidates(host, config.connection.fallbackHosts);

      let remotelyHealthy = false;
      for (const candidate of verifyCandidates) {
        const sshTarget = `${ssh.user}@${candidate}`;
        const probe = `curl -fsS -m 4 http://127.0.0.1:${port}/healthz >/dev/null`;
        try {
          execFileSync(
            'ssh',
            ['-o', `ConnectTimeout=${sshConnectTimeoutSec}`, '-i', identityFile, sshTarget, probe],
            { timeout: 20_000, stdio: 'pipe' }
          );
          remotelyHealthy = true;
          break;
        } catch {
          // Try next candidate.
        }
      }

      if (remotelyHealthy) {
        spinner.fail(`Opta LMX started on ${host} but is not reachable from this machine`);
        throw new OptaError(
          `Opta LMX started remotely but LAN access failed at ${host}:${port}`,
          EXIT.NO_CONNECTION,
          [
            'Remote daemon health check succeeded via SSH localhost probe.',
            'Direct HTTP health checks from local machine timed out.',
          ],
          [
            `Check remote firewall rules for TCP ${port}`,
            `Confirm bind host in remote config includes 0.0.0.0`,
            `Temporary workaround: ssh -N -L ${port}:127.0.0.1:${port} ${ssh.user}@${host}`,
            'Then retry: opta status',
          ]
        );
      }
    }

    spinner.fail(`Opta LMX did not start within ${Math.round(maxWait / 1000)} seconds`);
    console.log(chalk.dim(`  Check logs: opta serve logs`));
    throw new ExitError(EXIT.ERROR);
  } catch (err) {
    spinner.fail('Failed to start Opta LMX');
    if (err instanceof OptaError) {
      throw err;
    }
    const detail = extractExecOutput(err);
    throw new OptaError(
      `Failed to start Opta LMX on ${host}`,
      EXIT.ERROR,
      [detail ?? errorMessage(err)],
      [
        isRemote
          ? `Check SSH access: ssh -i ${config.connection.ssh.identityFile} ${config.connection.ssh.user}@${host}`
          : 'Check Python environment',
        isRemote ? `SSH config: opta config set connection.ssh.user <user>` : '',
        isRemote ? `Verify remote runtime: opta config get connection.ssh.pythonPath` : '',
        `Verify install: pip show opta-lmx`,
        `Check logs: opta serve logs`,
      ].filter(Boolean)
    );
  }
}

async function serveStop(_opts?: ServeOptions): Promise<void> {
  const config = await loadConfig();
  const { host } = config.connection;
  const isRemote = isRemoteHost(host);
  const spinner = await createSpinner();

  spinner.start(`Stopping Opta LMX on ${isRemote ? host : 'localhost'}...`);

  try {
    if (isRemote) {
      try {
        const { ssh } = config.connection;
        const identityFile = expandHome(ssh.identityFile);
        const sshConnectTimeoutSec = resolveSshConnectTimeoutSeconds(ssh.connectTimeoutSec);
        const hostCandidates = await expandSshHostCandidates(host, config.connection.fallbackHosts);
        const stopScript = [
          `if command -v launchctl >/dev/null 2>&1; then launchctl kill SIGTERM gui/$(id -u)/${REMOTE_LAUNCHD_LABEL} >/dev/null 2>&1 || true; fi`,
          'pkill -f "python -m opta_lmx.main" >/dev/null 2>&1 || true',
          'pkill -f "python -m opta_lmx" >/dev/null 2>&1 || true',
        ].join('; ');
        for (const candidate of hostCandidates) {
          const sshTarget = `${ssh.user}@${candidate}`;
          try {
            execFileSync(
              'ssh',
              [
                '-o',
                `ConnectTimeout=${sshConnectTimeoutSec}`,
                '-i',
                identityFile,
                sshTarget,
                stopScript,
              ],
              { timeout: 20_000 }
            );
            break;
          } catch {
            // Try next host candidate.
          }
        }
      } catch {
        // pkill returns non-zero when no process found — that's fine
      }
    } else {
      try {
        execFileSync('pkill', ['-f', 'python -m opta_lmx.main'], { timeout: 5_000 });
      } catch {
        // No process to kill
      }
      try {
        execFileSync('pkill', ['-f', 'python -m opta_lmx'], { timeout: 5_000 });
      } catch {
        // No process to kill
      }
    }

    spinner.succeed('Opta LMX stopped');

    if (_opts?.json) {
      console.log(JSON.stringify({ stopped: true, host }, null, 2));
    }
  } catch (err) {
    spinner.fail('Failed to stop Opta LMX');
    throw new OptaError(
      `Failed to stop Opta LMX on ${host}`,
      EXIT.ERROR,
      [errorMessage(err)],
      [isRemote ? `SSH manually: ssh ${host}` : 'Check running processes']
    );
  }
}

async function serveLogs(): Promise<void> {
  const config = await loadConfig();
  const { host } = config.connection;
  const isRemote = isRemoteHost(host);

  try {
    let output: string;
    if (isRemote) {
      const { ssh } = config.connection;
      const identityFile = expandHome(ssh.identityFile);
      const sshConnectTimeoutSec = resolveSshConnectTimeoutSeconds(ssh.connectTimeoutSec);
      const hostCandidates = await expandSshHostCandidates(host, config.connection.fallbackHosts);
      const logsScript = [
        'set -e',
        'printed=0',
        'for f in /tmp/opta-lmx.log /tmp/opta-lmx-service.log; do',
        '  if [ -f "$f" ]; then',
        '    if [ "$printed" = "1" ]; then printf "\\n"; fi',
        '    echo "=== $f ==="',
        '    tail -50 "$f"',
        '    printed=1',
        '  fi',
        'done',
        'if [ "$printed" = "0" ]; then echo "No Opta LMX logs found under /tmp."; fi',
      ].join('\n');
      const failures: string[] = [];
      let logsOutput: string | null = null;
      for (const candidate of hostCandidates) {
        const sshTarget = `${ssh.user}@${candidate}`;
        try {
          logsOutput = execFileSync(
            'ssh',
            [
              '-o',
              `ConnectTimeout=${sshConnectTimeoutSec}`,
              '-i',
              identityFile,
              sshTarget,
              `bash -lc ${quoteSh(logsScript)}`,
            ],
            {
              timeout: 30_000,
              encoding: 'utf8',
            }
          );
          break;
        } catch (err) {
          failures.push(`${candidate}: ${extractExecOutput(err) ?? errorMessage(err)}`);
        }
      }
      if (logsOutput === null) {
        throw new OptaError('Failed to read Opta LMX logs', EXIT.ERROR, failures.slice(0, 4), [
          `SSH manually: ssh ${host}`,
        ]);
      }
      output = logsOutput;
    } else {
      const localScript = [
        'set -e',
        'printed=0',
        'for f in /tmp/opta-lmx.log /tmp/opta-lmx-service.log; do',
        '  if [ -f "$f" ]; then',
        '    if [ "$printed" = "1" ]; then printf "\\n"; fi',
        '    echo "=== $f ==="',
        '    tail -50 "$f"',
        '    printed=1',
        '  fi',
        'done',
        'if [ "$printed" = "0" ]; then echo "No Opta LMX logs found under /tmp."; fi',
      ].join('\n');
      output = execFileSync('bash', ['-lc', localScript], {
        timeout: 8_000,
        encoding: 'utf8',
      });
    }
    console.log(output);
  } catch (err) {
    if (err instanceof OptaError) {
      throw err;
    }
    throw new OptaError(
      'Failed to read Opta LMX logs',
      EXIT.ERROR,
      [errorMessage(err)],
      [isRemote ? `SSH manually: ssh ${host}` : 'Check /tmp/opta-lmx.log']
    );
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}
