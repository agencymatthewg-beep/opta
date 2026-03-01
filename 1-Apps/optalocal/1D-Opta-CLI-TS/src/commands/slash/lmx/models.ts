/**
 * LMX model interaction handlers: models, benchmark, embed, rerank, model-perf, agents, skills, rag.
 */

import chalk from 'chalk';
import { box, kv } from '../../../ui/box.js';
import { errorMessage } from '../../../utils/errors.js';
import { getDisplayProfile } from '../../../core/model-display.js';
import type { SlashContext, SlashResult } from '../types.js';
import {
  fmtTag,
  parseSlashArgs,
  renderJson,
  asObject,
  readString,
  readNumber,
  readArray,
  classifyOutcome,
} from './types.js';

export const modelsHandler = async (args: string, _ctx: SlashContext): Promise<SlashResult> => {
  const tokens = parseSlashArgs(args);
  const json = tokens.includes('--json');
  const positional = tokens.filter((token) => token !== '--json');
  const knownActions = new Set([
    'help',
    'list',
    'manage',
    'interactive',
    'ui',
    'use',
    'info',
    'load',
    'unload',
    'stop',
    'swap',
    'download',
    'delete',
    'remove',
    'benchmark',
    'bench',
    'predictor',
    'helpers',
    'quantize',
    'agents',
    'skills',
    'rag',
    'health',
    'scan',
    'browse',
    'browse-local',
    'library',
    'browse-library',
  ]);

  let action = positional[0]?.toLowerCase();
  let name: string | undefined;
  let extraArg: string | undefined;

  if (action && !knownActions.has(action)) {
    name = positional.join(' ');
    action = 'use';
  } else if (action === 'swap') {
    name = positional[1];
    extraArg = positional.slice(2).join(' ').trim() || undefined;
  } else {
    name = positional.slice(1).join(' ').trim() || undefined;
  }

  try {
    const { models } = await import('../../models/index.js');
    await models(action, name, extraArg, { json });
  } catch (err) {
    console.error(chalk.red('\u2717') + ` models command failed: ${errorMessage(err)}`);
  }

  return 'handled';
};

export const benchmarkHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  const tokens = parseSlashArgs(args);
  const first = tokens[0]?.toLowerCase();
  if (first === 'results') {
    const json = tokens.slice(1).includes('--json');
    const unknown = tokens.slice(1).filter((token) => token !== '--json');
    if (unknown.length > 0) {
      console.log(chalk.yellow(`  Unknown options: ${unknown.join(', ')}`));
      console.log(chalk.dim('  Usage: /benchmark results [--json]'));
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
      const listBenchmarkResults = (lmx as unknown as {
        listBenchmarkResults: () => Promise<unknown>;
      }).listBenchmarkResults;
      const payload = await listBenchmarkResults.call(lmx);

      if (json) {
        console.log(renderJson(payload));
        return 'handled';
      }

      const rows = Array.isArray(payload)
        ? payload
        : readArray(asObject(payload), 'results', 'rows', 'items');
      const lines: string[] = [kv('Stored Results', String(rows.length))];

      if (rows.length > 0) {
        lines.push('');
        for (const row of rows.slice(0, 20)) {
          const entry = asObject(row);
          const modelId = readString(entry, 'model_id', 'modelId') ?? '(unknown)';
          const backend = readString(entry, 'backend', 'backend_type', 'backendType') ?? 'unknown';
          const ts = readString(entry, 'timestamp', 'ts');
          const statusRaw = readString(entry, 'status');
          const status = classifyOutcome(statusRaw) === 'success'
            ? chalk.green(statusRaw ?? 'ok')
            : classifyOutcome(statusRaw) === 'failure'
              ? chalk.red(statusRaw ?? 'failed')
              : chalk.dim(statusRaw ?? 'unknown');
          const stats = asObject(entry.stats);
          const tokPerSec = readNumber(stats, 'toks_per_sec_mean', 'avg_tokens_per_second', 'tokens_per_second_mean')
            ?? readNumber(entry, 'avg_tokens_per_second', 'tokens_per_second');
          const ttftMs = readNumber(stats, 'ttft_ms_mean', 'avg_time_to_first_token_ms')
            ?? readNumber(entry, 'avg_time_to_first_token_ms');
          const perf = [
            tokPerSec !== undefined ? `${tokPerSec.toFixed(1)} tok/s` : undefined,
            ttftMs !== undefined ? `TTFT ${ttftMs.toFixed(0)}ms` : undefined,
          ].filter(Boolean).join(' \u00b7 ');
          const suffix = [chalk.dim(backend), status, perf ? chalk.dim(perf) : undefined]
            .filter(Boolean)
            .join(' \u00b7 ');
          lines.push(`  ${chalk.cyan(modelId)} ${suffix ? ` ${suffix}` : ''}`);
          if (ts) {
            lines.push(chalk.dim(`    ${ts}`));
          }
        }
        if (rows.length > 20) {
          lines.push(chalk.dim(`  \u2026 ${rows.length - 20} more`));
        }
      } else {
        lines.push(chalk.dim('No benchmark results recorded yet.'));
      }

      console.log('\n' + box('Benchmark Results', lines));
    } catch (err) {
      console.error(chalk.red('\u2717') + ` Benchmark results failed: ${errorMessage(err)}`);
    }
    return 'handled';
  }

  const modelId = tokens.join(' ').trim() || ctx.config.model.default;

  if (!modelId) {
    console.log(chalk.dim('  Usage: /benchmark <model-id>'));
    console.log(chalk.dim('  No model specified and no default set'));
    return 'handled';
  }

  const { LmxClient } = await import('../../../lmx/client.js');
  const lmx = new LmxClient({
    host: ctx.config.connection.host,
    fallbackHosts: ctx.config.connection.fallbackHosts,
    port: ctx.config.connection.port,
    adminKey: ctx.config.connection.adminKey,
  });

  console.log(chalk.dim(`  Benchmarking ${modelId} (3 runs \u00d7 128 tokens)...`));

  try {
    const result = await lmx.benchmarkModel(modelId);
    const dp = getDisplayProfile(result.modelId);

    const tpsColor = result.avgTokensPerSecond >= 30
      ? chalk.green
      : result.avgTokensPerSecond >= 10
      ? chalk.yellow
      : chalk.red;

    const lines: string[] = [
      kv('Model', `${chalk.bold(dp.displayName)} ${fmtTag(dp.format)} ${chalk.dim(dp.orgAbbrev)}`),
      kv('Backend', chalk.cyan(result.backendType)),
      '',
      kv('Avg tok/s', tpsColor(`${result.avgTokensPerSecond.toFixed(1)} tok/s`)),
      kv('Avg TTFT', `${result.avgTimeToFirstTokenMs.toFixed(0)} ms`),
      kv('Avg total', `${result.avgTotalTimeMs.toFixed(0)} ms`),
    ];

    if (result.results.length > 1) {
      lines.push('');
      lines.push(chalk.dim('Per-run:'));
      for (const r of result.results) {
        const bar = '\u25aa'.repeat(Math.min(20, Math.round(r.tokensPerSecond / 3)));
        lines.push(
          chalk.dim(`  Run ${r.run}  ${bar.padEnd(20)}`) +
          `  ${r.tokensPerSecond.toFixed(1)} tok/s` +
          chalk.dim(`  TTFT ${r.timeToFirstTokenMs.toFixed(0)}ms`)
        );
      }
    }

    console.log('\n' + box('Benchmark', lines));
  } catch (err) {
    console.error(chalk.red('\u2717') + ` Benchmark failed: ${errorMessage(err)}`);
    console.log(chalk.dim(`  Is "${modelId}" loaded? Run /scan to check`));
  }
  return 'handled';
};

export const embedHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  const tokens = parseSlashArgs(args);
  const positional: string[] = [];
  const unknown: string[] = [];
  let model: string | undefined;
  let json = false;

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]!;
    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }
    if (token === '--json') {
      json = true;
      continue;
    }
    if (token === '--model') {
      const value = tokens[i + 1];
      if (!value) {
        console.log(chalk.dim('  Missing value for --model'));
        console.log(chalk.dim('  Usage: /embed <text> [--model <id>] [--json]'));
        return 'handled';
      }
      model = value;
      i += 1;
      continue;
    }
    unknown.push(token);
  }

  if (unknown.length > 0 || positional.length === 0) {
    if (unknown.length > 0) {
      console.log(chalk.yellow(`  Unknown options: ${unknown.join(', ')}`));
    }
    console.log(chalk.dim('  Usage: /embed <text> [--model <id>] [--json]'));
    return 'handled';
  }

  const input = positional.join(' ').trim();
  if (!input) {
    console.log(chalk.dim('  Usage: /embed <text> [--model <id>] [--json]'));
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
    const request: { input: string; model?: string } = { input };
    if (model) request.model = model;

    const createEmbeddings = (lmx as unknown as {
      createEmbeddings: (payload: { input: string; model?: string }) => Promise<unknown>;
    }).createEmbeddings;
    const payload = await createEmbeddings.call(lmx, request);

    if (json) {
      console.log(renderJson(payload));
      return 'handled';
    }

    const response = asObject(payload);
    const vectors = readArray(response, 'data', 'embeddings', 'results');
    const first = asObject(vectors[0]);
    const embedding = Array.isArray(first.embedding) ? first.embedding : [];
    const usage = asObject(response.usage);
    const lines: string[] = [
      kv('Model', readString(response, 'model') ?? model ?? chalk.dim('(default)')),
      kv('Input Chars', String(input.length)),
      kv('Vectors', String(vectors.length)),
      kv('Dimensions', embedding.length > 0 ? String(embedding.length) : chalk.dim('(unknown)')),
    ];

    const promptTokens = readNumber(usage, 'prompt_tokens', 'promptTokens');
    if (promptTokens !== undefined) {
      lines.push(kv('Prompt Tokens', String(promptTokens)));
    }

    console.log('\n' + box('Embeddings', lines));
  } catch (err) {
    console.error(chalk.red('\u2717') + ` Embedding request failed: ${errorMessage(err)}`);
  }
  return 'handled';
};

export const rerankHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  const tokens = parseSlashArgs(args);
  const positional: string[] = [];
  const unknown: string[] = [];
  let model: string | undefined;
  let documentsRaw: string | undefined;
  let topK: number | undefined;
  let json = false;

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]!;
    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }
    if (token === '--json') {
      json = true;
      continue;
    }
    if (token === '--model') {
      const value = tokens[i + 1];
      if (!value) {
        console.log(chalk.dim('  Missing value for --model'));
        console.log(chalk.dim('  Usage: /rerank <query> --documents <doc1|doc2|...> [--model <id>] [--top-k <n>] [--json]'));
        return 'handled';
      }
      model = value;
      i += 1;
      continue;
    }
    if (token === '--documents') {
      const value = tokens[i + 1];
      if (!value) {
        console.log(chalk.dim('  Missing value for --documents'));
        console.log(chalk.dim('  Usage: /rerank <query> --documents <doc1|doc2|...> [--model <id>] [--top-k <n>] [--json]'));
        return 'handled';
      }
      documentsRaw = value;
      i += 1;
      continue;
    }
    if (token === '--top-k') {
      const value = tokens[i + 1];
      if (!value) {
        console.log(chalk.dim('  Missing value for --top-k'));
        console.log(chalk.dim('  Usage: /rerank <query> --documents <doc1|doc2|...> [--model <id>] [--top-k <n>] [--json]'));
        return 'handled';
      }
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 1) {
        console.log(chalk.yellow(`  Invalid --top-k value: ${value}`));
        console.log(chalk.dim('  Usage: /rerank <query> --documents <doc1|doc2|...> [--model <id>] [--top-k <n>] [--json]'));
        return 'handled';
      }
      topK = parsed;
      i += 1;
      continue;
    }
    unknown.push(token);
  }

  if (unknown.length > 0) {
    console.log(chalk.yellow(`  Unknown options: ${unknown.join(', ')}`));
    console.log(chalk.dim('  Usage: /rerank <query> --documents <doc1|doc2|...> [--model <id>] [--top-k <n>] [--json]'));
    return 'handled';
  }

  const query = positional.join(' ').trim();
  const documents = (documentsRaw ?? '')
    .split('|')
    .map((doc) => doc.trim())
    .filter((doc) => doc.length > 0);

  if (!query || documents.length === 0) {
    console.log(chalk.dim('  Usage: /rerank <query> --documents <doc1|doc2|...> [--model <id>] [--top-k <n>] [--json]'));
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
    const request: {
      query: string;
      documents: string[];
      model?: string;
      topK?: number;
    } = { query, documents };
    if (model) request.model = model;
    if (topK !== undefined) request.topK = topK;

    const rerankDocuments = (lmx as unknown as {
      rerankDocuments: (payload: {
        query: string;
        documents: string[];
        model?: string;
        topK?: number;
      }) => Promise<unknown>;
    }).rerankDocuments;
    const payload = await rerankDocuments.call(lmx, request);

    if (json) {
      console.log(renderJson(payload));
      return 'handled';
    }

    const response = asObject(payload);
    const results = readArray(response, 'results', 'data', 'items');
    const usage = asObject(response.usage);
    const lines: string[] = [
      kv('Model', readString(response, 'model') ?? model ?? chalk.dim('(default)')),
      kv('Documents', String(documents.length)),
      kv('Matches', String(results.length)),
      kv('Top K', topK === undefined ? chalk.dim('(default)') : String(topK)),
    ];

    const totalTokens = readNumber(usage, 'total_tokens', 'totalTokens');
    if (totalTokens !== undefined) {
      lines.push(kv('Total Tokens', String(totalTokens)));
    }

    if (results.length > 0) {
      lines.push('');
      lines.push(chalk.dim('Top matches:'));
      for (const raw of results.slice(0, 10)) {
        const row = asObject(raw);
        const idx = readNumber(row, 'index');
        const score = readNumber(row, 'relevance_score', 'relevanceScore', 'score');
        const doc = asObject(row.document);
        const text = readString(doc, 'text') ?? (idx !== undefined ? documents[idx] : undefined) ?? '';
        const preview = text.length > 80 ? `${text.slice(0, 77)}...` : text;
        const scoreLabel = score === undefined ? 'n/a' : score.toFixed(4);
        lines.push(`  [${idx ?? '?'}] ${scoreLabel} ${chalk.dim(preview)}`);
      }
    }

    console.log('\n' + box('Rerank Results', lines));
  } catch (err) {
    console.error(chalk.red('\u2717') + ` Rerank request failed: ${errorMessage(err)}`);
  }
  return 'handled';
};

const runModelsProxyAction = async (
  action: string,
  args: string,
  _ctx: SlashContext,
): Promise<void> => {
  const tokens = parseSlashArgs(args);
  const json = tokens.includes('--json');
  const forwarded = tokens.filter((token) => token !== '--json').join(' ').trim() || undefined;
  const { models } = await import('../../models/index.js');
  await models(action, forwarded, undefined, { json });
};

export const agentsHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  try {
    await runModelsProxyAction('agents', args, ctx);
  } catch (err) {
    console.error(chalk.red('\u2717') + ` agents command failed: ${errorMessage(err)}`);
  }
  return 'handled';
};

export const skillsHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  try {
    await runModelsProxyAction('skills', args, ctx);
  } catch (err) {
    console.error(chalk.red('\u2717') + ` skills command failed: ${errorMessage(err)}`);
  }
  return 'handled';
};

export const ragHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  try {
    await runModelsProxyAction('rag', args, ctx);
  } catch (err) {
    console.error(chalk.red('\u2717') + ` rag command failed: ${errorMessage(err)}`);
  }
  return 'handled';
};

export const modelPerfHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  const tokens = parseSlashArgs(args);
  const json = tokens.includes('--json');
  const positional = tokens.filter((token) => !token.startsWith('--'));
  const modelId = positional.join(' ').trim();

  if (!modelId) {
    console.log(chalk.dim('  Usage: /model-perf <model-id> [--json]'));
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
    const perf = await lmx.modelPerformance(modelId);

    if (json) {
      console.log(renderJson(perf));
      return 'handled';
    }

    const dp = getDisplayProfile(perf.modelId);
    const ctxK = perf.contextLength > 0
      ? `${Math.round(perf.contextLength / 1024)}K`
      : chalk.dim('(unknown)');

    const lines: string[] = [
      kv('Model', `${chalk.bold(dp.displayName)} ${fmtTag(dp.format)} ${chalk.dim(dp.orgAbbrev)}`),
      kv('Backend', chalk.cyan(perf.backendType)),
      kv('Context', ctxK),
      kv('Memory', `${perf.memoryGb.toFixed(1)} GB`),
      kv('Requests', String(perf.requestCount)),
      kv('Batching', perf.useBatching ? chalk.green('enabled') : chalk.dim('disabled')),
      kv('Loaded At', perf.loadedAt),
    ];

    if (perf.lastUsedAt) {
      lines.push(kv('Last Used', perf.lastUsedAt));
    }

    const overrideEntries = Object.entries(perf.performanceOverrides);
    if (overrideEntries.length > 0) {
      lines.push('');
      lines.push(chalk.dim('Performance Overrides:'));
      for (const [key, val] of overrideEntries) {
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        lines.push(`  ${kv(label, String(val))}`);
      }
    }

    console.log('\n' + box('Model Performance', lines));
  } catch (err) {
    console.error(chalk.red('\u2717') + ` Model performance failed: ${errorMessage(err)}`);
    console.log(chalk.dim(`  Is "${modelId}" loaded? Run /scan to check`));
  }
  return 'handled';
};
