/**
 * Model alias management — read, write, list, set, remove, resolve.
 */

import chalk from 'chalk';
import { getConfigStore } from '../../core/config.js';
import { ExitError, EXIT } from '../../core/errors.js';
import {
  MODEL_ALIASES_KEY,
  MODEL_ALIAS_LIMIT,
  warnModelInventoryFallback,
  type ModelAliasMap,
  type ModelsOptions,
} from './types.js';
import { getModelOptions, resolveModelIdFromOptions } from './inventory.js';
import type { LmxClient } from '../../lmx/client.js';

export function normalizeAliasName(alias: string): string {
  return alias
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '');
}

function normalizeModelAliasMap(raw: unknown): ModelAliasMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const map: ModelAliasMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== 'string') continue;
    const alias = normalizeAliasName(key);
    const target = value.trim();
    if (!alias || !target) continue;
    map[alias] = target;
  }
  return map;
}

export function resolveModelAlias(query: string, aliases: ModelAliasMap): string | undefined {
  const normalizedQuery = normalizeAliasName(query);
  if (!normalizedQuery) return undefined;
  return aliases[normalizedQuery];
}

export async function readModelAliasMap(): Promise<ModelAliasMap> {
  const store = await getConfigStore();
  return normalizeModelAliasMap(store.get(MODEL_ALIASES_KEY));
}

export async function writeModelAliasMap(map: ModelAliasMap): Promise<void> {
  const store = await getConfigStore();
  const entries = Object.entries(map)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(0, MODEL_ALIAS_LIMIT);
  store.set(MODEL_ALIASES_KEY, Object.fromEntries(entries));
}

export async function listModelAliases(opts?: ModelsOptions): Promise<void> {
  const aliases = await readModelAliasMap();
  const entries = Object.entries(aliases).sort((a, b) => a[0].localeCompare(b[0]));

  if (opts?.json) {
    console.log(JSON.stringify({ aliases: Object.fromEntries(entries) }, null, 2));
    return;
  }

  console.log(chalk.bold('\nModel Aliases'));
  if (entries.length === 0) {
    console.log(chalk.dim('  No aliases configured.'));
    console.log(chalk.dim('  Add one with: opta models alias mini inferencelabs/GLM-5-MLX-4.8bit'));
    return;
  }

  for (const [alias, target] of entries) {
    console.log(`  ${chalk.cyan(alias)} ${chalk.dim('→')} ${target}`);
  }
}

export async function setModelAlias(
  aliasInput: string | undefined,
  targetInput: string | undefined,
  client: LmxClient,
  defaultModel: string
): Promise<void> {
  const aliasName = normalizeAliasName(aliasInput ?? '');
  if (!aliasName) {
    console.error(chalk.red('✗') + ' Missing alias name');
    console.log(chalk.dim('  Usage: opta models alias <alias> <model-name>'));
    throw new ExitError(EXIT.MISUSE);
  }
  if (!targetInput || !targetInput.trim()) {
    console.error(chalk.red('✗') + ' Missing model target');
    console.log(chalk.dim('  Usage: opta models alias <alias> <model-name>'));
    throw new ExitError(EXIT.MISUSE);
  }

  const aliases = await readModelAliasMap();
  const aliasTarget = resolveModelAlias(targetInput, aliases);
  let resolvedTarget = aliasTarget ?? targetInput.trim();

  const options = await getModelOptions(client).catch((err: unknown) => {
    warnModelInventoryFallback('model options', err);
    return { loaded: [], onDisk: [] };
  });
  const candidateOptions = [...options.loaded, ...options.onDisk];
  if (candidateOptions.length > 0) {
    try {
      resolvedTarget = await resolveModelIdFromOptions(
        resolvedTarget,
        candidateOptions,
        defaultModel,
        'Select model for alias',
        aliases
      );
    } catch (err) {
      if (
        err instanceof ExitError &&
        err.exitCode === EXIT.NOT_FOUND &&
        resolvedTarget.includes('/')
      ) {
        // Allow aliases to point at IDs not detected locally yet.
      } else {
        throw err;
      }
    }
  }

  aliases[aliasName] = resolvedTarget;
  await writeModelAliasMap(aliases);
  console.log(chalk.green('✓') + ` Alias ${chalk.cyan(aliasName)} → ${resolvedTarget}`);
}

export async function removeModelAlias(aliasInput: string | undefined): Promise<void> {
  const aliasName = normalizeAliasName(aliasInput ?? '');
  if (!aliasName) {
    console.error(chalk.red('✗') + ' Missing alias name');
    console.log(chalk.dim('  Usage: opta models unalias <alias>'));
    throw new ExitError(EXIT.MISUSE);
  }

  const aliases = await readModelAliasMap();
  if (!aliases[aliasName]) {
    console.error(chalk.red('✗') + ` Alias "${aliasName}" not found`);
    throw new ExitError(EXIT.NOT_FOUND);
  }

  Reflect.deleteProperty(aliases, aliasName);
  await writeModelAliasMap(aliases);
  console.log(chalk.green('✓') + ` Removed alias ${chalk.cyan(aliasName)}`);
}
