import chalk from 'chalk';
import { loadConfig, getConfigStore, OptaConfigSchema } from '../core/config.js';
import { EXIT, ExitError, OptaError } from '../core/errors.js';
import { errorMessage } from '../utils/errors.js';

interface ConfigOptions {
  json?: boolean;
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

    default:
      console.error(chalk.red('✗') + ` Unknown action: ${action}\n`);
      console.log(chalk.dim('Available actions: list, get, set, reset'));
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
    console.log(`  ${chalk.cyan(key.padEnd(30))} ${String(val)}`);
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

  console.log(String(val));
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

  // Parse value type
  let parsed: unknown = value;
  if (value === 'true') parsed = true;
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
    throw new OptaError(
      `Invalid value for "${key}": ${errorMessage(e)}`,
      EXIT.MISUSE,
    );
  }

  console.log(chalk.green('✓') + ` Set ${chalk.cyan(key)} = ${String(parsed)}`);
}

// --- Reset ---

async function resetConfig(): Promise<void> {
  const store = await getConfigStore();
  store.clear();
  console.log(chalk.green('✓') + ' Config reset to defaults');
}

// --- Helpers ---

function flattenObject(
  obj: Record<string, unknown>,
  prefix = ''
): Record<string, unknown> {
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
