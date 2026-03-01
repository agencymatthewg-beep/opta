import chalk from 'chalk';
import { loadConfig } from '../core/config.js';
import { formatError, OptaError, ExitError, EXIT } from '../core/errors.js';
import { createSpinner } from '../ui/spinner.js';
import { LmxApiError, LmxClient, lookupContextLimit } from '../lmx/client.js';
import { errorMessage, NO_MODELS_LOADED } from '../utils/errors.js';

interface StatusOptions {
  json?: boolean;
  full?: boolean;
}

const FAST_STATUS_REQUEST_OPTS = { timeoutMs: 5_000, maxRetries: 0 } as const;
const FULL_STATUS_REQUEST_OPTS = { timeoutMs: 15_000, maxRetries: 1 } as const;

export async function status(opts: StatusOptions): Promise<void> {
  const config = await loadConfig();
  const { host, port } = config.connection;
  const adminKey = config.connection.adminKey;
  const reqOpts = opts.full ? FULL_STATUS_REQUEST_OPTS : FAST_STATUS_REQUEST_OPTS;

  const client = new LmxClient({
    host,
    fallbackHosts: config.connection.fallbackHosts,
    port,
    adminKey,
  });
  const spinner = opts.json ? null : await createSpinner();

  spinner?.start(
    opts.full ? `Running full diagnostic on Opta LMX at ${host}:${port}...` : `Checking Opta LMX at ${host}:${port}...`
  );

  try {
    const health = await client.health(reqOpts);
    const lmxStatus = await client.status(reqOpts);
    const activeHost = client.getActiveHost();
    const deviceIdentity = await client.device(reqOpts).catch(() => null);
    const available = opts.full ? await client.available(reqOpts).catch(() => null) : null;
    const memory = opts.full ? await client.memory(reqOpts).catch(() => null) : null;

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
        deviceIdentity,
        availableModelsCount: available?.length,
        memoryDetails: memory,
      }, null, 2));
      return;
    }

    if (activeHost.toLowerCase() !== host.toLowerCase()) {
      console.log(
        chalk.yellow('!') +
        ` Primary host ${host}:${port} unreachable; using fallback ${activeHost}:${port}`,
      );
    }

    // Device identity
    if (deviceIdentity?.hardware?.chip_name) {
      const hw = deviceIdentity.hardware;
      const chipShort = hw.chip_name?.replace(/^Apple /, '') ?? '';
      const memStr = hw.memory_gb ? ` · ${hw.memory_gb}GB` : '';
      const nameStr = deviceIdentity.identity.name ? ` (${deviceIdentity.identity.name})` : '';
      console.log(chalk.dim('  Device:  ') + chalk.bold(`${chipShort}${memStr}${nameStr}`));
      if (hw.chip_name) {
        const archStr = hw.architecture ? ` (${hw.architecture})` : '';
        console.log(chalk.dim('  Chip:    ') + chalk.bold(`${hw.chip_name}${archStr}`));
      }
      if (hw.cpu_cores) {
        console.log(chalk.dim('  Cores:   ') + chalk.bold(`${hw.cpu_cores} CPU`));
      }
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
    
    if (opts.full && memory) {
      const umUsed = (memory.used_gb).toFixed(1);
      const umTotal = (memory.total_unified_memory_gb).toFixed(1);
      const umPct = Math.round((memory.used_gb / memory.total_unified_memory_gb) * 100);
      console.log(chalk.dim(`  VRAM:    ${umUsed}/${umTotal} GB (${umPct}%) [Threshold: ${memory.threshold_percent}%]`));
    }
    
    if (opts.full && available != null) {
      console.log(chalk.dim(`  On Disk: ${available.length} models downloaded`));
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
      '\n' + chalk.dim('Run ') + chalk.cyan('opta') + chalk.dim(' to start coding.')
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
          'Start Opta LMX: cd 1-Apps/optalocal/1M-Opta-LMX && python -m opta_lmx.main',
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
