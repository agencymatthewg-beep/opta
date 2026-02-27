/**
 * LMX model and server lifecycle handlers: scan, load, unload, serve, lmx command router, reconnect.
 */

import chalk from 'chalk';
import { box, kv, progressBar } from '../../../ui/box.js';
import { errorMessage } from '../../../utils/errors.js';
import { getDisplayProfile } from '../../../core/model-display.js';
import type { SlashContext, SlashResult } from '../types.js';
import {
  STABLE_MODEL_LOAD_TIMEOUT_MS,
  FAST_SLASH_REQUEST_OPTS,
  fmtTag,
  parseSlashArgs,
  parseBooleanLiteral,
} from './types.js';
import { lmxStatusHandler } from './status.js';

export const scanHandler = async (_args: string, ctx: SlashContext): Promise<SlashResult> => {
  const { lookupContextLimit } = await import('../../../lmx/client.js');
  const {
    scanModels,
    buildRoleMap,
    shortId,
    fmtGB,
    fmtCtx,
    summarizeScan,
  } = await import('../../../providers/model-scan.js');
  // (shortId kept for presets display)

  console.log(chalk.dim(`  Scanning ${ctx.config.connection.host}:${ctx.config.connection.port}...`));

  const scan = await scanModels(ctx.config);

  if (!scan.lmxReachable && scan.cloud.length === 0) {
    console.log(chalk.yellow('  LMX unreachable, no cloud providers configured'));
    return 'handled';
  }

  const roleMap = buildRoleMap(scan.roles);
  const loadedIds = new Set(scan.loaded.map(m => m.model_id));

  const lines: string[] = [];

  // Loaded
  if (scan.lmxReachable) {
    lines.push(chalk.bold('Loaded') + chalk.dim(` \u2500 ${ctx.config.connection.host}:${ctx.config.connection.port}`));
    if (scan.loaded.length === 0) {
      lines.push(chalk.dim('  (no models loaded)'));
    }
    for (const m of scan.loaded) {
      const parts: string[] = [fmtCtx(m.context_length ?? lookupContextLimit(m.model_id))];
      if (m.memory_bytes) parts.push(fmtGB(m.memory_bytes));
      if (m.request_count) parts.push(`${m.request_count} reqs`);
      const roles = roleMap.get(m.model_id);
      if (roles) parts.push(roles.map(r => `role:${r}`).join(' '));
      const isCurrent = m.model_id === ctx.config.model.default;
      const star = isCurrent ? chalk.green(' \u2605') : '';
      const dp = getDisplayProfile(m.model_id);
      lines.push(`  ${chalk.green('\u25cf')} ${chalk.bold(dp.displayName)} ${fmtTag(dp.format)} ${chalk.dim(dp.orgAbbrev)}  ${chalk.dim(parts.join(' \u00b7 '))}${star}`);
    }
  }

  // On disk
  const onDisk = scan.available.filter(a => !loadedIds.has(a.repo_id));
  if (onDisk.length > 0) {
    lines.push('');
    lines.push(chalk.bold('On Disk') + chalk.dim(' \u2500 not loaded'));
    for (const a of onDisk) {
      const size = a.size_bytes > 0 ? fmtGB(a.size_bytes) : '';
      const dp = getDisplayProfile(a.repo_id);
      lines.push(`  ${chalk.dim('\u25cb')} ${dp.displayName} ${fmtTag(dp.format)} ${chalk.dim(dp.orgAbbrev)}  ${chalk.dim([fmtCtx(lookupContextLimit(a.repo_id)), size].filter(Boolean).join(' \u00b7 '))}`);
    }
  }

  // Presets
  if (scan.presets.length > 0) {
    lines.push('');
    lines.push(chalk.bold('Presets'));
    for (const p of scan.presets) {
      const model = shortId(p.model);
      const alias = p.routing_alias ? chalk.cyan(`alias:"${p.routing_alias}"`) : '';
      const auto = p.auto_load ? chalk.dim('auto-load') : '';
      lines.push(`  ${chalk.magenta('\u2666')} ${chalk.bold(p.name.padEnd(18))} \u2192 ${chalk.dim(model)}  ${alias}  ${auto}`);
    }
  }

  // Cloud
  if (scan.cloud.length > 0) {
    lines.push('');
    lines.push(chalk.bold('Cloud') + chalk.dim(' \u2500 Anthropic'));
    for (const m of scan.cloud) {
      const ctxStr = m.contextLength ? fmtCtx(m.contextLength) : '';
      lines.push(`  ${chalk.blue('\u2601')} ${m.id}  ${chalk.dim([m.name ?? '', ctxStr].filter(Boolean).join(' \u00b7 '))}`);
    }
  }

  // Memory
  if (scan.memory) {
    lines.push('');
    const pct = Math.round((scan.memory.used_gb / scan.memory.total_unified_memory_gb) * 100);
    const pctColor = pct > 80 ? chalk.red : pct > 60 ? chalk.yellow : chalk.green;
    lines.push(`Memory: ${scan.memory.used_gb.toFixed(1)} / ${scan.memory.total_unified_memory_gb.toFixed(1)} GB ${pctColor(`(${pct}%)`)}` +
      chalk.dim(` \u00b7 threshold ${scan.memory.threshold_percent}%`));
  }

  // Footer
  const summary = summarizeScan(scan);
  const counts: string[] = [];
  if (summary.loadedCount > 0) counts.push(`${summary.loadedCount} loaded`);
  if (summary.onDiskCount > 0) counts.push(`${summary.onDiskCount} on disk`);
  if (summary.presetCount > 0) counts.push(`${summary.presetCount} presets`);
  if (summary.cloudCount > 0) counts.push(`${summary.cloudCount} cloud`);
  if (counts.length > 0) {
    lines.push('');
    lines.push(chalk.dim(counts.join(' \u00b7 ')));
  }

  console.log('\n' + box('Model Scan', lines));
  return 'handled';
};

export const loadHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  const tokens = parseSlashArgs(args);
  const modelToken = tokens.find((token) => !token.startsWith('--'));
  if (!modelToken) {
    console.log(chalk.dim('  Usage: /load <model-id> [--backend <name>] [--auto-download] [--keep-alive <sec>] [--allow-unsupported]'));
    console.log(chalk.dim('         [--kv-bits <n>] [--kv-group-size <n>] [--prefix-cache <true|false>] [--memory-estimate-gb <n>] [--perf-json <json>]'));
    console.log(chalk.dim('  Run /scan to see available models'));
    return 'handled';
  }

  const advanced: {
    backend?: 'vllm-mlx' | 'mlx-lm' | 'gguf';
    autoDownload?: boolean;
    keepAliveSec?: number;
    allowUnsupportedRuntime?: boolean;
    performanceOverrides?: Record<string, unknown>;
  } = {};

  const perfOverrides: Record<string, unknown> = {};
  let hasPerfOverride = false;
  let hasAdvancedOption = false;

  const unknown: string[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]!;
    if (!token.startsWith('--')) continue;

    if (token === '--backend') {
      const value = tokens[i + 1];
      if (!value) {
        console.log(chalk.dim('  Missing value for --backend (expected: vllm-mlx|mlx-lm|gguf)'));
        return 'handled';
      }
      i += 1;
      if (value !== 'vllm-mlx' && value !== 'mlx-lm' && value !== 'gguf') {
        console.log(chalk.yellow(`  Invalid backend: ${value}`));
        return 'handled';
      }
      advanced.backend = value;
      hasAdvancedOption = true;
      continue;
    }

    if (token === '--auto-download') {
      advanced.autoDownload = true;
      hasAdvancedOption = true;
      continue;
    }

    if (token === '--allow-unsupported') {
      advanced.allowUnsupportedRuntime = true;
      hasAdvancedOption = true;
      continue;
    }

    if (token === '--keep-alive') {
      const value = tokens[i + 1];
      if (!value) {
        console.log(chalk.dim('  Missing value for --keep-alive'));
        return 'handled';
      }
      i += 1;
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 0) {
        console.log(chalk.yellow(`  Invalid --keep-alive value: ${value}`));
        return 'handled';
      }
      advanced.keepAliveSec = parsed;
      hasAdvancedOption = true;
      continue;
    }

    if (token === '--perf-json') {
      const value = tokens[i + 1];
      if (!value) {
        console.log(chalk.dim('  Missing value for --perf-json'));
        return 'handled';
      }
      i += 1;
      try {
        const parsed = JSON.parse(value) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          console.log(chalk.yellow('  --perf-json must be a JSON object'));
          return 'handled';
        }
        Object.assign(perfOverrides, parsed);
        hasPerfOverride = true;
        hasAdvancedOption = true;
      } catch (err) {
        console.log(chalk.yellow(`  Invalid --perf-json: ${errorMessage(err)}`));
        return 'handled';
      }
      continue;
    }

    if (token === '--kv-bits') {
      const value = tokens[i + 1];
      if (!value) {
        console.log(chalk.dim('  Missing value for --kv-bits'));
        return 'handled';
      }
      i += 1;
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        console.log(chalk.yellow(`  Invalid --kv-bits value: ${value}`));
        return 'handled';
      }
      perfOverrides['kv_bits'] = parsed;
      hasPerfOverride = true;
      hasAdvancedOption = true;
      continue;
    }

    if (token === '--kv-group-size') {
      const value = tokens[i + 1];
      if (!value) {
        console.log(chalk.dim('  Missing value for --kv-group-size'));
        return 'handled';
      }
      i += 1;
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        console.log(chalk.yellow(`  Invalid --kv-group-size value: ${value}`));
        return 'handled';
      }
      perfOverrides['kv_group_size'] = parsed;
      hasPerfOverride = true;
      hasAdvancedOption = true;
      continue;
    }

    if (token === '--memory-estimate-gb') {
      const value = tokens[i + 1];
      if (!value) {
        console.log(chalk.dim('  Missing value for --memory-estimate-gb'));
        return 'handled';
      }
      i += 1;
      const parsed = Number.parseFloat(value);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        console.log(chalk.yellow(`  Invalid --memory-estimate-gb value: ${value}`));
        return 'handled';
      }
      perfOverrides['memory_estimate_gb'] = parsed;
      hasPerfOverride = true;
      hasAdvancedOption = true;
      continue;
    }

    if (token === '--prefix-cache') {
      const value = tokens[i + 1];
      if (!value) {
        console.log(chalk.dim('  Missing value for --prefix-cache (true|false)'));
        return 'handled';
      }
      i += 1;
      const parsed = parseBooleanLiteral(value);
      if (parsed === undefined) {
        console.log(chalk.yellow(`  Invalid --prefix-cache value: ${value}`));
        return 'handled';
      }
      perfOverrides['prefix_cache'] = parsed;
      hasPerfOverride = true;
      hasAdvancedOption = true;
      continue;
    }

    unknown.push(token);
  }

  if (unknown.length > 0) {
    console.log(chalk.yellow(`  Unknown options: ${unknown.join(', ')}`));
    console.log(chalk.dim('  Usage: /load <model-id> [--backend <name>] [--auto-download] [--keep-alive <sec>] [--allow-unsupported]'));
    return 'handled';
  }

  if (hasPerfOverride) {
    advanced.performanceOverrides = perfOverrides;
  }

  const { LmxClient } = await import('../../../lmx/client.js');
  const { ensureModelLoaded, findMatchingModelId } = await import('../../../lmx/model-lifecycle.js');
  const lmx = new LmxClient({
    host: ctx.config.connection.host,
    fallbackHosts: ctx.config.connection.fallbackHosts,
    port: ctx.config.connection.port,
    adminKey: ctx.config.connection.adminKey,
  });

  try {
    const [loadedRes, availableRes] = await Promise.all([
      lmx.models(FAST_SLASH_REQUEST_OPTS).catch(() => ({ models: [] })),
      lmx.available(FAST_SLASH_REQUEST_OPTS).catch(() => []),
    ]);
    const loadedIds = loadedRes.models.map((m) => m.model_id);
    const alreadyLoaded = findMatchingModelId(modelToken, loadedIds);
    if (alreadyLoaded) {
      console.log(chalk.dim(`  ${alreadyLoaded} is already loaded`));
      if (hasAdvancedOption) {
        console.log(chalk.dim('  Unload first if you want to apply new load-time backend/performance options.'));
      }
      return 'handled';
    }

    const resolved = findMatchingModelId(modelToken, availableRes.map((m) => m.repo_id)) ?? modelToken;
    console.log(chalk.dim(`  Loading ${resolved}...`));

    const loadedId = await ensureModelLoaded(lmx, resolved, {
      timeoutMs: STABLE_MODEL_LOAD_TIMEOUT_MS,
      loadOptions: hasAdvancedOption ? advanced : undefined,
    });

    console.log(chalk.green('\u2713') + ` Loaded ${loadedId}`);

    const refreshed = await lmx.models(FAST_SLASH_REQUEST_OPTS).catch(() => ({ models: [] }));
    const details = refreshed.models.find((model) => findMatchingModelId(loadedId, [model.model_id]));
    if (details?.memory_bytes) {
      console.log(chalk.dim(`  Memory: ${(details.memory_bytes / 1e9).toFixed(1)} GB`));
    }
  } catch (err) {
    console.error(chalk.red('\u2717') + ` Failed to load: ${errorMessage(err)}`);
  }
  return 'handled';
};

export const unloadHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  if (!args) {
    console.log(chalk.dim('  Usage: /unload <model-id>'));
    return 'handled';
  }

  const { LmxClient } = await import('../../../lmx/client.js');
  const { findMatchingModelId, waitForModelUnloaded } = await import('../../../lmx/model-lifecycle.js');
  const lmx = new LmxClient({
    host: ctx.config.connection.host,
    fallbackHosts: ctx.config.connection.fallbackHosts,
    port: ctx.config.connection.port,
    adminKey: ctx.config.connection.adminKey,
  });

  try {
    const loadedRes = await lmx.models(FAST_SLASH_REQUEST_OPTS).catch(() => ({ models: [] }));
    const resolved = findMatchingModelId(args, loadedRes.models.map((m) => m.model_id));
    if (!resolved) {
      console.log(chalk.dim(`  ${args} is not currently loaded`));
      return 'handled';
    }

    const result = await lmx.unloadModel(resolved);
    await waitForModelUnloaded(lmx, resolved, { timeoutMs: 30_000 });
    console.log(chalk.green('\u2713') + ` Unloaded ${result.model_id}`);
    if (result.freed_bytes) {
      console.log(chalk.dim(`  Freed: ${(result.freed_bytes / 1e9).toFixed(1)} GB`));
    }
  } catch (err) {
    console.error(chalk.red('\u2717') + ` Failed to unload: ${errorMessage(err)}`);
  }
  return 'handled';
};

export const serveHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  const tokens = parseSlashArgs(args);
  let action = 'status';
  let startIndex = 0;
  const maybeAction = tokens[0]?.toLowerCase();
  if (maybeAction && !maybeAction.startsWith('-')) {
    action = maybeAction;
    startIndex = 1;
  }

  let json = false;
  const unknown: string[] = [];
  for (let i = startIndex; i < tokens.length; i += 1) {
    const token = tokens[i]!;
    if (token === '--json') {
      json = true;
      continue;
    }
    unknown.push(token);
  }

  if (unknown.length > 0) {
    console.log(chalk.yellow(`  Unknown options: ${unknown.join(', ')}`));
    console.log(chalk.dim('  Usage: /serve [start|stop|restart|reload|logs] [--json]'));
    console.log(chalk.dim('  No args: show LMX server status'));
    return 'handled';
  }

  const { host, port } = ctx.config.connection;

  if (action === 'status') {
    if (json) {
      const { serve } = await import('../../serve.js');
      await serve(undefined, { json: true });
      return 'handled';
    }

    const { LmxClient } = await import('../../../lmx/client.js');
    const lmx = new LmxClient({
      host,
      fallbackHosts: ctx.config.connection.fallbackHosts,
      port,
      adminKey: ctx.config.connection.adminKey,
    });

    try {
      await lmx.health(FAST_SLASH_REQUEST_OPTS);
      const status = await lmx.status(FAST_SLASH_REQUEST_OPTS);
      const lines: string[] = [
        kv('Status', chalk.green('running')),
        kv('Address', `${host}:${port}`),
      ];
      if (status.version) lines.push(kv('Version', status.version));
      if (status.uptime_seconds != null) {
        const mins = Math.floor(status.uptime_seconds / 60);
        lines.push(kv('Uptime', mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`));
      }
      lines.push(kv('Models', `${status.models.length} loaded`));
      if (status.memory) {
        const usedGB = (status.memory.used_bytes / 1e9).toFixed(1);
        const totalGB = (status.memory.total_bytes / 1e9).toFixed(1);
        const ratio = status.memory.used_bytes / status.memory.total_bytes;
        lines.push(kv('Memory', `${usedGB}/${totalGB} GB ${progressBar(ratio, 12)}`));
      }
      console.log('\n' + box('LMX Server', lines));
    } catch {
      console.log(chalk.red('  \u25cf LMX is not reachable') + chalk.dim(` at ${host}:${port}`));
      console.log(chalk.dim('  Start it: /serve start'));
    }
    return 'handled';
  }

  if (action === 'reload') {
    const { LmxClient } = await import('../../../lmx/client.js');
    const { host, port } = ctx.config.connection;
    const lmx = new LmxClient({
      host,
      fallbackHosts: ctx.config.connection.fallbackHosts,
      port,
      adminKey: ctx.config.connection.adminKey,
    });
    try {
      const result = await lmx.reloadConfig(FAST_SLASH_REQUEST_OPTS);
      if (json) {
        console.log(JSON.stringify({ ok: true, updated: result.updated }, null, 2));
        return 'handled';
      }
      console.log(chalk.green('\u2713') + ' Config reloaded');
      console.log(chalk.dim('  Updated: ' + result.updated.join(', ')));
    } catch (err) {
      if (json) {
        console.log(JSON.stringify({ ok: false, error: errorMessage(err) }, null, 2));
        return 'handled';
      }
      console.error(chalk.red('\u2717') + ` Config reload failed: ${errorMessage(err)}`);
    }
    return 'handled';
  }

  if (action === 'start' || action === 'stop' || action === 'restart' || action === 'logs') {
    try {
      const { serve } = await import('../../serve.js');
      await serve(action, json ? { json: true } : undefined);
    } catch (err) {
      console.error(chalk.red('\u2717') + ` serve ${action} failed: ${errorMessage(err)}`);
    }
    return 'handled';
  }

  console.log(chalk.dim('  Usage: /serve [start|stop|restart|reload|logs] [--json]'));
  console.log(chalk.dim('  No args: show LMX server status'));
  return 'handled';
};

export const lmxReconnectHandler = async (_args: string, ctx: SlashContext): Promise<SlashResult> => {
  console.log(chalk.dim('  Reconnecting to LMX...'));

  try {
    const { resetClientCache } = await import('../../../core/agent-setup.js');
    await resetClientCache();

    const { probeProvider } = await import('../../../providers/manager.js');
    const provider = await probeProvider(ctx.config);

    const providerName: string = (provider as unknown as { name?: string }).name ?? 'unknown';
    const model = ctx.config.model.default ?? '';
    const display = model ? `${model} via ${providerName}` : providerName;

    if (model) {
      ctx.session.model = model;
    }

    console.log(chalk.green('\u2713') + ` Connected to ${display}`);
    return 'model-switched';
  } catch (err) {
    const { config } = ctx;
    const hasAnthropicFallback = !!(
      config.provider?.anthropic?.apiKey || process.env['ANTHROPIC_API_KEY']
    );

    console.log(chalk.red('\u2717') + ' LMX unreachable');

    if (hasAnthropicFallback) {
      console.log(chalk.dim('  Anthropic fallback is configured'));
    }

    console.log(chalk.dim(`  ${errorMessage(err)}`));
    return 'handled';
  }
};

export const lmxCommandHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  const tokens = parseSlashArgs(args);
  const action = tokens[0]?.toLowerCase();

  if (action === 'status') {
    const remainingArgs = tokens.slice(1).join(' ');
    return lmxStatusHandler(remainingArgs, ctx);
  }

  if (action === 'reconnect') {
    const remainingArgs = tokens.slice(1).join(' ');
    return lmxReconnectHandler(remainingArgs, ctx);
  }

  // Delegate all other actions (start, stop, restart, reload, logs) to serveHandler
  return serveHandler(args, ctx);
};
