/**
 * Management slash commands: /config, /doctor, /mcp
 */

import chalk from 'chalk';
import { box, kv, statusDot } from '../../ui/box.js';
import type { SlashCommandDef, SlashContext, SlashResult } from './types.js';

const configHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  const parts = args.trim().split(/\s+/);
  const action = parts[0] || 'list';
  const key = parts[1];
  const value = parts.slice(2).join(' ');

  if (action === 'list' || action === '') {
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

  console.log(chalk.dim('  Usage: /config [list|get|set|reset]'));
  return 'handled';
};

const doctorHandler = async (_args: string, ctx: SlashContext): Promise<SlashResult> => {
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

export const manageCommands: SlashCommandDef[] = [
  {
    command: 'config',
    description: 'View/change settings',
    handler: configHandler,
    category: 'tools',
  },
  {
    command: 'doctor',
    description: 'Environment health check',
    handler: doctorHandler,
    category: 'info',
  },
  {
    command: 'mcp',
    description: 'List MCP servers',
    handler: mcpHandler,
    category: 'tools',
  },
];
