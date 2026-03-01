/**
 * Barrel entry point for the models command subsystem.
 *
 * Re-exports all public symbols so that existing imports like:
 *   import { models } from './commands/models.js';
 *   import { normalizeModelKey, rankModelIds } from '../../src/commands/models.js';
 * continue to work unchanged after the monolith→directory split.
 */

import chalk from 'chalk';
import { loadConfig } from '../../core/config.js';
import { ExitError, EXIT } from '../../core/errors.js';
import { LmxClient } from '../../lmx/client.js';
import { isInteractiveTerminal, type ModelsOptions } from './types.js';
import { readModelAliasMap, resolveModelAlias } from './aliases.js';
import {
  resolveEffectiveDefaultModel,
  listModels,
  showModelDashboard,
  scanModelsCommand,
  getModelOptions,
} from './inventory.js';
import { showModelHistory } from './history.js';
import { listModelAliases, setModelAlias, removeModelAlias } from './aliases.js';
import {
  useModel,
  infoModel,
  loadModel,
  unloadModel,
  downloadModel,
  deleteModel,
  benchmarkModel,
  stopAllModels,
  swapModel,
} from './lifecycle.js';
import { browseLocalModels, browseFullLibrary, promptManagerAction } from './browser.js';
import {
  showPredictorStats,
  showHelpersHealth,
  runQuantizeCommand,
  runAgentsCommand,
  runSkillsCommand,
  runRagCommand,
  runHealthCommand,
} from './extensions.js';

// ── Re-exports for backward-compatible barrel ───────────────────────

// types.ts — public symbols
export {
  type ModelHistoryEntry,
  formatModelInventoryWarning,
  normalizeModelKey,
  rankModelIds,
  computeLifecycleStagePercent,
} from './types.js';

// history.ts — public symbols
export { normalizeModelHistoryEntries, mergeModelHistoryEntries } from './history.js';

// ── Main entry function ─────────────────────────────────────────────

export async function models(
  action?: string,
  name?: string,
  extraArg?: string,
  opts?: ModelsOptions
): Promise<void> {
  const config = await loadConfig();
  const { host, port } = config.connection;
  const client = new LmxClient({
    host,
    fallbackHosts: config.connection.fallbackHosts,
    port,
    adminKey: config.connection.adminKey,
  });
  const defaultModel = await resolveEffectiveDefaultModel(client, config.model.default, opts);
  const effectiveConfig = { ...config, model: { ...config.model, default: defaultModel } };
  const aliasMap = await readModelAliasMap();
  const resolveWithAlias = (input?: string): string | undefined => {
    if (!input) return input;
    return resolveModelAlias(input, aliasMap) ?? input;
  };
  const resolvedName = action === 'alias' ? name : resolveWithAlias(name);
  const resolvedExtra = action === 'swap' ? resolveWithAlias(extraArg) : extraArg;

  switch (action) {
    case 'help':
      printModelsHelp();
      return;
    case 'list':
      await listModels(client, defaultModel, opts);
      return;
    case 'manage':
    case 'interactive':
    case 'ui':
      await interactiveModelManager(client, effectiveConfig, opts);
      return;
    case 'dashboard':
      await showModelDashboard(client, defaultModel, opts);
      return;
    case 'aliases':
      await listModelAliases(opts);
      return;
    case 'alias':
      await setModelAlias(name, extraArg, client, defaultModel);
      return;
    case 'unalias':
      await removeModelAlias(name);
      return;
    case 'use':
      await useModel(resolvedName, client, defaultModel, aliasMap);
      return;
    case 'info':
      await infoModel(resolvedName, client, opts);
      return;
    case 'load':
      await loadModel(resolvedName, client, aliasMap, defaultModel);
      return;
    case 'unload':
      await unloadModel(resolvedName, client, aliasMap);
      return;
    case 'stop':
      await stopAllModels(client);
      return;
    case 'swap':
      await swapModel(resolvedName, resolvedExtra, client, aliasMap);
      return;
    case 'history':
      await showModelHistory(opts);
      return;
    case 'download':
      await downloadModel(resolvedName, client);
      return;
    case 'delete':
    case 'remove':
      await deleteModel(resolvedName, client);
      return;
    case 'benchmark':
    case 'bench':
      await benchmarkModel(resolvedName, client);
      return;
    case 'predictor':
      await showPredictorStats(client, opts);
      return;
    case 'helpers':
      await showHelpersHealth(client, opts);
      return;
    case 'quantize':
      await runQuantizeCommand(resolvedName, client, opts);
      return;
    case 'agents':
      await runAgentsCommand(resolvedName, client, opts, config.connection);
      return;
    case 'skills':
      await runSkillsCommand(resolvedName, client, opts);
      return;
    case 'rag':
      await runRagCommand(resolvedName, client, opts);
      return;
    case 'health':
      await runHealthCommand(resolvedName, client, opts, config.connection);
      return;
    case 'scan':
      await scanModelsCommand(client, effectiveConfig, opts);
      return;
    case 'browse':
    case 'browse-local':
      if (!isInteractiveTerminal()) {
        console.error(chalk.red('✗') + ' browse-local requires an interactive terminal');
        throw new ExitError(EXIT.MISUSE);
      }
      await browseLocalModels(client, defaultModel);
      return;
    case 'library':
    case 'browse-library':
      if (!isInteractiveTerminal()) {
        console.error(chalk.red('✗') + ' browse-library requires an interactive terminal');
        throw new ExitError(EXIT.MISUSE);
      }
      await browseFullLibrary(client, defaultModel);
      return;
    default:
      if (!action && !opts?.json && isInteractiveTerminal()) {
        await interactiveModelManager(client, effectiveConfig, opts);
        return;
      }
      await listModels(client, defaultModel, opts);
  }
}

// ── Interactive Model Manager ───────────────────────────────────────

async function interactiveModelManager(
  client: LmxClient,
  initialConfig: Awaited<ReturnType<typeof loadConfig>>,
  opts?: ModelsOptions
): Promise<void> {
  if (opts?.json || !isInteractiveTerminal()) {
    await listModels(client, initialConfig.model.default, opts);
    return;
  }

  console.log(chalk.bold('\nInteractive Model Manager'));
  console.log(chalk.dim('Use arrows + Enter. Type in picker prompts for fuzzy matching.\n'));

  let currentDefault = initialConfig.model.default;
  let currentConfig = {
    ...initialConfig,
    model: { ...initialConfig.model, default: currentDefault },
  };

  while (true) {
    const { loaded, onDisk } = await getModelOptions(client);
    const action = await promptManagerAction(loaded.length, onDisk.length, currentDefault);
    if (!action || action === 'exit') return;
    if (action === 'refresh') continue;

    try {
      switch (action) {
        case 'use':
          currentDefault = await useModel(undefined, client, currentDefault);
          currentConfig = {
            ...currentConfig,
            model: { ...currentConfig.model, default: currentDefault },
          };
          break;
        case 'load':
          await loadModel(undefined, client, {}, currentDefault);
          break;
        case 'unload':
          await unloadModel(undefined, client);
          break;
        case 'swap':
          await swapModel(undefined, undefined, client);
          break;
        case 'stop':
          await stopAllModels(client);
          break;
        case 'browse-local':
          await browseLocalModels(client, currentDefault);
          break;
        case 'browse-library':
          await browseFullLibrary(client, currentDefault);
          break;
        case 'scan':
          await scanModelsCommand(client, currentConfig, opts);
          break;
        case 'dashboard':
          await showModelDashboard(client, currentDefault, opts);
          break;
      }
    } catch (err) {
      if (err instanceof ExitError && err.exitCode === EXIT.SIGINT) {
        console.log(chalk.dim('  Cancelled'));
        continue;
      }
      throw err;
    }
  }
}

// ── Help ────────────────────────────────────────────────────────────

function printModelsHelp(): void {
  console.log(chalk.bold('Model Commands\n'));
  console.log(
    `  ${chalk.reset('opta models')}                     interactive manager (TTY) or list`
  );
  console.log(`  ${chalk.reset('opta models list')}                list loaded models`);
  console.log(`  ${chalk.reset('opta models history')}             show recent model activity`);
  console.log(`  ${chalk.reset('opta models manage')}              open interactive model manager`);
  console.log(
    `  ${chalk.reset('opta models use [name]')}          switch default (fuzzy + picker)`
  );
  console.log(`  ${chalk.reset('opta models load [name]')}         load a downloaded model`);
  console.log(`  ${chalk.reset('opta models unload [name]')}       unload a running model`);
  console.log(`  ${chalk.reset('opta models swap [old] [new]')}    replace running model`);
  console.log(
    `  ${chalk.reset('opta models dashboard')}           show live model inventory dashboard`
  );
  console.log(`  ${chalk.reset('opta models aliases')}             list custom aliases`);
  console.log(`  ${chalk.reset('opta models alias <a> <model>')}   map alias to a model id`);
  console.log(`  ${chalk.reset('opta models unalias <a>')}         remove an alias`);
  console.log(`  ${chalk.reset('opta models stop')}                unload all models`);
  console.log(
    `  ${chalk.reset('opta models predictor')}           predictor stats and next-model guess`
  );
  console.log(`  ${chalk.reset('opta models helpers')}             helper node health dashboard`);
  console.log(
    `  ${chalk.reset('opta models quantize ...')}        start/list/check quantization jobs`
  );
  console.log(
    `  ${chalk.reset('opta models agents ...')}          list/start/status/cancel/watch agent runs`
  );
  console.log(
    `  ${chalk.reset('opta models skills ...')}          list/show/run/mcp-call/openclaw skills`
  );
  console.log(
    `  ${chalk.reset('opta models rag ...')}             query/list/delete/ingest/context RAG`
  );
  console.log(
    `  ${chalk.reset('opta models health')}              liveness/readiness/admin health checks`
  );
  console.log(`  ${chalk.reset('opta models scan')}                full local/cloud inventory`);
  console.log(
    `  ${chalk.reset('opta models browse-local')}        browse downloaded models + history`
  );
  console.log(
    `  ${chalk.reset('opta models browse-library')}      browse global Hugging Face library`
  );
}
