/**
 * Display-related slash commands: /help, /expand, /theme, /sidebar, /keys
 */

import chalk from 'chalk';
import { box, kv } from '../../ui/box.js';
import { optaWord } from '../../ui/brand.js';
import { runMenuPrompt } from '../../ui/prompt-nav.js';
import type { SlashCommandDef, SlashContext, SlashResult } from './types.js';
import type { PaneMenuSection } from '../../ui/pane-menu.js';

const HELP_AREA_ORDER = [
  { id: 'models', label: 'Models & LMX', color: '#a855f7' },
  { id: 'coding', label: 'Coding Commands', color: '#22d3ee' },
  { id: 'session', label: 'Session Flow', color: '#3b82f6' },
  { id: 'management', label: 'Management', color: '#f59e0b' },
  { id: 'all', label: 'All Commands', color: '#10b981' },
] as const;

const MODEL_COMMANDS = new Set([
  'model',
  'models',
  'scan',
  'load',
  'unload',
  'serve',
  'memory',
  'metrics',
  'benchmark',
]);

const CODING_COMMANDS = new Set([
  'plan',
  'review',
  'research',
  'agent',
  'format',
  'editor',
  'image',
  'undo',
  'checkpoint',
  'compact',
]);

const SESSION_COMMANDS = new Set([
  'exit',
  'clear',
  'save',
  'share',
  'export',
  'sessions',
  'init',
  'tag',
  'rename',
]);

const MANAGEMENT_COMMANDS = new Set([
  'config',
  'doctor',
  'mcp',
  'quickfix',
  'permissions',
  'skills',
  'keys',
  'theme',
  'sidebar',
  'update',
  'server',
  'daemon',
  'completions',
]);

function classifyHelpArea(def: SlashCommandDef): string {
  if (MODEL_COMMANDS.has(def.command)) return 'models';
  if (CODING_COMMANDS.has(def.command)) return 'coding';
  if (SESSION_COMMANDS.has(def.command)) return 'session';
  if (MANAGEMENT_COMMANDS.has(def.command)) return 'management';
  if (def.category === 'server') return 'models';
  if (def.category === 'tools') return 'coding';
  if (def.category === 'session') return 'session';
  return 'management';
}

export function buildHelpSections(commands: SlashCommandDef[]): PaneMenuSection[] {
  const unique = new Map<string, SlashCommandDef>();
  for (const def of commands) {
    if (!unique.has(def.command)) unique.set(def.command, def);
  }

  const defs = [...unique.values()].sort((a, b) => a.command.localeCompare(b.command));

  const base = HELP_AREA_ORDER.map((area) => ({
    id: area.id,
    label: area.label,
    color: area.color,
    items: (area.id === 'all' ? defs : defs.filter((def) => classifyHelpArea(def) === area.id)).map(
      (def) => ({
        id: def.command,
        label: `/${def.command}`,
        description: def.description,
      })
    ),
  }));

  return base.filter((s) => s.items.length > 0);
}

function printCommandHelpCard(def: SlashCommandDef): void {
  const lines: string[] = [
    `${chalk.cyan(`/${def.command}`)} ${chalk.dim('—')} ${def.description}`,
    '',
  ];
  if (def.usage) {
    lines.push(`${chalk.dim('Usage:')} ${chalk.cyan(def.usage)}`);
  }
  if (def.examples && def.examples.length > 0) {
    lines.push(chalk.dim('Examples:'));
    for (const ex of def.examples) lines.push(`  ${chalk.cyan(ex)}`);
  }
  if (def.aliases && def.aliases.length > 0) {
    lines.push(`${chalk.dim('Aliases:')} ${def.aliases.map((a) => `/${a}`).join(', ')}`);
  }
  console.log('\n' + box(`Command ${chalk.cyan(`/${def.command}`)}`, lines) + '\n');
}

async function interactiveHelpBrowser(ctx: SlashContext): Promise<boolean> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return false;
  }

  const { getAllCommands, dispatchSlashCommand } = await import('./index.js');
  const { runPaneMenu } = await import('../../ui/pane-menu.js');
  const { select } = await import('@inquirer/prompts');

  const commands = getAllCommands();
  const commandMap = new Map(commands.map((c) => [c.command, c] as const));
  const sections = buildHelpSections(commands);

  let sectionIndex = 0;
  let itemIndex = 0;

  while (true) {
    const selection = await runPaneMenu({
      title: `${optaWord()} Help Navigator`,
      subtitle: 'Finder-style menu with infinite scrolling',
      instructions: '←/→ switch panes · ↑/↓ scroll (loop) · Enter select · q exit',
      sections,
      initialSectionIndex: sectionIndex,
      initialItemIndex: itemIndex,
      loop: true,
    });

    if (!selection) return true;
    sectionIndex = selection.sectionIndex;
    itemIndex = selection.itemIndex;

    const selected = commandMap.get(selection.itemId);
    if (!selected) continue;

    printCommandHelpCard(selected);

    let next: 'back' | 'cmd-help' | 'exit';
    try {
      const picked = await runMenuPrompt(
        (context) =>
          select<'back' | 'cmd-help' | 'exit'>(
            {
              message: chalk.dim('Next'),
              choices: [
                { name: 'Back to navigator', value: 'back' },
                { name: `Show /${selected.command} --help`, value: 'cmd-help' },
                { name: 'Exit help', value: 'exit' },
              ],
            },
            context
          ),
        'select'
      );
      if (!picked) continue;
      next = picked;
    } catch {
      return true;
    }

    if (next === 'exit') return true;
    if (next === 'cmd-help') {
      await dispatchSlashCommand(`/${selected.command} --help`, ctx);
    }
  }
}

/**
 * Build the /help output dynamically. This is called by the help handler
 * and needs access to the full registry, so it receives a callback to get
 * command descriptions.
 *
 * NOTE: The /help handler is registered here with a static layout matching
 * the original chat.ts output. The interactive browser (`/` with no args)
 * is handled in index.ts where it has access to the full registry.
 */
const helpHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  const mode = args.trim().toLowerCase();
  if (mode === 'menu' || mode === 'interactive' || mode === 'nav' || mode === 'browser') {
    const opened = await interactiveHelpBrowser(ctx);
    if (opened) return 'handled';
  }

  const { getAllCommands } = await import('./index.js');
  const defs = getAllCommands().sort((a, b) => a.command.localeCompare(b.command));

  const groups: Array<{ label: string; category: SlashCommandDef['category'] }> = [
    { label: 'Session', category: 'session' },
    { label: 'Tools', category: 'tools' },
    { label: 'Info', category: 'info' },
    { label: 'Server', category: 'server' },
  ];

  const cmdLine = (cmd: string, desc: string) => chalk.cyan(cmd.padEnd(18)) + chalk.dim(desc);

  const lines: string[] = [];
  for (const group of groups) {
    const commands = defs.filter((def) => def.category === group.category);
    if (commands.length === 0) continue;
    lines.push(chalk.dim(group.label));
    for (const def of commands) {
      lines.push(cmdLine(`/${def.command}`, def.description));
    }
    lines.push('');
  }
  if (lines[lines.length - 1] === '') lines.pop();

  console.log('\n' + box('Commands', lines));
  console.log(
    chalk.dim(
      `  Tip: type / to browse commands interactively, or ${chalk.cyan('/help menu')} for area-first navigation\n`
    )
  );
  return 'handled';
};

const expandHandler = (_args: string, ctx: SlashContext): Promise<SlashResult> => {
  if (!ctx.chatState.lastThinkingRenderer?.hasThinking()) {
    console.log(chalk.dim('  No thinking to display'));
    return Promise.resolve('handled');
  }
  if (ctx.chatState.thinkingExpanded) {
    console.log(ctx.chatState.lastThinkingRenderer.getCollapsedSummary());
    ctx.chatState.thinkingExpanded = false;
  } else {
    console.log(ctx.chatState.lastThinkingRenderer.getExpandedView());
    ctx.chatState.thinkingExpanded = true;
  }
  return Promise.resolve('handled');
};

const themeHandler = async (args: string, _ctx: SlashContext): Promise<SlashResult> => {
  const { getTheme, setTheme, listThemes, initThemes } = await import('../../ui/theme.js');
  await initThemes();
  if (!args) {
    const themes = listThemes();
    const current = getTheme();
    console.log(
      '\n' +
        box(
          'Themes',
          themes.map(
            (t) =>
              (t.name === current.name ? chalk.green('\u25cf ') : chalk.dim('  ')) +
              chalk.cyan(t.name.padEnd(14)) +
              chalk.dim(t.description) +
              (t.custom ? chalk.magenta(' (custom)') : '')
          )
        )
    );
    console.log(chalk.dim('  Usage: /theme <name>'));
    console.log(chalk.dim('  Custom: ~/.config/opta/themes/*.json or .opta/themes/*.json\n'));
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

const sidebarHandler = (_args: string, _ctx: SlashContext): Promise<SlashResult> => {
  // Toggle sidebar visibility (TUI mode only)
  console.log(chalk.dim('  Sidebar toggle: Ctrl+B in TUI mode'));
  return Promise.resolve('handled');
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

const formatHandler = (args: string, ctx: SlashContext): Promise<SlashResult> => {
  const validFormats = ['text', 'json', 'markdown'];
  const state = ctx.chatState as unknown as Record<string, unknown>;
  const current = (state.outputFormat as string) || 'text';

  if (!args) {
    console.log(`  Output format: ${chalk.cyan(current)}`);
    console.log(chalk.dim(`  Usage: /format <${validFormats.join('|')}>`));
    return Promise.resolve('handled');
  }

  if (!validFormats.includes(args)) {
    console.log(
      chalk.yellow(`  Unknown format: ${args}`) + chalk.dim(` (try: ${validFormats.join(', ')})`)
    );
    return Promise.resolve('handled');
  }

  state.outputFormat = args;
  console.log(chalk.green('\u2713') + ` Output format: ${chalk.cyan(args)}`);
  return Promise.resolve('handled');
};

export const displayCommands: SlashCommandDef[] = [
  {
    command: 'help',
    aliases: ['h', '?'],
    description: 'Show available commands (/help menu for interactive navigator)',
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
  {
    command: 'format',
    description: 'Toggle output format',
    handler: formatHandler,
    category: 'session',
    usage: '/format [text|json|markdown]',
    examples: ['/format', '/format json', '/format text'],
  },
];
