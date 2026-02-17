/**
 * Slash command registry.
 *
 * Collects all command definitions from the handler modules into a single
 * Map<string, SlashCommandDef>. Provides:
 *
 *   - dispatchSlashCommand(input, ctx) — parse and dispatch a slash command
 *   - getAllCommands() — returns all registered commands (for /help, browser)
 *   - getCommandMap() — returns the raw lookup map
 */

import chalk from 'chalk';
import type { SlashCommandDef, SlashContext, SlashResult, SlashHandler } from './types.js';

// Re-export types for convenience
export type { SlashCommandDef, SlashContext, SlashResult, SlashHandler } from './types.js';

// --- Import all handler modules ---

import { sessionCommands } from './session.js';
import { modelCommands } from './model.js';
import { displayCommands } from './display.js';
import { workflowCommands } from './workflow.js';
import { debugCommands } from './debug.js';
import { reviewCommands } from './review.js';
import { researchCommands } from './research.js';
import { lmxCommands } from './lmx.js';
import { manageCommands } from './manage.js';

// --- Build the registry ---

const allCommandDefs: SlashCommandDef[] = [
  ...sessionCommands,
  ...modelCommands,
  ...displayCommands,
  ...workflowCommands,
  ...debugCommands,
  ...reviewCommands,
  ...researchCommands,
  ...lmxCommands,
  ...manageCommands,
];

/** Map from command/alias name (without slash) to the command definition. */
const commandMap = new Map<string, SlashCommandDef>();

for (const def of allCommandDefs) {
  commandMap.set(def.command, def);
  if (def.aliases) {
    for (const alias of def.aliases) {
      commandMap.set(alias, def);
    }
  }
}

/**
 * Returns all unique command definitions (no duplicates from aliases).
 */
export function getAllCommands(): SlashCommandDef[] {
  return allCommandDefs;
}

/**
 * Returns the raw lookup map (command/alias -> definition).
 */
export function getCommandMap(): ReadonlyMap<string, SlashCommandDef> {
  return commandMap;
}

/**
 * Parse a slash command string and dispatch it to the matching handler.
 *
 * Handles the special case of bare `/` (interactive command browser) by
 * building a picker from the registry and recursively dispatching the
 * selected command.
 *
 * Returns a SlashResult telling the chat loop what to do next.
 */
export async function dispatchSlashCommand(
  input: string,
  ctx: SlashContext
): Promise<SlashResult> {
  const parts = input.trim().split(/\s+/);
  const rawCmd = parts[0]!.toLowerCase();
  const args = parts.slice(1).join(' ');

  // Strip leading slash
  const cmd = rawCmd.startsWith('/') ? rawCmd.slice(1) : rawCmd;

  // Special: bare `/` opens the interactive command browser
  if (cmd === '') {
    return browseCommands(ctx);
  }

  const def = commandMap.get(cmd);
  if (!def) {
    console.log(chalk.yellow(`  Unknown command: ${rawCmd}`) + chalk.dim(' (try /help)'));
    return 'handled';
  }

  return def.handler(args, ctx);
}

/**
 * Interactive command browser — shown when user types bare `/`.
 * Reads all commands from the registry and presents an inquirer select picker.
 */
async function browseCommands(ctx: SlashContext): Promise<SlashResult> {
  const { select, Separator } = await import('@inquirer/prompts');

  // Group commands by category for the browser display
  const infoCommands = allCommandDefs.filter(c => c.category === 'info');
  const sessionCmds = allCommandDefs.filter(c => c.category === 'session');
  const toolsCmds = allCommandDefs.filter(c => c.category === 'tools');
  const serverCmds = allCommandDefs.filter(c => c.category === 'server');

  const formatChoice = (def: SlashCommandDef) => ({
    name: `/${def.command.padEnd(14)}${def.description}`,
    value: `/${def.command}`,
  });

  const commands = [
    ...infoCommands.map(formatChoice),
    new Separator(chalk.dim('\u2500\u2500\u2500\u2500 Session \u2500\u2500\u2500\u2500')),
    ...sessionCmds.map(formatChoice),
    new Separator(chalk.dim('\u2500\u2500\u2500\u2500 Tools \u2500\u2500\u2500\u2500')),
    ...toolsCmds.map(formatChoice),
    new Separator(chalk.dim('\u2500\u2500\u2500\u2500 Server \u2500\u2500\u2500\u2500')),
    ...serverCmds.map(formatChoice),
  ];

  try {
    const selected = await select({ message: chalk.dim('\u203a'), choices: commands });
    return dispatchSlashCommand(selected, ctx);
  } catch {
    return 'handled';
  }
}
