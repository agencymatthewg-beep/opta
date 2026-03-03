/**
 * Debug and info slash commands: /debug, /history, /cost, /stats
 */

import chalk from 'chalk';
import { box, kv, progressBar } from '../../ui/box.js';
import { formatTokens } from '../../utils/tokens.js';
import { estimateTokens } from '../../utils/tokens.js';
import { estimateCost, formatCost } from '../../utils/pricing.js';
import { errorMessage } from '../../utils/errors.js';
import type { AgentMessage } from '../../core/agent.js';
import type { SlashCommandDef, SlashContext, SlashResult } from './types.js';
import { parseSlashArgs, renderJson } from './lmx/types.js';

interface DebugSnapshot {
  sessionId: string;
  messageCount: number;
  toolCallCount: number;
  provider: string;
  fallbackOnFailure: boolean;
  endpoint: {
    host: string;
    fallbackHosts: string[];
    port: number;
    activeHost: string;
    adminKeyConfigured: boolean;
    hostSpecificAdminKeys: number;
  };
  auth: {
    anthropicKeyConfigured: boolean;
    optaApiKeyConfigured: boolean;
  };
  lmx: {
    reachable: boolean;
    latencyMs: number | null;
    error?: string;
  };
}

async function collectDebugSnapshot(ctx: SlashContext): Promise<DebugSnapshot> {
  const { host, port, fallbackHosts, adminKey, adminKeysByHost } = ctx.config.connection;
  const startedAt = Date.now();
  let reachable = false;
  let latencyMs: number | null = null;
  let activeHost = host;
  let connectionError: string | undefined;

  try {
    const { LmxClient } = await import('../../lmx/client.js');
    const lmx = new LmxClient({
      host,
      fallbackHosts,
      port,
      adminKey,
      adminKeysByHost,
      timeoutMs: 2_500,
      maxRetries: 0,
    });
    await lmx.health({ timeoutMs: 2_500, maxRetries: 0 });
    reachable = true;
    latencyMs = Date.now() - startedAt;
    activeHost = lmx.getActiveHost();
  } catch (err) {
    connectionError = errorMessage(err);
  }

  const anthropicConfigKey = ctx.config.provider.anthropic.apiKey.trim();
  const anthropicEnvKey = process.env['ANTHROPIC_API_KEY']?.trim() ?? '';
  const optaApiEnvKey = process.env['OPTA_API_KEY']?.trim() ?? '';
  const optaApiConfigKey = ctx.config.connection.apiKey?.trim() ?? '';

  return {
    sessionId: ctx.session.id,
    messageCount: ctx.session.messages.length,
    toolCallCount: ctx.session.toolCallCount ?? 0,
    provider: ctx.config.provider.active,
    fallbackOnFailure: ctx.config.provider.fallbackOnFailure,
    endpoint: {
      host,
      fallbackHosts,
      port,
      activeHost,
      adminKeyConfigured: Boolean(adminKey?.trim()),
      hostSpecificAdminKeys: Object.keys(adminKeysByHost ?? {}).length,
    },
    auth: {
      anthropicKeyConfigured: Boolean(anthropicConfigKey || anthropicEnvKey),
      optaApiKeyConfigured: Boolean(optaApiConfigKey || optaApiEnvKey),
    },
    lmx: {
      reachable,
      latencyMs,
      ...(connectionError ? { error: connectionError } : {}),
    },
  };
}

const debugHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  const tokens = parseSlashArgs(args);
  const asJson = tokens.includes('--json');
  const includeDoctor = tokens.includes('--doctor');
  const unknown = tokens.filter((token) => token.startsWith('--') && token !== '--json' && token !== '--doctor');
  if (unknown.length > 0) {
    console.log(chalk.yellow(`  Unknown options: ${unknown.join(', ')}`));
    console.log(chalk.dim('  Usage: /debug [--json] [--doctor]'));
    return 'handled';
  }

  const snapshot = await collectDebugSnapshot(ctx);

  if (asJson) {
    console.log(renderJson(snapshot));
  } else {
    const endpointLabel = `${snapshot.endpoint.host}:${snapshot.endpoint.port}`;
    const fallbackLabel =
      snapshot.endpoint.fallbackHosts.length > 0
        ? snapshot.endpoint.fallbackHosts.join(', ')
        : '(none)';

    const lines: string[] = [
      kv('Session', snapshot.sessionId),
      kv('Messages', String(snapshot.messageCount)),
      kv('Tool Calls', String(snapshot.toolCallCount)),
      '',
      kv('Provider', snapshot.provider),
      kv('Fallback', snapshot.fallbackOnFailure ? chalk.cyan('enabled') : chalk.dim('disabled')),
      '',
      kv('Configured Host', endpointLabel),
      kv('Fallback Hosts', fallbackLabel),
      kv('Active Host', `${snapshot.endpoint.activeHost}:${snapshot.endpoint.port}`),
      kv('Admin Key', snapshot.endpoint.adminKeyConfigured ? '(set)' : chalk.dim('(unset)')),
      kv('Host Admin Keys', String(snapshot.endpoint.hostSpecificAdminKeys)),
      '',
      kv(
        'Anthropic Key',
        snapshot.auth.anthropicKeyConfigured ? '(set)' : chalk.dim('(unset)'),
      ),
      kv(
        'OPTA_API_KEY',
        snapshot.auth.optaApiKeyConfigured ? '(set)' : chalk.dim('(unset)'),
      ),
      '',
    ];

    if (snapshot.lmx.reachable) {
      lines.push(
        kv(
          'LMX',
          chalk.green(`reachable (${snapshot.lmx.latencyMs ?? 0}ms)`),
        ),
      );
    } else {
      lines.push(kv('LMX', chalk.red('unreachable')));
      if (snapshot.lmx.error) {
        lines.push(chalk.dim(`  ${snapshot.lmx.error}`));
      }
      lines.push(chalk.dim('  Next: /doctor, /lmx status --full, /lmx reconnect'));
    }

    console.log('\n' + box('Debug Snapshot', lines));
  }

  if (includeDoctor) {
    const { runDoctor } = await import('../doctor.js');
    await runDoctor({ fix: false });
  }

  return 'handled';
};

const historyHandler = (_args: string, ctx: SlashContext): Promise<SlashResult> => {
  const userMessages = ctx.session.messages.filter(
    (m: AgentMessage) => m.role === 'user' || m.role === 'assistant'
  );
  if (userMessages.length === 0) {
    console.log(chalk.dim('  No messages yet'));
    return Promise.resolve('handled');
  }
  console.log();
  userMessages.forEach((m: AgentMessage, i: number) => {
    const role = m.role === 'user' ? chalk.cyan('user') : chalk.green('assistant');
    const rawContent =
      typeof m.content === 'string' ? m.content : Array.isArray(m.content) ? '[multimodal]' : '';
    const content = rawContent.slice(0, 80).replace(/\n/g, ' ');
    const toolCount = m.tool_calls?.length;
    const suffix = toolCount ? chalk.dim(` (${toolCount} tool calls)`) : '';
    console.log(`  ${i + 1}. [${role}] ${content}${suffix}`);
  });
  console.log();
  return Promise.resolve('handled');
};

const costHandler = (_args: string, ctx: SlashContext): Promise<SlashResult> => {
  const msgs = ctx.session.messages;
  let promptTok = 0;
  let completionTok = 0;
  for (const m of msgs) {
    const tok = estimateTokens(typeof m.content === 'string' ? m.content : '');
    if (m.role === 'assistant') completionTok += tok;
    else promptTok += tok;
  }
  const total = promptTok + completionTok;
  const contextLimit = ctx.config.model.contextLimit ?? 128000;
  const usageRatio = total / contextLimit;

  console.log(
    '\n' +
      box('Token Usage', [
        kv('Prompt', `~${formatTokens(promptTok)} tokens`),
        kv('Completion', `~${formatTokens(completionTok)} tokens`),
        kv('Total', `~${formatTokens(total)} tokens`),
        kv(
          'Context',
          `${progressBar(usageRatio, 16)} ${chalk.dim(`${formatTokens(total)}/${formatTokens(contextLimit)}`)}`
        ),
        '',
        kv('Messages', String(msgs.length)),
        kv('Tool calls', String(ctx.session.toolCallCount)),
        (() => {
          const provider = ctx.config.provider.active;
          const model =
            provider === 'lmx' ? ctx.config.model.default : ctx.config.provider.anthropic.model;
          const cost = estimateCost(promptTok, completionTok, provider, model);
          if (cost.isLocal)
            return kv('Cost', chalk.green('Free') + chalk.dim(' (local inference)'));
          return kv('Cost', chalk.yellow(formatCost(cost) + ' USD'));
        })(),
      ])
  );
  return Promise.resolve('handled');
};

const statsHandler = async (_args: string, _ctx: SlashContext): Promise<SlashResult> => {
  const { listSessions } = await import('../../memory/store.js');
  const { SessionAnalytics } = await import('../../memory/analytics.js');
  const allSessions = await listSessions();
  const analytics = new SessionAnalytics(allSessions);

  const modelLines = Object.entries(analytics.modelBreakdown)
    .sort(([, a], [, b]) => b - a)
    .map(([model, count]) => kv(model, `${count} sessions`, 20));

  console.log(
    '\n' +
      box('Session Analytics', [
        kv('Total', `${analytics.totalSessions} sessions`, 14),
        kv('Messages', `${analytics.totalMessages} total`, 14),
        kv('Tool Calls', `${analytics.totalToolCalls} total`, 14),
        kv('Avg/Session', `${analytics.avgMessagesPerSession.toFixed(1)} msgs`, 14),
        kv('Today', `${analytics.sessionsToday()} sessions`, 14),
        '',
        chalk.dim('Model Usage:'),
        ...modelLines,
        '',
        kv('Cost', chalk.green('Free') + chalk.dim(' (aggregate cost tracked per-turn)'), 14),
      ])
  );
  return 'handled';
};

export const debugCommands: SlashCommandDef[] = [
  {
    command: 'debug',
    description: 'Runtime debug snapshot (LMX/provider/session)',
    handler: debugHandler,
    category: 'info',
    usage: '/debug [--json] [--doctor]',
    examples: ['/debug', '/debug --json', '/debug --doctor'],
  },
  {
    command: 'history',
    description: 'Conversation summary',
    handler: historyHandler,
    category: 'info',
  },
  {
    command: 'cost',
    description: 'Token usage breakdown',
    handler: costHandler,
    category: 'info',
  },
  {
    command: 'stats',
    aliases: ['analytics'],
    description: 'Session analytics',
    handler: statsHandler,
    category: 'info',
  },
];
