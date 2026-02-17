import chalk from 'chalk';
import { loadConfig, saveConfig } from '../core/config.js';
import { formatError, OptaError, EXIT } from '../core/errors.js';
import { createSpinner } from '../ui/spinner.js';
import { LmxClient, lookupContextLimit } from '../lmx/client.js';
import type {
  LmxModelDetail,
  LmxAvailableModel,
  LmxPreset,
  LmxStackRole,
  LmxMemoryResponse,
} from '../lmx/client.js';
import type { ProviderModelInfo } from '../providers/base.js';

interface ModelsOptions {
  json?: boolean;
}

export async function models(
  action?: string,
  name?: string,
  opts?: ModelsOptions
): Promise<void> {
  const config = await loadConfig();
  const { host, port } = config.connection;
  const client = new LmxClient({ host, port, adminKey: config.connection.adminKey });

  switch (action) {
    case 'use':
      await useModel(name, client, config);
      return;
    case 'info':
      await infoModel(name, client, opts);
      return;
    case 'load':
      await loadModel(name, client);
      return;
    case 'unload':
      await unloadModel(name, client);
      return;
    case 'scan':
      await scanModels(client, config, opts);
      return;
    default:
      await listModels(client, config.model.default, opts);
  }
}

async function listModels(
  client: LmxClient,
  defaultModel: string,
  opts?: ModelsOptions
): Promise<void> {
  const spinner = await createSpinner();
  spinner.start('Fetching models...');

  try {
    const result = await client.models();
    spinner.stop();

    if (opts?.json) {
      const output = result.models.map((m) => ({
        id: m.model_id,
        status: m.status,
        contextLength: m.context_length ?? lookupContextLimit(m.model_id),
        memoryBytes: m.memory_bytes,
        isDefault: m.model_id === defaultModel || m.is_default,
      }));
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    console.log(chalk.bold('Models\n'));

    for (const model of result.models) {
      const ctx = model.context_length ?? lookupContextLimit(model.model_id);
      const ctxStr = chalk.dim(` ${(ctx / 1000).toFixed(0)}K context`);
      const def = (model.model_id === defaultModel || model.is_default)
        ? chalk.green(' ★')
        : '';
      const mem = model.memory_bytes
        ? chalk.dim(` ${(model.memory_bytes / 1e9).toFixed(1)}GB`)
        : '';
      console.log(`  ${model.model_id}${ctxStr}${mem}${def}`);
    }

    if (result.models.length === 0) {
      console.log(chalk.dim('  No models loaded'));
    }

    console.log(
      '\n' + chalk.dim(`Use ${chalk.reset('opta models use <name>')} to switch default`)
    );
    console.log(
      chalk.dim(`Use ${chalk.reset('opta models load <name>')} to load a model`)
    );
  } catch (err) {
    spinner.stop();
    if (err instanceof OptaError) {
      console.error(formatError(err));
      process.exit(err.code);
    }
    throw err;
  }
}

async function useModel(
  name: string | undefined,
  client: LmxClient,
  _config: Awaited<ReturnType<typeof loadConfig>>
): Promise<void> {
  if (!name) {
    console.error(
      chalk.red('✗') + ' Missing model name\n\n' +
      chalk.dim('Usage: opta models use <name>')
    );
    process.exit(EXIT.MISUSE);
  }

  const spinner = await createSpinner();
  spinner.start(`Checking model ${name}...`);

  try {
    const result = await client.models();
    const found = result.models.find((m) => m.model_id === name);

    if (!found) {
      spinner.fail(`Model "${name}" not found`);
      console.log('\nLoaded models:');
      for (const m of result.models) {
        console.log(`  ${m.model_id}`);
      }
      process.exit(EXIT.NOT_FOUND);
    }

    const contextLimit = found.context_length ?? lookupContextLimit(name);

    await saveConfig({
      model: { default: name, contextLimit },
    });

    spinner.succeed(`Default model set to ${name}`);
  } catch (err) {
    spinner.stop();
    if (err instanceof OptaError) {
      console.error(formatError(err));
      process.exit(err.code);
    }
    throw err;
  }
}

async function infoModel(
  name: string | undefined,
  client: LmxClient,
  opts?: ModelsOptions
): Promise<void> {
  if (!name) {
    console.error(
      chalk.red('✗') + ' Missing model name\n\n' +
      chalk.dim('Usage: opta models info <name>')
    );
    process.exit(EXIT.MISUSE);
  }

  const spinner = await createSpinner();
  spinner.start(`Fetching info for ${name}...`);

  try {
    const result = await client.models();
    spinner.stop();

    const model = result.models.find((m) => m.model_id === name);
    if (!model) {
      console.error(chalk.red('✗') + ` Model "${name}" not found`);
      process.exit(EXIT.NOT_FOUND);
    }

    if (opts?.json) {
      console.log(JSON.stringify(model, null, 2));
      return;
    }

    const ctx = model.context_length ?? lookupContextLimit(model.model_id);

    console.log(chalk.bold(model.model_id));
    console.log(`  Status:  ${model.status === 'loaded' ? chalk.green('loaded') : chalk.yellow(model.status)}`);
    console.log(`  Context: ${ctx.toLocaleString()} tokens`);
    if (model.memory_bytes) {
      console.log(`  Memory:  ${(model.memory_bytes / 1e9).toFixed(1)} GB`);
    }
    if (model.request_count != null) {
      console.log(`  Requests: ${model.request_count}`);
    }
    if (model.loaded_at) {
      console.log(`  Loaded:  ${model.loaded_at}`);
    }
    if (model.is_default) {
      console.log(`  Default: ${chalk.green('yes')}`);
    }
  } catch (err) {
    spinner.stop();
    if (err instanceof OptaError) {
      console.error(formatError(err));
      process.exit(err.code);
    }
    throw err;
  }
}

async function loadModel(
  name: string | undefined,
  client: LmxClient
): Promise<void> {
  if (!name) {
    console.error(
      chalk.red('✗') + ' Missing model name\n\n' +
      chalk.dim('Usage: opta models load <name>')
    );
    process.exit(EXIT.MISUSE);
  }

  const spinner = await createSpinner();
  spinner.start(`Loading ${name}...`);

  try {
    const result = await client.loadModel(name);
    spinner.succeed(`Loaded ${result.model_id}`);

    if (result.memory_bytes) {
      console.log(chalk.dim(`  Memory: ${(result.memory_bytes / 1e9).toFixed(1)} GB`));
    }
    if (result.load_time_seconds) {
      console.log(chalk.dim(`  Load time: ${result.load_time_seconds.toFixed(1)}s`));
    }
  } catch (err) {
    spinner.stop();
    if (err instanceof OptaError) {
      console.error(formatError(err));
      process.exit(err.code);
    }
    throw err;
  }
}

async function unloadModel(
  name: string | undefined,
  client: LmxClient
): Promise<void> {
  if (!name) {
    console.error(
      chalk.red('✗') + ' Missing model name\n\n' +
      chalk.dim('Usage: opta models unload <name>')
    );
    process.exit(EXIT.MISUSE);
  }

  const spinner = await createSpinner();
  spinner.start(`Unloading ${name}...`);

  try {
    const result = await client.unloadModel(name);
    spinner.succeed(`Unloaded ${result.model_id}`);

    if (result.freed_bytes) {
      console.log(chalk.dim(`  Freed: ${(result.freed_bytes / 1e9).toFixed(1)} GB`));
    }
  } catch (err) {
    spinner.stop();
    if (err instanceof OptaError) {
      console.error(formatError(err));
      process.exit(err.code);
    }
    throw err;
  }
}

// --- Helpers ---

function shortId(id: string): string {
  return id
    .replace(/^lmstudio-community\//, '')
    .replace(/^mlx-community\//, '')
    .replace(/^huggingface\//, '');
}

function fmtGB(bytes: number): string {
  return `${(bytes / 1e9).toFixed(1)}GB`;
}

function fmtCtx(tokens: number): string {
  return `${(tokens / 1000).toFixed(0)}K ctx`;
}

// --- Scan: unified multi-source model discovery ---

interface ScanResult {
  loaded: LmxModelDetail[];
  available: LmxAvailableModel[];
  presets: LmxPreset[];
  roles: Record<string, LmxStackRole>;
  memory: LmxMemoryResponse | null;
  cloud: ProviderModelInfo[];
  cloudHealthy: boolean;
  lmxReachable: boolean;
}

async function gatherScanData(
  client: LmxClient,
  config: Awaited<ReturnType<typeof loadConfig>>
): Promise<ScanResult> {
  const result: ScanResult = {
    loaded: [],
    available: [],
    presets: [],
    roles: {},
    memory: null,
    cloud: [],
    cloudHealthy: false,
    lmxReachable: false,
  };

  // Query LMX endpoints in parallel (all may fail if LMX is down)
  const lmxPromises = Promise.all([
    client.models().catch(() => null),
    client.available().catch(() => null),
    client.presets().catch(() => null),
    client.stack().catch(() => null),
    client.memory().catch(() => null),
  ]);

  // Query Anthropic provider in parallel with LMX
  const anthropicPromise = (async () => {
    if (config.provider?.active === 'anthropic' || config.provider?.anthropic?.apiKey || process.env['ANTHROPIC_API_KEY']) {
      try {
        const { getProvider } = await import('../providers/manager.js');
        // Create a temporary config with anthropic active to get the provider
        const anthropicConfig = { ...config, provider: { ...config.provider, active: 'anthropic' as const } };
        const provider = await getProvider(anthropicConfig);
        const models = await provider.listModels();
        const health = await provider.health();
        return { models, healthy: health.ok };
      } catch {
        return { models: [], healthy: false };
      }
    }
    return { models: [], healthy: false };
  })();

  const [lmxResults, anthropicResult] = await Promise.all([lmxPromises, anthropicPromise]);
  const [modelsRes, availRes, presetsRes, stackRes, memRes] = lmxResults;

  if (modelsRes) {
    result.loaded = modelsRes.models;
    result.lmxReachable = true;
  }
  if (availRes) {
    result.available = availRes;
    result.lmxReachable = true;
  }
  if (presetsRes) {
    result.presets = presetsRes.presets;
  }
  if (stackRes) {
    result.roles = stackRes.roles;
  }
  if (memRes) {
    result.memory = memRes;
  }

  result.cloud = anthropicResult.models;
  result.cloudHealthy = anthropicResult.healthy;

  return result;
}

async function scanModels(
  client: LmxClient,
  config: Awaited<ReturnType<typeof loadConfig>>,
  opts?: ModelsOptions
): Promise<void> {
  const spinner = await createSpinner();
  const { host, port } = config.connection;
  spinner.start(`Scanning LMX (${host}:${port}) + providers...`);

  try {
    const scan = await gatherScanData(client, config);
    spinner.stop();

    // --- JSON output ---
    if (opts?.json) {
      console.log(JSON.stringify(scan, null, 2));
      return;
    }

    // --- Build role lookup (model_id -> role names) ---
    const roleMap = new Map<string, string[]>();
    for (const [role, info] of Object.entries(scan.roles)) {
      if (info.resolved_model) {
        const existing = roleMap.get(info.resolved_model) ?? [];
        existing.push(role);
        roleMap.set(info.resolved_model, existing);
      }
    }

    // --- Build loaded set for dedup with available ---
    const loadedIds = new Set(scan.loaded.map((m) => m.model_id));
    const defaultModel = config.model.default;

    // --- Print: Loaded ---
    if (!scan.lmxReachable) {
      console.log(chalk.yellow('\n  LMX unreachable') + chalk.dim(` (${host}:${port})\n`));
    } else {
      console.log(
        chalk.bold('\n  Loaded') +
          chalk.dim(` \u2500\u2500 LMX ${host}:${port} \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`)
      );
      if (scan.loaded.length === 0) {
        console.log(chalk.dim('  (no models loaded)'));
      }
      for (const m of scan.loaded) {
        const ctx = m.context_length ?? lookupContextLimit(m.model_id);
        const parts: string[] = [fmtCtx(ctx)];
        if (m.memory_bytes) parts.push(fmtGB(m.memory_bytes));
        if (m.request_count != null && m.request_count > 0) parts.push(`${m.request_count} reqs`);
        const roles = roleMap.get(m.model_id);
        if (roles) parts.push(roles.map((r) => `role:${r}`).join(' '));
        const isDefault = m.model_id === defaultModel || m.is_default;
        const star = isDefault ? chalk.green(' \u2605') : '';
        console.log(
          `  ${chalk.green('\u25cf')} ${m.model_id}  ${chalk.dim(parts.join(' \u00b7 '))}${star}`
        );
      }

      // --- Print: Available on disk ---
      const unloaded = scan.available.filter((a) => !loadedIds.has(a.repo_id));
      if (unloaded.length > 0) {
        console.log(
          chalk.bold('\n  On Disk') +
            chalk.dim(' \u2500\u2500 downloaded, not loaded \u2500\u2500\u2500\u2500\u2500\u2500\u2500')
        );
        for (const a of unloaded) {
          const ctx = lookupContextLimit(a.repo_id);
          const parts: string[] = [fmtCtx(ctx)];
          if (a.size_bytes > 0) parts.push(`${fmtGB(a.size_bytes)} on disk`);
          console.log(`  ${chalk.dim('\u25cb')} ${a.repo_id}  ${chalk.dim(parts.join(' \u00b7 '))}`);
        }
      }
    }

    // --- Print: Presets ---
    if (scan.presets.length > 0) {
      console.log(
        chalk.bold('\n  Presets') +
          chalk.dim(' \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500')
      );
      for (const p of scan.presets) {
        const modelStr = shortId(p.model);
        const isLoaded = loadedIds.has(p.model);
        const dot = isLoaded ? chalk.green('\u25cf') : chalk.dim('\u25cb');
        const aliasStr = p.routing_alias ? chalk.cyan(`alias:"${p.routing_alias}"`) : '';
        const autoStr = p.auto_load ? chalk.dim('auto-load') : '';
        const parts = [
          `\u2192 ${modelStr}`,
          aliasStr,
          autoStr,
        ].filter(Boolean);
        console.log(
          `  ${chalk.magenta('\u2666')} ${chalk.bold(p.name.padEnd(20))} ${chalk.dim(parts.join('  '))}`
        );
      }
    }

    // --- Print: Cloud providers ---
    if (scan.cloud.length > 0) {
      const statusStr = scan.cloudHealthy
        ? chalk.green('api key \u2713')
        : chalk.yellow('not configured');
      console.log(
        chalk.bold('\n  Cloud') +
          chalk.dim(` \u2500\u2500 Anthropic \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 `) +
          statusStr
      );
      for (const m of scan.cloud) {
        const ctx = m.contextLength ? fmtCtx(m.contextLength) : '';
        const name = m.name ?? m.id;
        console.log(`  ${chalk.blue('\u2601')} ${m.id}  ${chalk.dim(name !== m.id ? `${name}  ` : '')}${chalk.dim(ctx)}`);
      }
    }

    // --- Print: Memory summary ---
    if (scan.memory) {
      const pct = Math.round((scan.memory.used_gb / scan.memory.total_unified_memory_gb) * 100);
      const pctColor = pct > 80 ? chalk.red : pct > 60 ? chalk.yellow : chalk.green;
      console.log(
        chalk.bold('\n  Memory') +
          chalk.dim(' \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500')
      );
      console.log(
        `  ${scan.memory.used_gb.toFixed(1)} / ${scan.memory.total_unified_memory_gb.toFixed(1)} GB used ` +
          pctColor(`(${pct}%)`) +
          chalk.dim(` \u00b7 threshold ${scan.memory.threshold_percent}%`)
      );
    }

    // --- Print: Summary footer ---
    const counts: string[] = [];
    if (scan.loaded.length > 0) counts.push(`${scan.loaded.length} loaded`);
    const unloadedCount = scan.available.filter((a) => !loadedIds.has(a.repo_id)).length;
    if (unloadedCount > 0) counts.push(`${unloadedCount} on disk`);
    if (scan.presets.length > 0) counts.push(`${scan.presets.length} presets`);
    if (scan.cloud.length > 0) counts.push(`${scan.cloud.length} cloud`);

    console.log(`\n  ${chalk.dim(counts.join(' \u00b7 '))}`);
    console.log(chalk.dim(`  'opta models load <name>'  load from disk`));
    console.log(chalk.dim(`  'opta models use <name>'   switch default\n`));
  } catch (err) {
    spinner.stop();
    if (err instanceof OptaError) {
      console.error(formatError(err));
      process.exit(err.code);
    }
    throw err;
  }
}
