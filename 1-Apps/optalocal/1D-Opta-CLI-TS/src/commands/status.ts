import chalk from 'chalk';
import { loadConfig } from '../core/config.js';
import { formatError, OptaError, ExitError, EXIT } from '../core/errors.js';
import { createSpinner } from '../ui/spinner.js';
import { LmxApiError, LmxClient, lookupContextLimit } from '../lmx/client.js';
import { errorMessage, NO_MODELS_LOADED } from '../utils/errors.js';

interface StatusOptions {
  json?: boolean;
}

const FAST_STATUS_REQUEST_OPTS = { timeoutMs: 5_000, maxRetries: 0 } as const;

export async function status(opts: StatusOptions): Promise<void> {
  const config = await loadConfig();
  const { host, port } = config.connection;
  const adminKey = config.connection.adminKey;

  const client = new LmxClient({
    host,
    fallbackHosts: config.connection.fallbackHosts,
    port,
    adminKey,
  });
  const spinner = opts.json ? null : await createSpinner();

  spinner?.start(`Checking Opta LMX at ${host}:${port}...`);

  try {
    const health = await client.health(FAST_STATUS_REQUEST_OPTS);
    const lmxStatus = await client.status(FAST_STATUS_REQUEST_OPTS);
    const activeHost = client.getActiveHost();

    spinner?.succeed(`Opta LMX is ${health.status} at ${activeHost}:${port}`);

    if (opts.json) {
      console.log(JSON.stringify({
        health,
        status: lmxStatus,
        endpoint: {
          requestedHost: host,
          activeHost,
          fallbackUsed: activeHost.toLowerCase() !== host.toLowerCase(),
        },
      }, null, 2));
      return;
    }

    if (activeHost.toLowerCase() !== host.toLowerCase()) {
      console.log(
        chalk.yellow('!') +
        ` Primary host ${host}:${port} unreachable; using fallback ${activeHost}:${port}`,
      );
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
      console.log('\n' + chalk.dim(NO_MODELS_LOADED));
    }

    console.log(
      '\n' + chalk.dim('Run ') + chalk.cyan('opta chat') + chalk.dim(' to start coding.')
    );
  } catch (err) {
    spinner?.stop();

    if (err instanceof OptaError) {
      console.error(formatError(err));
      throw new ExitError(err.code);
    }

    const fallbackHosts = config.connection.fallbackHosts.filter((value) => value.trim().length > 0);
    const failureReason = errorMessage(err);
    const isUnauthorized = err instanceof LmxApiError
      && (err.code === 'unauthorized' || err.status === 401 || err.status === 403);

    const causes = isUnauthorized
      ? [
          'Opta LMX denied admin access (admin key mismatch or protected admin endpoints).',
          `Host ${host} is reachable but /admin endpoints are unauthorized.`,
          `Failure detail: ${failureReason}`,
        ]
      : [
          'Opta LMX server is not running',
          `Host ${host} is unreachable`,
          `Port ${port} is blocked or incorrect`,
          `Failure detail: ${failureReason}`,
        ];

    const suggestions = isUnauthorized
      ? [
          'Check admin key: opta config get connection.adminKey',
          'Set/clear key: opta config set connection.adminKey <key>  or  opta config delete connection.adminKey',
          `Verify unauthenticated health: curl http://${host}:${port}/healthz`,
        ]
      : [
          `Check connectivity: ping ${host}`,
          'Start Opta LMX: cd 1-Apps/1M-Opta-LMX && python -m opta_lmx.main',
          `Verify port: curl http://${host}:${port}/healthz`,
          fallbackHosts.length > 0
            ? `Try fallback hosts: ${fallbackHosts.join(', ')}`
            : 'Configure fallback hosts: opta config set connection.fallbackHosts hostA,hostB',
        ];

    throw new OptaError(
      `Cannot reach Opta LMX at ${host}:${port}`,
      EXIT.NO_CONNECTION,
      causes,
      suggestions,
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
