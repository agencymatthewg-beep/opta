/**
 * Display-related slash commands: /help, /expand, /theme, /sidebar, /keys
 */

import chalk from 'chalk';
import { box, kv } from '../../ui/box.js';
import type { SlashCommandDef, SlashContext, SlashResult } from './types.js';
import type { SlashHandler } from './types.js';

/**
 * Build the /help output dynamically. This is called by the help handler
 * and needs access to the full registry, so it receives a callback to get
 * command descriptions.
 *
 * NOTE: The /help handler is registered here with a static layout matching
 * the original chat.ts output. The interactive browser (`/` with no args)
 * is handled in index.ts where it has access to the full registry.
 */
const helpHandler = async (_args: string, _ctx: SlashContext): Promise<SlashResult> => {
  const cmdLine = (cmd: string, desc: string) =>
    chalk.cyan(cmd.padEnd(16)) + chalk.dim(desc);
  console.log('\n' + box('Commands', [
    chalk.dim('Session'),
    cmdLine('/exit', 'Save and exit'),
    cmdLine('/model', 'Switch model (picker)'),
    cmdLine('/agent', 'Switch agent profile'),
    cmdLine('/plan', 'Toggle plan mode'),
    cmdLine('/sessions', 'List recent sessions'),
    cmdLine('/share', 'Export conversation'),
    cmdLine('/theme', 'Change UI theme'),
    '',
    chalk.dim('Tools'),
    cmdLine('/undo [n|all]', 'Undo checkpoint (preview + confirm)'),
    cmdLine('/checkpoint', 'List checkpoints with diff stats'),
    cmdLine('/compact', 'Force context compaction'),
    cmdLine('/image <path>', 'Analyze an image'),
    cmdLine('/editor', 'Open $EDITOR for input'),
    cmdLine('/init', 'Generate project context'),
    '',
    chalk.dim('Info'),
    cmdLine('/history', 'Conversation summary'),
    cmdLine('/status', 'System & LMX status'),
    cmdLine('/stats', 'Session analytics'),
    cmdLine('/diff', 'Uncommitted changes'),
    cmdLine('/cost', 'Token usage breakdown'),
    cmdLine('/expand', 'Toggle thinking display'),
    cmdLine('/keys', 'Show keybindings'),
    cmdLine('/clear', 'Clear screen'),
  ]));
  console.log(chalk.dim('  Tip: type / to browse commands interactively\n'));
  return 'handled';
};

const expandHandler = async (_args: string, ctx: SlashContext): Promise<SlashResult> => {
  if (!ctx.chatState.lastThinkingRenderer?.hasThinking()) {
    console.log(chalk.dim('  No thinking to display'));
    return 'handled';
  }
  if (ctx.chatState.thinkingExpanded) {
    console.log(ctx.chatState.lastThinkingRenderer.getCollapsedSummary());
    ctx.chatState.thinkingExpanded = false;
  } else {
    console.log(ctx.chatState.lastThinkingRenderer.getExpandedView());
    ctx.chatState.thinkingExpanded = true;
  }
  return 'handled';
};

const themeHandler = async (args: string, _ctx: SlashContext): Promise<SlashResult> => {
  const { getTheme, setTheme, listThemes } = await import('../../ui/theme.js');
  if (!args) {
    const themes = listThemes();
    const current = getTheme();
    console.log('\n' + box('Themes', themes.map(t =>
      (t.name === current.name ? chalk.green('\u25cf ') : chalk.dim('  ')) +
      chalk.cyan(t.name.padEnd(14)) + chalk.dim(t.description)
    )));
    console.log(chalk.dim('  Usage: /theme <name>\n'));
    return 'handled';
  }
  setTheme(args);
  const theme = getTheme();
  if (theme.name === args) {
    console.log(chalk.green('\u2713') + ` Theme: ${theme.primary(theme.name)}`);
  } else {
    console.log(chalk.yellow(`  Unknown theme: ${args}. Try /theme to see options.`));
  }
  return 'handled';
};

const sidebarHandler = async (_args: string, _ctx: SlashContext): Promise<SlashResult> => {
  // Toggle sidebar visibility (TUI mode only)
  console.log(chalk.dim('  Sidebar toggle: Ctrl+B in TUI mode'));
  return 'handled';
};

const keysHandler = async (_args: string, _ctx: SlashContext): Promise<SlashResult> => {
  const { defaultKeybindings } = await import('../../tui/keybindings.js');
  const bindings = defaultKeybindings();
  const lines = Object.entries(bindings).map(([action, binding]) =>
    kv(binding.key.padEnd(14), `${binding.description} (${action})`, 14)
  );
  console.log('\n' + box('Keybindings', lines));
  console.log(chalk.dim('  Customize: .opta/keybindings.json\n'));
  return 'handled';
};

export const displayCommands: SlashCommandDef[] = [
  {
    command: 'help',
    aliases: ['h', '?'],
    description: 'Show available commands',
    handler: helpHandler,
    category: 'info',
  },
  {
    command: 'expand',
    aliases: ['think'],
    description: 'Toggle thinking display',
    handler: expandHandler,
    category: 'info',
  },
  {
    command: 'theme',
    description: 'Change UI theme',
    handler: themeHandler,
    category: 'session',
  },
  {
    command: 'sidebar',
    description: 'Toggle sidebar (TUI mode)',
    handler: sidebarHandler,
    category: 'session',
  },
  {
    command: 'keys',
    aliases: ['keybindings'],
    description: 'Show keybindings',
    handler: keysHandler,
    category: 'info',
  },
];
