/**
 * LMX configuration and tuning handlers: presets, probe, compatibility, autotune, quantize.
 */

import chalk from 'chalk';
import { box, kv } from '../../../ui/box.js';
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
  readArray,
  classifyOutcome,
} from './types.js';

export const presetHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  const name = args.trim();
  if (!name) {
    console.log(chalk.dim('  Usage: /preset <name>'));
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
    const preset = asObject(await lmx.presetDetail(name, FAST_SLASH_REQUEST_OPTS));
    const presetName = readString(preset, 'name') ?? name;
    const presetModel = readString(preset, 'model') ?? chalk.dim('(unknown)');
    const presetAlias = readString(preset, 'routing_alias', 'routingAlias');
    const presetAutoLoad = readBoolean(preset, 'auto_load', 'autoLoad');
    const presetDescription = readString(preset, 'description');
    const defaultPromptProfile = readString(preset, 'default_prompt_profile', 'defaultPromptProfile');
    const performance = asObject(preset.performance);
    const parameters = asObject(preset.parameters);
    const promptProfiles = asObject(preset.prompt_profiles ?? preset.promptProfiles);

    const lines: string[] = [
      kv('Name', presetName),
      kv('Model', presetModel),
      kv('Alias', presetAlias ?? chalk.dim('(none)')),
      kv('Auto-load', String(presetAutoLoad ?? false)),
      kv('Description', presetDescription ?? chalk.dim('(none)')),
      kv('Default Prompt Profile', defaultPromptProfile ?? chalk.dim('(none)')),
    ];

    if (Object.keys(performance).length > 0) {
      lines.push('');
      lines.push(chalk.dim('Performance:'));
      lines.push(chalk.dim(renderJson(performance)));
    }
    if (Object.keys(parameters).length > 0) {
      lines.push('');
      lines.push(chalk.dim('Parameters:'));
      lines.push(chalk.dim(renderJson(parameters)));
    }
    if (Object.keys(promptProfiles).length > 0) {
      lines.push('');
      lines.push(chalk.dim('Prompt Profiles:'));
      lines.push(chalk.dim(renderJson(promptProfiles)));
    }

    console.log('\n' + box(`Preset ${presetName}`, lines));
  } catch (err) {
    console.error(chalk.red('\u2717') + ` Failed to fetch preset: ${errorMessage(err)}`);
  }
  return 'handled';
};

export const presetsHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  const tokens = parseSlashArgs(args);
  const action = (tokens[0] ?? 'list').toLowerCase();

  const { LmxClient } = await import('../../../lmx/client.js');
  const lmx = new LmxClient({
    host: ctx.config.connection.host,
    fallbackHosts: ctx.config.connection.fallbackHosts,
    port: ctx.config.connection.port,
    adminKey: ctx.config.connection.adminKey,
  });

  if (action === 'reload') {
    try {
      const result = asObject(await lmx.reloadPresets(FAST_SLASH_REQUEST_OPTS));
      const loaded = readNumber(result, 'presets_loaded', 'presetsLoaded', 'count');
      const suffix = loaded === undefined ? '' : ` (${loaded} loaded)`;
      console.log(chalk.green('\u2713') + ` Presets reloaded${suffix}`);
    } catch (err) {
      console.error(chalk.red('\u2717') + ` Preset reload failed: ${errorMessage(err)}`);
    }
    return 'handled';
  }

  if (tokens.length === 1 && action !== 'list') {
    return presetHandler(action, ctx);
  }

  if (tokens.length > 1) {
    console.log(chalk.dim('  Usage: /presets [list|reload|<preset-name>]'));
    return 'handled';
  }

  try {
    const presets = await lmx.presets(FAST_SLASH_REQUEST_OPTS);
    const lines: string[] = [
      kv('Count', String(presets.count)),
    ];
    if (presets.presets.length === 0) {
      lines.push(chalk.dim('No presets loaded.'));
    } else {
      lines.push('');
      for (const preset of presets.presets) {
        const alias = preset.routing_alias ? chalk.cyan(`alias:${preset.routing_alias}`) : '';
        const auto = preset.auto_load ? chalk.dim('auto-load') : '';
        lines.push(
          `  ${chalk.magenta('\u25c6')} ${chalk.bold(preset.name.padEnd(20))} \u2192 ${chalk.dim(preset.model)} ${alias} ${auto}`.trimEnd(),
        );
      }
    }
    lines.push('');
    lines.push(chalk.dim('Tip: /preset <name> for full details \u00b7 /presets reload to re-read from disk.'));

    console.log('\n' + box('LMX Presets', lines));
  } catch (err) {
    console.error(chalk.red('\u2717') + ` Failed to list presets: ${errorMessage(err)}`);
  }
  return 'handled';
};

export const probeHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  const tokens = parseSlashArgs(args);
  const modelId = tokens.find((token) => !token.startsWith('--'));
  if (!modelId) {
    console.log(chalk.dim('  Usage: /probe <model-id> [--timeout <sec>] [--allow-unsupported]'));
    return 'handled';
  }

  let timeoutSec: number | undefined;
  let allowUnsupportedRuntime = false;
  const unknown: string[] = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]!;
    if (!token.startsWith('--')) continue;
    if (token === '--allow-unsupported') {
      allowUnsupportedRuntime = true;
      continue;
    }
    if (token === '--timeout') {
      const value = tokens[i + 1];
      if (!value) {
        console.log(chalk.dim('  Missing value for --timeout'));
        return 'handled';
      }
      i += 1;
      const parsed = Number.parseFloat(value);
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > 900) {
        console.log(chalk.yellow(`  Invalid --timeout value: ${value} (expected 1..900)`));
        return 'handled';
      }
      timeoutSec = parsed;
      continue;
    }
    unknown.push(token);
  }

  if (unknown.length > 0) {
    console.log(chalk.yellow(`  Unknown options: ${unknown.join(', ')}`));
    console.log(chalk.dim('  Usage: /probe <model-id> [--timeout <sec>] [--allow-unsupported]'));
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
    const result = asObject(await lmx.probeModel(
      {
        modelId,
        timeoutSec,
        allowUnsupportedRuntime,
      },
      { timeoutMs: Math.round((timeoutSec ?? 90) * 1000), maxRetries: 0 },
    ));
    const recommendedBackend = readString(result, 'recommendedBackend', 'recommended_backend');
    const candidates = readArray(result, 'candidates').map((entry) => asObject(entry));
    const lines: string[] = [
      kv('Model', readString(result, 'modelId', 'model_id') ?? modelId),
      kv('Recommended', recommendedBackend ?? chalk.dim('(none)')),
      kv('Candidates', String(candidates.length)),
    ];
    if (candidates.length > 0) {
      lines.push('');
      for (const candidate of candidates) {
        const backend = readString(candidate, 'backend') ?? 'unknown';
        const outcomeRaw = readString(candidate, 'outcome') ?? 'unknown';
        const reason = readString(candidate, 'reason', 'detail', 'message');
        const classed = classifyOutcome(outcomeRaw);
        const color = classed === 'success'
          ? chalk.green
          : classed === 'failure'
            ? chalk.red
            : chalk.yellow;
        lines.push(`  ${color(backend.padEnd(12))} ${outcomeRaw}${reason ? chalk.dim(` \u00b7 ${reason}`) : ''}`);
      }
    }
    console.log('\n' + box('Model Probe', lines));
  } catch (err) {
    console.error(chalk.red('\u2717') + ` Probe failed: ${errorMessage(err)}`);
  }
  return 'handled';
};

export const compatibilityHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  const tokens = parseSlashArgs(args);
  const options: {
    modelId?: string;
    backend?: string;
    outcome?: string;
    sinceTs?: number;
    limit?: number;
    includeSummary?: boolean;
  } = {};
  const unknown: string[] = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]!;
    if (!token.startsWith('--')) {
      unknown.push(token);
      continue;
    }
    if (token === '--summary') {
      options.includeSummary = true;
      continue;
    }
    if (token === '--model') {
      const value = tokens[i + 1];
      if (!value) {
        console.log(chalk.dim('  Missing value for --model'));
        return 'handled';
      }
      i += 1;
      options.modelId = value;
      continue;
    }
    if (token === '--backend') {
      const value = tokens[i + 1];
      if (!value) {
        console.log(chalk.dim('  Missing value for --backend'));
        return 'handled';
      }
      i += 1;
      options.backend = value;
      continue;
    }
    if (token === '--outcome') {
      const value = tokens[i + 1];
      if (!value) {
        console.log(chalk.dim('  Missing value for --outcome'));
        return 'handled';
      }
      i += 1;
      options.outcome = value;
      continue;
    }
    if (token === '--since') {
      const value = tokens[i + 1];
      if (!value) {
        console.log(chalk.dim('  Missing value for --since'));
        return 'handled';
      }
      i += 1;
      const parsed = Number.parseFloat(value);
      if (!Number.isFinite(parsed)) {
        console.log(chalk.yellow(`  Invalid --since value: ${value}`));
        return 'handled';
      }
      options.sinceTs = parsed;
      continue;
    }
    if (token === '--limit') {
      const value = tokens[i + 1];
      if (!value) {
        console.log(chalk.dim('  Missing value for --limit'));
        return 'handled';
      }
      i += 1;
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > 2000) {
        console.log(chalk.yellow(`  Invalid --limit value: ${value} (expected 1..2000)`));
        return 'handled';
      }
      options.limit = parsed;
      continue;
    }
    unknown.push(token);
  }

  if (unknown.length > 0) {
    console.log(chalk.yellow(`  Unknown arguments: ${unknown.join(', ')}`));
    console.log(chalk.dim('  Usage: /compatibility [--model <id>] [--backend <name>] [--outcome <value>] [--since <ts>] [--limit <n>] [--summary]'));
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
    const result = asObject(await lmx.modelCompatibility(options, FAST_SLASH_REQUEST_OPTS));
    const rows = readArray(result, 'rows', 'items').map((entry) => asObject(entry));
    const summary = asObject(result.summary);
    const totalRows = readNumber(result, 'total', 'count') ?? rows.length;

    const lines: string[] = [
      kv('Rows', String(totalRows)),
    ];
    if (Object.keys(summary).length > 0) {
      lines.push('');
      lines.push(chalk.dim('Summary by model:'));
      lines.push(chalk.dim(renderJson(summary)));
    }
    if (rows.length > 0) {
      lines.push('');
      lines.push(chalk.dim('Latest rows:'));
      const slice = rows.slice(0, 20);
      for (const row of slice) {
        const outcomeRaw = readString(row, 'outcome') ?? 'unknown';
        const backendName = readString(row, 'backend') ?? 'unknown';
        const modelName = readString(row, 'modelId', 'model_id', 'model') ?? 'unknown';
        const tsRaw = readNumber(row, 'ts', 'timestamp');
        const tsSeconds = tsRaw === undefined ? undefined : tsRaw > 1e11 ? tsRaw / 1000 : tsRaw;
        const tsLabel = tsSeconds === undefined ? 'unknown-time' : new Date(tsSeconds * 1000).toISOString();
        const classed = classifyOutcome(outcomeRaw);
        const outcome = classed === 'success'
          ? chalk.green(outcomeRaw)
          : classed === 'failure'
            ? chalk.red(outcomeRaw)
            : chalk.yellow(outcomeRaw);
        lines.push(`  ${tsLabel}  ${backendName.padEnd(10)}  ${outcome}  ${chalk.dim(modelName)}`);
      }
    }
    console.log('\n' + box('Model Compatibility', lines));
  } catch (err) {
    console.error(chalk.red('\u2717') + ` Compatibility query failed: ${errorMessage(err)}`);
  }
  return 'handled';
};

export const autotuneHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  const tokens = parseSlashArgs(args);
  const modelId = tokens.find((token) => !token.startsWith('--'));
  if (!modelId) {
    console.log(chalk.dim('  Usage: /autotune <model-id> [--prompt "..."] [--max-tokens <n>] [--temperature <n>] [--runs <n>] [--profiles-json <json>] [--allow-unsupported]'));
    return 'handled';
  }

  const payload: {
    modelId: string;
    prompt?: string;
    maxTokens?: number;
    temperature?: number;
    runs?: number;
    profiles?: Array<Record<string, unknown>>;
    allowUnsupportedRuntime?: boolean;
  } = { modelId };
  const unknown: string[] = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]!;
    if (!token.startsWith('--')) continue;
    if (token === '--allow-unsupported') {
      payload.allowUnsupportedRuntime = true;
      continue;
    }
    if (token === '--prompt') {
      const value = tokens[i + 1];
      if (!value) {
        console.log(chalk.dim('  Missing value for --prompt'));
        return 'handled';
      }
      i += 1;
      payload.prompt = value;
      continue;
    }
    if (token === '--max-tokens') {
      const value = tokens[i + 1];
      if (!value) {
        console.log(chalk.dim('  Missing value for --max-tokens'));
        return 'handled';
      }
      i += 1;
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > 4096) {
        console.log(chalk.yellow(`  Invalid --max-tokens value: ${value}`));
        return 'handled';
      }
      payload.maxTokens = parsed;
      continue;
    }
    if (token === '--temperature') {
      const value = tokens[i + 1];
      if (!value) {
        console.log(chalk.dim('  Missing value for --temperature'));
        return 'handled';
      }
      i += 1;
      const parsed = Number.parseFloat(value);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 2) {
        console.log(chalk.yellow(`  Invalid --temperature value: ${value}`));
        return 'handled';
      }
      payload.temperature = parsed;
      continue;
    }
    if (token === '--runs') {
      const value = tokens[i + 1];
      if (!value) {
        console.log(chalk.dim('  Missing value for --runs'));
        return 'handled';
      }
      i += 1;
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > 5) {
        console.log(chalk.yellow(`  Invalid --runs value: ${value}`));
        return 'handled';
      }
      payload.runs = parsed;
      continue;
    }
    if (token === '--profiles-json') {
      const value = tokens[i + 1];
      if (!value) {
        console.log(chalk.dim('  Missing value for --profiles-json'));
        return 'handled';
      }
      i += 1;
      try {
        const parsed = JSON.parse(value) as unknown;
        if (!Array.isArray(parsed)) {
          console.log(chalk.yellow('  --profiles-json must be a JSON array'));
          return 'handled';
        }
        const profiles = parsed.filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry)) as Array<Record<string, unknown>>;
        payload.profiles = profiles;
      } catch (err) {
        console.log(chalk.yellow(`  Invalid --profiles-json: ${errorMessage(err)}`));
        return 'handled';
      }
      continue;
    }
    unknown.push(token);
  }

  if (unknown.length > 0) {
    console.log(chalk.yellow(`  Unknown options: ${unknown.join(', ')}`));
    console.log(chalk.dim('  Usage: /autotune <model-id> [--prompt "..."] [--max-tokens <n>] [--temperature <n>] [--runs <n>] [--profiles-json <json>] [--allow-unsupported]'));
    return 'handled';
  }

  const { LmxClient } = await import('../../../lmx/client.js');
  const lmx = new LmxClient({
    host: ctx.config.connection.host,
    fallbackHosts: ctx.config.connection.fallbackHosts,
    port: ctx.config.connection.port,
    adminKey: ctx.config.connection.adminKey,
  });

  console.log(chalk.dim(`  Running autotune for ${modelId}...`));

  try {
    const result = asObject(await lmx.autotuneModel(payload, { timeoutMs: 180_000, maxRetries: 0 }));
    const candidates = readArray(result, 'candidates');
    const bestProfile = asObject(result.bestProfile ?? result.best_profile);
    const bestMetrics = asObject(result.bestMetrics ?? result.best_metrics);
    const effectiveBestProfile = Object.keys(bestProfile).length > 0
      ? bestProfile
      : asObject(asObject(candidates[0]).profile);
    const effectiveBestMetrics = Object.keys(bestMetrics).length > 0
      ? bestMetrics
      : asObject(asObject(candidates[0]).metrics);
    const bestScore = readNumber(result, 'bestScore', 'best_score', 'score');

    const lines: string[] = [
      kv('Model', readString(result, 'modelId', 'model_id') ?? modelId),
      kv('Backend', readString(result, 'backend') ?? chalk.dim('(unknown)')),
      kv('Backend Version', readString(result, 'backendVersion', 'backend_version') ?? chalk.dim('(unknown)')),
      kv('Best Score', bestScore === undefined ? chalk.dim('(unknown)') : bestScore.toFixed(4)),
      kv('Candidates', String(candidates.length)),
      '',
      chalk.dim('Best Profile:'),
      chalk.dim(renderJson(effectiveBestProfile)),
      '',
      chalk.dim('Best Metrics:'),
      chalk.dim(renderJson(effectiveBestMetrics)),
    ];
    console.log('\n' + box('Autotune Result', lines));
  } catch (err) {
    console.error(chalk.red('\u2717') + ` Autotune failed: ${errorMessage(err)}`);
  }
  return 'handled';
};

export const autotuneStatusHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  const tokens = parseSlashArgs(args);
  const modelId = tokens.find((token) => !token.startsWith('--'));
  if (!modelId) {
    console.log(chalk.dim('  Usage: /autotune-status <model-id> [--backend <name>] [--backend-version <version>]'));
    return 'handled';
  }

  let backend: string | undefined;
  let backendVersion: string | undefined;
  const unknown: string[] = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]!;
    if (!token.startsWith('--')) continue;
    if (token === '--backend') {
      const value = tokens[i + 1];
      if (!value) {
        console.log(chalk.dim('  Missing value for --backend'));
        return 'handled';
      }
      i += 1;
      backend = value;
      continue;
    }
    if (token === '--backend-version') {
      const value = tokens[i + 1];
      if (!value) {
        console.log(chalk.dim('  Missing value for --backend-version'));
        return 'handled';
      }
      i += 1;
      backendVersion = value;
      continue;
    }
    unknown.push(token);
  }

  if (unknown.length > 0) {
    console.log(chalk.yellow(`  Unknown options: ${unknown.join(', ')}`));
    console.log(chalk.dim('  Usage: /autotune-status <model-id> [--backend <name>] [--backend-version <version>]'));
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
    const result = asObject(await lmx.autotuneRecord(modelId, { backend, backendVersion }, FAST_SLASH_REQUEST_OPTS));
    const score = readNumber(result, 'score', 'best_score');
    const tsRaw = readNumber(result, 'ts', 'timestamp');
    const tsSeconds = tsRaw === undefined ? undefined : tsRaw > 1e11 ? tsRaw / 1000 : tsRaw;
    const profile = asObject(result.profile);
    const metrics = asObject(result.metrics);
    const lines: string[] = [
      kv('Model', readString(result, 'modelId', 'model_id') ?? modelId),
      kv('Backend', readString(result, 'backend') ?? chalk.dim('(unknown)')),
      kv('Backend Version', readString(result, 'backendVersion', 'backend_version') ?? chalk.dim('(unknown)')),
      kv('Score', score === undefined ? chalk.dim('(unknown)') : score.toFixed(4)),
      kv('Timestamp', tsSeconds === undefined ? chalk.dim('(unknown)') : new Date(tsSeconds * 1000).toISOString()),
      '',
      chalk.dim('Profile:'),
      chalk.dim(renderJson(profile)),
      '',
      chalk.dim('Metrics:'),
      chalk.dim(renderJson(metrics)),
    ];
    console.log('\n' + box('Autotune Profile', lines));
  } catch (err) {
    console.error(chalk.red('\u2717') + ` Failed to fetch autotune profile: ${errorMessage(err)}`);
  }
  return 'handled';
};

export const quantizeHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  const tokens = parseSlashArgs(args);
  const actionToken = tokens[0]?.toLowerCase();
  const action = actionToken && !actionToken.startsWith('--') ? actionToken : 'list';
  const startAt = actionToken === action ? 1 : 0;

  const { LmxClient } = await import('../../../lmx/client.js');
  const lmx = new LmxClient({
    host: ctx.config.connection.host,
    fallbackHosts: ctx.config.connection.fallbackHosts,
    port: ctx.config.connection.port,
    adminKey: ctx.config.connection.adminKey,
  });

  if (action === 'list') {
    try {
      const result = await lmx.quantizeJobs(FAST_SLASH_REQUEST_OPTS);
      const lines: string[] = [kv('Jobs', String(result.count))];
      if (result.jobs.length === 0) {
        lines.push(chalk.dim('No quantization jobs found.'));
      } else {
        lines.push('');
        for (const job of result.jobs.slice(0, 20)) {
          const id = job.job_id ?? 'unknown';
          const status = (job.status ?? 'unknown').toLowerCase();
          const statusText = status === 'completed'
            ? chalk.green(status)
            : status === 'failed'
              ? chalk.red(status)
              : chalk.yellow(status);
          const source = job.source_model ?? 'unknown-model';
          lines.push(`  ${id}  ${statusText}  ${chalk.dim(source)}`);
        }
      }
      console.log('\n' + box('Quantize Jobs', lines));
    } catch (err) {
      console.error(chalk.red('\u2717') + ` Quantize jobs query failed: ${errorMessage(err)}`);
    }
    return 'handled';
  }

  if (action === 'status') {
    const jobId = tokens[startAt];
    if (!jobId || jobId.startsWith('--')) {
      console.log(chalk.dim('  Usage: /quantize status <job-id>'));
      return 'handled';
    }
    try {
      const job = asObject(await lmx.quantizeStatus(jobId, FAST_SLASH_REQUEST_OPTS));
      const lines: string[] = [
        kv('Job ID', readString(job, 'job_id') ?? jobId),
        kv('Status', readString(job, 'status') ?? 'unknown'),
        kv('Model', readString(job, 'source_model') ?? chalk.dim('(unknown)')),
        kv('Bits', String(readNumber(job, 'bits') ?? 'n/a')),
      ];
      const error = readString(job, 'error');
      if (error) lines.push(kv('Error', chalk.red(error)));
      const duration = readNumber(job, 'duration_sec');
      if (duration !== undefined) lines.push(kv('Duration', `${duration.toFixed(1)}s`));
      const outputPath = readString(job, 'output_path');
      if (outputPath) lines.push(kv('Output', outputPath));
      console.log('\n' + box('Quantize Status', lines));
    } catch (err) {
      console.error(chalk.red('\u2717') + ` Quantize status failed: ${errorMessage(err)}`);
    }
    return 'handled';
  }

  if (action === 'start') {
    const sourceModel = tokens[startAt];
    if (!sourceModel || sourceModel.startsWith('--')) {
      console.log(chalk.dim('  Usage: /quantize start <model-id> [--bits 4|8] [--group-size <n>] [--mode affine|symmetric] [--output <path>]'));
      return 'handled';
    }
    const request: {
      sourceModel: string;
      bits?: 4 | 8;
      groupSize?: number;
      mode?: 'affine' | 'symmetric';
      outputPath?: string;
    } = { sourceModel };
    const unknown: string[] = [];
    for (let i = startAt + 1; i < tokens.length; i += 1) {
      const token = tokens[i]!;
      if (!token.startsWith('--')) {
        unknown.push(token);
        continue;
      }
      if (token === '--bits') {
        const value = tokens[i + 1];
        if (!value) {
          console.log(chalk.dim('  Missing value for --bits'));
          return 'handled';
        }
        i += 1;
        if (value !== '4' && value !== '8') {
          console.log(chalk.yellow(`  Invalid --bits value: ${value}`));
          return 'handled';
        }
        request.bits = Number.parseInt(value, 10) as 4 | 8;
        continue;
      }
      if (token === '--group-size') {
        const value = tokens[i + 1];
        if (!value) {
          console.log(chalk.dim('  Missing value for --group-size'));
          return 'handled';
        }
        i += 1;
        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed) || parsed < 1) {
          console.log(chalk.yellow(`  Invalid --group-size value: ${value}`));
          return 'handled';
        }
        request.groupSize = parsed;
        continue;
      }
      if (token === '--mode') {
        const value = tokens[i + 1];
        if (!value) {
          console.log(chalk.dim('  Missing value for --mode'));
          return 'handled';
        }
        i += 1;
        if (value !== 'affine' && value !== 'symmetric') {
          console.log(chalk.yellow(`  Invalid --mode value: ${value}`));
          return 'handled';
        }
        request.mode = value;
        continue;
      }
      if (token === '--output') {
        const value = tokens[i + 1];
        if (!value) {
          console.log(chalk.dim('  Missing value for --output'));
          return 'handled';
        }
        i += 1;
        request.outputPath = value;
        continue;
      }
      unknown.push(token);
    }
    if (unknown.length > 0) {
      console.log(chalk.yellow(`  Unknown arguments: ${unknown.join(', ')}`));
      console.log(chalk.dim('  Usage: /quantize start <model-id> [--bits 4|8] [--group-size <n>] [--mode affine|symmetric] [--output <path>]'));
      return 'handled';
    }
    try {
      const started = await lmx.quantizeStart(request, {
        timeoutMs: 60_000,
        maxRetries: 0,
      });
      const lines = [
        kv('Job ID', started.job_id),
        kv('Model', started.source_model),
        kv('Bits', String(started.bits)),
        kv('Mode', started.mode),
        kv('Status', started.status),
      ];
      console.log('\n' + box('Quantize Started', lines));
      console.log(chalk.dim(`  Track progress: /quantize status ${started.job_id}`));
    } catch (err) {
      console.error(chalk.red('\u2717') + ` Quantize start failed: ${errorMessage(err)}`);
    }
    return 'handled';
  }

  console.log(chalk.dim('  Usage: /quantize [list|status <job-id>|start <model-id> [--bits 4|8] [--group-size <n>] [--mode affine|symmetric] [--output <path>]]'));
  return 'handled';
};
