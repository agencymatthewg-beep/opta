/**
 * Management slash commands: /config, /doctor, /mcp, /quickfix
 */

import chalk from 'chalk';
import { box, kv } from '../../ui/box.js';
import { runMenuPrompt } from '../../ui/prompt-nav.js';
import { errorMessage } from '../../utils/errors.js';
import { formatAutonomySlider } from '../../core/autonomy.js';
import type { SlashCommandDef, SlashContext, SlashResult } from './types.js';
import type { PaneMenuSection } from '../../ui/pane-menu.js';
import type { UpdateOptions } from '../update.js';

const CONFIG_SECTION_COLORS: Record<string, string> = {
  connection: '#a855f7',
  model: '#22d3ee',
  autonomy: '#0ea5e9',
  provider: '#3b82f6',
  research: '#0ea5e9',
  browser: '#14b8a6',
  learning: '#f97316',
  policy: '#ef4444',
  permissions: '#f59e0b',
  git: '#10b981',
  tui: '#8b5cf6',
  mcp: '#06b6d4',
  default: '#64748b',
};

function isSensitiveConfigKey(key: string): boolean {
  const k = key.toLowerCase();
  return (
    k.includes('apikey') ||
    k.includes('api_key') ||
    k.includes('token') ||
    k.includes('secret') ||
    k.includes('password') ||
    k.endsWith('.key') ||
    k.includes('adminkey')
  );
}

function formatConfigValueForDisplay(value: unknown, key = ''): string {
  if (value === undefined || value === null) return chalk.dim('(unset)');
  if (key && isSensitiveConfigKey(key)) {
    const raw = typeof value === 'string' ? value : JSON.stringify(value);
    if (!raw) return chalk.dim('(none)');
    return '(set)';
  }
  if (typeof value === 'string') return value.length === 0 ? chalk.dim('(empty)') : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'object') return chalk.dim('{...}');
  // At this point value is number | boolean | bigint | symbol | undefined (non-object, non-string, non-null handled above)
  return String(value as number | boolean | bigint | symbol | undefined);
}

function summarizeConfigValue(value: unknown, maxWidth = 40, key = ''): string {
  const rendered = formatConfigValueForDisplay(value, key);
  const plain = rendered.replace(/\x1B\[[0-9;]*m/g, '');
  if (plain.length <= maxWidth) return rendered;
  return `${plain.slice(0, maxWidth - 1)}…`;
}

function parseSlashArgs(raw: string): string[] {
  const tokens: string[] = [];
  const pattern =
    /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|`([^`\\]*(?:\\.[^`\\]*)*)`|([^\s]+)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(raw)) !== null) {
    const captured = match[1] ?? match[2] ?? match[3] ?? match[4] ?? '';
    tokens.push(captured.replace(/\\(["'`\\])/g, '$1'));
  }

  return tokens;
}

function printMcpUsage(): void {
  console.log(chalk.dim('  Usage: /mcp [list|add|add-playwright|remove|test]'));
  console.log(chalk.dim('    /mcp list'));
  console.log(
    chalk.dim(
      '    /mcp add myserver "npx @modelcontextprotocol/server-filesystem /tmp" --env FOO=bar'
    )
  );
  console.log(
    chalk.dim('    /mcp add-playwright --mode attach --allowed-hosts localhost,127.0.0.1')
  );
  console.log(chalk.dim('    /mcp remove myserver'));
  console.log(chalk.dim('    /mcp test myserver'));
}

function printUpdateUsage(): void {
  console.log(chalk.dim('  Usage: /update [options]'));
  console.log(chalk.dim('    --components|-c cli,lmx,plus,web'));
  console.log(chalk.dim('    --target|-t auto|local|remote|both'));
  console.log(chalk.dim('    --remote-host <host> --remote-user <user> --identity-file <path>'));
  console.log(chalk.dim('    --local-root <path> --remote-root <path>'));
  console.log(chalk.dim('    --dry-run --no-build --no-pull --json'));
}

function printDaemonUsage(): void {
  console.log(chalk.dim('  Usage: /daemon [start|stop|status|logs|run] [options]'));
  console.log(chalk.dim('    --host <host> --port <port> --json'));
  console.log(chalk.dim('    --token <token> --model <name> (run only)'));
}

function printKeyUsage(): void {
  console.log(chalk.dim('  Usage: /key [create|show|copy] [options]'));
  console.log(chalk.dim('    /key show [--reveal] [--copy] [--json]'));
  console.log(chalk.dim('    /key create [--value <key>] [--no-remote] [--no-copy] [--json]'));
  console.log(chalk.dim('    /key copy [--json]'));
}

function printServerUsage(): void {
  console.log(
    chalk.dim('  Usage: /server [start|stop|status|logs] [--host <host>] [--port <port>] [--json]')
  );
  console.log(chalk.dim('  Notes: /server is chat-safe and maps to daemon lifecycle commands.'));
}

export function buildConfigSections(config: Record<string, unknown>): PaneMenuSection[] {
  const entries = flattenConfig(config);
  const grouped = new Map<string, Array<{ key: string; value: unknown }>>();

  for (const [key, value] of entries) {
    const section = key.split('.')[0] ?? 'other';
    const bucket = grouped.get(section) ?? [];
    bucket.push({ key, value });
    grouped.set(section, bucket);
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([section, pairs]) => ({
      id: section,
      label: section.charAt(0).toUpperCase() + section.slice(1),
      color: CONFIG_SECTION_COLORS[section] ?? CONFIG_SECTION_COLORS.default,
      items: pairs
        .sort((a, b) => a.key.localeCompare(b.key))
        .map((pair) => ({
          id: pair.key,
          label: pair.key,
          description: summarizeConfigValue(pair.value, 40, pair.key),
        })),
    }))
    .filter((section) => section.items.length > 0);
}

async function interactiveConfigMenu(ctx: SlashContext): Promise<boolean> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return false;
  }

  const { loadConfig, saveConfig, getConfigStore } = await import('../../core/config.js');
  const { runPaneMenu } = await import('../../ui/pane-menu.js');
  const { input, select } = await import('@inquirer/prompts');

  let sectionIndex = 0;
  let itemIndex = 0;

  while (true) {
    const latest = await loadConfig();
    const sections = buildConfigSections(latest as unknown as Record<string, unknown>);
    if (sections.length === 0) return true;

    const selection = await runPaneMenu({
      title: 'Opta Config Navigator',
      subtitle: 'Finder-style browser for config keys',
      instructions: '←/→ panes · ↑/↓ loop · Enter select · q exit',
      sections,
      initialSectionIndex: sectionIndex,
      initialItemIndex: itemIndex,
      loop: true,
    });

    if (!selection) return true;
    sectionIndex = selection.sectionIndex;
    itemIndex = selection.itemIndex;

    const selectedKey = selection.itemId;
    const currentValue = getNestedValue(latest as Record<string, unknown>, selectedKey);

    console.log(
      '\n' +
        box(`Config ${chalk.cyan(selectedKey)}`, [
          kv('Key', selectedKey, 16),
          kv('Value', formatConfigValueForDisplay(currentValue, selectedKey), 16),
          kv('Type', currentValue === null ? 'null' : typeof currentValue, 16),
          '',
          chalk.dim(`Set with: /config set ${selectedKey} <value>`),
        ]) +
        '\n'
    );

    let action: 'back' | 'set' | 'clear' | 'exit';
    try {
      const picked = await runMenuPrompt(
        (context) =>
          select<'back' | 'set' | 'clear' | 'exit'>(
            {
              message: chalk.dim('Next'),
              choices: [
                { name: 'Back to config navigator', value: 'back' },
                { name: `Set ${selectedKey}`, value: 'set' },
                { name: `Reset ${selectedKey} to default`, value: 'clear' },
                { name: 'Exit config menu', value: 'exit' },
              ],
            },
            context
          ),
        'select'
      );
      if (!picked) continue;
      action = picked;
    } catch {
      return true;
    }

    if (action === 'exit') return true;
    if (action === 'back') continue;

    if (action === 'set') {
      const defaultValue =
        currentValue === undefined
          ? ''
          : typeof currentValue === 'object'
            ? JSON.stringify(currentValue)
            : String(currentValue as string | number | boolean | bigint);
      let valueInput = '';
      try {
        valueInput = await input({
          message: chalk.dim(`Set ${selectedKey}`),
          default: defaultValue,
        });
      } catch {
        continue;
      }

      try {
        const nested = buildNestedObject(selectedKey, valueInput);
        await saveConfig(nested);
        Object.assign(ctx.config, await loadConfig());
        console.log(chalk.green('✓') + ` ${selectedKey} = ${valueInput}`);
      } catch (err) {
        console.error(chalk.red('\u2717') + ` Failed to save: ${errorMessage(err)}`);
      }
      continue;
    }

    try {
      const store = await getConfigStore();
      store.delete(selectedKey);
      Object.assign(ctx.config, await loadConfig());
      console.log(chalk.green('✓') + ` Reset ${selectedKey} to default`);
    } catch (err) {
      console.error(chalk.red('\u2717') + ` Failed to reset: ${errorMessage(err)}`);
    }
  }
}

const configHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  const parts = args.trim().split(/\s+/);
  const rawAction = (parts[0] || 'list').toLowerCase();
  const key = parts[1];
  const value = parts.slice(2).join(' ');
  const menuActions = new Set(['menu', 'interactive', 'nav', 'browser']);

  if (menuActions.has(rawAction)) {
    const opened = await interactiveConfigMenu(ctx);
    if (opened) return 'handled';
  }

  const action = menuActions.has(rawAction) ? 'list' : rawAction;

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
      chalk.dim('Autonomy'),
      kv(
        'level',
        `${ctx.config.autonomy.level} ${formatAutonomySlider(ctx.config.autonomy.level)}`,
        20
      ),
      kv('mode', ctx.config.autonomy.mode, 20),
      kv('enforceProfile', String(ctx.config.autonomy.enforceProfile), 20),
      kv('objectiveReassessment', String(ctx.config.autonomy.objectiveReassessment), 20),
      kv('requireLiveData', String(ctx.config.autonomy.requireLiveData), 20),
      kv('reportStyle', ctx.config.autonomy.reportStyle, 20),
      '',
      chalk.dim('Provider'),
      kv('active', ctx.config.provider.active, 20),
      kv(
        'anthropic.apiKey',
        ctx.config.provider.anthropic.apiKey ? '(set)' : chalk.dim('(none)'),
        20
      ),
      '',
      chalk.dim('Research'),
      kv('enabled', String(ctx.config.research.enabled), 20),
      kv('defaultProvider', ctx.config.research.defaultProvider, 20),
      kv('alwaysIncludeDocs', String(ctx.config.research.alwaysIncludeDocumentation), 20),
      kv(
        'tavily.apiKey',
        ctx.config.research.providers.tavily.apiKey ? '(set)' : chalk.dim('(none)'),
        20
      ),
      kv(
        'gemini.apiKey',
        ctx.config.research.providers.gemini.apiKey ? '(set)' : chalk.dim('(none)'),
        20
      ),
      kv(
        'exa.apiKey',
        ctx.config.research.providers.exa.apiKey ? '(set)' : chalk.dim('(none)'),
        20
      ),
      kv(
        'brave.apiKey',
        ctx.config.research.providers.brave.apiKey ? '(set)' : chalk.dim('(none)'),
        20
      ),
      kv(
        'groq.apiKey',
        ctx.config.research.providers.groq.apiKey ? '(set)' : chalk.dim('(none)'),
        20
      ),
      '',
      chalk.dim('Browser'),
      kv('enabled', String(ctx.config.browser.enabled), 20),
      kv('mode', ctx.config.browser.mode, 20),
      kv('attach.enabled', String(ctx.config.browser.attach.enabled), 20),
      kv('attach.requireApproval', String(ctx.config.browser.attach.requireApproval), 20),
      '',
      chalk.dim('Learning'),
      kv('enabled', String(ctx.config.learning.enabled), 20),
      kv('captureLevel', ctx.config.learning.captureLevel, 20),
      kv('governor.autoCalibrate', String(ctx.config.learning.governor.autoCalibrate), 20),
      '',
      chalk.dim('Policy'),
      kv('enabled', String(ctx.config.policy.enabled), 20),
      kv('mode', ctx.config.policy.mode, 20),
      kv('failureMode', ctx.config.policy.failureMode, 20),
      kv('gateAllAutonomy', String(ctx.config.policy.gateAllAutonomy), 20),
      '',
      chalk.dim('Features'),
      kv('defaultMode', ctx.config.defaultMode, 20),
      kv('git.autoCommit', String(ctx.config.git.autoCommit), 20),
      kv('git.checkpoints', String(ctx.config.git.checkpoints), 20),
      kv('insights.enabled', String(ctx.config.insights.enabled), 20),
      kv('tui.default', String(ctx.config.tui.default), 20),
    ];
    console.log('\n' + box('Config', lines));
    console.log(chalk.dim('  /config menu                \u2014  interactive key navigator'));
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
      console.log(
        `  ${chalk.dim(key + ':')} ${val !== undefined ? (typeof val === 'object' ? JSON.stringify(val) : String(val as string | number | boolean | bigint)) : chalk.dim('(not set)')}`
      );
    } catch (err) {
      console.error(chalk.red('\u2717') + ` ${errorMessage(err)}`);
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
      console.error(chalk.red('\u2717') + ` Failed to save: ${errorMessage(err)}`);
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
      console.error(chalk.red('\u2717') + ` ${errorMessage(err)}`);
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
    const matches = flattenConfig(config).filter(([k]) => k.toLowerCase().includes(pattern));

    if (matches.length === 0) {
      console.log(chalk.dim(`  No config keys matching "${key}"`));
      return 'handled';
    }

    const lines = matches.map(([k, v]) => kv(k, String(v), 30));
    console.log('\n' + box(`Config: "${key}" (${matches.length} matches)`, lines));
    return 'handled';
  }

  console.log(chalk.dim('  Usage: /config [list|get|set|reset|search|menu]'));
  return 'handled';
};

const doctorHandler = async (args: string, _ctx: SlashContext): Promise<SlashResult> => {
  const tokens = parseSlashArgs(args);
  const fix = tokens.includes('--fix');
  try {
    const { runDoctor } = await import('../doctor.js');
    await runDoctor({ fix });
  } catch (err) {
    console.error(chalk.red('\u2717') + ` Doctor failed: ${errorMessage(err)}`);
  }
  return 'handled';
};

const mcpHandler = async (args: string, _ctx: SlashContext): Promise<SlashResult> => {
  const tokens = parseSlashArgs(args);
  const action = (tokens[0] ?? 'list').toLowerCase();

  try {
    const { mcpList, mcpAdd, mcpAddPlaywright, mcpRemove, mcpTest } = await import('../mcp.js');

    if (action === '--help' || action === '-h' || action === 'help') {
      printMcpUsage();
      return 'handled';
    }

    if (action === 'list' || action === 'ls') {
      await mcpList({ json: tokens.includes('--json') });
      return 'handled';
    }

    if (action === 'add') {
      const name = tokens[1];
      if (!name) {
        console.log(chalk.dim('  Usage: /mcp add <name> <command> [--env KEY=VAL,...]'));
        return 'handled';
      }

      let env: string | undefined;
      let envIndex = -1;
      for (let i = 2; i < tokens.length; i += 1) {
        const token = tokens[i]!;
        if (token === '--env' || token.startsWith('--env=')) {
          envIndex = i;
          break;
        }
      }

      const commandTokens = envIndex === -1 ? tokens.slice(2) : tokens.slice(2, envIndex);

      if (commandTokens.length === 0) {
        console.log(chalk.dim('  Usage: /mcp add <name> <command> [--env KEY=VAL,...]'));
        return 'handled';
      }

      if (envIndex !== -1) {
        const envToken = tokens[envIndex]!;
        if (envToken === '--env') {
          env = tokens[envIndex + 1];
        } else {
          env = envToken.slice('--env='.length);
        }
      }

      await mcpAdd(name, commandTokens.join(' '), { env });
      return 'handled';
    }

    if (action === 'add-playwright') {
      const opts: {
        name?: string;
        mode?: 'attach' | 'isolated';
        command?: string;
        packageName?: string;
        allowedHosts?: string[];
        blockedOrigins?: string[];
        env?: string;
      } = {};

      const unknown: string[] = [];
      for (let i = 1; i < tokens.length; i += 1) {
        const token = tokens[i]!;
        if (token === '--name') {
          opts.name = tokens[i + 1];
          i += 1;
          continue;
        }
        if (token.startsWith('--name=')) {
          opts.name = token.slice('--name='.length);
          continue;
        }
        if (token === '--mode') {
          const value = tokens[i + 1];
          if (value === 'attach' || value === 'isolated') {
            opts.mode = value;
          }
          i += 1;
          continue;
        }
        if (token.startsWith('--mode=')) {
          const value = token.slice('--mode='.length);
          if (value === 'attach' || value === 'isolated') {
            opts.mode = value;
          }
          continue;
        }
        if (token === '--command') {
          opts.command = tokens[i + 1];
          i += 1;
          continue;
        }
        if (token.startsWith('--command=')) {
          opts.command = token.slice('--command='.length);
          continue;
        }
        if (token === '--package') {
          opts.packageName = tokens[i + 1];
          i += 1;
          continue;
        }
        if (token.startsWith('--package=')) {
          opts.packageName = token.slice('--package='.length);
          continue;
        }
        if (token === '--allowed-hosts') {
          const raw = tokens[i + 1];
          opts.allowedHosts = raw
            ?.split(',')
            .map((v) => v.trim())
            .filter(Boolean);
          i += 1;
          continue;
        }
        if (token.startsWith('--allowed-hosts=')) {
          opts.allowedHosts = token
            .slice('--allowed-hosts='.length)
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean);
          continue;
        }
        if (token === '--blocked-origins') {
          const raw = tokens[i + 1];
          opts.blockedOrigins = raw
            ?.split(',')
            .map((v) => v.trim())
            .filter(Boolean);
          i += 1;
          continue;
        }
        if (token.startsWith('--blocked-origins=')) {
          opts.blockedOrigins = token
            .slice('--blocked-origins='.length)
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean);
          continue;
        }
        if (token === '--env') {
          opts.env = tokens[i + 1];
          i += 1;
          continue;
        }
        if (token.startsWith('--env=')) {
          opts.env = token.slice('--env='.length);
          continue;
        }
        unknown.push(token);
      }

      if (unknown.length > 0) {
        console.log(chalk.yellow(`  Unknown options: ${unknown.join(', ')}`));
        printMcpUsage();
        return 'handled';
      }

      await mcpAddPlaywright(opts);
      return 'handled';
    }

    if (action === 'remove' || action === 'rm') {
      const name = tokens[1];
      if (!name) {
        console.log(chalk.dim('  Usage: /mcp remove <name>'));
        return 'handled';
      }
      await mcpRemove(name);
      return 'handled';
    }

    if (action === 'test') {
      const name = tokens[1];
      if (!name) {
        console.log(chalk.dim('  Usage: /mcp test <name>'));
        return 'handled';
      }
      await mcpTest(name);
      return 'handled';
    }

    console.log(chalk.yellow(`  Unknown MCP action: ${action}`));
    printMcpUsage();
  } catch (err) {
    console.error(chalk.red('\u2717') + ` MCP command failed: ${errorMessage(err)}`);
  }

  return 'handled';
};

const updateHandler = async (args: string, _ctx: SlashContext): Promise<SlashResult> => {
  const tokens = parseSlashArgs(args);

  if (tokens.includes('--help') || tokens.includes('-h') || tokens.includes('help')) {
    printUpdateUsage();
    return 'handled';
  }

  const opts: UpdateOptions = {};
  const unknown: string[] = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]!;
    if (token === '--components' || token === '-c') {
      opts.components = tokens[i + 1];
      i += 1;
      continue;
    }
    if (token.startsWith('--components=')) {
      opts.components = token.slice('--components='.length);
      continue;
    }
    if (token === '--target' || token === '-t') {
      opts.target = tokens[i + 1] as UpdateOptions['target'];
      i += 1;
      continue;
    }
    if (token.startsWith('--target=')) {
      opts.target = token.slice('--target='.length) as UpdateOptions['target'];
      continue;
    }
    if (token === '--remote-host') {
      opts.remoteHost = tokens[i + 1];
      i += 1;
      continue;
    }
    if (token.startsWith('--remote-host=')) {
      opts.remoteHost = token.slice('--remote-host='.length);
      continue;
    }
    if (token === '--remote-user') {
      opts.remoteUser = tokens[i + 1];
      i += 1;
      continue;
    }
    if (token.startsWith('--remote-user=')) {
      opts.remoteUser = token.slice('--remote-user='.length);
      continue;
    }
    if (token === '--identity-file') {
      opts.identityFile = tokens[i + 1];
      i += 1;
      continue;
    }
    if (token.startsWith('--identity-file=')) {
      opts.identityFile = token.slice('--identity-file='.length);
      continue;
    }
    if (token === '--local-root') {
      opts.localRoot = tokens[i + 1];
      i += 1;
      continue;
    }
    if (token.startsWith('--local-root=')) {
      opts.localRoot = token.slice('--local-root='.length);
      continue;
    }
    if (token === '--remote-root') {
      opts.remoteRoot = tokens[i + 1];
      i += 1;
      continue;
    }
    if (token.startsWith('--remote-root=')) {
      opts.remoteRoot = token.slice('--remote-root='.length);
      continue;
    }
    if (token === '--dry-run') {
      opts.dryRun = true;
      continue;
    }
    if (token === '--no-build') {
      opts.build = false;
      continue;
    }
    if (token === '--no-pull') {
      opts.pull = false;
      continue;
    }
    if (token === '--json') {
      opts.json = true;
      continue;
    }
    unknown.push(token);
  }

  if (unknown.length > 0) {
    console.log(chalk.yellow(`  Unknown options: ${unknown.join(', ')}`));
    printUpdateUsage();
    return 'handled';
  }

  try {
    const { updateCommand } = await import('../update.js');
    await updateCommand(opts);
  } catch (err) {
    console.error(chalk.red('\u2717') + ` Update failed: ${errorMessage(err)}`);
  }

  return 'handled';
};

const serverHandler = async (args: string, _ctx: SlashContext): Promise<SlashResult> => {
  const tokens = parseSlashArgs(args);
  if (tokens.includes('--help') || tokens.includes('-h') || tokens.includes('help')) {
    printServerUsage();
    return 'handled';
  }

  let action = 'status';
  let startIndex = 0;
  const maybeAction = tokens[0]?.toLowerCase();
  if (maybeAction && !maybeAction.startsWith('-')) {
    if (['start', 'stop', 'status', 'logs'].includes(maybeAction)) {
      action = maybeAction;
      startIndex = 1;
    } else {
      console.log(chalk.yellow(`  Unknown /server action: ${tokens[0]}`));
      printServerUsage();
      return 'handled';
    }
  }

  const daemonOpts: { host?: string; port?: string; json?: boolean } = {};
  const unknown: string[] = [];

  for (let i = startIndex; i < tokens.length; i += 1) {
    const token = tokens[i]!;
    if (token === '--host') {
      daemonOpts.host = tokens[i + 1];
      i += 1;
      continue;
    }
    if (token.startsWith('--host=')) {
      daemonOpts.host = token.slice('--host='.length);
      continue;
    }
    if (token === '--port') {
      daemonOpts.port = tokens[i + 1];
      i += 1;
      continue;
    }
    if (token.startsWith('--port=')) {
      daemonOpts.port = token.slice('--port='.length);
      continue;
    }
    if (token === '--json') {
      daemonOpts.json = true;
      continue;
    }
    unknown.push(token);
  }

  if (unknown.length > 0) {
    console.log(chalk.yellow(`  Unknown options: ${unknown.join(', ')}`));
    printServerUsage();
    return 'handled';
  }

  try {
    const { daemonStart, daemonStop, daemonStatusCommand, daemonLogs } =
      await import('../daemon.js');
    if (action === 'start') await daemonStart(daemonOpts);
    else if (action === 'stop') await daemonStop(daemonOpts);
    else if (action === 'logs') await daemonLogs(daemonOpts);
    else await daemonStatusCommand(daemonOpts);
  } catch (err) {
    console.error(chalk.red('\u2717') + ` Server command failed: ${errorMessage(err)}`);
  }

  return 'handled';
};

const daemonHandler = async (args: string, _ctx: SlashContext): Promise<SlashResult> => {
  const tokens = parseSlashArgs(args);
  if (tokens.includes('--help') || tokens.includes('-h') || tokens.includes('help')) {
    printDaemonUsage();
    return 'handled';
  }

  let action = 'status';
  let startIndex = 0;
  const maybeAction = tokens[0]?.toLowerCase();
  if (maybeAction && !maybeAction.startsWith('-')) {
    action = maybeAction;
    startIndex = 1;
  }

  const daemonOpts: {
    host?: string;
    port?: string;
    json?: boolean;
    token?: string;
    model?: string;
  } = {};
  const unknown: string[] = [];

  for (let i = startIndex; i < tokens.length; i += 1) {
    const token = tokens[i]!;
    if (token === '--host') {
      daemonOpts.host = tokens[i + 1];
      i += 1;
      continue;
    }
    if (token.startsWith('--host=')) {
      daemonOpts.host = token.slice('--host='.length);
      continue;
    }
    if (token === '--port') {
      daemonOpts.port = tokens[i + 1];
      i += 1;
      continue;
    }
    if (token.startsWith('--port=')) {
      daemonOpts.port = token.slice('--port='.length);
      continue;
    }
    if (token === '--json') {
      daemonOpts.json = true;
      continue;
    }
    if (token === '--token') {
      daemonOpts.token = tokens[i + 1];
      i += 1;
      continue;
    }
    if (token.startsWith('--token=')) {
      daemonOpts.token = token.slice('--token='.length);
      continue;
    }
    if (token === '--model') {
      daemonOpts.model = tokens[i + 1];
      i += 1;
      continue;
    }
    if (token.startsWith('--model=')) {
      daemonOpts.model = token.slice('--model='.length);
      continue;
    }
    unknown.push(token);
  }

  if (unknown.length > 0) {
    console.log(chalk.yellow(`  Unknown options: ${unknown.join(', ')}`));
    printDaemonUsage();
    return 'handled';
  }

  try {
    const { daemonStart, daemonRun, daemonStop, daemonStatusCommand, daemonLogs } =
      await import('../daemon.js');

    if (action === 'start') {
      await daemonStart(daemonOpts);
      return 'handled';
    }
    if (action === 'run') {
      await daemonRun(daemonOpts);
      return 'handled';
    }
    if (action === 'stop') {
      await daemonStop(daemonOpts);
      return 'handled';
    }
    if (action === 'logs') {
      await daemonLogs(daemonOpts);
      return 'handled';
    }
    if (action === 'status') {
      await daemonStatusCommand(daemonOpts);
      return 'handled';
    }

    console.log(chalk.yellow(`  Unknown daemon action: ${action}`));
    printDaemonUsage();
  } catch (err) {
    console.error(chalk.red('\u2717') + ` Daemon command failed: ${errorMessage(err)}`);
  }

  return 'handled';
};

const completionsHandler = async (args: string, _ctx: SlashContext): Promise<SlashResult> => {
  const tokens = parseSlashArgs(args);
  const shell = tokens[0]?.toLowerCase();
  if (!shell || !['bash', 'zsh', 'fish'].includes(shell)) {
    console.log(chalk.dim('  Usage: /completions <bash|zsh|fish>'));
    return 'handled';
  }

  try {
    const { completions } = await import('../completions.js');
    completions(shell);
  } catch (err) {
    console.error(chalk.red('\u2717') + ` Completions failed: ${errorMessage(err)}`);
  }

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

    const fixed = issues.filter((i) => i.autoFixed);
    const manual = issues.filter((i) => !i.autoFixed);

    const lines: string[] = [];
    for (const issue of issues) {
      const icon = issue.autoFixed ? chalk.green('\u2713') : chalk.yellow('\u26a0');
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
        '\n'
    );
  } catch (err) {
    console.error(chalk.red('\u2717') + ` Quickfix failed: ${errorMessage(err)}`);
  }
  return 'handled';
};

const keyHandler = async (args: string, _ctx: SlashContext): Promise<SlashResult> => {
  const tokens = parseSlashArgs(args);
  const first = tokens[0]?.toLowerCase();
  const hasExplicitAction = Boolean(first && !first.startsWith('-'));
  const action = hasExplicitAction ? first! : 'show';
  const rest = hasExplicitAction ? tokens.slice(1) : tokens;

  if (action === 'help' || rest.includes('--help') || rest.includes('-h')) {
    printKeyUsage();
    return 'handled';
  }

  try {
    const { keyCreate, keyShow, keyCopy } = await import('../key.js');

    if (action === 'create' || action === 'rotate') {
      const opts: {
        value?: string;
        remote?: boolean;
        copy?: boolean;
        json?: boolean;
      } = {};
      const unknown: string[] = [];

      for (let i = 0; i < rest.length; i += 1) {
        const token = rest[i]!;
        if (token === '--value') {
          opts.value = rest[i + 1];
          i += 1;
          continue;
        }
        if (token.startsWith('--value=')) {
          opts.value = token.slice('--value='.length);
          continue;
        }
        if (token === '--no-remote') {
          opts.remote = false;
          continue;
        }
        if (token === '--no-copy') {
          opts.copy = false;
          continue;
        }
        if (token === '--json') {
          opts.json = true;
          continue;
        }
        unknown.push(token);
      }

      if (unknown.length > 0) {
        console.log(chalk.yellow(`  Unknown options: ${unknown.join(', ')}`));
        printKeyUsage();
        return 'handled';
      }

      await keyCreate(opts);
      return 'handled';
    }

    if (action === 'show') {
      const opts: { reveal?: boolean; copy?: boolean; json?: boolean } = {};
      const unknown: string[] = [];
      for (const token of rest) {
        if (token === '--reveal') opts.reveal = true;
        else if (token === '--copy') opts.copy = true;
        else if (token === '--json') opts.json = true;
        else unknown.push(token);
      }
      if (unknown.length > 0) {
        console.log(chalk.yellow(`  Unknown options: ${unknown.join(', ')}`));
        printKeyUsage();
        return 'handled';
      }
      await keyShow(opts);
      return 'handled';
    }

    if (action === 'copy') {
      const unknown = rest.filter((token) => token !== '--json');
      if (unknown.length > 0) {
        console.log(chalk.yellow(`  Unknown options: ${unknown.join(', ')}`));
        printKeyUsage();
        return 'handled';
      }
      await keyCopy({ json: rest.includes('--json') });
      return 'handled';
    }

    console.log(chalk.yellow(`  Unknown key action: ${action}`));
    printKeyUsage();
  } catch (err) {
    console.error(chalk.red('\u2717') + ` Key command failed: ${errorMessage(err)}`);
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
      read_file: 'allow',
      write_file: 'ask',
      edit_file: 'ask',
      run_command: 'ask',
      ask_user: 'allow',
      list_dir: 'allow',
      search_files: 'allow',
      find_files: 'allow',
    };
    const lines: string[] = [];
    for (const [tool, defaultVal] of Object.entries(defaults)) {
      const current = (perms as Record<string, string>)[tool] || defaultVal;
      const color =
        current === 'allow' ? chalk.green : current === 'deny' ? chalk.red : chalk.yellow;
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
    console.error(chalk.red('\u2717') + ` Failed: ${errorMessage(err)}`);
  }
  return 'handled';
};

const skillsHandler = async (_args: string, _ctx: SlashContext): Promise<SlashResult> => {
  try {
    const { TOOL_SCHEMAS } = await import('../../core/tools/schemas.js');
    const { getAllCommands } = await import('./index.js');

    const tools = TOOL_SCHEMAS.map((t) => t.function.name).sort();
    const slash = getAllCommands()
      .map((c) => `/${c.command}`)
      .sort();

    const lines: string[] = [
      chalk.dim('Tool Skills'),
      ...tools.map((t) => `  ${chalk.cyan(t)}`),
      '',
      chalk.dim(`Slash Commands (${slash.length})`),
      ...slash.slice(0, 20).map((c) => `  ${chalk.green(c)}`),
    ];
    if (slash.length > 20) lines.push(chalk.dim(`  ... ${slash.length - 20} more`));

    console.log('\n' + box('Skills', lines));
  } catch (err) {
    console.error(chalk.red('✗') + ` ${errorMessage(err)}`);
  }
  return 'handled';
};

const keysHandler = (_args: string, ctx: SlashContext): Promise<SlashResult> => {
  const mask = (v?: string) => {
    if (!v) return chalk.dim('(missing)');
    if (v.length <= 10) return chalk.yellow(v);
    return chalk.yellow(`${v.slice(0, 6)}...${v.slice(-4)}`);
  };
  const env = ((ctx.config as Record<string, unknown>).env ?? {}) as Record<
    string,
    string | undefined
  >;
  const tgChannels = (ctx.config as Record<string, unknown>).channels as
    | { telegram?: { botToken?: string } }
    | undefined;
  const tg = tgChannels?.telegram?.botToken;

  const rows: string[] = [
    kv('OPTA_API_KEY(env)', mask(process.env['OPTA_API_KEY']), 24),
    kv('connection.apiKey', mask(ctx.config.connection.apiKey), 24),
    kv('GEMINI_API_KEY', mask(env.GEMINI_API_KEY), 24),
    kv('GROQ_API_KEY', mask(env.GROQ_API_KEY), 24),
    kv('KIMI_API_KEY', mask(env.KIMI_API_KEY), 24),
    kv('MINIMAX_API_KEY', mask(env.MINIMAX_API_KEY), 24),
    kv('OPENCODE_API_KEY', mask(env.OPENCODE_API_KEY), 24),
    kv('TELEGRAM_BOT_TOKEN', mask(tg), 24),
  ];

  console.log('\n' + box('Key Status (masked)', rows));
  console.log(chalk.dim('  Tip: /key create|show|copy manages Opta inference API keys.\n'));
  return Promise.resolve('handled');
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
    usage: '/config [list|get|set|reset|search|menu] [key] [value]',
    examples: [
      '/config',
      '/config menu',
      '/config get connection.host',
      '/config set connection.port 1234',
      '/config reset',
      '/config search git',
    ],
  },
  {
    command: 'doctor',
    description: 'Environment health check and auto-remediation',
    handler: doctorHandler,
    category: 'info',
    usage: '/doctor [--fix]',
    examples: ['/doctor', '/doctor --fix'],
  },
  {
    command: 'mcp',
    aliases: ['mcps'],
    description: 'Manage MCP servers (list/add/remove/test)',
    handler: mcpHandler,
    category: 'tools',
    usage: '/mcp [list|add|add-playwright|remove|test] ...',
    examples: [
      '/mcp',
      '/mcp add docs "npx @modelcontextprotocol/server-filesystem ."',
      '/mcp test docs',
    ],
  },
  {
    command: 'update',
    description: 'Update Opta components (cli/lmx/plus/web)',
    handler: updateHandler,
    category: 'tools',
    usage: '/update [--components ...] [--target ...] [--dry-run] [--no-build] [--no-pull]',
    examples: ['/update --dry-run', '/update --components web --target local'],
  },
  {
    command: 'server',
    description: 'Manage chat-safe server lifecycle (daemon wrapper)',
    handler: serverHandler,
    category: 'server',
    usage: '/server [start|stop|status|logs] [--host <host>] [--port <port>] [--json]',
    examples: ['/server status', '/server start --host 127.0.0.1 --port 3456'],
  },
  {
    command: 'daemon',
    description: 'Manage daemon runtime (start/stop/status/logs/run)',
    handler: daemonHandler,
    category: 'server',
    usage: '/daemon [start|stop|status|logs|run] [--host <host>] [--port <port>] [--json]',
    examples: ['/daemon status', '/daemon start', '/daemon logs'],
  },
  {
    command: 'completions',
    description: 'Generate shell completions (bash/zsh/fish)',
    handler: completionsHandler,
    category: 'tools',
    usage: '/completions <bash|zsh|fish>',
    examples: ['/completions zsh'],
  },
  {
    command: 'skills',
    description: 'List available tool skills and slash commands',
    handler: skillsHandler,
    category: 'info',
    usage: '/skills',
    examples: ['/skills'],
  },
  {
    command: 'key',
    aliases: ['apikey'],
    description: 'Manage Opta inference API key (create/show/copy)',
    handler: keyHandler,
    category: 'tools',
    usage: '/key [create|show|copy] [options]',
    examples: ['/key', '/key show --reveal', '/key create --no-remote', '/key copy'],
  },
  {
    command: 'keys',
    description: 'Show configured API key status (masked)',
    handler: keysHandler,
    category: 'info',
    usage: '/keys',
    examples: ['/keys'],
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
