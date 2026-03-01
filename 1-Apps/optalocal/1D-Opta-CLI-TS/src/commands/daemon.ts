import chalk from 'chalk';
import { readFile } from 'node:fs/promises';
import { daemonLogsPath } from '../daemon/telemetry.js';
import { daemonStatus, ensureDaemonRunning, stopDaemon } from '../daemon/lifecycle.js';
import { runDaemon } from '../daemon/main.js';
import {
  installDaemonService,
  uninstallDaemonService,
} from '../daemon/installer.js';

interface DaemonCmdOptions {
  host?: string;
  port?: string;
  json?: boolean;
  token?: string;
  model?: string;
}

export async function daemonStart(opts: DaemonCmdOptions): Promise<void> {
  const host = opts.host;
  const port = opts.port ? Number.parseInt(opts.port, 10) : undefined;
  const state = await ensureDaemonRunning({ host, port });
  if (opts.json) {
    console.log(JSON.stringify(state, null, 2));
    return;
  }
  console.log(chalk.green('✓') + ` daemon running at http://${state.host}:${state.port}`);
  console.log(chalk.dim(`  pid: ${state.pid}`));
  console.log(chalk.dim(`  logs: ${state.logsPath}`));
}

export async function daemonRun(opts: DaemonCmdOptions): Promise<void> {
  const host = opts.host;
  const port = opts.port ? Number.parseInt(opts.port, 10) : undefined;
  await runDaemon({
    host,
    port,
    token: opts.token,
    model: opts.model,
  });
}

export async function daemonStop(_opts: DaemonCmdOptions): Promise<void> {
  const stopped = await stopDaemon();
  if (stopped) {
    console.log(chalk.green('✓') + ' daemon stopped');
  } else {
    console.log(chalk.dim('daemon is not running'));
  }
}

export async function daemonStatusCommand(opts: DaemonCmdOptions): Promise<void> {
  const status = await daemonStatus();
  if (opts.json) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }
  if (!status.running || !status.state) {
    console.log(chalk.yellow('•') + ' daemon is not running');
    return;
  }
  console.log(chalk.green('✓') + ` daemon running at http://${status.state.host}:${status.state.port}`);
  console.log(chalk.dim(`  pid: ${status.state.pid}`));
  console.log(chalk.dim(`  started: ${status.state.startedAt}`));
  console.log(chalk.dim(`  logs: ${status.logsPath}`));
}

export async function daemonLogs(opts: DaemonCmdOptions): Promise<void> {
  const path = daemonLogsPath();
  try {
    const raw = await readFile(path, 'utf-8');
    const lines = raw.trim().split('\n').filter(Boolean);
    const tail = lines.slice(-200);
    if (opts.json) {
      const parsed = tail.map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return { raw: line };
        }
      });
      console.log(JSON.stringify(parsed, null, 2));
      return;
    }
    console.log(tail.join('\n'));
  } catch {
    if (opts.json) {
      console.log(JSON.stringify({ logs: [] }));
      return;
    }
    console.log(chalk.dim('No daemon logs yet.'));
  }
}

export async function daemonInstall(_opts: DaemonCmdOptions): Promise<void> {
  await installDaemonService();
  console.log(chalk.green('✓') + ' daemon service installed and registered');
}

export async function daemonUninstall(_opts: DaemonCmdOptions): Promise<void> {
  await uninstallDaemonService();
  console.log(chalk.green('✓') + ' daemon service uninstalled');
}
