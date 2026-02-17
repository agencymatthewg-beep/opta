import { execFileSync, spawn } from 'node:child_process';
import chalk from 'chalk';
import { loadConfig } from '../core/config.js';
import { OptaError, EXIT } from '../core/errors.js';
import { createSpinner } from '../ui/spinner.js';
import { LmxClient } from '../lmx/client.js';

interface ServeOptions {
  json?: boolean;
}

export async function serve(
  action?: string,
  opts?: ServeOptions,
): Promise<void> {
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

async function serveStatus(opts?: ServeOptions): Promise<void> {
  const config = await loadConfig();
  const { host, port } = config.connection;
  const client = new LmxClient({ host, port, adminKey: config.connection.adminKey });

  try {
    const health = await client.health();
    const status = await client.status();

    if (opts?.json) {
      console.log(JSON.stringify({ running: true, health, status }, null, 2));
      return;
    }

    console.log(chalk.green('●') + ` Opta LMX running at ${host}:${port}`);
    if (status.version) console.log(chalk.dim(`  Version: ${status.version}`));
    if (status.uptime_seconds != null) console.log(chalk.dim(`  Uptime:  ${formatDuration(status.uptime_seconds)}`));
    console.log(chalk.dim(`  Models:  ${status.models.length} loaded`));
  } catch {
    if (opts?.json) {
      console.log(JSON.stringify({ running: false, host, port }, null, 2));
      return;
    }
    console.log(chalk.red('●') + ` Opta LMX is not reachable at ${host}:${port}`);
    console.log(chalk.dim(`  Start it: opta serve start`));
  }
}

async function serveStart(opts?: ServeOptions): Promise<void> {
  const config = await loadConfig();
  const { host, port } = config.connection;
  const client = new LmxClient({ host, port, adminKey: config.connection.adminKey });
  const spinner = await createSpinner();

  // Check if already running
  try {
    await client.health();
    console.log(chalk.yellow('!') + ` Opta LMX is already running at ${host}:${port}`);
    return;
  } catch {
    // Not running — proceed with start
  }

  const isRemote = host !== '127.0.0.1' && host !== 'localhost';

  spinner.start(`Starting Opta LMX on ${isRemote ? host : 'localhost'}...`);

  try {
    if (isRemote) {
      // Remote start via SSH with configured identity and user
      const { ssh } = config.connection;
      const identityFile = ssh.identityFile.replace('~', process.env.HOME ?? '');
      const sshTarget = `${ssh.user}@${host}`;
      const sshCmd = [
        `cd ${ssh.lmxPath} &&`,
        `nohup ${ssh.pythonPath} -m opta_lmx --host 0.0.0.0 --port ${port} > /tmp/opta-lmx.log 2>&1 &`,
      ].join(' ');
      execFileSync('ssh', ['-i', identityFile, sshTarget, sshCmd], { timeout: 15_000 });
    } else {
      // Local start — detached process
      const child = spawn(
        'python', ['-m', 'opta_lmx', '--host', '0.0.0.0', '--port', String(port)],
        { detached: true, stdio: 'ignore' },
      );
      child.unref();
    }

    // Poll for health (up to 30 seconds)
    const maxWait = 30_000;
    const interval = 1_000;
    const deadline = Date.now() + maxWait;

    while (Date.now() < deadline) {
      await sleep(interval);
      try {
        await client.health();
        spinner.succeed(`Opta LMX started at ${host}:${port}`);

        if (opts?.json) {
          console.log(JSON.stringify({ started: true, host, port }, null, 2));
        }
        return;
      } catch {
        // Not ready yet
      }
    }

    spinner.fail('Opta LMX did not start within 30 seconds');
    console.log(chalk.dim(`  Check logs: opta serve logs`));
    process.exit(EXIT.ERROR);
  } catch (err) {
    spinner.fail('Failed to start Opta LMX');
    throw new OptaError(
      `Failed to start Opta LMX on ${host}`,
      EXIT.ERROR,
      [err instanceof Error ? err.message : String(err)],
      [
        isRemote ? `Check SSH access: ssh ${host}` : 'Check Python environment',
        `Verify install: pip show opta-lmx`,
        `Check logs: opta serve logs`,
      ],
    );
  }
}

async function serveStop(_opts?: ServeOptions): Promise<void> {
  const config = await loadConfig();
  const { host } = config.connection;
  const isRemote = host !== '127.0.0.1' && host !== 'localhost';
  const spinner = await createSpinner();

  spinner.start(`Stopping Opta LMX on ${isRemote ? host : 'localhost'}...`);

  try {
    if (isRemote) {
      try {
        const { ssh } = config.connection;
        const identityFile = ssh.identityFile.replace('~', process.env.HOME ?? '');
        const sshTarget = `${ssh.user}@${host}`;
        execFileSync('ssh', ['-i', identityFile, sshTarget, 'pkill -f "python -m opta_lmx"'], { timeout: 10_000 });
      } catch {
        // pkill returns non-zero when no process found — that's fine
      }
    } else {
      try {
        execFileSync('pkill', ['-f', 'python -m opta_lmx'], { timeout: 5_000 });
      } catch {
        // No process to kill
      }
    }

    spinner.succeed('Opta LMX stopped');

    if (opts?.json) {
      console.log(JSON.stringify({ stopped: true, host }, null, 2));
    }
  } catch (err) {
    spinner.fail('Failed to stop Opta LMX');
    throw new OptaError(
      `Failed to stop Opta LMX on ${host}`,
      EXIT.ERROR,
      [err instanceof Error ? err.message : String(err)],
      [
        isRemote ? `SSH manually: ssh ${host}` : 'Check running processes',
      ],
    );
  }
}

async function serveLogs(): Promise<void> {
  const config = await loadConfig();
  const { host } = config.connection;
  const isRemote = host !== '127.0.0.1' && host !== 'localhost';

  try {
    let output: string;
    if (isRemote) {
      const { ssh } = config.connection;
      const identityFile = ssh.identityFile.replace('~', process.env.HOME ?? '');
      const sshTarget = `${ssh.user}@${host}`;
      output = execFileSync('ssh', ['-i', identityFile, sshTarget, 'tail -50 /tmp/opta-lmx.log'], {
        timeout: 10_000,
        encoding: 'utf8',
      });
    } else {
      output = execFileSync('tail', ['-50', '/tmp/opta-lmx.log'], {
        timeout: 5_000,
        encoding: 'utf8',
      });
    }
    console.log(output);
  } catch (err) {
    throw new OptaError(
      'Failed to read Opta LMX logs',
      EXIT.ERROR,
      [err instanceof Error ? err.message : String(err)],
      [isRemote ? `SSH manually: ssh ${host}` : 'Check /tmp/opta-lmx.log'],
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}
