/**
 * Extended model commands — predictor, helpers, quantize, agents, skills, rag, health.
 */

import chalk from 'chalk';
import { readFile } from 'node:fs/promises';
import { ExitError, EXIT } from '../../core/errors.js';
import type { LmxClient } from '../../lmx/client.js';
import {
  FAST_DISCOVERY_REQUEST_OPTS,
  FAST_DISCOVERY_TIMEOUT_MS,
  parseShellLikeArgs,
  parseJsonObjectOption,
  parseJsonValueOption,
  parseCsvList,
  readStdinText,
  streamSseEvents,
  throwModelCommandError,
  type ModelsOptions,
} from './types.js';

// ── Predictor ───────────────────────────────────────────────────────

export async function showPredictorStats(
  client: LmxClient,
  opts?: ModelsOptions,
): Promise<void> {
  const spinner = opts?.json ? null : await (await import('../../ui/spinner.js')).createSpinner();
  spinner?.start('Fetching predictor stats...');

  try {
    const stats = await client.predictorStats(FAST_DISCOVERY_REQUEST_OPTS);
    spinner?.stop();

    if (opts?.json) {
      console.log(JSON.stringify(stats, null, 2));
      return;
    }

    const predictedNext = (stats['predicted_next'] ?? stats['predictedNext']) as string | undefined;
    console.log(chalk.bold('Predictor Stats\n'));
    console.log(`  Predicted next: ${predictedNext ? chalk.cyan(predictedNext) : chalk.dim('(none)')}`);
    for (const [key, value] of Object.entries(stats)) {
      if (key === 'predicted_next' || key === 'predictedNext') continue;
      if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
        console.log(`  ${key}: ${String(value)}`);
      }
    }
  } catch (err) {
    spinner?.stop();
    throwModelCommandError(err);
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

export async function showHelpersHealth(
  client: LmxClient,
  opts?: ModelsOptions,
): Promise<void> {
  const spinner = opts?.json ? null : await (await import('../../ui/spinner.js')).createSpinner();
  spinner?.start('Checking helper-node health...');

  try {
    const payload = await client.helpersHealth(FAST_DISCOVERY_REQUEST_OPTS);
    spinner?.stop();

    if (opts?.json) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }

    const helpers = (payload.helpers ?? {}) as Record<string, Record<string, unknown>>;
    const liveChecks = (payload.live_checks ?? payload.liveChecks ?? {}) as Record<string, unknown>;

    console.log(chalk.bold('Helper Nodes\n'));
    console.log(`  Configured: ${payload.configured_count ?? Object.keys(helpers).length}`);
    console.log(`  All healthy: ${payload.all_healthy ? chalk.green('yes') : chalk.yellow('no')}`);

    if (Object.keys(helpers).length === 0) {
      console.log(chalk.dim('\n  No helper nodes configured'));
      return;
    }

    for (const [name, stats] of Object.entries(helpers)) {
      const healthy = Boolean(stats.healthy);
      const live = liveChecks[name];
      const avgLatencyMs = typeof stats.avg_latency_ms === 'number'
        ? `${stats.avg_latency_ms.toFixed(0)}ms`
        : null;
      const successRate = typeof stats.success_rate === 'number'
        ? `${(stats.success_rate * 100).toFixed(1)}%`
        : null;
      const meta = [avgLatencyMs, successRate, typeof live === 'boolean' ? `live:${live ? 'pass' : 'fail'}` : null]
        .filter(Boolean)
        .join(' · ');
      const badge = healthy ? chalk.green('healthy') : chalk.red('unhealthy');
      console.log(`  ${name.padEnd(10)} ${badge}${meta ? chalk.dim(` · ${meta}`) : ''}`);
    }
  } catch (err) {
    spinner?.stop();
    throwModelCommandError(err);
  }
}

// ── Quantize ────────────────────────────────────────────────────────

export async function runQuantizeCommand(
  args: string | undefined,
  client: LmxClient,
  opts?: ModelsOptions,
): Promise<void> {
  const tokens = parseShellLikeArgs(args ?? '');
  const action = (tokens[0] ?? 'list').toLowerCase();

  if (action === 'list') {
    const result = await client.quantizeJobs(FAST_DISCOVERY_REQUEST_OPTS);
    if (opts?.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    console.log(chalk.bold('Quantize Jobs\n'));
    if (result.jobs.length === 0) {
      console.log(chalk.dim('  No quantize jobs found'));
      return;
    }
    for (const job of result.jobs.slice(0, 30)) {
      const id = job.job_id ?? 'unknown';
      const status = String(job.status ?? 'unknown');
      const statusColor = status === 'completed'
        ? chalk.green
        : status === 'failed'
          ? chalk.red
          : chalk.yellow;
      console.log(`  ${id}  ${statusColor(status)}  ${chalk.dim(job.source_model ?? '')}`);
    }
    return;
  }

  if (action === 'status') {
    const jobId = tokens[1];
    if (!jobId) {
      console.error(chalk.red('✗') + ' Missing job id\n\n' + chalk.dim('Usage: opta models quantize status <job-id>'));
      throw new ExitError(EXIT.MISUSE);
    }
    const status = await client.quantizeStatus(jobId, FAST_DISCOVERY_REQUEST_OPTS);
    if (opts?.json) {
      console.log(JSON.stringify(status, null, 2));
      return;
    }
    console.log(chalk.bold('Quantize Status\n'));
    console.log(`  Job:      ${status.job_id ?? jobId}`);
    console.log(`  Status:   ${status.status ?? 'unknown'}`);
    if (status.source_model) console.log(`  Model:    ${status.source_model}`);
    if (typeof status.bits === 'number') console.log(`  Bits:     ${status.bits}`);
    if (typeof status.group_size === 'number') console.log(`  Group:    ${status.group_size}`);
    if (status.mode) console.log(`  Mode:     ${status.mode}`);
    if (status.output_path) console.log(`  Output:   ${status.output_path}`);
    if (typeof status.duration_sec === 'number') console.log(`  Duration: ${status.duration_sec.toFixed(1)}s`);
    if (status.error) console.log(chalk.red(`  Error:    ${status.error}`));
    return;
  }

  if (action === 'start') {
    const sourceModel = tokens[1];
    if (!sourceModel) {
      console.error(
        chalk.red('✗') + ' Missing source model\n\n' +
        chalk.dim('Usage: opta models quantize start <model-id> [--bits 4|8] [--group-size <n>] [--mode affine|symmetric] [--output <path>]'),
      );
      throw new ExitError(EXIT.MISUSE);
    }

    const request: {
      sourceModel: string;
      bits?: 4 | 8;
      groupSize?: number;
      mode?: 'affine' | 'symmetric';
      outputPath?: string;
    } = { sourceModel };

    const unknown: string[] = [];
    for (let i = 2; i < tokens.length; i += 1) {
      const token = tokens[i]!;
      if (!token.startsWith('--')) {
        unknown.push(token);
        continue;
      }
      if (token === '--bits') {
        const value = tokens[i + 1];
        if (!value || (value !== '4' && value !== '8')) {
          console.error(chalk.red('✗') + ' --bits must be 4 or 8');
          throw new ExitError(EXIT.MISUSE);
        }
        request.bits = Number.parseInt(value, 10) as 4 | 8;
        i += 1;
        continue;
      }
      if (token === '--group-size') {
        const value = tokens[i + 1];
        const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
        if (!Number.isFinite(parsed) || parsed < 1) {
          console.error(chalk.red('✗') + ' --group-size must be a positive integer');
          throw new ExitError(EXIT.MISUSE);
        }
        request.groupSize = parsed;
        i += 1;
        continue;
      }
      if (token === '--mode') {
        const value = tokens[i + 1];
        if (!value || (value !== 'affine' && value !== 'symmetric')) {
          console.error(chalk.red('✗') + ' --mode must be affine or symmetric');
          throw new ExitError(EXIT.MISUSE);
        }
        request.mode = value;
        i += 1;
        continue;
      }
      if (token === '--output') {
        const value = tokens[i + 1];
        if (!value) {
          console.error(chalk.red('✗') + ' Missing value for --output');
          throw new ExitError(EXIT.MISUSE);
        }
        request.outputPath = value;
        i += 1;
        continue;
      }
      unknown.push(token);
    }
    if (unknown.length > 0) {
      console.error(chalk.red('✗') + ` Unknown options: ${unknown.join(', ')}`);
      throw new ExitError(EXIT.MISUSE);
    }

    const spinner = opts?.json ? null : await (await import('../../ui/spinner.js')).createSpinner();
    spinner?.start(`Starting quantize job for ${sourceModel}...`);
    try {
      const started = await client.quantizeStart(request, {
        timeoutMs: 60_000,
        maxRetries: 0,
      });
      spinner?.succeed(`Quantize job started (${started.job_id})`);
      if (opts?.json) {
        console.log(JSON.stringify(started, null, 2));
      } else {
        console.log(chalk.dim(`  Track with ${chalk.reset(`opta models quantize status ${started.job_id}`)}`));
      }
      return;
    } catch (err) {
      spinner?.stop();
      throwModelCommandError(err);
    }
  }

  console.error(
    chalk.red('✗') + ` Unknown quantize action: ${action}\n\n` +
    chalk.dim('Usage: opta models quantize [list|status <job-id>|start <model-id> [--bits 4|8] [--group-size <n>] [--mode affine|symmetric] [--output <path>]]'),
  );
  throw new ExitError(EXIT.MISUSE);
}

// ── Agents ──────────────────────────────────────────────────────────

export async function runAgentsCommand(
  args: string | undefined,
  client: LmxClient,
  opts?: ModelsOptions,
  connection?: {
    host: string;
    fallbackHosts?: string[];
    port: number;
    adminKey?: string;
  },
): Promise<void> {
  const tokens = parseShellLikeArgs(args ?? '');
  const action = (tokens[0] ?? 'list').toLowerCase();

  if (action === 'list') {
    let limit = 20;
    let offset = 0;
    let status: string | undefined;

    for (let i = 1; i < tokens.length; i += 1) {
      const token = tokens[i]!;
      if (token === '--limit') {
        const value = tokens[i + 1];
        const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
        if (!Number.isFinite(parsed) || parsed < 1 || parsed > 200) {
          console.error(chalk.red('✗') + ' --limit must be between 1 and 200');
          throw new ExitError(EXIT.MISUSE);
        }
        limit = parsed;
        i += 1;
        continue;
      }
      if (token === '--offset') {
        const value = tokens[i + 1];
        const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
        if (!Number.isFinite(parsed) || parsed < 0) {
          console.error(chalk.red('✗') + ' --offset must be >= 0');
          throw new ExitError(EXIT.MISUSE);
        }
        offset = parsed;
        i += 1;
        continue;
      }
      if (token === '--status') {
        const value = tokens[i + 1];
        if (!value) {
          console.error(chalk.red('✗') + ' Missing value for --status');
          throw new ExitError(EXIT.MISUSE);
        }
        status = value;
        i += 1;
        continue;
      }
      console.error(chalk.red('✗') + ` Unknown option: ${token}`);
      throw new ExitError(EXIT.MISUSE);
    }

    const payload = await client.agentRuns({ limit, offset, status }, FAST_DISCOVERY_REQUEST_OPTS);
    if (opts?.json) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }

    const runs = Array.isArray(payload.data) ? payload.data : [];
    console.log(chalk.bold('Agent Runs\n'));
    console.log(`  Total: ${payload.total ?? runs.length}`);
    if (runs.length === 0) {
      console.log(chalk.dim('  No agent runs found.'));
      return;
    }
    for (const run of runs.slice(0, 30)) {
      const statusText = String(run.status ?? 'unknown');
      const color = statusText === 'completed'
        ? chalk.green
        : statusText === 'failed' || statusText === 'cancelled'
          ? chalk.red
          : chalk.yellow;
      const request = (run.request ?? {}) as Record<string, unknown>;
      const strategy = typeof request.strategy === 'string' ? request.strategy : 'unknown';
      const prompt = typeof request.prompt === 'string' ? request.prompt.replace(/\s+/g, ' ').trim() : '';
      console.log(`  ${run.id}  ${color(statusText)}  ${chalk.dim(strategy)}  ${prompt.slice(0, 72)}`);
    }
    return;
  }

  if (action === 'start' || action === 'create') {
    let prompt: string | undefined;
    let strategy: 'parallel_map' | 'router' | 'handoff' = 'handoff';
    let roles: string[] = ['default'];
    let model: string | undefined;
    let timeoutSec: number | undefined;
    let priority: 'interactive' | 'normal' | 'batch' = 'normal';
    let approvalRequired = false;
    let metadata: Record<string, unknown> = {};
    let idempotencyKey: string | undefined;

    for (let i = 1; i < tokens.length; i += 1) {
      const token = tokens[i]!;
      if (!token.startsWith('--') && prompt === undefined) {
        prompt = token;
        continue;
      }
      if (token === '--prompt') {
        const value = tokens[i + 1];
        if (!value) {
          console.error(chalk.red('✗') + ' Missing value for --prompt');
          throw new ExitError(EXIT.MISUSE);
        }
        prompt = value;
        i += 1;
        continue;
      }
      if (token === '--strategy') {
        const value = tokens[i + 1];
        if (!value || !['parallel_map', 'router', 'handoff'].includes(value)) {
          console.error(chalk.red('✗') + ' --strategy must be parallel_map, router, or handoff');
          throw new ExitError(EXIT.MISUSE);
        }
        strategy = value as 'parallel_map' | 'router' | 'handoff';
        i += 1;
        continue;
      }
      if (token === '--roles') {
        const value = tokens[i + 1];
        if (!value) {
          console.error(chalk.red('✗') + ' Missing value for --roles');
          throw new ExitError(EXIT.MISUSE);
        }
        const parsed = parseCsvList(value);
        if (parsed.length === 0) {
          console.error(chalk.red('✗') + ' --roles must contain at least one role');
          throw new ExitError(EXIT.MISUSE);
        }
        roles = parsed;
        i += 1;
        continue;
      }
      if (token === '--model') {
        const value = tokens[i + 1];
        if (!value) {
          console.error(chalk.red('✗') + ' Missing value for --model');
          throw new ExitError(EXIT.MISUSE);
        }
        model = value;
        i += 1;
        continue;
      }
      if (token === '--timeout') {
        const value = tokens[i + 1];
        const parsed = value ? Number.parseFloat(value) : Number.NaN;
        if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 3600) {
          console.error(chalk.red('✗') + ' --timeout must be > 0 and <= 3600 seconds');
          throw new ExitError(EXIT.MISUSE);
        }
        timeoutSec = parsed;
        i += 1;
        continue;
      }
      if (token === '--priority') {
        const value = tokens[i + 1];
        if (!value || !['interactive', 'normal', 'batch'].includes(value)) {
          console.error(chalk.red('✗') + ' --priority must be interactive, normal, or batch');
          throw new ExitError(EXIT.MISUSE);
        }
        priority = value as 'interactive' | 'normal' | 'batch';
        i += 1;
        continue;
      }
      if (token === '--metadata') {
        const value = tokens[i + 1];
        if (!value) {
          console.error(chalk.red('✗') + ' Missing value for --metadata');
          throw new ExitError(EXIT.MISUSE);
        }
        metadata = await parseJsonObjectOption(value, '--metadata');
        i += 1;
        continue;
      }
      if (token === '--approve' || token === '--approval-required') {
        approvalRequired = true;
        continue;
      }
      if (token === '--idempotency-key') {
        const value = tokens[i + 1];
        if (!value) {
          console.error(chalk.red('✗') + ' Missing value for --idempotency-key');
          throw new ExitError(EXIT.MISUSE);
        }
        idempotencyKey = value;
        i += 1;
        continue;
      }
      console.error(chalk.red('✗') + ` Unknown option: ${token}`);
      throw new ExitError(EXIT.MISUSE);
    }

    if (!prompt || !prompt.trim()) {
      console.error(
        chalk.red('✗') + ' Missing prompt\n\n' +
        chalk.dim('Usage: opta models agents start --prompt "<text>" [--roles <a,b>] [--strategy <parallel_map|router|handoff>] [--model <id>] [--timeout <sec>] [--priority <interactive|normal|batch>] [--metadata <json|@file>] [--approve] [--idempotency-key <key>]'),
      );
      throw new ExitError(EXIT.MISUSE);
    }

    const created = await client.createAgentRun(
      {
        request: {
          strategy,
          prompt: prompt.trim(),
          roles,
          model: model ?? 'auto',
          timeout_sec: timeoutSec,
          priority,
          metadata,
          approval_required: approvalRequired,
        },
      },
      {
        timeoutMs: Math.max(10_000, timeoutSec ? Math.round(timeoutSec * 1000) : 30_000),
        maxRetries: 0,
        idempotencyKey,
      },
    );

    if (opts?.json) {
      console.log(JSON.stringify(created, null, 2));
      return;
    }

    const request = (created.request ?? {}) as Record<string, unknown>;
    const requestRoles = Array.isArray(request.roles)
      ? request.roles.filter((value): value is string => typeof value === 'string')
      : roles;
    console.log(chalk.green('✓') + ` Agent run created: ${created.id}`);
    console.log(`  Status:   ${created.status}`);
    console.log(`  Strategy: ${String(request.strategy ?? strategy)}`);
    console.log(`  Roles:    ${requestRoles.join(', ')}`);
    if (created.error) console.log(chalk.red(`  Error:    ${created.error}`));
    console.log(chalk.dim(`  Watch:    opta models agents events ${created.id}`));
    return;
  }

  if (action === 'status') {
    const runId = tokens[1];
    if (!runId) {
      console.error(chalk.red('✗') + ' Missing run id\n\n' + chalk.dim('Usage: opta models agents status <run-id>'));
      throw new ExitError(EXIT.MISUSE);
    }
    const run = await client.agentRun(runId, FAST_DISCOVERY_REQUEST_OPTS);
    if (opts?.json) {
      console.log(JSON.stringify(run, null, 2));
      return;
    }
    const request = (run.request ?? {}) as Record<string, unknown>;
    const steps = Array.isArray(run.steps) ? run.steps : [];
    const roles = Array.isArray(request.roles)
      ? request.roles.filter((value): value is string => typeof value === 'string')
      : [];
    console.log(chalk.bold('Agent Run\n'));
    console.log(`  Run:      ${run.id}`);
    console.log(`  Status:   ${run.status}`);
    console.log(`  Strategy: ${typeof request.strategy === 'string' ? request.strategy : 'unknown'}`);
    console.log(`  Roles:    ${roles.length > 0 ? roles.join(', ') : '(none)'}`);
    if (run.error) console.log(chalk.red(`  Error:    ${run.error}`));
    if (steps.length > 0) {
      console.log('');
      for (const step of steps) {
        const role = typeof step.role === 'string' ? step.role : 'step';
        const stepStatus = typeof step.status === 'string' ? step.status : 'unknown';
        console.log(`  ${role.padEnd(12)} ${stepStatus}`);
      }
    }
    return;
  }

  if (action === 'events' || action === 'watch') {
    const runId = tokens[1];
    if (!runId) {
      console.error(chalk.red('✗') + ' Missing run id\n\n' + chalk.dim('Usage: opta models agents events <run-id> [--timeout <sec>] [--limit <n>]'));
      throw new ExitError(EXIT.MISUSE);
    }
    let timeoutSec = 30;
    let limit = 120;
    for (let i = 2; i < tokens.length; i += 1) {
      const token = tokens[i]!;
      if (token === '--timeout') {
        const value = tokens[i + 1];
        const parsed = value ? Number.parseFloat(value) : Number.NaN;
        if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 900) {
          console.error(chalk.red('✗') + ' --timeout must be > 0 and <= 900 seconds');
          throw new ExitError(EXIT.MISUSE);
        }
        timeoutSec = parsed;
        i += 1;
        continue;
      }
      if (token === '--limit') {
        const value = tokens[i + 1];
        const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
        if (!Number.isFinite(parsed) || parsed < 1 || parsed > 1000) {
          console.error(chalk.red('✗') + ' --limit must be between 1 and 1000');
          throw new ExitError(EXIT.MISUSE);
        }
        limit = parsed;
        i += 1;
        continue;
      }
      console.error(chalk.red('✗') + ` Unknown option: ${token}`);
      throw new ExitError(EXIT.MISUSE);
    }

    const activeHost = client.getActiveHost();
    const host = activeHost || connection?.host || 'localhost';
    const port = connection?.port ?? 11434;
    const headers: Record<string, string> = {};
    const adminKey = connection?.adminKey?.trim();
    if (adminKey) headers['X-Admin-Key'] = adminKey;
    const url = `http://${host}:${port}/v1/agents/runs/${encodeURIComponent(runId)}/events`;
    const streamed = await streamSseEvents(url, headers, Math.round(timeoutSec * 1000));
    const events = streamed.events.slice(0, limit);

    if (opts?.json) {
      console.log(JSON.stringify({
        run_id: runId,
        host,
        timed_out: streamed.timedOut,
        events,
      }, null, 2));
      return;
    }

    console.log(chalk.bold(`Agent Events · ${runId}\n`));
    if (events.length === 0) {
      console.log(chalk.dim('  No events received yet.'));
      if (streamed.timedOut) {
        console.log(chalk.dim(`  Timed out after ${timeoutSec}s.`));
      }
      return;
    }

    for (const entry of events) {
      if (entry.data === '[DONE]') continue;
      let rendered = entry.data;
      try {
        const parsed = JSON.parse(entry.data) as Record<string, unknown>;
        const type = typeof parsed.type === 'string' ? parsed.type : entry.event;
        if (type === 'run.update' || type === 'run.completed') {
          const run = parsed.run as Record<string, unknown> | undefined;
          const status = run && typeof run.status === 'string' ? run.status : 'unknown';
          const runIdFromEvent = run && typeof run.id === 'string' ? run.id : runId;
          rendered = `${type} · ${runIdFromEvent} · ${status}`;
        } else if (type === 'run.error') {
          rendered = `${type} · ${String(parsed.error ?? 'unknown error')}`;
        } else {
          rendered = `${type} · ${entry.data.slice(0, 160)}`;
        }
      } catch {
        rendered = `${entry.event} · ${entry.data.slice(0, 160)}`;
      }
      console.log(`  ${rendered}`);
    }
    if (streamed.timedOut) {
      console.log(chalk.dim(`\n  Stream timed out after ${timeoutSec}s. Re-run to continue following events.`));
    }
    return;
  }

  if (action === 'cancel') {
    const runId = tokens[1];
    if (!runId) {
      console.error(chalk.red('✗') + ' Missing run id\n\n' + chalk.dim('Usage: opta models agents cancel <run-id>'));
      throw new ExitError(EXIT.MISUSE);
    }
    const cancelled = await client.cancelAgentRun(runId, FAST_DISCOVERY_REQUEST_OPTS);
    if (opts?.json) {
      console.log(JSON.stringify(cancelled, null, 2));
      return;
    }
    console.log(chalk.green('✓') + ` Agent run ${cancelled.id} status: ${cancelled.status}`);
    if (cancelled.error) {
      console.log(chalk.dim(`  ${cancelled.error}`));
    }
    return;
  }

  console.error(
    chalk.red('✗') + ` Unknown agents action: ${action}\n\n` +
    chalk.dim('Usage: opta models agents [list|start|status <run-id>|events <run-id>|cancel <run-id>] [--limit <n>] [--offset <n>] [--status <state>]'),
  );
  throw new ExitError(EXIT.MISUSE);
}

// ── Skills ──────────────────────────────────────────────────────────

export async function runSkillsCommand(
  args: string | undefined,
  client: LmxClient,
  opts?: ModelsOptions,
): Promise<void> {
  const tokens = parseShellLikeArgs(args ?? '');
  const action = (tokens[0] ?? 'list').toLowerCase();

  if (action === 'list') {
    let latestOnly = true;
    for (let i = 1; i < tokens.length; i += 1) {
      const token = tokens[i]!;
      if (token === '--all') {
        latestOnly = false;
        continue;
      }
      console.error(chalk.red('✗') + ` Unknown option: ${token}`);
      throw new ExitError(EXIT.MISUSE);
    }
    const payload = await client.skillsList({ latestOnly }, FAST_DISCOVERY_REQUEST_OPTS);
    if (opts?.json) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }
    const rows = Array.isArray(payload.data) ? payload.data : [];
    console.log(chalk.bold('Skills Registry\n'));
    console.log(`  Count: ${rows.length}`);
    if (rows.length === 0) {
      console.log(chalk.dim('  No skills registered.'));
      return;
    }
    for (const skill of rows.slice(0, 50)) {
      const reference = skill.reference ?? skill.name ?? 'unknown';
      const kind = skill.kind ?? 'unknown';
      const version = skill.version ?? '';
      const suffix = version ? chalk.dim(` v${version}`) : '';
      console.log(`  ${chalk.cyan(reference)}  ${chalk.dim(kind)}${suffix}`);
    }
    return;
  }

  if (action === 'show' || action === 'get') {
    const skillName = tokens[1];
    if (!skillName) {
      console.error(chalk.red('✗') + ' Missing skill name\n\n' + chalk.dim('Usage: opta models skills show <skill-name>'));
      throw new ExitError(EXIT.MISUSE);
    }
    const payload = await client.skillDetail(skillName, FAST_DISCOVERY_REQUEST_OPTS);
    if (opts?.json) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }
    console.log(chalk.bold('Skill Detail\n'));
    console.log(`  Name:        ${payload.name ?? skillName}`);
    console.log(`  Reference:   ${payload.reference ?? payload.qualified_name ?? skillName}`);
    console.log(`  Kind:        ${payload.kind ?? 'unknown'}`);
    console.log(`  Version:     ${payload.version ?? 'unknown'}`);
    console.log(`  Namespace:   ${payload.namespace ?? 'default'}`);
    console.log(`  Description: ${payload.description ?? '(none)'}`);
    return;
  }

  if (action === 'tools') {
    const payload = await client.skillMcpTools(FAST_DISCOVERY_REQUEST_OPTS);
    if (opts?.json) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }
    const tools = Array.isArray(payload.tools) ? payload.tools : [];
    console.log(chalk.bold('MCP Tools\n'));
    console.log(`  Count: ${tools.length}`);
    if (tools.length === 0) {
      console.log(chalk.dim('  No MCP tools available.'));
      return;
    }
    for (const tool of tools.slice(0, 50)) {
      const description = typeof tool.description === 'string' ? tool.description : '';
      console.log(`  ${chalk.cyan(tool.name)} ${description ? chalk.dim(`- ${description}`) : ''}`);
    }
    return;
  }

  if (action === 'run' || action === 'execute') {
    const skillName = tokens[1];
    if (!skillName) {
      console.error(chalk.red('✗') + ' Missing skill name\n\n' + chalk.dim('Usage: opta models skills run <skill-name> [--args <json|@file>] [--approve] [--timeout <sec>]'));
      throw new ExitError(EXIT.MISUSE);
    }
    let approved = false;
    let timeoutSec: number | undefined;
    let argumentsPayload: Record<string, unknown> = {};
    for (let i = 2; i < tokens.length; i += 1) {
      const token = tokens[i]!;
      if (token === '--approve') {
        approved = true;
        continue;
      }
      if (token === '--timeout') {
        const value = tokens[i + 1];
        const parsed = value ? Number.parseFloat(value) : Number.NaN;
        if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 600) {
          console.error(chalk.red('✗') + ' --timeout must be > 0 and <= 600 seconds');
          throw new ExitError(EXIT.MISUSE);
        }
        timeoutSec = parsed;
        i += 1;
        continue;
      }
      if (token === '--args') {
        const value = tokens[i + 1];
        if (!value) {
          console.error(chalk.red('✗') + ' Missing value for --args');
          throw new ExitError(EXIT.MISUSE);
        }
        argumentsPayload = await parseJsonObjectOption(value, '--args');
        i += 1;
        continue;
      }
      console.error(chalk.red('✗') + ` Unknown option: ${token}`);
      throw new ExitError(EXIT.MISUSE);
    }

    const payload = await client.skillExecute(
      skillName,
      {
        arguments: argumentsPayload,
        approved,
        timeoutSec,
      },
      { timeoutMs: Math.max(10_000, timeoutSec ? Math.round(timeoutSec * 1000) : 30_000), maxRetries: 0 },
    );

    if (opts?.json) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }

    const ok = payload.ok === true;
    console.log((ok ? chalk.green('✓') : chalk.red('✗')) + ` Skill ${skillName} ${ok ? 'completed' : 'failed'}`);
    if (payload.error) {
      console.log(chalk.red(`  Error: ${payload.error}`));
    }
    if (payload.output !== undefined) {
      const rendered = typeof payload.output === 'string'
        ? payload.output
        : JSON.stringify(payload.output, null, 2);
      console.log(chalk.dim(`  Output: ${rendered.slice(0, 320)}`));
    }
    return;
  }

  if (action === 'mcp-call' || action === 'mcp' || action === 'call') {
    const toolName = tokens[1];
    if (!toolName) {
      console.error(chalk.red('✗') + ' Missing tool name\n\n' + chalk.dim('Usage: opta models skills mcp-call <tool-name> [--args <json|@file>] [--approve]'));
      throw new ExitError(EXIT.MISUSE);
    }
    let approved = false;
    let argumentsPayload: Record<string, unknown> = {};
    for (let i = 2; i < tokens.length; i += 1) {
      const token = tokens[i]!;
      if (token === '--approve') {
        approved = true;
        continue;
      }
      if (token === '--args') {
        const value = tokens[i + 1];
        if (!value) {
          console.error(chalk.red('✗') + ' Missing value for --args');
          throw new ExitError(EXIT.MISUSE);
        }
        argumentsPayload = await parseJsonObjectOption(value, '--args');
        i += 1;
        continue;
      }
      console.error(chalk.red('✗') + ` Unknown option: ${token}`);
      throw new ExitError(EXIT.MISUSE);
    }

    const payload = await client.skillMcpCall(
      { name: toolName, arguments: argumentsPayload, approved },
      { timeoutMs: 30_000, maxRetries: 0 },
    );

    if (opts?.json) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }
    const ok = payload.ok === true;
    console.log((ok ? chalk.green('✓') : chalk.red('✗')) + ` MCP tool ${toolName} ${ok ? 'completed' : 'failed'}`);
    if (payload.error) console.log(chalk.red(`  Error: ${payload.error}`));
    return;
  }

  if (action === 'openclaw' || action === 'invoke') {
    const toolName = tokens[1];
    if (!toolName) {
      console.error(chalk.red('✗') + ' Missing tool name\n\n' + chalk.dim('Usage: opta models skills openclaw <tool-name> [--args <json|@file>] [--approve] [--timeout <sec>]'));
      throw new ExitError(EXIT.MISUSE);
    }
    let approved = false;
    let timeoutSec: number | undefined;
    let argumentsPayload: Record<string, unknown> = {};
    for (let i = 2; i < tokens.length; i += 1) {
      const token = tokens[i]!;
      if (token === '--approve') {
        approved = true;
        continue;
      }
      if (token === '--timeout') {
        const value = tokens[i + 1];
        const parsed = value ? Number.parseFloat(value) : Number.NaN;
        if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 600) {
          console.error(chalk.red('✗') + ' --timeout must be > 0 and <= 600 seconds');
          throw new ExitError(EXIT.MISUSE);
        }
        timeoutSec = parsed;
        i += 1;
        continue;
      }
      if (token === '--args') {
        const value = tokens[i + 1];
        if (!value) {
          console.error(chalk.red('✗') + ' Missing value for --args');
          throw new ExitError(EXIT.MISUSE);
        }
        argumentsPayload = await parseJsonObjectOption(value, '--args');
        i += 1;
        continue;
      }
      console.error(chalk.red('✗') + ` Unknown option: ${token}`);
      throw new ExitError(EXIT.MISUSE);
    }

    const payload = await client.skillOpenClawInvoke(
      {
        name: toolName,
        arguments: argumentsPayload,
        approved,
        timeoutSec,
      },
      { timeoutMs: Math.max(10_000, timeoutSec ? Math.round(timeoutSec * 1000) : 30_000), maxRetries: 0 },
    );

    if (opts?.json) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }
    const ok = payload.ok === true;
    console.log((ok ? chalk.green('✓') : chalk.red('✗')) + ` OpenClaw invoke ${toolName} ${ok ? 'completed' : 'failed'}`);
    if (payload.error) console.log(chalk.red(`  Error: ${payload.error}`));
    return;
  }

  console.error(
    chalk.red('✗') + ` Unknown skills action: ${action}\n\n` +
    chalk.dim('Usage: opta models skills [list|show <skill-name>|tools|run <skill-name>|mcp-call <tool-name>|openclaw <tool-name>] [--all]'),
  );
  throw new ExitError(EXIT.MISUSE);
}

// ── RAG ─────────────────────────────────────────────────────────────

export async function runRagCommand(
  args: string | undefined,
  client: LmxClient,
  opts?: ModelsOptions,
): Promise<void> {
  const tokens = parseShellLikeArgs(args ?? '');
  const action = (tokens[0] ?? 'collections').toLowerCase();

  if (action === 'collections' || action === 'list') {
    const payload = await client.ragCollections(FAST_DISCOVERY_REQUEST_OPTS);
    if (opts?.json) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }
    console.log(chalk.bold('RAG Collections\n'));
    console.log(`  Collections: ${payload.collection_count}`);
    console.log(`  Documents:   ${payload.total_documents}`);
    if (payload.collections.length === 0) {
      console.log(chalk.dim('  No collections found.'));
      return;
    }
    for (const collection of payload.collections) {
      console.log(
        `  ${chalk.cyan(collection.name)}  ${chalk.dim(`${collection.document_count} docs · ${collection.embedding_dimensions} dims`)}`,
      );
    }
    return;
  }

  if (action === 'delete') {
    const collection = tokens[1];
    if (!collection) {
      console.error(chalk.red('✗') + ' Missing collection name\n\n' + chalk.dim('Usage: opta models rag delete <collection>'));
      throw new ExitError(EXIT.MISUSE);
    }
    await client.ragDeleteCollection(collection, FAST_DISCOVERY_REQUEST_OPTS);
    if (opts?.json) {
      console.log(JSON.stringify({ ok: true, deleted: collection }, null, 2));
    } else {
      console.log(chalk.green('✓') + ` Deleted collection ${chalk.cyan(collection)}`);
    }
    return;
  }

  if (action === 'query') {
    const collection = tokens[1];
    const query = tokens[2];
    if (!collection || !query) {
      console.error(
        chalk.red('✗') + ' Missing query arguments\n\n' +
        chalk.dim('Usage: opta models rag query <collection> "<query>" [--top-k <n>] [--min-score <n>] [--mode vector|keyword|hybrid] [--rerank]'),
      );
      throw new ExitError(EXIT.MISUSE);
    }
    let topK: number | undefined;
    let minScore: number | undefined;
    let searchMode: 'vector' | 'keyword' | 'hybrid' | undefined;
    let rerank = false;
    for (let i = 3; i < tokens.length; i += 1) {
      const token = tokens[i]!;
      if (token === '--top-k') {
        const value = tokens[i + 1];
        const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
        if (!Number.isFinite(parsed) || parsed < 1 || parsed > 50) {
          console.error(chalk.red('✗') + ' --top-k must be between 1 and 50');
          throw new ExitError(EXIT.MISUSE);
        }
        topK = parsed;
        i += 1;
        continue;
      }
      if (token === '--min-score') {
        const value = tokens[i + 1];
        const parsed = value ? Number.parseFloat(value) : Number.NaN;
        if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
          console.error(chalk.red('✗') + ' --min-score must be between 0 and 1');
          throw new ExitError(EXIT.MISUSE);
        }
        minScore = parsed;
        i += 1;
        continue;
      }
      if (token === '--mode') {
        const value = tokens[i + 1];
        if (!value || !['vector', 'keyword', 'hybrid'].includes(value)) {
          console.error(chalk.red('✗') + ' --mode must be vector, keyword, or hybrid');
          throw new ExitError(EXIT.MISUSE);
        }
        searchMode = value as 'vector' | 'keyword' | 'hybrid';
        i += 1;
        continue;
      }
      if (token === '--rerank') {
        rerank = true;
        continue;
      }
      console.error(chalk.red('✗') + ` Unknown option: ${token}`);
      throw new ExitError(EXIT.MISUSE);
    }
    const payload = await client.ragQuery(
      {
        collection,
        query,
        topK,
        minScore,
        searchMode,
        rerank,
      },
      { timeoutMs: 30_000, maxRetries: 0 },
    );
    if (opts?.json) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }
    const results = Array.isArray(payload.results) ? payload.results : [];
    console.log(chalk.bold('RAG Query\n'));
    console.log(`  Collection: ${payload.collection ?? collection}`);
    console.log(`  Query:      ${payload.query ?? query}`);
    console.log(`  Results:    ${results.length}`);
    if (results.length === 0) {
      console.log(chalk.dim('  No matches found.'));
      return;
    }
    for (const row of results.slice(0, 8)) {
      const text = typeof row.text === 'string' ? row.text.replace(/\s+/g, ' ').trim() : '';
      const score = typeof row.score === 'number' ? row.score.toFixed(3) : 'n/a';
      console.log(`  score=${score}  ${text.slice(0, 110)}`);
    }
    return;
  }

  if (action === 'ingest') {
    const collection = tokens[1];
    if (!collection) {
      console.error(
        chalk.red('✗') + ' Missing collection name\n\n' +
        chalk.dim('Usage: opta models rag ingest <collection> (--file <path> | --text "<content>" | --stdin) [--metadata <json|@file>] [--chunking <auto|text|code|markdown_headers|none>] [--chunk-size <n>] [--chunk-overlap <n>] [--model <id>]'),
      );
      throw new ExitError(EXIT.MISUSE);
    }

    let filePath: string | undefined;
    let inlineText: string | undefined;
    let useStdin = false;
    let metadataRaw: unknown;
    let chunking: 'auto' | 'text' | 'code' | 'markdown_headers' | 'none' | undefined;
    let chunkSize: number | undefined;
    let chunkOverlap: number | undefined;
    let model: string | undefined;

    for (let i = 2; i < tokens.length; i += 1) {
      const token = tokens[i]!;
      if (token === '--file') {
        const value = tokens[i + 1];
        if (!value) {
          console.error(chalk.red('✗') + ' Missing value for --file');
          throw new ExitError(EXIT.MISUSE);
        }
        filePath = value;
        i += 1;
        continue;
      }
      if (token === '--text') {
        const value = tokens[i + 1];
        if (!value) {
          console.error(chalk.red('✗') + ' Missing value for --text');
          throw new ExitError(EXIT.MISUSE);
        }
        inlineText = value;
        i += 1;
        continue;
      }
      if (token === '--stdin') {
        useStdin = true;
        continue;
      }
      if (token === '--metadata') {
        const value = tokens[i + 1];
        if (!value) {
          console.error(chalk.red('✗') + ' Missing value for --metadata');
          throw new ExitError(EXIT.MISUSE);
        }
        metadataRaw = await parseJsonValueOption(value, '--metadata');
        i += 1;
        continue;
      }
      if (token === '--chunking') {
        const value = tokens[i + 1];
        if (!value || !['auto', 'text', 'code', 'markdown_headers', 'none'].includes(value)) {
          console.error(chalk.red('✗') + ' --chunking must be auto, text, code, markdown_headers, or none');
          throw new ExitError(EXIT.MISUSE);
        }
        chunking = value as 'auto' | 'text' | 'code' | 'markdown_headers' | 'none';
        i += 1;
        continue;
      }
      if (token === '--chunk-size') {
        const value = tokens[i + 1];
        const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
        if (!Number.isFinite(parsed) || parsed < 64 || parsed > 2048) {
          console.error(chalk.red('✗') + ' --chunk-size must be between 64 and 2048');
          throw new ExitError(EXIT.MISUSE);
        }
        chunkSize = parsed;
        i += 1;
        continue;
      }
      if (token === '--chunk-overlap') {
        const value = tokens[i + 1];
        const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
        if (!Number.isFinite(parsed) || parsed < 0 || parsed > 512) {
          console.error(chalk.red('✗') + ' --chunk-overlap must be between 0 and 512');
          throw new ExitError(EXIT.MISUSE);
        }
        chunkOverlap = parsed;
        i += 1;
        continue;
      }
      if (token === '--model') {
        const value = tokens[i + 1];
        if (!value) {
          console.error(chalk.red('✗') + ' Missing value for --model');
          throw new ExitError(EXIT.MISUSE);
        }
        model = value;
        i += 1;
        continue;
      }
      console.error(chalk.red('✗') + ` Unknown option: ${token}`);
      throw new ExitError(EXIT.MISUSE);
    }

    const inputModes = [Boolean(filePath), Boolean(inlineText), useStdin].filter(Boolean).length;
    if (inputModes !== 1) {
      console.error(chalk.red('✗') + ' Specify exactly one of --file, --text, or --stdin');
      throw new ExitError(EXIT.MISUSE);
    }

    let documentText = '';
    if (filePath) {
      documentText = await readFile(filePath, 'utf8');
    } else if (inlineText) {
      documentText = inlineText;
    } else if (useStdin) {
      documentText = await readStdinText();
    }
    if (!documentText.trim()) {
      console.error(chalk.red('✗') + ' Ingest content is empty');
      throw new ExitError(EXIT.MISUSE);
    }

    let metadata: Array<Record<string, unknown>> | undefined;
    if (metadataRaw !== undefined) {
      if (Array.isArray(metadataRaw)) {
        const rows = metadataRaw.filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value));
        if (rows.length === 0) {
          console.error(chalk.red('✗') + ' --metadata array must contain at least one object');
          throw new ExitError(EXIT.MISUSE);
        }
        metadata = rows;
      } else if (metadataRaw && typeof metadataRaw === 'object') {
        metadata = [metadataRaw as Record<string, unknown>];
      } else {
        console.error(chalk.red('✗') + ' --metadata must be a JSON object or an array of objects');
        throw new ExitError(EXIT.MISUSE);
      }
    }

    const payload = await client.ragIngest(
      {
        collection,
        documents: [documentText],
        metadata,
        chunking,
        chunkSize,
        chunkOverlap,
        model,
      },
      { timeoutMs: 60_000, maxRetries: 0 },
    );

    if (opts?.json) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }

    console.log(chalk.green('✓') + ` Ingested into ${chalk.cyan(collection)}`);
    console.log(`  Documents: ${payload.documents_ingested ?? 0}`);
    console.log(`  Chunks:    ${payload.chunks_created ?? 0}`);
    if (payload.duration_ms !== undefined) {
      console.log(`  Duration:  ${payload.duration_ms.toFixed(1)} ms`);
    }
    return;
  }

  if (action === 'context') {
    const query = tokens[1];
    if (!query) {
      console.error(
        chalk.red('✗') + ' Missing query text\n\n' +
        chalk.dim('Usage: opta models rag context "<query>" --collections <c1,c2> [--top-k-per-collection <n>] [--min-score <n>] [--max-context-tokens <n>] [--model <id>] [--rerank]'),
      );
      throw new ExitError(EXIT.MISUSE);
    }
    let collections: string[] = [];
    let topKPerCollection: number | undefined;
    let minScore: number | undefined;
    let maxContextTokens: number | undefined;
    let model: string | undefined;
    let rerank = false;

    for (let i = 2; i < tokens.length; i += 1) {
      const token = tokens[i]!;
      if (token === '--collections') {
        const value = tokens[i + 1];
        if (!value) {
          console.error(chalk.red('✗') + ' Missing value for --collections');
          throw new ExitError(EXIT.MISUSE);
        }
        collections = parseCsvList(value);
        i += 1;
        continue;
      }
      if (token === '--top-k-per-collection') {
        const value = tokens[i + 1];
        const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
        if (!Number.isFinite(parsed) || parsed < 1 || parsed > 20) {
          console.error(chalk.red('✗') + ' --top-k-per-collection must be between 1 and 20');
          throw new ExitError(EXIT.MISUSE);
        }
        topKPerCollection = parsed;
        i += 1;
        continue;
      }
      if (token === '--min-score') {
        const value = tokens[i + 1];
        const parsed = value ? Number.parseFloat(value) : Number.NaN;
        if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
          console.error(chalk.red('✗') + ' --min-score must be between 0 and 1');
          throw new ExitError(EXIT.MISUSE);
        }
        minScore = parsed;
        i += 1;
        continue;
      }
      if (token === '--max-context-tokens') {
        const value = tokens[i + 1];
        const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
        if (!Number.isFinite(parsed) || parsed < 256 || parsed > 32768) {
          console.error(chalk.red('✗') + ' --max-context-tokens must be between 256 and 32768');
          throw new ExitError(EXIT.MISUSE);
        }
        maxContextTokens = parsed;
        i += 1;
        continue;
      }
      if (token === '--model') {
        const value = tokens[i + 1];
        if (!value) {
          console.error(chalk.red('✗') + ' Missing value for --model');
          throw new ExitError(EXIT.MISUSE);
        }
        model = value;
        i += 1;
        continue;
      }
      if (token === '--rerank') {
        rerank = true;
        continue;
      }
      console.error(chalk.red('✗') + ` Unknown option: ${token}`);
      throw new ExitError(EXIT.MISUSE);
    }

    if (collections.length === 0) {
      console.error(chalk.red('✗') + ' --collections is required for rag context');
      throw new ExitError(EXIT.MISUSE);
    }

    const payload = await client.ragContext(
      {
        query,
        collections,
        topKPerCollection,
        minScore,
        maxContextTokens,
        model,
        rerank,
      },
      { timeoutMs: 60_000, maxRetries: 0 },
    );

    if (opts?.json) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }

    console.log(chalk.bold('RAG Context\n'));
    console.log(`  Chunks:  ${payload.total_chunks ?? 0}`);
    console.log(`  Tokens:  ${payload.estimated_tokens ?? 0}`);
    if (payload.duration_ms !== undefined) {
      console.log(`  Time:    ${payload.duration_ms.toFixed(1)} ms`);
    }
    console.log('');
    const contextPreview = (payload.context ?? '').trim();
    if (!contextPreview) {
      console.log(chalk.dim('  No context assembled.'));
    } else {
      console.log(contextPreview.slice(0, 1200));
      if (contextPreview.length > 1200) {
        console.log(chalk.dim('\n  …truncated…'));
      }
    }
    return;
  }

  console.error(
    chalk.red('✗') + ` Unknown rag action: ${action}\n\n` +
    chalk.dim('Usage: opta models rag [collections|delete <collection>|query <collection> "<query>" [--top-k <n>] [--min-score <n>] [--mode vector|keyword|hybrid] [--rerank]|ingest <collection> (--file <path>|--text "<content>"|--stdin)|context "<query>" --collections <c1,c2>]'),
  );
  throw new ExitError(EXIT.MISUSE);
}

// ── Health ──────────────────────────────────────────────────────────

export async function runHealthCommand(
  args: string | undefined,
  client: LmxClient,
  opts?: ModelsOptions,
  connection?: {
    host: string;
    fallbackHosts?: string[];
    port: number;
    adminKey?: string;
  },
): Promise<void> {
  const tokens = parseShellLikeArgs(args ?? '');
  let includeReady = false;
  let includeAdmin = false;
  for (const token of tokens) {
    if (token === '--ready') {
      includeReady = true;
      continue;
    }
    if (token === '--admin') {
      includeAdmin = true;
      continue;
    }
    console.error(chalk.red('✗') + ` Unknown option: ${token}`);
    throw new ExitError(EXIT.MISUSE);
  }
  if (!includeReady && !includeAdmin) {
    includeReady = true;
    includeAdmin = true;
  }

  const liveness = await client.health(FAST_DISCOVERY_REQUEST_OPTS);
  const host = client.getActiveHost() || connection?.host || 'localhost';
  const port = connection?.port ?? 11434;
  const headers: Record<string, string> = {};
  const adminKey = connection?.adminKey?.trim();
  if (adminKey) {
    headers['X-Admin-Key'] = adminKey;
  }

  const fetchJsonProbe = async (
    path: string,
    acceptedStatuses: number[],
    authRequired: boolean,
  ): Promise<{ status: number; body: unknown }> => {
    const response = await fetch(`http://${host}:${port}${path}`, {
      method: 'GET',
      headers: authRequired ? headers : {},
      signal: AbortSignal.timeout(FAST_DISCOVERY_TIMEOUT_MS),
    });
    const text = await response.text().catch(() => '');
    let body: unknown = text;
    if (text.trim()) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    if (!acceptedStatuses.includes(response.status)) {
      const detail = typeof body === 'string' ? body : JSON.stringify(body);
      throw new Error(`${path} returned HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
    }
    return { status: response.status, body };
  };

  const ready = includeReady ? await fetchJsonProbe('/readyz', [200, 503], false) : undefined;
  const admin = includeAdmin ? await fetchJsonProbe('/admin/health', [200], true) : undefined;

  if (opts?.json) {
    console.log(JSON.stringify({
      host,
      port,
      liveness,
      ready,
      admin,
    }, null, 2));
    return;
  }

  const readyStatus = ready?.status === 200 ? chalk.green('ready') : chalk.yellow('not-ready');
  const adminStatusRaw = (admin?.body && typeof admin.body === 'object' && !Array.isArray(admin.body))
    ? (admin.body as Record<string, unknown>).status
    : undefined;
  const adminStatus = typeof adminStatusRaw === 'string' && adminStatusRaw === 'ok'
    ? chalk.green(adminStatusRaw)
    : typeof adminStatusRaw === 'string'
      ? chalk.yellow(adminStatusRaw)
      : chalk.dim('(n/a)');

  console.log(chalk.bold('Model Health\n'));
  console.log(`  Endpoint:   ${host}:${port}`);
  console.log(`  Liveness:   ${chalk.green(liveness.status)}`);
  if (ready) {
    const reason = ready.body && typeof ready.body === 'object' && !Array.isArray(ready.body)
      ? ((ready.body as Record<string, unknown>).reason as string | undefined)
      : undefined;
    console.log(`  Readiness:  ${readyStatus}${reason ? chalk.dim(` (${reason})`) : ''}`);
  }
  if (admin) {
    const bodyObj = admin.body && typeof admin.body === 'object' && !Array.isArray(admin.body)
      ? admin.body as Record<string, unknown>
      : {};
    const modelsLoaded = typeof bodyObj.models_loaded === 'number' ? bodyObj.models_loaded : undefined;
    const inFlight = typeof bodyObj.in_flight_requests === 'number' ? bodyObj.in_flight_requests : undefined;
    const memoryUsage = typeof bodyObj.memory_usage_percent === 'number'
      ? `${bodyObj.memory_usage_percent.toFixed(1)}%`
      : undefined;
    console.log(`  Admin:      ${adminStatus}`);
    if (modelsLoaded !== undefined) console.log(`  Models:     ${modelsLoaded}`);
    if (inFlight !== undefined) console.log(`  In flight:  ${inFlight}`);
    if (memoryUsage !== undefined) console.log(`  Memory:     ${memoryUsage}`);
  }
}
