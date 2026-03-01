/**
 * Code review slash command: /review
 *
 * Toggles a read-only review mode that denies all write/execute tools,
 * or optionally targets a specific file for review.
 */

import chalk from 'chalk';
import type { SlashCommandDef, SlashContext, SlashResult } from './types.js';

const reviewHandler = (args: string, ctx: SlashContext): Promise<SlashResult> => {
  // Toggle off if already in review mode and no args
  if (!args && ctx.chatState.currentMode === 'review') {
    ctx.chatState.currentMode = 'normal';
    console.log(chalk.green('\u2713') + ' Exited review mode');
    return Promise.resolve('handled');
  }

  // Enter review mode
  ctx.chatState.currentMode = 'review';
  console.log(chalk.magenta('\u2713') + ' Entered review mode \u2014 read-only analysis');
  console.log(chalk.dim('  All write/execute tools are blocked'));

  // If a file path was provided, inject it as context
  if (args) {
    const filePath = args.trim();
    ctx.session.messages.push({
      role: 'user',
      content: `[System: Review mode activated. Please review the following file for bugs, security issues, performance problems, and code style: ${filePath}]`,
    });
    console.log(chalk.dim(`  Target: ${filePath}`));
  }

  console.log(chalk.dim('  Type /review to exit'));
  return Promise.resolve('handled');
};

export const reviewCommands: SlashCommandDef[] = [
  {
    command: 'review',
    description: 'Toggle code review mode',
    handler: reviewHandler,
    category: 'tools',
  },
];
