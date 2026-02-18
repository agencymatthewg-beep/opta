/**
 * LMX server management slash commands: /scan, /load, /unload, /serve, /memory
 */

import chalk from 'chalk';
import { box, kv, progressBar } from '../../ui/box.js';
import type { SlashCommandDef, SlashContext, SlashResult } from './types.js';

const scanHandler = async (_args: string, ctx: SlashContext): Promise<SlashResult> => {
  const { LmxClient, lookupContextLimit } = await import('../../lmx/client.js');
  const lmx = new LmxClient({
    host: ctx.config.connection.host,
    port: ctx.config.connection.port,
    adminKey: ctx.config.connection.adminKey,
  });

  console.log(chalk.dim(`  Scanning ${ctx.config.connection.host}:${ctx.config.connection.port}...`));

  const [modelsRes, availRes, presetsRes, stackRes, memRes, cloudModels] = await Promise.all([
    lmx.models().catch(() => null),
    lmx.available().catch(() => null),
    lmx.presets().catch(() => null),
    lmx.stack().catch(() => null),
    lmx.memory().catch(() => null),
    (async () => {
      const hasKey = ctx.config.provider?.anthropic?.apiKey || process.env['ANTHROPIC_API_KEY'];
      if (!hasKey) return [];
      try {
        const { getProvider } = await import('../../providers/manager.js');
        const cfg = { ...ctx.config, provider: { ...ctx.config.provider, active: 'anthropic' as const } };
        return (await getProvider(cfg)).listModels();
      } catch { return []; }
    })(),
  ]);

  const loaded = modelsRes?.models ?? [];
  const loadedIds = new Set(loaded.map(m => m.model_id));
  const lmxReachable = modelsRes !== null || availRes !== null;

  if (!lmxReachable && cloudModels.length === 0) {
    console.log(chalk.yellow('  LMX unreachable, no cloud providers configured'));
    return 'handled';
  }

  // Role lookup
  const roleMap = new Map<string, string[]>();
  if (stackRes) {
    for (const [role, info] of Object.entries(stackRes.roles)) {
      if (info.resolved_model) {
        const existing = roleMap.get(info.resolved_model) ?? [];
        existing.push(role);
        roleMap.set(info.resolved_model, existing);
      }
    }
  }

  const lines: string[] = [];

  // Loaded
  if (lmxReachable) {
    lines.push(chalk.bold('Loaded') + chalk.dim(` \u2500 ${ctx.config.connection.host}:${ctx.config.connection.port}`));
    if (loaded.length === 0) {
      lines.push(chalk.dim('  (no models loaded)'));
    }
    for (const m of loaded) {
      const ctxK = ((m.context_length ?? lookupContextLimit(m.model_id)) / 1000).toFixed(0);
      const parts: string[] = [`${ctxK}K ctx`];
      if (m.memory_bytes) parts.push(`${(m.memory_bytes / 1e9).toFixed(1)}GB`);
      if (m.request_count) parts.push(`${m.request_count} reqs`);
      const roles = roleMap.get(m.model_id);
      if (roles) parts.push(roles.map(r => `role:${r}`).join(' '));
      const isCurrent = m.model_id === ctx.config.model.default;
      const star = isCurrent ? chalk.green(' \u2605') : '';
      lines.push(`  ${chalk.green('\u25cf')} ${m.model_id}  ${chalk.dim(parts.join(' \u00b7 '))}${star}`);
    }
  }

  // On disk
  const onDisk = (availRes ?? []).filter(a => !loadedIds.has(a.repo_id));
  if (onDisk.length > 0) {
    lines.push('');
    lines.push(chalk.bold('On Disk') + chalk.dim(' \u2500 not loaded'));
    for (const a of onDisk) {
      const ctxK = (lookupContextLimit(a.repo_id) / 1000).toFixed(0);
      const size = a.size_bytes > 0 ? `${(a.size_bytes / 1e9).toFixed(1)}GB` : '';
      lines.push(`  ${chalk.dim('\u25cb')} ${a.repo_id}  ${chalk.dim([`${ctxK}K ctx`, size].filter(Boolean).join(' \u00b7 '))}`);
    }
  }

  // Presets
  if (presetsRes?.presets.length) {
    lines.push('');
    lines.push(chalk.bold('Presets'));
    for (const p of presetsRes.presets) {
      const model = p.model.replace(/^(mlx|huggingface)-community\//, '');
      const alias = p.routing_alias ? chalk.cyan(`alias:"${p.routing_alias}"`) : '';
      const auto = p.auto_load ? chalk.dim('auto-load') : '';
      lines.push(`  ${chalk.magenta('\u2666')} ${chalk.bold(p.name.padEnd(18))} \u2192 ${chalk.dim(model)}  ${alias}  ${auto}`);
    }
  }

  // Cloud
  if (cloudModels.length > 0) {
    lines.push('');
    lines.push(chalk.bold('Cloud') + chalk.dim(' \u2500 Anthropic'));
    for (const m of cloudModels) {
      const ctxStr = m.contextLength ? `${(m.contextLength / 1000).toFixed(0)}K ctx` : '';
      lines.push(`  ${chalk.blue('\u2601')} ${m.id}  ${chalk.dim([m.name ?? '', ctxStr].filter(Boolean).join(' \u00b7 '))}`);
    }
  }

  // Memory
  if (memRes) {
    lines.push('');
    const pct = Math.round((memRes.used_gb / memRes.total_unified_memory_gb) * 100);
    const pctColor = pct > 80 ? chalk.red : pct > 60 ? chalk.yellow : chalk.green;
    lines.push(`Memory: ${memRes.used_gb.toFixed(1)} / ${memRes.total_unified_memory_gb.toFixed(1)} GB ${pctColor(`(${pct}%)`)}` +
      chalk.dim(` \u00b7 threshold ${memRes.threshold_percent}%`));
  }

  // Footer
  const counts: string[] = [];
  if (loaded.length > 0) counts.push(`${loaded.length} loaded`);
  if (onDisk.length > 0) counts.push(`${onDisk.length} on disk`);
  if (presetsRes?.presets.length) counts.push(`${presetsRes.presets.length} presets`);
  if (cloudModels.length > 0) counts.push(`${cloudModels.length} cloud`);
  if (counts.length > 0) {
    lines.push('');
    lines.push(chalk.dim(counts.join(' \u00b7 ')));
  }

  console.log('\n' + box('Model Scan', lines));
  return 'handled';
};

const loadHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  if (!args) {
    console.log(chalk.dim('  Usage: /load <model-id>'));
    console.log(chalk.dim('  Run /scan to see available models'));
    return 'handled';
  }

  const { LmxClient } = await import('../../lmx/client.js');
  const lmx = new LmxClient({
    host: ctx.config.connection.host,
    port: ctx.config.connection.port,
    adminKey: ctx.config.connection.adminKey,
  });

  console.log(chalk.dim(`  Loading ${args}...`));
  try {
    const result = await lmx.loadModel(args);
    console.log(chalk.green('\u2713') + ` Loaded ${result.model_id}`);
    if (result.memory_bytes) {
      console.log(chalk.dim(`  Memory: ${(result.memory_bytes / 1e9).toFixed(1)} GB`));
    }
    if (result.load_time_seconds) {
      console.log(chalk.dim(`  Load time: ${result.load_time_seconds.toFixed(1)}s`));
    }
  } catch (err) {
    console.error(chalk.red('\u2717') + ` Failed to load: ${err instanceof Error ? err.message : err}`);
  }
  return 'handled';
};

const unloadHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  if (!args) {
    console.log(chalk.dim('  Usage: /unload <model-id>'));
    return 'handled';
  }

  const { LmxClient } = await import('../../lmx/client.js');
  const lmx = new LmxClient({
    host: ctx.config.connection.host,
    port: ctx.config.connection.port,
    adminKey: ctx.config.connection.adminKey,
  });

  try {
    const result = await lmx.unloadModel(args);
    console.log(chalk.green('\u2713') + ` Unloaded ${result.model_id}`);
    if (result.freed_bytes) {
      console.log(chalk.dim(`  Freed: ${(result.freed_bytes / 1e9).toFixed(1)} GB`));
    }
  } catch (err) {
    console.error(chalk.red('\u2717') + ` Failed to unload: ${err instanceof Error ? err.message : err}`);
  }
  return 'handled';
};

const serveHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  const action = args.trim().toLowerCase() || 'status';
  const { host, port } = ctx.config.connection;

  if (action === 'status') {
    const { LmxClient } = await import('../../lmx/client.js');
    const lmx = new LmxClient({ host, port, adminKey: ctx.config.connection.adminKey });

    try {
      await lmx.health();
      const status = await lmx.status();
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

  if (action === 'start' || action === 'stop' || action === 'restart' || action === 'logs') {
    try {
      const { serve } = await import('../serve.js');
      await serve(action);
    } catch (err) {
      console.error(chalk.red('\u2717') + ` serve ${action} failed: ${err instanceof Error ? err.message : err}`);
    }
    return 'handled';
  }

  console.log(chalk.dim('  Usage: /serve [start|stop|restart|logs]'));
  console.log(chalk.dim('  No args: show LMX server status'));
  return 'handled';
};

const memoryHandler = async (_args: string, ctx: SlashContext): Promise<SlashResult> => {
  const { LmxClient } = await import('../../lmx/client.js');
  const lmx = new LmxClient({
    host: ctx.config.connection.host,
    port: ctx.config.connection.port,
    adminKey: ctx.config.connection.adminKey,
  });

  try {
    const mem = await lmx.memory();
    const pct = Math.round((mem.used_gb / mem.total_unified_memory_gb) * 100);
    const lines: string[] = [
      kv('Total', `${mem.total_unified_memory_gb.toFixed(1)} GB`),
      kv('Used', `${mem.used_gb.toFixed(1)} GB ${progressBar(pct / 100, 16)}`),
      kv('Available', `${mem.available_gb.toFixed(1)} GB`),
      kv('Threshold', `${mem.threshold_percent}%`),
    ];

    const modelEntries = Object.entries(mem.models);
    if (modelEntries.length > 0) {
      lines.push('');
      lines.push(chalk.dim('Per-model:'));
      for (const [id, info] of modelEntries) {
        const shortName = id.replace(/^(mlx|huggingface)-community\//, '');
        const loadedStr = info.loaded ? chalk.green('\u25cf') : chalk.dim('\u25cb');
        lines.push(`  ${loadedStr} ${shortName.padEnd(35)} ${chalk.dim(`${info.memory_gb.toFixed(1)} GB`)}`);
      }
    }

    console.log('\n' + box('LMX Memory', lines));
  } catch {
    console.log(chalk.red('  \u25cf LMX unreachable') + chalk.dim(` \u2014 ${ctx.config.connection.host}:${ctx.config.connection.port}`));
  }
  return 'handled';
};

const diagnoseHandler = async (_args: string, ctx: SlashContext): Promise<SlashResult> => {
  const { LmxClient } = await import('../../lmx/client.js');
  const { getProvider } = await import('../../providers/manager.js');
  const { host, port } = ctx.config.connection;

  console.log(chalk.dim('  Running diagnostics...\n'));
  const checks: string[] = [];
  const lmx = new LmxClient({ host, port, adminKey: ctx.config.connection.adminKey });

  // 1. Server reachability + latency
  const healthStart = Date.now();
  let serverOk = false;
  try {
    await lmx.health();
    const latency = Date.now() - healthStart;
    serverOk = true;
    const latColor = latency < 50 ? chalk.green : latency < 200 ? chalk.yellow : chalk.red;
    checks.push(`${chalk.green('\u2713')} Server reachable at ${host}:${port} ${latColor(`(${latency}ms)`)}`);
  } catch (err) {
    checks.push(`${chalk.red('\u2717')} Server unreachable at ${host}:${port}`);
    checks.push(`  ${chalk.dim(err instanceof Error ? err.message : String(err))}`);
  }

  // 2. Models loaded
  if (serverOk) {
    try {
      const models = await lmx.models();
      const count = models.models.length;
      checks.push(count > 0
        ? `${chalk.green('\u2713')} ${count} model${count !== 1 ? 's' : ''} loaded`
        : `${chalk.yellow('\u26a0')} No models loaded — run /load <model-id>`);
    } catch {
      checks.push(`${chalk.yellow('\u26a0')} Could not query loaded models`);
    }
  }

  // 3. Memory utilization
  if (serverOk) {
    try {
      const mem = await lmx.memory();
      const pct = Math.round((mem.used_gb / mem.total_unified_memory_gb) * 100);
      const pctColor = pct > 80 ? chalk.red : pct > 60 ? chalk.yellow : chalk.green;
      checks.push(`${chalk.green('\u2713')} Memory: ${mem.used_gb.toFixed(1)}/${mem.total_unified_memory_gb.toFixed(1)} GB ${pctColor(`(${pct}%)`)}`);
    } catch {
      checks.push(`${chalk.yellow('\u26a0')} Could not query memory`);
    }
  }

  // 4. Admin API
  if (serverOk) {
    try {
      await lmx.status();
      checks.push(`${chalk.green('\u2713')} Admin API responding`);
    } catch {
      checks.push(`${chalk.yellow('\u26a0')} Admin API not available (check admin key)`);
    }
  }

  // 5. Provider config
  const active = ctx.config.provider?.active ?? 'lmx';
  const fallback = ctx.config.provider?.fallbackOnFailure ?? false;
  checks.push(`${chalk.green('\u2713')} Provider: ${chalk.bold(active)}${fallback ? chalk.cyan(' + Anthropic fallback') : ''}`);

  // 6. Anthropic fallback status
  const hasAnthropicKey = !!(ctx.config.provider?.anthropic?.apiKey || process.env['ANTHROPIC_API_KEY']);
  if (fallback && hasAnthropicKey) {
    try {
      const cfg = { ...ctx.config, provider: { ...ctx.config.provider, active: 'anthropic' as const } };
      const anthropic = await getProvider(cfg);
      const aHealth = await anthropic.health();
      checks.push(aHealth.ok
        ? `${chalk.green('\u2713')} Anthropic fallback ready ${chalk.dim(`(${aHealth.latencyMs}ms)`)}`
        : `${chalk.red('\u2717')} Anthropic fallback unhealthy: ${aHealth.error}`);
    } catch {
      checks.push(`${chalk.yellow('\u26a0')} Could not verify Anthropic fallback`);
    }
  } else if (fallback && !hasAnthropicKey) {
    checks.push(`${chalk.yellow('\u26a0')} Fallback enabled but no Anthropic API key configured`);
  } else if (!fallback && hasAnthropicKey) {
    checks.push(`${chalk.dim('\u2139')} Anthropic key present but fallback disabled — set provider.fallbackOnFailure: true to enable`);
  }

  // 7. Inference timeout
  const timeout = ctx.config.connection.inferenceTimeout;
  checks.push(`${chalk.green('\u2713')} Inference timeout: ${(timeout / 1000).toFixed(0)}s`);

  console.log(box('LMX Diagnostics', checks));
  return 'handled';
};

export const lmxCommands: SlashCommandDef[] = [
  {
    command: 'scan',
    aliases: ['models'],
    description: 'Scan all available models',
    handler: scanHandler,
    category: 'server',
    usage: '/scan',
    examples: ['/scan'],
  },
  {
    command: 'load',
    description: 'Load model into LMX memory',
    handler: loadHandler,
    category: 'server',
    usage: '/load <model-id>',
    examples: ['/load mlx-community/Llama-3-8B-Instruct-4bit'],
  },
  {
    command: 'unload',
    description: 'Unload model (free memory)',
    handler: unloadHandler,
    category: 'server',
    usage: '/unload <model-id>',
    examples: ['/unload mlx-community/Llama-3-8B-Instruct-4bit'],
  },
  {
    command: 'serve',
    description: 'LMX server start/stop/status',
    handler: serveHandler,
    category: 'server',
    usage: '/serve [start|stop|restart|logs]',
    examples: ['/serve', '/serve start', '/serve stop', '/serve logs'],
  },
  {
    command: 'memory',
    aliases: ['mem'],
    description: 'LMX memory breakdown',
    handler: memoryHandler,
    category: 'server',
    usage: '/memory',
    examples: ['/memory'],
  },
  {
    command: 'diagnose',
    aliases: ['diag'],
    description: 'Run LMX provider diagnostics',
    handler: diagnoseHandler,
    category: 'server',
    usage: '/diagnose',
    examples: ['/diagnose'],
  },
];
