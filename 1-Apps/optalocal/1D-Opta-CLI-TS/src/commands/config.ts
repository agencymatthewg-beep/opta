import chalk from 'chalk';
import { loadConfig, getConfigStore, OptaConfigSchema } from '../core/config.js';
import { EXIT, ExitError, OptaError } from '../core/errors.js';
import { errorMessage } from '../utils/errors.js';
import { box, kv } from '../ui/box.js';
import type { PaneMenuSection } from '../ui/pane-menu.js';
import { runMenuPrompt } from '../ui/prompt-nav.js';

interface ConfigOptions {
  json?: boolean;
}

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

function unknownToStr(v: unknown, fallback = ''): string {
  if (v === null || v === undefined) return fallback;
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v as number | boolean | bigint);
}

function maskSensitiveConfigValue(value: unknown): string {
  const raw = unknownToStr(value);
  if (!raw || raw === 'undefined') return chalk.dim('(none)');
  if (raw.length <= 6) return '******';
  return `${'*'.repeat(Math.max(0, raw.length - 4))}${raw.slice(-4)}`;
}

export async function config(
  action?: string,
  key?: string,
  value?: string,
  opts?: ConfigOptions
): Promise<void> {
  // Default: list
  if (!action || action === 'list') {
    await listConfig(opts);
    return;
  }

  switch (action) {
    case 'get':
      await getConfig(key);
      break;

    case 'set':
      await setConfig(key, value);
      break;

    case 'reset':
      await resetConfig();
      break;

    case 'menu':
    case 'interactive':
      await configMenu();
      break;

    case 'settings':
      console.log('To open settings:');
      console.log('  1. Run: opta');
      console.log('  2. Press Ctrl+S to open Opta Menu');
      console.log('  3. Select Settings from the Operations page');
      console.log('');
      console.log('Or press Ctrl+Shift+S directly to open settings.');
      break;

    default:
      console.error(chalk.red('✗') + ` Unknown action: ${action}\n`);
      console.log(chalk.dim('Available actions: list, get, set, reset, menu, settings'));
      throw new ExitError(EXIT.MISUSE);
  }
}

// --- List ---

async function listConfig(opts?: ConfigOptions): Promise<void> {
  const cfg = await loadConfig();

  if (opts?.json) {
    console.log(JSON.stringify(cfg, null, 2));
    return;
  }

  const flat = flattenObject(cfg);

  for (const [key, val] of Object.entries(flat)) {
    const display = isSensitiveConfigKey(key) ? maskSensitiveConfigValue(val) : String(val);
    console.log(`  ${chalk.cyan(key.padEnd(30))} ${display}`);
  }
}

// --- Get ---

async function getConfig(key?: string): Promise<void> {
  if (!key) {
    console.error(chalk.red('✗') + ' Key required\n');
    console.log(chalk.dim('Usage: opta config get <key>'));
    console.log(chalk.dim('Example: opta config get connection.host'));
    throw new ExitError(EXIT.MISUSE);
  }

  const cfg = await loadConfig();
  const flat = flattenObject(cfg);
  const val = flat[key];

  if (val === undefined) {
    console.error(chalk.red('✗') + ` Unknown key: ${key}\n`);
    console.log(chalk.dim('Available keys:'));
    for (const k of Object.keys(flat)) {
      console.log(chalk.dim(`  ${k}`));
    }
    throw new ExitError(EXIT.NOT_FOUND);
  }

  console.log(unknownToStr(val));
}

// --- Set ---

async function setConfig(key?: string, value?: string): Promise<void> {
  if (!key || value === undefined) {
    console.error(chalk.red('✗') + ' Key and value required\n');
    console.log(chalk.dim('Usage: opta config set <key> <value>'));
    console.log(chalk.dim('Example: opta config set permissions.edit_file allow'));
    throw new ExitError(EXIT.MISUSE);
  }

  const store = await getConfigStore();

  // Capture old value for display
  const oldRaw = store.get(key);
  const oldValue = oldRaw !== undefined ? unknownToStr(oldRaw) : chalk.dim('(default)');

  // Parse value type
  let parsed: unknown = value;
  if (key === 'connection.fallbackHosts') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        throw new OptaError(
          `Invalid value for "${key}": expected a JSON array or comma-separated host list`,
          EXIT.MISUSE
        );
      }
    } else if (trimmed.length === 0) {
      parsed = [];
    } else {
      parsed = trimmed
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    }
  } else if (value === 'true') parsed = true;
  else if (value === 'false') parsed = false;
  else if (/^\d+$/.test(value)) parsed = parseInt(value, 10);
  else if (/^\d+\.\d+$/.test(value)) parsed = parseFloat(value);

  store.set(key, parsed);

  // Validate the full merged config against the Zod schema
  try {
    const fullConfig = store.store;
    OptaConfigSchema.parse(fullConfig);
  } catch (e) {
    // Revert the change — the value is invalid
    store.delete(key);
    throw new OptaError(`Invalid value for "${key}": ${errorMessage(e)}`, EXIT.MISUSE);
  }

  console.log(chalk.green('✓') + ` ${chalk.cyan(key)}: ${chalk.dim(oldValue)} → ${String(parsed)}`);
}

// --- Reset ---

async function resetConfig(): Promise<void> {
  const store = await getConfigStore();
  store.clear();
  console.log(chalk.green('✓') + ' Config reset to defaults');
}

async function configMenu(): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    await listConfig();
    return;
  }

  const { runPaneMenu } = await import('../ui/pane-menu.js');
  const { select, input } = await import('@inquirer/prompts');

  let sectionIndex = 0;
  let itemIndex = 0;

  while (true) {
    const cfg = await loadConfig();
    const flat = flattenObject(cfg as unknown as Record<string, unknown>);
    const sections = buildConfigMenuSections(flat);
    const selection = await runPaneMenu({
      title: 'Opta Config Menu',
      subtitle: 'Browse keys with arrows, set values with Enter',
      instructions: '←/→ panes · ↑/↓ loop · Enter select · q exit',
      sections,
      initialSectionIndex: sectionIndex,
      initialItemIndex: itemIndex,
      loop: true,
    });

    if (!selection) return;
    sectionIndex = selection.sectionIndex;
    itemIndex = selection.itemIndex;

    const selectedKey = selection.itemId;
    const current = flat[selectedKey];

    console.log(
      '\n' +
        box(`Config ${chalk.cyan(selectedKey)}`, [
          kv('Key', selectedKey, 16),
          kv(
            'Value',
            isSensitiveConfigKey(selectedKey)
              ? maskSensitiveConfigValue(current)
              : current !== undefined && current !== null
                ? unknownToStr(current)
                : chalk.dim('(unset)'),
            16
          ),
          '',
          chalk.dim(`Set with: opta config set ${selectedKey} <value>`),
        ]) +
        '\n'
    );

    let action: 'back' | 'set' | 'reset' | 'exit';
    try {
      const picked = await runMenuPrompt(
        (context) =>
          select<'back' | 'set' | 'reset' | 'exit'>(
            {
              message: chalk.dim('Next'),
              choices: [
                { name: 'Back to config menu', value: 'back' },
                { name: `Set ${selectedKey}`, value: 'set' },
                { name: `Reset ${selectedKey} to default`, value: 'reset' },
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
      return;
    }

    if (action === 'exit') return;
    if (action === 'back') continue;

    if (action === 'set') {
      let nextValue = '';
      try {
        nextValue = await input({
          message: chalk.dim(`Set ${selectedKey}`),
          default: isSensitiveConfigKey(selectedKey)
            ? ''
            : current === undefined
              ? ''
              : unknownToStr(current),
        });
      } catch {
        continue;
      }
      try {
        await setConfig(selectedKey, nextValue);
      } catch (err) {
        console.error(chalk.red('✗') + ` ${errorMessage(err)}`);
      }
      continue;
    }

    const store = await getConfigStore();
    store.delete(selectedKey);
    console.log(chalk.green('✓') + ` ${selectedKey} reset to default`);
  }
}

// --- Helpers ---

function flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      Object.assign(result, flattenObject(val as Record<string, unknown>, fullKey));
    } else {
      result[fullKey] = val;
    }
  }

  return result;
}

function buildConfigMenuSections(flat: Record<string, unknown>): PaneMenuSection[] {
  const grouped = new Map<string, Array<{ key: string; value: unknown }>>();

  for (const [key, value] of Object.entries(flat)) {
    const section = key.split('.')[0] ?? 'other';
    const items = grouped.get(section) ?? [];
    items.push({ key, value });
    grouped.set(section, items);
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([section, items]) => ({
      id: section,
      label: section.charAt(0).toUpperCase() + section.slice(1),
      color: '#a855f7',
      items: items
        .sort((a, b) => a.key.localeCompare(b.key))
        .map((item) => ({
          id: item.key,
          label: item.key,
          description: String(item.value).slice(0, 36),
        })),
    }));
}
