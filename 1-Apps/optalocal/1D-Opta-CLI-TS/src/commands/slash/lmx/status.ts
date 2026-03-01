/**
 * LMX status, diagnostics, memory, metrics, events, predictor, stack, and helpers handlers.
 */

import chalk from 'chalk';
import { box, kv, progressBar } from '../../../ui/box.js';
import { errorMessage } from '../../../utils/errors.js';
import type { SlashContext, SlashResult } from '../types.js';
import {
  FAST_SLASH_REQUEST_OPTS,
  parseSlashArgs,
  renderJson,
  asObject,
  readString,
  readNumber,
  readBoolean,
  adminEndpointUrl,
  fetchAdminText,
} from './types.js';

export const lmxStatusHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  const tokens = parseSlashArgs(args);
  const isFull = tokens.includes('--full');
  
  const { LmxClient } = await import('../../../lmx/client.js');
  const { host, port } = ctx.config.connection;
  const lmx = new LmxClient({
    host,
    fallbackHosts: ctx.config.connection.fallbackHosts,
    port,
    adminKey: ctx.config.connection.adminKey,
  });

  const reqOpts = isFull ? { timeoutMs: 15_000, maxRetries: 1 } : FAST_SLASH_REQUEST_OPTS;

  const [healthResult, statusResult, memory, available] = await Promise.all([
    lmx.health(reqOpts).catch(() => null),
    lmx.status(reqOpts).catch(() => null),
    isFull ? lmx.memory(reqOpts).catch(() => null) : null,
    isFull ? lmx.available(reqOpts).catch(() => null) : null,
  ]);

  const activeHost = lmx.getActiveHost();
  const isFallback = activeHost !== host;

  if (!healthResult || !statusResult) {
    console.log(chalk.red('\u2717') + ` LMX unreachable at ${host}:${port}`);
    return 'handled';
  }

  const lines: string[] = [];

  if (statusResult.version) {
    lines.push(kv('Version', statusResult.version));
  }

  if (statusResult.uptime_seconds != null) {
    const mins = Math.floor(statusResult.uptime_seconds / 60);
    const uptime = mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
    lines.push(kv('Uptime', uptime));
  }

  if (statusResult.memory) {
    const usedGB = (statusResult.memory.used_bytes / 1e9).toFixed(1);
    const totalGB = (statusResult.memory.total_bytes / 1e9).toFixed(1);
    const ratio = statusResult.memory.used_bytes / statusResult.memory.total_bytes;
    lines.push(kv('Memory', `${usedGB}/${totalGB} GB ${progressBar(ratio, 12)}`));
  }

  if (isFull && memory) {
    const umUsed = (memory.used_gb).toFixed(1);
    const umTotal = (memory.total_unified_memory_gb).toFixed(1);
    const umPct = Math.round((memory.used_gb / memory.total_unified_memory_gb) * 100);
    lines.push(kv('VRAM', `${umUsed}/${umTotal} GB (${umPct}%) [Threshold: ${memory.threshold_percent}%]`));
  }

  if (isFull && available) {
    lines.push(kv('On Disk', `${available.length} models downloaded`));
  }

  const hostLabel = isFallback
    ? `${activeHost}:${port} ${chalk.cyan('(fallback)')}`
    : `${activeHost}:${port}`;
  lines.push(kv('Host', hostLabel));

  if (statusResult.models.length > 0) {
    lines.push('');
    lines.push(chalk.bold(`Loaded Models`) + chalk.dim(` \u2500 ${statusResult.models.length}`));
    for (const m of statusResult.models) {
      const ctxK = m.context_length != null ? `${Math.round(m.context_length / 1024)}K` : '';
      const memGB = m.memory_bytes != null ? `${(m.memory_bytes / 1e9).toFixed(1)}GB` : '';
      const parts = [ctxK, memGB].filter(Boolean).join('  ');
      lines.push(`  ${chalk.green('\u25cf')} ${m.model_id}  ${chalk.dim(parts)}`);
    }
  } else {
    lines.push(kv('Models', chalk.dim('(none loaded)')));
  }

  console.log('\n' + box(isFull ? 'LMX Status (Full)' : 'LMX Status', lines));
  return 'handled';
};

export const diagnoseHandler = async (_args: string, ctx: SlashContext): Promise<SlashResult> => {
  const { LmxClient } = await import('../../../lmx/client.js');
  const { getProvider } = await import('../../../providers/manager.js');
  const { host, port } = ctx.config.connection;

  console.log(chalk.dim('  Running diagnostics...\n'));
  const checks: string[] = [];
  const lmx = new LmxClient({
    host,
    fallbackHosts: ctx.config.connection.fallbackHosts,
    port,
    adminKey: ctx.config.connection.adminKey,
  });

  // 1. Server reachability + latency
  const healthStart = Date.now();
  let serverOk = false;
  try {
    await lmx.health(FAST_SLASH_REQUEST_OPTS);
    const latency = Date.now() - healthStart;
    serverOk = true;
    const latColor = latency < 50 ? chalk.green : latency < 200 ? chalk.yellow : chalk.red;
    checks.push(`${chalk.green('\u2713')} Server reachable at ${host}:${port} ${latColor(`(${latency}ms)`)}`);
  } catch (err) {
    checks.push(`${chalk.red('\u2717')} Server unreachable at ${host}:${port}`);
    checks.push(`  ${chalk.dim(errorMessage(err))}`);
  }

  // 2. Models loaded
  if (serverOk) {
    try {
      const models = await lmx.models(FAST_SLASH_REQUEST_OPTS);
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
      const mem = await lmx.memory(FAST_SLASH_REQUEST_OPTS);
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
      await lmx.status(FAST_SLASH_REQUEST_OPTS);
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

export const memoryHandler = async (_args: string, ctx: SlashContext): Promise<SlashResult> => {
  const { LmxClient } = await import('../../../lmx/client.js');
  const lmx = new LmxClient({
    host: ctx.config.connection.host,
    fallbackHosts: ctx.config.connection.fallbackHosts,
    port: ctx.config.connection.port,
    adminKey: ctx.config.connection.adminKey,
  });

  try {
    const mem = await lmx.memory(FAST_SLASH_REQUEST_OPTS);
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

export const metricsHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  const tokens = parseSlashArgs(args);
  const json = tokens.includes('--json');
  const prom = tokens.includes('--prom');
  const unknown = tokens.filter((token) => token.startsWith('--') && token !== '--json' && token !== '--prom');
  if (unknown.length > 0) {
    console.log(chalk.yellow(`  Unknown options: ${unknown.join(', ')}`));
    console.log(chalk.dim('  Usage: /metrics [--prom|--json]'));
    return 'handled';
  }

  if (prom) {
    try {
      const text = await fetchAdminText(ctx, '/admin/metrics', 10_000);
      if (json) {
        console.log(renderJson({ format: 'prometheus', content: text }));
      } else {
        console.log(text.trimEnd());
      }
    } catch (err) {
      console.error(chalk.red('\u2717') + ` Metrics fetch failed: ${errorMessage(err)}`);
    }
    return 'handled';
  }

  const { LmxClient } = await import('../../../lmx/client.js');
  const lmx = new LmxClient({
    host: ctx.config.connection.host,
    fallbackHosts: ctx.config.connection.fallbackHosts,
    port: ctx.config.connection.port,
    adminKey: ctx.config.connection.adminKey,
  });

  try {
    const m = await lmx.metricsJson(FAST_SLASH_REQUEST_OPTS);
    if (json) {
      console.log(renderJson(m));
      return 'handled';
    }
    const lines: string[] = [];

    // Show all top-level numeric/string fields
    for (const [key, val] of Object.entries(m)) {
      if (typeof val === 'number') {
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        const formatted = Number.isInteger(val) ? val.toLocaleString() : val.toFixed(2);
        lines.push(kv(label, formatted));
      }
    }

    if (lines.length === 0) {
      lines.push(chalk.dim('No metrics available yet — make some requests first'));
    }

    console.log('\n' + box('LMX Metrics', lines));
  } catch {
    console.log(chalk.red('  \u25cf LMX unreachable') + chalk.dim(` \u2014 ${ctx.config.connection.host}:${ctx.config.connection.port}`));
  }
  return 'handled';
};

export const eventsHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  const tokens = parseSlashArgs(args);
  let limit = 20;
  let timeoutSec = 20;
  const json = tokens.includes('--json');
  const unknown: string[] = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]!;
    if (!token.startsWith('--')) {
      unknown.push(token);
      continue;
    }
    if (token === '--json') continue;
    if (token === '--limit') {
      const value = tokens[i + 1];
      if (!value) {
        console.log(chalk.dim('  Missing value for --limit'));
        return 'handled';
      }
      i += 1;
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > 500) {
        console.log(chalk.yellow(`  Invalid --limit value: ${value} (expected 1..500)`));
        return 'handled';
      }
      limit = parsed;
      continue;
    }
    if (token === '--timeout') {
      const value = tokens[i + 1];
      if (!value) {
        console.log(chalk.dim('  Missing value for --timeout'));
        return 'handled';
      }
      i += 1;
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > 300) {
        console.log(chalk.yellow(`  Invalid --timeout value: ${value} (expected 1..300)`));
        return 'handled';
      }
      timeoutSec = parsed;
      continue;
    }
    unknown.push(token);
  }

  if (unknown.length > 0) {
    console.log(chalk.yellow(`  Unknown options: ${unknown.join(', ')}`));
    console.log(chalk.dim('  Usage: /events [--limit <n>] [--timeout <sec>] [--json]'));
    return 'handled';
  }

  const headers: Record<string, string> = {
    Accept: 'text/event-stream',
  };
  if (ctx.config.connection.adminKey?.trim()) {
    headers['X-Admin-Key'] = ctx.config.connection.adminKey.trim();
  }

  const controller = new AbortController();
  const killTimer = setTimeout(() => controller.abort(), timeoutSec * 1000);
  type EventRow = { event: string; data: unknown };
  const rows: EventRow[] = [];
  let partial = '';
  let eventName = 'message';
  let dataLines: string[] = [];

  const flushEvent = () => {
    if (dataLines.length === 0) return;
    const raw = dataLines.join('\n');
    let parsed: unknown = raw;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = raw;
    }
    rows.push({ event: eventName || 'message', data: parsed });
    eventName = 'message';
    dataLines = [];
  };

  try {
    const response = await fetch(adminEndpointUrl(ctx, '/admin/events'), {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    if (!response.body) {
      throw new Error('No response stream available');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (rows.length < limit) {
      const { value, done } = await reader.read();
      if (done) break;
      partial += decoder.decode(value, { stream: true });
      const lines = partial.split(/\r?\n/);
      partial = lines.pop() ?? '';
      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventName = line.slice(6).trim() || 'message';
          continue;
        }
        if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trim());
          continue;
        }
        if (line.trim() === '') {
          flushEvent();
          if (rows.length >= limit) {
            controller.abort();
            break;
          }
        }
      }
    }
    flushEvent();
  } catch (err) {
    if (!(err instanceof DOMException && err.name === 'AbortError')) {
      console.error(chalk.red('\u2717') + ` Events stream failed: ${errorMessage(err)}`);
      return 'handled';
    }
  } finally {
    clearTimeout(killTimer);
  }

  if (json) {
    console.log(renderJson({
      count: rows.length,
      timeoutSec,
      limit,
      events: rows,
    }));
    return 'handled';
  }

  const lines: string[] = [
    kv('Captured', String(rows.length)),
    kv('Timeout', `${timeoutSec}s`),
  ];
  if (rows.length > 0) {
    lines.push('');
    for (const row of rows) {
      const payload = typeof row.data === 'string' ? row.data : renderJson(row.data);
      const inline = payload.replace(/\s+/g, ' ').trim();
      lines.push(`  ${chalk.cyan(row.event.padEnd(18))} ${inline.slice(0, 120)}`);
    }
  } else {
    lines.push(chalk.dim('No events captured in this window.'));
  }
  console.log('\n' + box('LMX Events', lines));
  return 'handled';
};

export const predictorHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  const tokens = parseSlashArgs(args);
  const json = tokens.includes('--json');
  const unknown = tokens.filter((token) => token.startsWith('--') && token !== '--json');
  if (unknown.length > 0) {
    console.log(chalk.yellow(`  Unknown options: ${unknown.join(', ')}`));
    console.log(chalk.dim('  Usage: /predictor [--json]'));
    return 'handled';
  }

  const { LmxClient } = await import('../../../lmx/client.js');
  const lmx = new LmxClient({
    host: ctx.config.connection.host,
    fallbackHosts: ctx.config.connection.fallbackHosts,
    port: ctx.config.connection.port,
    adminKey: ctx.config.connection.adminKey,
  });

  try {
    const stats = asObject(await lmx.predictorStats(FAST_SLASH_REQUEST_OPTS));
    if (json) {
      console.log(renderJson(stats));
      return 'handled';
    }

    const predictedNext = readString(stats, 'predicted_next', 'predictedNext');
    const lines: string[] = [
      kv('Predicted Next', predictedNext ?? chalk.dim('(none)')),
    ];
    for (const [key, value] of Object.entries(stats)) {
      if (key === 'predicted_next' || key === 'predictedNext') continue;
      if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        lines.push(kv(label, String(value)));
      }
    }

    console.log('\n' + box('Predictor Stats', lines));
  } catch (err) {
    console.error(chalk.red('\u2717') + ` Predictor stats failed: ${errorMessage(err)}`);
  }
  return 'handled';
};

export const helpersHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  const tokens = parseSlashArgs(args);
  const json = tokens.includes('--json');
  const unknown = tokens.filter((token) => token.startsWith('--') && token !== '--json');
  if (unknown.length > 0) {
    console.log(chalk.yellow(`  Unknown options: ${unknown.join(', ')}`));
    console.log(chalk.dim('  Usage: /helpers [--json]'));
    return 'handled';
  }

  const { LmxClient } = await import('../../../lmx/client.js');
  const lmx = new LmxClient({
    host: ctx.config.connection.host,
    fallbackHosts: ctx.config.connection.fallbackHosts,
    port: ctx.config.connection.port,
    adminKey: ctx.config.connection.adminKey,
  });

  try {
    const payload = asObject(await lmx.helpersHealth(FAST_SLASH_REQUEST_OPTS));
    if (json) {
      console.log(renderJson(payload));
      return 'handled';
    }

    const helpers = asObject(payload.helpers);
    const liveChecks = asObject(payload.live_checks ?? payload.liveChecks);
    const configuredCount = readNumber(payload, 'configured_count', 'configuredCount') ?? Object.keys(helpers).length;
    const allHealthy = readBoolean(payload, 'all_healthy', 'allHealthy');
    const lines: string[] = [
      kv('Configured', String(configuredCount)),
      kv('All Healthy', String(allHealthy ?? false)),
    ];

    if (Object.keys(helpers).length > 0) {
      lines.push('');
      lines.push(chalk.dim('Nodes:'));
      for (const [name, rawStats] of Object.entries(helpers)) {
        const stats = asObject(rawStats);
        const healthy = readBoolean(stats, 'healthy');
        const latencyMs = readNumber(stats, 'avg_latency_ms', 'latency_ms', 'latencyMs');
        const successRate = readNumber(stats, 'success_rate', 'successRate');
        const live = readBoolean(liveChecks, name);
        const healthBadge = healthy ? chalk.green('healthy') : chalk.red('unhealthy');
        const meta = [
          latencyMs !== undefined ? `${latencyMs.toFixed(0)}ms` : undefined,
          successRate !== undefined ? `${(successRate * 100).toFixed(1)}% ok` : undefined,
          live !== undefined ? `live:${live ? 'pass' : 'fail'}` : undefined,
        ].filter(Boolean).join(' \u00b7 ');
        lines.push(`  ${name.padEnd(10)} ${healthBadge}${meta ? chalk.dim(` \u00b7 ${meta}`) : ''}`);
      }
    }

    console.log('\n' + box('Helper Nodes', lines));
  } catch (err) {
    console.error(chalk.red('\u2717') + ` Helper health failed: ${errorMessage(err)}`);
  }
  return 'handled';
};

export const stackHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  const tokens = parseSlashArgs(args);
  const json = tokens.includes('--json');
  const unknown = tokens.filter((token) => token.startsWith('--') && token !== '--json');
  if (unknown.length > 0) {
    console.log(chalk.yellow(`  Unknown options: ${unknown.join(', ')}`));
    console.log(chalk.dim('  Usage: /stack [--json]'));
    return 'handled';
  }

  const { LmxClient } = await import('../../../lmx/client.js');
  const lmx = new LmxClient({
    host: ctx.config.connection.host,
    fallbackHosts: ctx.config.connection.fallbackHosts,
    port: ctx.config.connection.port,
    adminKey: ctx.config.connection.adminKey,
  });

  try {
    const stack = await lmx.stack(FAST_SLASH_REQUEST_OPTS);

    if (json) {
      console.log(renderJson(stack));
      return 'handled';
    }

    const lines: string[] = [];

    if (stack.default_model) {
      lines.push(kv('Default', stack.default_model));
    }

    if (stack.loaded_models.length > 0) {
      lines.push(kv('Loaded', String(stack.loaded_models.length)));
      for (const id of stack.loaded_models) {
        lines.push(`  ${chalk.green('\u25cf')} ${id}`);
      }
    } else {
      lines.push(kv('Loaded', chalk.dim('(none)')));
    }

    const roleEntries = Object.entries(stack.roles);
    if (roleEntries.length > 0) {
      lines.push('');
      lines.push(chalk.dim('Role Routing:'));
      const nameW = Math.max(8, ...roleEntries.map(([n]) => n.length));
      const modelW = Math.max(14, ...roleEntries.map(([, r]) => r.resolved_model?.length ?? 0));
      lines.push(chalk.dim(`  ${'NAME'.padEnd(nameW)}  ${'RESOLVED MODEL'.padEnd(modelW)}  STATUS`));
      for (const [roleName, role] of roleEntries) {
        const modelText = role.resolved_model ?? '';
        const modelColored = role.resolved_model
          ? modelText.padEnd(modelW)
          : chalk.dim('(none)'.padEnd(modelW));
        const statusBadge = role.loaded ? chalk.green('loaded') : chalk.yellow('not loaded');
        lines.push(`  ${roleName.padEnd(nameW)}  ${modelColored}  ${statusBadge}`);
      }
    }

    const helperEntries = Object.entries(stack.helper_nodes);
    if (helperEntries.length > 0) {
      lines.push('');
      lines.push(chalk.dim('Helper Nodes:'));
      for (const [name, info] of helperEntries) {
        const rec = asObject(info);
        const status = readString(rec, 'status', 'health') ?? chalk.dim('(unknown)');
        lines.push(`  ${name.padEnd(16)}  ${status}`);
      }
    }

    console.log('\n' + box('LMX Stack', lines));
  } catch (err) {
    console.error(chalk.red('\u2717') + ` Stack query failed: ${errorMessage(err)}`);
  }
  return 'handled';
};
