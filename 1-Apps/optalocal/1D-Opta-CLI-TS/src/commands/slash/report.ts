/**
 * /report slash command — generate an HTML session report manually.
 *
 * Renders the current session's stats, tool timeline, file changes,
 * decisions, and issues into an Opta-glass HTML document and opens
 * it in the default browser.
 */

import chalk from 'chalk';
import type { SlashCommandDef } from './types.js';
import type { TurnStats } from '../../tui/adapter.js';

export const reportCommands: SlashCommandDef[] = [
  {
    command: 'report',
    aliases: ['summary'],
    description: 'Generate HTML session report and open in browser',
    category: 'tools',
    usage: '/report',
    examples: ['/report'],
    handler: async (_args, ctx) => {
      const { generateManualReport } = await import('../../ui/report-trigger.js');

      // Build TurnStats from session metadata.
      // The slash command doesn't have live TurnStats, so we reconstruct
      // from what the session has accumulated.
      const turnStats: TurnStats = {
        toolCalls: ctx.session.toolCallCount ?? 0,
        tokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        elapsed: 0,
        speed: 0,
        firstTokenLatencyMs: null,
      };

      // Approximate elapsed from session timestamps
      if (ctx.session.created && ctx.session.updated) {
        const start = Date.parse(ctx.session.created);
        const end = Date.parse(ctx.session.updated);
        if (Number.isFinite(start) && Number.isFinite(end)) {
          turnStats.elapsed = Math.max(0, (end - start) / 1000);
        }
      }

      try {
        const filePath = await generateManualReport(ctx.session, turnStats, ctx.config);
        console.log();
        console.log(chalk.hex('#8B5CF6')('  ◆ Report generated'));
        console.log(chalk.dim(`    ${filePath}`));
        console.log();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(chalk.red(`  Report generation failed: ${msg}`));
      }

      return 'handled';
    },
  },
];
