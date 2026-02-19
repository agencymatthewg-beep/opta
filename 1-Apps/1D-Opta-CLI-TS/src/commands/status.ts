import chalk from 'chalk';
import { loadConfig } from '../core/config.js';
import { formatError, OptaError, ExitError, EXIT } from '../core/errors.js';
import { createSpinner } from '../ui/spinner.js';
import { LmxClient, lookupContextLimit } from '../lmx/client.js';

interface StatusOptions {
  json?: boolean;
}

export async function status(opts: StatusOptions): Promise<void> {
  const config = await loadConfig();
  const { host, port } = config.connection;
  const adminKey = config.connection.adminKey;

  const client = new LmxClient({ host, port, adminKey });
  const spinner = await createSpinner();

  spinner.start(`Checking Opta LMX at ${host}:${port}...`);

  try {
    const health = await client.health();
    const lmxStatus = await client.status();

    spinner.succeed(`Opta LMX is ${health.status} at ${host}:${port}`);

    if (opts.json) {
      console.log(JSON.stringify({ health, status: lmxStatus }, null, 2));
      return;
    }

    // Version & uptime
    if (lmxStatus.version) {
      console.log(chalk.dim(`  Version: ${lmxStatus.version}`));
    }
    if (lmxStatus.uptime_seconds != null) {
      console.log(chalk.dim(`  Uptime:  ${formatUptime(lmxStatus.uptime_seconds)}`));
    }

    // Memory
    if (lmxStatus.memory) {
      const usedGB = (lmxStatus.memory.used_bytes / 1e9).toFixed(1);
      const totalGB = (lmxStatus.memory.total_bytes / 1e9).toFixed(1);
      const pct = ((lmxStatus.memory.used_bytes / lmxStatus.memory.total_bytes) * 100).toFixed(0);
      console.log(chalk.dim(`  Memory:  ${usedGB}/${totalGB} GB (${pct}%)`));
    }

    // Loaded models
    if (lmxStatus.models.length > 0) {
      console.log('\n' + chalk.bold('Loaded models:'));
      for (const model of lmxStatus.models) {
        const ctx = model.context_length ?? lookupContextLimit(model.model_id);
        const ctxStr = chalk.dim(` (${(ctx / 1000).toFixed(0)}K context)`);
        const def = model.is_default ? chalk.green(' ★') : '';
        const mem = model.memory_bytes
          ? chalk.dim(` ${(model.memory_bytes / 1e9).toFixed(1)}GB`)
          : '';
        console.log(`  ${model.model_id}${ctxStr}${mem}${def}`);
      }
    } else {
      console.log('\n' + chalk.dim('No models loaded'));
    }

    console.log(
      '\n' + chalk.dim('Run ') + chalk.cyan('opta chat') + chalk.dim(' to start coding.')
    );
  } catch (err) {
    spinner.stop();

    if (err instanceof OptaError) {
      console.error(formatError(err));
      throw new ExitError(err.code);
    }

    throw new OptaError(
      `Cannot reach Opta LMX at ${host}:${port}`,
      EXIT.NO_CONNECTION,
      [
        'Opta LMX server is not running',
        `Host ${host} is unreachable`,
        `Port ${port} is blocked or incorrect`,
      ],
      [
        `Check connectivity: ping ${host}`,
        'Start Opta LMX: cd 1-Apps/1J-Opta-LMX && python -m opta_lmx',
        `Verify port: curl http://${host}:${port}/admin/health`,
      ]
    );
  }
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}
