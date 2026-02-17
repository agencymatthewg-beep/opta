/**
 * Research mode slash command: /research
 *
 * Toggles a research mode that allows reading and running commands
 * but denies file modifications. Tracks research activity in the session
 * so /plan can detect when research has been done.
 */

import chalk from 'chalk';
import type { SlashCommandDef, SlashContext, SlashResult } from './types.js';

const researchHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  // Toggle off if already in research mode and no args
  if (!args && ctx.chatState.currentMode === 'research') {
    ctx.chatState.currentMode = 'normal';
    console.log(chalk.green('\u2713') + ' Exited research mode');
    return 'handled';
  }

  // Enter research mode
  ctx.chatState.currentMode = 'research';
  console.log(chalk.blue('\u2713') + ' Entered research mode \u2014 explore and investigate');
  console.log(chalk.dim('  Allowed: read, search, run commands, web search/fetch'));
  console.log(chalk.dim('  Blocked: file edits, writes, deletes'));

  // Mark that research has been done in this session
  ctx.session.messages.push({
    role: 'user',
    content: args
      ? `[System: Research mode activated. Research topic: ${args}]`
      : '[System: Research mode activated. Explore the codebase, search the web, run diagnostic commands, and take notes.]',
  });

  console.log(chalk.dim('  Type /research to exit'));
  return 'handled';
};

export const researchCommands: SlashCommandDef[] = [
  {
    command: 'research',
    aliases: ['explore'],
    description: 'Toggle research mode',
    handler: researchHandler,
    category: 'session',
  },
];
