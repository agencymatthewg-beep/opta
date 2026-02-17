/**
 * Debug and info slash commands: /history, /cost, /stats
 */

import chalk from 'chalk';
import { box, kv, fmtTokens, progressBar } from '../../ui/box.js';
import type { AgentMessage } from '../../core/agent.js';
import type { SlashCommandDef, SlashContext, SlashResult } from './types.js';

const historyHandler = async (_args: string, ctx: SlashContext): Promise<SlashResult> => {
  const userMessages = ctx.session.messages.filter(
    (m: AgentMessage) => m.role === 'user' || m.role === 'assistant'
  );
  if (userMessages.length === 0) {
    console.log(chalk.dim('  No messages yet'));
    return 'handled';
  }
  console.log();
  userMessages.forEach((m: AgentMessage, i: number) => {
    const role = m.role === 'user' ? chalk.cyan('user') : chalk.green('assistant');
    const rawContent = typeof m.content === 'string' ? m.content : Array.isArray(m.content) ? '[multimodal]' : '';
    const content = rawContent.slice(0, 80).replace(/\n/g, ' ');
    const toolCount = m.tool_calls?.length;
    const suffix = toolCount ? chalk.dim(` (${toolCount} tool calls)`) : '';
    console.log(`  ${i + 1}. [${role}] ${content}${suffix}`);
  });
  console.log();
  return 'handled';
};

const costHandler = async (_args: string, ctx: SlashContext): Promise<SlashResult> => {
  const msgs = ctx.session.messages;
  let promptTok = 0;
  let completionTok = 0;
  for (const m of msgs) {
    const len = typeof m.content === 'string' ? m.content.length : 0;
    const tok = Math.ceil(len / 4);
    if (m.role === 'assistant') completionTok += tok;
    else promptTok += tok;
  }
  const total = promptTok + completionTok;
  const contextLimit = ctx.config.model.contextLimit ?? 128000;
  const usageRatio = total / contextLimit;

  console.log('\n' + box('Token Usage', [
    kv('Prompt', `~${fmtTokens(promptTok)} tokens`),
    kv('Completion', `~${fmtTokens(completionTok)} tokens`),
    kv('Total', `~${fmtTokens(total)} tokens`),
    kv('Context', `${progressBar(usageRatio, 16)} ${chalk.dim(`${fmtTokens(total)}/${fmtTokens(contextLimit)}`)}`),
    '',
    kv('Messages', String(msgs.length)),
    kv('Tool calls', String(ctx.session.toolCallCount)),
    kv('Cost', chalk.green('$0.00') + chalk.dim(' (local inference)')),
  ]));
  return 'handled';
};

const statsHandler = async (_args: string, _ctx: SlashContext): Promise<SlashResult> => {
  const { listSessions } = await import('../../memory/store.js');
  const { SessionAnalytics } = await import('../../memory/analytics.js');
  const allSessions = await listSessions();
  const analytics = new SessionAnalytics(allSessions);

  const modelLines = Object.entries(analytics.modelBreakdown)
    .sort(([, a], [, b]) => b - a)
    .map(([model, count]) => kv(model, `${count} sessions`, 20));

  console.log('\n' + box('Session Analytics', [
    kv('Total', `${analytics.totalSessions} sessions`, 14),
    kv('Messages', `${analytics.totalMessages} total`, 14),
    kv('Tool Calls', `${analytics.totalToolCalls} total`, 14),
    kv('Avg/Session', `${analytics.avgMessagesPerSession.toFixed(1)} msgs`, 14),
    kv('Today', `${analytics.sessionsToday()} sessions`, 14),
    '',
    chalk.dim('Model Usage:'),
    ...modelLines,
    '',
    kv('Cost', chalk.green('$0.00') + chalk.dim(' (local inference)'), 14),
  ]));
  return 'handled';
};

export const debugCommands: SlashCommandDef[] = [
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
