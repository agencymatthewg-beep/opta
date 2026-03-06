import chalk from 'chalk';
import { execa } from 'execa';
import { daemonStatus } from '../daemon/lifecycle.js';
import { loadConfig } from '../core/config.js';
import { isLoopbackHost } from '../lmx/local-config.js';
import { ExitError, EXIT } from '../core/errors.js';
import { colorizeOptaWord } from '../ui/brand.js';

interface HealthOptions {
  json?: boolean;
  skipLmx?: boolean;
}

type HealthState = 'pass' | 'warn' | 'fail';

interface HealthCheck {
  name: string;
  status: HealthState;
  message: string;
  detail?: string;
}

const REQUIRED_SURFACE = ['daemon', 'health', 'doctor', 'settings', 'update'] as const;

function statusIcon(status: HealthState): string {
  if (status === 'pass') return chalk.green('\u2713');
  if (status === 'warn') return chalk.yellow('\u26A0');
  return chalk.red('\u2717');
}

function parseMissingCommands(helpText: string): string[] {
  const normalized = helpText.toLowerCase();
  return REQUIRED_SURFACE.filter((command) => {
    const pattern = new RegExp(`(^|\\s)${command}(\\s|$)`, 'm');
    return !pattern.test(normalized);
  });
}

async function resolveOptaBinaryPath(): Promise<string | null> {
  const lookupCommand = process.platform === 'win32' ? 'where' : 'which';
  const lookup = await execa(lookupCommand, ['opta'], { reject: false });
  if ((lookup.exitCode ?? 1) !== 0) return null;
  const firstMatch = lookup.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  return firstMatch ?? null;
}

async function checkCliSurface(): Promise<HealthCheck> {
  const optaPath = await resolveOptaBinaryPath();
  if (!optaPath) {
    return {
      name: 'CLI',
      status: 'fail',
      message: 'opta command is not available in PATH',
      detail: 'Install/relink Opta CLI, then rerun: npm i -g @opta/opta-cli',
    };
  }

  const versionResult = await execa('opta', ['--version'], { reject: false });
  const helpResult = await execa('opta', ['--help'], { reject: false });
  const helpText = [helpResult.stdout, helpResult.stderr].filter(Boolean).join('\n');

  if ((helpResult.exitCode ?? 1) !== 0) {
    return {
      name: 'CLI',
      status: 'fail',
      message: 'opta --help failed',
      detail: helpText || 'unknown help failure',
    };
  }

  const missing = parseMissingCommands(helpText);
  if (missing.length > 0) {
    return {
      name: 'CLI',
      status: 'warn',
      message: `CLI missing expected commands: ${missing.join(', ')}`,
      detail: `Binary path: ${optaPath}`,
    };
  }

  const version = versionResult.stdout.trim() || 'unknown';
  return {
    name: 'CLI',
    status: 'pass',
    message: `CLI healthy (${version})`,
    detail: `Binary path: ${optaPath}`,
  };
}

async function checkDaemonRuntime(): Promise<HealthCheck> {
  const status = await daemonStatus();
  if (!status.running || !status.state) {
    return {
      name: 'Daemon',
      status: 'warn',
      message: 'Daemon is not running',
      detail: `Start it with: opta daemon start (${status.logsPath})`,
    };
  }

  const endpoint = `http://${status.state.host}:${status.state.port}/v3/health`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_500);
  try {
    const response = await fetch(endpoint, { signal: controller.signal });
    if (response.status === 401 || response.status === 403) {
      return {
        name: 'Daemon',
        status: 'pass',
        message: `Daemon reachable at ${status.state.host}:${status.state.port} (pid=${status.state.pid}); health endpoint requires auth`,
        detail: `Endpoint: ${endpoint} (${response.status})`,
      };
    }
    if (!response.ok) {
      return {
        name: 'Daemon',
        status: 'warn',
        message: `Daemon running (pid=${status.state.pid}) but /v3/health returned ${response.status}`,
        detail: `Endpoint: ${endpoint}`,
      };
    }
    return {
      name: 'Daemon',
      status: 'pass',
      message: `Daemon healthy at ${status.state.host}:${status.state.port} (pid=${status.state.pid})`,
      detail: `Endpoint: ${endpoint}`,
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return {
      name: 'Daemon',
      status: 'warn',
      message: `Daemon running (pid=${status.state.pid}) but health probe failed`,
      detail: `${endpoint} (${detail})`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function checkLmxRuntime(host: string, port: number): Promise<HealthCheck> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3_000);
  try {
    // LMX exposes /healthz on the inference port
    const response = await fetch(`http://${host}:${port}/healthz`, { signal: controller.signal });
    if (response.ok) {
      return {
        name: 'LMX',
        status: 'pass',
        message: `LMX reachable at ${host}:${port}`,
        detail: `Endpoint: http://${host}:${port}/healthz`,
      };
    }
    return {
      name: 'LMX',
      status: 'warn',
      message: `LMX at ${host}:${port} returned HTTP ${response.status}`,
      detail: `Endpoint: http://${host}:${port}/healthz`,
    };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    const isRefused =
      err instanceof Error &&
      (err.message.includes('ECONNREFUSED') || err.message.includes('fetch failed'));
    const reason = isAbort ? 'timeout' : isRefused ? 'connection refused' : (err instanceof Error ? err.message : String(err));
    return {
      name: 'LMX',
      status: 'warn',
      message: `LMX unreachable at ${host}:${port} (${reason})`,
      detail: `Run 'opta serve start' or check connection.host / connection.port in config`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function runHealth(opts: HealthOptions): Promise<void> {
  const config = await loadConfig();
  const lmxHost = config.connection.host;
  const lmxPort = config.connection.port;
  const shouldCheckLmx = !opts.skipLmx && lmxHost && !isLoopbackHost(lmxHost);

  const checks = await Promise.all([
    checkCliSurface(),
    checkDaemonRuntime(),
    ...(shouldCheckLmx ? [checkLmxRuntime(lmxHost, lmxPort)] : []),
  ]);
  const summary = {
    passed: checks.filter((check) => check.status === 'pass').length,
    warnings: checks.filter((check) => check.status === 'warn').length,
    failures: checks.filter((check) => check.status === 'fail').length,
  };

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          checks,
          summary,
        },
        null,
        2
      )
    );
  } else {
    console.log('');
    console.log(chalk.bold(colorizeOptaWord('Opta Health')));
    console.log(chalk.dim('\u2500'.repeat(30)));
    console.log('');
    for (const check of checks) {
      console.log(`  ${statusIcon(check.status)} ${check.message}`);
      if (check.detail) {
        console.log(`    ${chalk.dim(check.detail)}`);
      }
    }
    console.log('');
    console.log(
      `  ${summary.failures > 0 ? chalk.red(`${summary.failures} failures`) : chalk.green(`${summary.passed} passed`)}` +
        `${summary.warnings > 0 ? chalk.yellow(`, ${summary.warnings} warnings`) : ''}`
    );
    console.log(chalk.dim("  Use 'opta doctor --fix' for deeper diagnosis and auto-remediation."));
    console.log('');
  }

  if (summary.failures > 0) {
    throw new ExitError(EXIT.ERROR);
  }
}
