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
import type { SlashCommandDef, SlashContext, SlashResult } from './types.js';

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
    // Fuzzy match: find closest command names by Levenshtein distance
    let bestMatch: { name: string; distance: number } | null = null;
    for (const key of commandMap.keys()) {
      const dist = levenshtein(cmd, key);
      if (!bestMatch || dist < bestMatch.distance) {
        bestMatch = { name: key, distance: dist };
      }
    }

    if (bestMatch && bestMatch.distance <= 2) {
      // Close enough — auto-execute with a hint
      const matched = commandMap.get(bestMatch.name)!;
      console.log(chalk.dim(`  Auto-corrected: /${bestMatch.name}`));
      return matched.handler(args, ctx);
    }

    if (bestMatch && bestMatch.distance === 3) {
      console.log(
        chalk.yellow(`  Unknown command: ${rawCmd}`) +
        chalk.dim(` — did you mean /${bestMatch.name}? (try /help)`)
      );
      return 'handled';
    }

    console.log(chalk.yellow(`  Unknown command: ${rawCmd}`) + chalk.dim(' (try /help)'));
    return 'handled';
  }

  // Per-command help: /cmd --help or /cmd -h
  if (args === '--help' || args === '-h') {
    console.log();
    console.log(`  ${chalk.cyan(`/${def.command}`)} ${chalk.dim('\u2014')} ${def.description}`);
    if (def.usage) {
      console.log(`  ${chalk.dim('Usage:')} ${def.usage}`);
    }
    if (def.examples && def.examples.length > 0) {
      console.log(`  ${chalk.dim('Examples:')}`);
      for (const ex of def.examples) {
        console.log(`    ${chalk.cyan(ex)}`);
      }
    }
    if (def.aliases && def.aliases.length > 0) {
      console.log(`  ${chalk.dim('Aliases:')} ${def.aliases.map(a => `/${a}`).join(', ')}`);
    }
    console.log();
    return 'handled';
  }

  return def.handler(args, ctx);
}

/**
 * Compute the Levenshtein distance between two strings.
 * Used for fuzzy matching of slash commands.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[]);

  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,      // deletion
        dp[i]![j - 1]! + 1,      // insertion
        dp[i - 1]![j - 1]! + cost // substitution
      );
    }
  }

  return dp[m]![n]!;
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
