/**
 * Management slash commands: /config, /doctor, /mcp, /quickfix
 */

import chalk from 'chalk';
import { box, kv } from '../../ui/box.js';
import type { SlashCommandDef, SlashContext, SlashResult } from './types.js';

const configHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  const parts = args.trim().split(/\s+/);
  const action = parts[0] || 'list';
  const key = parts[1];
  const value = parts.slice(2).join(' ');

  if (action === 'list') {
    const lines: string[] = [
      chalk.dim('Connection'),
      kv('host', ctx.config.connection.host, 20),
      kv('port', String(ctx.config.connection.port), 20),
      kv('adminKey', ctx.config.connection.adminKey ? '(set)' : chalk.dim('(none)'), 20),
      '',
      chalk.dim('Model'),
      kv('default', ctx.config.model.default || chalk.dim('(none)'), 20),
      kv('contextLimit', String(ctx.config.model.contextLimit), 20),
      '',
      chalk.dim('Provider'),
      kv('active', ctx.config.provider.active, 20),
      kv('anthropic.apiKey', ctx.config.provider.anthropic.apiKey ? '(set)' : chalk.dim('(none)'), 20),
      '',
      chalk.dim('Features'),
      kv('defaultMode', ctx.config.defaultMode, 20),
      kv('git.autoCommit', String(ctx.config.git.autoCommit), 20),
      kv('git.checkpoints', String(ctx.config.git.checkpoints), 20),
      kv('insights.enabled', String(ctx.config.insights.enabled), 20),
      kv('tui.default', String(ctx.config.tui.default), 20),
    ];
    console.log('\n' + box('Config', lines));
    console.log(chalk.dim('  /config set <key> <value>  \u2014  change a setting'));
    console.log(chalk.dim('  /config get <key>          \u2014  read a setting\n'));
    return 'handled';
  }

  if (action === 'get') {
    if (!key) {
      console.log(chalk.dim('  Usage: /config get <key>'));
      return 'handled';
    }
    try {
      const { loadConfig } = await import('../../core/config.js');
      const config = await loadConfig();
      const val = getNestedValue(config, key);
      console.log(`  ${chalk.dim(key + ':')} ${val !== undefined ? String(val) : chalk.dim('(not set)')}`);
    } catch (err) {
      console.error(chalk.red('\u2717') + ` ${err instanceof Error ? err.message : err}`);
    }
    return 'handled';
  }

  if (action === 'set') {
    if (!key || !value) {
      console.log(chalk.dim('  Usage: /config set <key> <value>'));
      console.log(chalk.dim('  Example: /config set connection.port 1234'));
      return 'handled';
    }

    try {
      const { saveConfig } = await import('../../core/config.js');
      const nested = buildNestedObject(key, value);
      await saveConfig(nested);
      console.log(chalk.green('\u2713') + ` ${key} = ${value}`);
    } catch (err) {
      console.error(chalk.red('\u2717') + ` Failed to save: ${err instanceof Error ? err.message : err}`);
    }
    return 'handled';
  }

  if (action === 'reset') {
    try {
      const { getConfigStore } = await import('../../core/config.js');
      const store = await getConfigStore();
      store.clear();
      console.log(chalk.green('\u2713') + ' Config reset to defaults');
    } catch (err) {
      console.error(chalk.red('\u2717') + ` ${err instanceof Error ? err.message : err}`);
    }
    return 'handled';
  }

  if (action === 'search') {
    if (!key) {
      console.log(chalk.dim('  Usage: /config search <pattern>'));
      return 'handled';
    }
    const { loadConfig } = await import('../../core/config.js');
    const config = await loadConfig();
    const pattern = key.toLowerCase();
    const matches = flattenConfig(config)
      .filter(([k]) => k.toLowerCase().includes(pattern));

    if (matches.length === 0) {
      console.log(chalk.dim(`  No config keys matching "${key}"`));
      return 'handled';
    }

    const lines = matches.map(([k, v]) => kv(k, String(v), 30));
    console.log('\n' + box(`Config: "${key}" (${matches.length} matches)`, lines));
    return 'handled';
  }

  console.log(chalk.dim('  Usage: /config [list|get|set|reset|search]'));
  return 'handled';
};

const doctorHandler = async (_args: string, _ctx: SlashContext): Promise<SlashResult> => {
  try {
    const { runDoctor } = await import('../doctor.js');
    await runDoctor({});
  } catch (err) {
    console.error(chalk.red('\u2717') + ` Doctor failed: ${err instanceof Error ? err.message : err}`);
  }
  return 'handled';
};

const mcpHandler = async (_args: string, ctx: SlashContext): Promise<SlashResult> => {
  const servers = ctx.config.mcp.servers;
  const entries = Object.entries(servers);

  if (entries.length === 0) {
    console.log(chalk.dim('  No MCP servers configured'));
    console.log(chalk.dim('  Add one: opta mcp add <name> <command>'));
    return 'handled';
  }

  const lines: string[] = [];
  for (const [name, config] of entries) {
    if (config.transport === 'stdio') {
      lines.push(`${chalk.green('\u25cf')} ${chalk.bold(name.padEnd(16))} ${chalk.dim('stdio')} ${chalk.dim(config.command)}`);
      if (config.args.length > 0) {
        lines.push(`  ${chalk.dim('args: ' + config.args.join(' '))}`);
      }
    } else {
      lines.push(`${chalk.blue('\u25cf')} ${chalk.bold(name.padEnd(16))} ${chalk.dim('http')} ${chalk.dim(config.url)}`);
    }
  }

  console.log('\n' + box(`MCP Servers (${entries.length})`, lines));
  console.log(chalk.dim('  Manage: opta mcp add|remove|test <name>\n'));
  return 'handled';
};

const quickfixHandler = async (_args: string, _ctx: SlashContext): Promise<SlashResult> => {
  try {
    const { healConfig } = await import('../../core/config.js');
    const issues = await healConfig();

    if (issues.length === 0) {
      console.log(chalk.green('\u2713') + ' Config is healthy — no issues found');
      return 'handled';
    }

    const fixed = issues.filter(i => i.autoFixed);
    const manual = issues.filter(i => !i.autoFixed);

    const lines: string[] = [];
    for (const issue of issues) {
      const icon = issue.autoFixed
        ? chalk.green('\u2713')
        : chalk.yellow('\u26a0');
      const status = issue.autoFixed
        ? chalk.dim('(auto-fixed)')
        : chalk.yellow('(manual fix needed)');
      lines.push(`${icon} ${chalk.bold(issue.path)} ${status}`);
      lines.push(`  ${issue.message}`);
      if (!issue.autoFixed) {
        lines.push(`  ${chalk.dim(issue.suggestion)}`);
      }
    }

    console.log('\n' + box('Config Health', lines));
    console.log(
      `  Fixed ${chalk.green(String(fixed.length))} issue${fixed.length === 1 ? '' : 's'}` +
      (manual.length > 0
        ? `, ${chalk.yellow(String(manual.length))} require${manual.length === 1 ? 's' : ''} manual attention`
        : '') +
      '\n',
    );
  } catch (err) {
    console.error(
      chalk.red('\u2717') + ` Quickfix failed: ${err instanceof Error ? err.message : err}`,
    );
  }
  return 'handled';
};

const permissionsHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  // Show current permissions or set one
  const parts = args.trim().split(/\s+/);
  const toolName = parts[0];
  const newPerm = parts[1];

  if (!toolName) {
    // List all tool permissions
    const perms = ctx.config.permissions || {};
    const defaults: Record<string, string> = {
      read_file: 'allow', write_file: 'ask', edit_file: 'ask',
      run_command: 'ask', ask_user: 'allow', list_dir: 'allow',
      search_files: 'allow', find_files: 'allow',
    };
    const lines: string[] = [];
    for (const [tool, defaultVal] of Object.entries(defaults)) {
      const current = (perms as Record<string, string>)[tool] || defaultVal;
      const color = current === 'allow' ? chalk.green : current === 'deny' ? chalk.red : chalk.yellow;
      lines.push(`  ${chalk.dim(tool.padEnd(16))} ${color(current)}`);
    }
    console.log('\n' + box('Tool Permissions', lines));
    console.log(chalk.dim('  /permissions <tool> <allow|ask|deny>  \u2014  change\n'));
    return 'handled';
  }

  if (!newPerm || !['allow', 'ask', 'deny'].includes(newPerm)) {
    console.log(chalk.dim(`  Usage: /permissions ${toolName} <allow|ask|deny>`));
    return 'handled';
  }

  try {
    const { saveConfig } = await import('../../core/config.js');
    await saveConfig({ permissions: { [toolName]: newPerm } });
    const color = newPerm === 'allow' ? chalk.green : newPerm === 'deny' ? chalk.red : chalk.yellow;
    console.log(chalk.green('\u2713') + ` ${toolName}: ${color(newPerm)}`);
  } catch (err) {
    console.error(chalk.red('\u2717') + ` Failed: ${err instanceof Error ? err.message : err}`);
  }
  return 'handled';
};

// --- Helpers ---

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;
  for (const k of keys) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[k];
  }
  return current;
}

function buildNestedObject(path: string, value: string): Record<string, unknown> {
  const keys = path.split('.');
  const result: Record<string, unknown> = {};
  let current = result;

  for (let i = 0; i < keys.length - 1; i++) {
    const next: Record<string, unknown> = {};
    current[keys[i]!] = next;
    current = next;
  }

  // Auto-convert types
  const lastKey = keys[keys.length - 1]!;
  if (value === 'true') current[lastKey] = true;
  else if (value === 'false') current[lastKey] = false;
  else if (/^\d+$/.test(value)) current[lastKey] = parseInt(value, 10);
  else current[lastKey] = value;

  return result;
}

function flattenConfig(obj: Record<string, unknown>, prefix = ''): [string, unknown][] {
  const result: [string, unknown][] = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result.push(...flattenConfig(value as Record<string, unknown>, path));
    } else {
      result.push([path, value]);
    }
  }
  return result;
}

export const manageCommands: SlashCommandDef[] = [
  {
    command: 'config',
    description: 'View/change settings',
    handler: configHandler,
    category: 'tools',
    usage: '/config [list|get|set|reset|search] [key] [value]',
    examples: ['/config', '/config get connection.host', '/config set connection.port 1234', '/config reset', '/config search git'],
  },
  {
    command: 'doctor',
    description: 'Environment health check',
    handler: doctorHandler,
    category: 'info',
    usage: '/doctor',
    examples: ['/doctor'],
  },
  {
    command: 'mcp',
    description: 'List MCP servers',
    handler: mcpHandler,
    category: 'tools',
    usage: '/mcp',
    examples: ['/mcp'],
  },
  {
    command: 'quickfix',
    aliases: ['fix', 'repair'],
    description: 'Auto-repair config issues',
    handler: quickfixHandler,
    category: 'tools',
    usage: '/quickfix',
    examples: ['/quickfix', '/fix'],
  },
  {
    command: 'permissions',
    aliases: ['perms', 'perm'],
    description: 'View/set tool permissions',
    handler: permissionsHandler,
    category: 'tools',
    usage: '/permissions [tool] [allow|ask|deny]',
    examples: ['/permissions', '/permissions edit_file allow', '/permissions run_command deny'],
  },
];
