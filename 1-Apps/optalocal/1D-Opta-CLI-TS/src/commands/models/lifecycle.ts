/**
 * Model lifecycle operations — use, info, load, unload, swap, download, delete, benchmark, stop.
 */

import chalk from 'chalk';
import { loadConfig, saveConfig } from '../../core/config.js';
import { ExitError, EXIT } from '../../core/errors.js';
import { createSpinner } from '../../ui/spinner.js';
import { renderPercentBar } from '../../ui/progress.js';
import { errorMessage, NO_MODELS_LOADED } from '../../utils/errors.js';
import { LmxClient, LmxApiError, lookupContextLimit } from '../../lmx/client.js';
import {
  ensureModelLoaded,
  findMatchingModelId,
  normalizeConfiguredModelId,
  isPlaceholderModelId,
  modelIdsEqual,
  waitForModelUnloaded,
} from '../../lmx/model-lifecycle.js';
import { getDisplayProfile } from '../../core/model-display.js';
import { fmtGB } from '../../providers/model-scan.js';
import {
  FAST_DISCOVERY_REQUEST_OPTS,
  STABLE_MODEL_LOAD_TIMEOUT_MS,
  STABLE_MODEL_LOAD_REQUEST_TIMEOUT_MS,
  progressText,
  throwModelCommandError,
  warnModelInventoryFallback,
  createLoadProgressUpdater,
  createUnloadProgressUpdater,
  fmtTag,
  type ModelsOptions,
  type ModelAliasMap,
} from './types.js';
import { recordModelHistory } from './history.js';
import { getModelOptions, resolveModelIdFromOptions } from './inventory.js';

export async function useModel(
  name: string | undefined,
  client: LmxClient,
  defaultModel: string,
  aliasMap: ModelAliasMap = {}
): Promise<string> {
  const spinner = await createSpinner();
  spinner.start(progressText('Set default', 15, 'fetching model catalog'));

  try {
    const { loaded, onDisk } = await getModelOptions(client);
    spinner.stop();
    console.log(chalk.dim(`  ${progressText('Set default', 45, 'catalog ready')}`));

    const options = [...loaded, ...onDisk];
    const selectedId = await resolveModelIdFromOptions(
      name,
      options,
      defaultModel,
      'Select default model',
      aliasMap
    );

    const selectedLoaded = loaded.find((m) => modelIdsEqual(m.id, selectedId));
    const contextLimit = selectedLoaded?.contextLength ?? lookupContextLimit(selectedId);

    spinner.start(progressText('Set default', 75, `saving ${selectedId}`));
    await saveConfig({
      model: { default: selectedId, contextLimit },
    });
    spinner.succeed(progressText('Set default', 100, `default set to ${selectedId}`));

    if (!selectedLoaded) {
      console.log(
        chalk.dim(
          `  ${selectedId} is on disk; run ${chalk.reset(`opta models load ${selectedId}`)} to load it now`
        )
      );
    }
    return selectedId;
  } catch (err) {
    spinner.stop();
    throwModelCommandError(err);
  }
}

export async function infoModel(
  name: string | undefined,
  client: LmxClient,
  opts?: ModelsOptions
): Promise<void> {
  if (!name) {
    console.error(
      chalk.red('✗') + ' Missing model name\n\n' + chalk.dim('Usage: opta models info <name>')
    );
    throw new ExitError(EXIT.MISUSE);
  }

  const spinner = await createSpinner();
  spinner.start(`Fetching info for ${name}...`);

  try {
    // Fetch basic model list + performance detail in parallel
    const [result, perfResult] = await Promise.all([
      client.models(FAST_DISCOVERY_REQUEST_OPTS),
      client.modelPerformance(name).catch(() => null),
    ]);
    spinner.stop();

    const model = result.models.find((m) => m.model_id === name);
    if (!model && !perfResult) {
      console.error(chalk.red('✗') + ` Model "${name}" not found or not loaded`);
      throw new ExitError(EXIT.NOT_FOUND);
    }

    if (opts?.json) {
      console.log(JSON.stringify({ model, performance: perfResult }, null, 2));
      return;
    }

    const dp = getDisplayProfile(name);
    const ctx = model?.context_length ?? perfResult?.contextLength ?? lookupContextLimit(name);

    console.log(
      '\n' + chalk.bold(dp.displayName) + ' ' + fmtTag(dp.format) + ' ' + chalk.dim(dp.orgAbbrev)
    );
    console.log(chalk.dim(`  ${name}`));
    console.log('');

    if (model) {
      console.log(`  Status:   ${chalk.green('● loaded')}`);
    }

    console.log(`  Context:  ${(ctx / 1000).toFixed(0)}K tokens`);

    if (perfResult) {
      console.log(`  Backend:  ${chalk.cyan(perfResult.backendType)}`);
      console.log(`  Memory:   ${perfResult.memoryGb.toFixed(1)} GB`);
      console.log(`  Batching: ${perfResult.useBatching ? chalk.green('on') : chalk.dim('off')}`);
      console.log(`  Requests: ${perfResult.requestCount.toLocaleString()}`);
      if (perfResult.lastUsedAt) {
        const d = new Date(perfResult.lastUsedAt);
        const mins = Math.round((Date.now() - d.getTime()) / 60000);
        const agoStr = mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`;
        console.log(`  Last used: ${chalk.dim(agoStr)}`);
      }
      console.log(`  Loaded:   ${chalk.dim(new Date(perfResult.loadedAt).toLocaleTimeString())}`);

      const overrides = Object.entries(perfResult.performanceOverrides);
      if (overrides.length > 0) {
        console.log('');
        console.log(chalk.dim('  Performance overrides:'));
        for (const [k, v] of overrides) {
          console.log(chalk.dim(`    ${k}: ${String(v)}`));
        }
      }

      const defaults = Object.entries(perfResult.globalDefaults);
      if (defaults.length > 0) {
        console.log('');
        console.log(chalk.dim('  Global defaults:'));
        for (const [k, v] of defaults) {
          console.log(chalk.dim(`    ${k}: ${String(v)}`));
        }
      }
    } else if (model?.memory_bytes) {
      console.log(`  Memory:   ${(model.memory_bytes / 1e9).toFixed(1)} GB`);
    }

    console.log('');
    console.log(
      chalk.dim(`  Run ${chalk.reset(`opta models benchmark ${name}`)} to measure tok/s`)
    );
  } catch (err) {
    spinner.stop();
    throwModelCommandError(err);
  }
}

export async function loadModel(
  name: string | undefined,
  client: LmxClient,
  aliasMap: ModelAliasMap = {},
  defaultModel = ''
): Promise<void> {
  const spinner = await createSpinner();
  spinner.start(progressText('Load model', 15, 'fetching downloadable models'));

  try {
    const { loaded, onDisk } = await getModelOptions(client);
    spinner.stop();
    console.log(chalk.dim(`  ${progressText('Load model', 45, 'model catalog ready')}`));

    if (onDisk.length === 0) {
      if (loaded.length > 0) {
        console.log(chalk.dim('  No additional models on disk to load.'));
      } else {
        console.log(
          chalk.dim('  No downloaded models found. Use `opta models download <repo>` first.')
        );
      }
      return;
    }

    if (name) {
      const matchingLoaded = findMatchingModelId(
        name,
        loaded.map((m) => m.id)
      );
      if (matchingLoaded) {
        console.log(chalk.dim(`  ${matchingLoaded} is already loaded`));
        return;
      }
    }

    const selectedId = await resolveModelIdFromOptions(
      name,
      onDisk,
      defaultModel,
      'Select model to load',
      aliasMap
    );

    spinner.start(progressText('Load model', 75, `loading ${selectedId}`));
    const loadedId = await ensureModelLoaded(client, selectedId, {
      timeoutMs: STABLE_MODEL_LOAD_TIMEOUT_MS,
      loadRequestTimeoutMs: STABLE_MODEL_LOAD_REQUEST_TIMEOUT_MS,
      onProgress: createLoadProgressUpdater(spinner, 'Load model', selectedId, 75),
    });
    spinner.succeed(progressText('Load model', 100, `loaded ${loadedId}`));
    await recordModelHistory([loadedId], 'loaded');

    const loadedSnapshot = await client
      .models(FAST_DISCOVERY_REQUEST_OPTS)
      .catch((err: unknown) => {
        warnModelInventoryFallback('loaded models', err);
        return { models: [] };
      });
    const details = loadedSnapshot.models.find((model) => modelIdsEqual(model.model_id, loadedId));
    if (details?.memory_bytes) {
      console.log(chalk.dim(`  Memory: ${(details.memory_bytes / 1e9).toFixed(1)} GB`));
    }
  } catch (err) {
    spinner.stop();
    throwModelCommandError(err);
  }
}

export async function unloadModel(
  name: string | undefined,
  client: LmxClient,
  aliasMap: ModelAliasMap = {}
): Promise<void> {
  const spinner = await createSpinner();
  spinner.start(progressText('Unload model', 15, 'fetching loaded models'));

  try {
    const config = await loadConfig();
    const { loaded } = await getModelOptions(client);
    spinner.stop();
    console.log(chalk.dim(`  ${progressText('Unload model', 45, 'loaded model list ready')}`));

    if (loaded.length === 0) {
      console.log(chalk.dim('  ' + NO_MODELS_LOADED));
      return;
    }

    const selectedId = await resolveModelIdFromOptions(
      name,
      loaded,
      config.model.default,
      'Select model to unload',
      aliasMap
    );

    const loadedId =
      findMatchingModelId(
        selectedId,
        loaded.map((model) => model.id)
      ) ?? selectedId;
    spinner.start(progressText('Unload model', 75, `unloading ${loadedId}`));
    const onProgress = createUnloadProgressUpdater(spinner, 'Unload model', loadedId, 75);
    const result = await client.unloadModel(loadedId);
    await waitForModelUnloaded(client, loadedId, {
      timeoutMs: 30_000,
      onProgress,
    });
    spinner.succeed(progressText('Unload model', 100, `unloaded ${result.model_id}`));

    if (result.freed_bytes) {
      console.log(chalk.dim(`  Freed: ${(result.freed_bytes / 1e9).toFixed(1)} GB`));
    }
  } catch (err) {
    spinner.stop();
    throwModelCommandError(err);
  }
}

export async function downloadModel(name: string | undefined, client: LmxClient): Promise<void> {
  if (!name) {
    console.error(
      chalk.red('✗') +
        ' Missing repo ID\n\n' +
        chalk.dim('Usage: opta models download <org/model-name>')
    );
    throw new ExitError(EXIT.MISUSE);
  }

  const spinner = await createSpinner();
  spinner.start(progressText('Download model', 5, `starting ${name}`));

  let downloadId: string;
  try {
    const started = await client.downloadModel(name);
    downloadId = started.downloadId;
    const sizeStr = started.estimatedSizeBytes
      ? chalk.dim(` · est. ${fmtGB(started.estimatedSizeBytes)}`)
      : '';
    spinner.succeed(progressText('Download model', 10, `started${sizeStr}`));
  } catch (err) {
    spinner.stop();
    if (err instanceof LmxApiError) {
      console.error(chalk.red('✗') + ` ${err.message}`);
      if (err.code === 'out_of_memory') {
        console.log(chalk.dim('  Not enough memory — unload a model first'));
      }
      throw new ExitError(EXIT.ERROR);
    }
    throw err;
  }

  // Poll progress until complete
  console.log(chalk.dim(`  Polling progress (download ID: ${downloadId})\n`));
  let lastPct = -1;

  const poll = async (): Promise<boolean> => {
    try {
      const progress = await client.downloadProgress(downloadId);

      if (progress.progressPercent !== lastPct) {
        lastPct = progress.progressPercent;
        const bar = renderPercentBar(progress.progressPercent, 20);
        const dlStr =
          progress.totalBytes > 0
            ? `${fmtGB(progress.downloadedBytes)} / ${fmtGB(progress.totalBytes)}`
            : fmtGB(progress.downloadedBytes);
        console.log(
          `  ${bar}  ${chalk.dim(dlStr)}  ` +
            chalk.dim(`${progress.filesCompleted}/${progress.filesTotal} files`)
        );
      }

      if (progress.status === 'completed') {
        console.log(`  ${renderPercentBar(100, 20)}  ${chalk.dim('complete')}`);
        console.log(
          chalk.green('✓') +
            ` Download complete — run ${chalk.bold(`opta models load ${name}`)} to use`
        );
        return true;
      }
      if (progress.status === 'failed') {
        process.stdout.write('\n');
        console.error(chalk.red('✗') + ` Download failed: ${progress.error ?? 'unknown error'}`);
        throw new ExitError(EXIT.ERROR);
      }
      return false;
    } catch (err) {
      if (err instanceof ExitError) throw err;
      return false; // transient error, keep polling
    }
  };

  // Poll every 2 seconds
  while (!(await poll())) {
    await new Promise<void>((r) => setTimeout(r, 2000));
  }
  await recordModelHistory([name], 'downloaded');
}

export async function deleteModel(name: string | undefined, client: LmxClient): Promise<void> {
  if (!name) {
    console.error(
      chalk.red('✗') +
        ' Missing model name\n\n' +
        chalk.dim('Usage: opta models delete <model-name>')
    );
    throw new ExitError(EXIT.MISUSE);
  }

  const spinner = await createSpinner();
  spinner.start(`Deleting ${name} from disk...`);

  try {
    const result = await client.deleteModel(name);
    spinner.succeed(
      `Deleted ${result.modelId}` +
        (result.freedBytes > 0 ? chalk.dim(` · freed ${fmtGB(result.freedBytes)}`) : '')
    );
    await recordModelHistory([result.modelId], 'deleted');
  } catch (err) {
    spinner.stop();
    if (err instanceof LmxApiError) {
      if (err.code === 'conflict') {
        console.error(chalk.red('✗') + ` Cannot delete — model is currently loaded`);
        console.log(chalk.dim(`  Run ${chalk.reset(`opta models unload ${name}`)} first`));
      } else if (err.code === 'not_found') {
        console.error(chalk.red('✗') + ` Model "${name}" not found on disk`);
      } else {
        console.error(chalk.red('✗') + ` ${err.message}`);
      }
      throw new ExitError(EXIT.ERROR);
    }
    throw err;
  }
}

export async function benchmarkModel(name: string | undefined, client: LmxClient): Promise<void> {
  if (!name) {
    console.error(
      chalk.red('✗') +
        ' Missing model name\n\n' +
        chalk.dim('Usage: opta models benchmark <model-name>')
    );
    throw new ExitError(EXIT.MISUSE);
  }

  const spinner = await createSpinner();
  spinner.start(`Benchmarking ${name} (3 runs × 128 tokens)...`);

  try {
    const result = await client.benchmarkModel(name);
    spinner.succeed(`Benchmark complete`);

    const dp = getDisplayProfile(result.modelId);
    console.log('');
    console.log(`  ${chalk.bold(dp.displayName)} ${fmtTag(dp.format)} ${chalk.dim(dp.orgAbbrev)}`);
    console.log('');

    const tpsColor =
      result.avgTokensPerSecond >= 30
        ? chalk.green
        : result.avgTokensPerSecond >= 10
          ? chalk.yellow
          : chalk.red;

    console.log(
      `  ${chalk.bold('Avg tok/s')}    ${tpsColor(result.avgTokensPerSecond.toFixed(1))} tok/s`
    );
    console.log(`  ${chalk.bold('Avg TTFT')}     ${result.avgTimeToFirstTokenMs.toFixed(0)} ms`);
    console.log(`  ${chalk.bold('Avg total')}    ${result.avgTotalTimeMs.toFixed(0)} ms`);
    console.log(`  ${chalk.bold('Backend')}      ${chalk.cyan(result.backendType)}`);

    if (result.results.length > 1) {
      console.log('');
      console.log(chalk.dim('  Per-run:'));
      for (const r of result.results) {
        const bar = '▪'.repeat(Math.min(20, Math.round(r.tokensPerSecond / 3)));
        console.log(
          chalk.dim(`  Run ${r.run}  `) +
            chalk.dim(bar.padEnd(20)) +
            `  ${r.tokensPerSecond.toFixed(1)} tok/s` +
            chalk.dim(`  TTFT ${r.timeToFirstTokenMs.toFixed(0)}ms`)
        );
      }
    }
    console.log('');
  } catch (err) {
    spinner.stop();
    if (err instanceof LmxApiError) {
      if (err.code === 'not_found') {
        console.error(chalk.red('✗') + ` Model "${name}" not loaded`);
        console.log(chalk.dim(`  Run ${chalk.reset(`opta models load ${name}`)} first`));
      } else {
        console.error(chalk.red('✗') + ` ${err.message}`);
      }
      throw new ExitError(EXIT.ERROR);
    }
    throw err;
  }
}

export async function stopAllModels(client: LmxClient): Promise<void> {
  const spinner = await createSpinner();
  spinner.start(progressText('Stop models', 10, 'fetching loaded models'));

  try {
    const result = await client.models(FAST_DISCOVERY_REQUEST_OPTS);
    if (result.models.length === 0) {
      spinner.succeed(progressText('Stop models', 100, NO_MODELS_LOADED));
      return;
    }

    const total = result.models.length;
    let successCount = 0;
    let totalFreed = 0;

    for (let i = 0; i < total; i++) {
      const model = result.models[i]!;
      const pct = 20 + Math.round(((i + 1) / total) * 70);
      spinner.start(
        progressText('Stop models', pct, `unloading ${model.model_id} (${i + 1}/${total})`)
      );
      const unloadResult = await client.unloadModel(model.model_id).catch(() => null);
      if (unloadResult) {
        successCount += 1;
        totalFreed += unloadResult.freed_bytes ?? 0;
      }
    }

    spinner.succeed(
      progressText(
        'Stop models',
        100,
        `unloaded ${successCount}/${total} model${total > 1 ? 's' : ''}${totalFreed > 0 ? ` · freed ${fmtGB(totalFreed)}` : ''}`
      )
    );
  } catch (err) {
    spinner.stop();
    throwModelCommandError(err);
  }
}

export async function swapModel(
  fromName: string | undefined,
  toName: string | undefined,
  client: LmxClient,
  aliasMap: ModelAliasMap = {}
): Promise<void> {
  const spinner = await createSpinner();
  try {
    const config = await loadConfig();
    const defaultModel = normalizeConfiguredModelId(config.model.default);
    if (!defaultModel && isPlaceholderModelId(config.model.default)) {
      await saveConfig({ 'model.default': '', 'model.contextLimit': lookupContextLimit('') }).catch(
        () => {}
      );
    }
    spinner.start(progressText('Swap model', 12, 'fetching model catalog'));
    const { loaded, onDisk } = await getModelOptions(client);
    spinner.stop();
    console.log(chalk.dim(`  ${progressText('Swap model', 40, 'model catalog ready')}`));

    if (loaded.length === 0) {
      console.error(chalk.red('✗') + ' No running model to swap');
      throw new ExitError(EXIT.NOT_FOUND);
    }

    const fromId = await resolveModelIdFromOptions(
      fromName,
      loaded,
      defaultModel,
      'Select running model to swap out',
      aliasMap
    );

    const targetOptions = [...onDisk, ...loaded.filter((m) => !modelIdsEqual(m.id, fromId))];
    if (targetOptions.length === 0) {
      console.error(chalk.red('✗') + ' No replacement model available on disk');
      console.log(
        chalk.dim(`  Download one with ${chalk.reset('opta models download <org/model>')}`)
      );
      throw new ExitError(EXIT.NOT_FOUND);
    }

    const toId = await resolveModelIdFromOptions(
      toName,
      targetOptions,
      defaultModel,
      'Select replacement model',
      aliasMap
    );

    if (modelIdsEqual(fromId, toId)) {
      console.error(chalk.red('✗') + ' Source and replacement model are the same');
      throw new ExitError(EXIT.MISUSE);
    }

    const targetAlreadyLoaded = findMatchingModelId(
      toId,
      loaded.filter((m) => !modelIdsEqual(m.id, fromId)).map((m) => m.id)
    );

    const fromLoadedId =
      findMatchingModelId(
        fromId,
        loaded.map((m) => m.id)
      ) ?? fromId;
    spinner.start(progressText('Swap model', 65, `unloading ${fromLoadedId}`));
    let unloaded: { model_id: string; freed_bytes?: number; status?: string };
    try {
      unloaded = await client.unloadModel(fromLoadedId);
    } catch (err) {
      if (err instanceof LmxApiError && err.code === 'not_found') {
        unloaded = { model_id: fromLoadedId, status: 'unloaded', freed_bytes: 0 };
      } else {
        throw err;
      }
    }
    try {
      await waitForModelUnloaded(client, fromLoadedId, {
        timeoutMs: 30_000,
        onProgress: createUnloadProgressUpdater(spinner, 'Swap model', fromLoadedId, 65),
      });
    } catch (err) {
      spinner.stop();
      console.error(
        chalk.red('✗') + ` Failed to confirm ${fromLoadedId} was unloaded: ${errorMessage(err)}`
      );
      throw err;
    }
    const freedStr = unloaded.freed_bytes
      ? chalk.dim(` · freed ${fmtGB(unloaded.freed_bytes)}`)
      : '';
    spinner.succeed(
      progressText(
        'Swap model',
        targetAlreadyLoaded ? 100 : 82,
        `unloaded ${fromLoadedId}${freedStr}`
      )
    );

    if (targetAlreadyLoaded) {
      console.log(chalk.green('✓') + ` ${targetAlreadyLoaded} was already loaded`);
      return;
    }

    try {
      spinner.start(progressText('Swap model', 88, `loading ${toId}`));
      const loadedId = await ensureModelLoaded(client, toId, {
        timeoutMs: STABLE_MODEL_LOAD_TIMEOUT_MS,
        loadRequestTimeoutMs: STABLE_MODEL_LOAD_REQUEST_TIMEOUT_MS,
        onProgress: createLoadProgressUpdater(spinner, 'Swap model', toId, 88),
      });
      const snapshot = await client.models(FAST_DISCOVERY_REQUEST_OPTS).catch((err: unknown) => {
        warnModelInventoryFallback('loaded models', err);
        return { models: [] };
      });
      const details = snapshot.models.find((model) => modelIdsEqual(model.model_id, loadedId));
      const memStr = details?.memory_bytes ? chalk.dim(` · ${fmtGB(details.memory_bytes)}`) : '';
      spinner.succeed(progressText('Swap model', 100, `loaded ${loadedId}${memStr}`));
    } catch (loadErr) {
      spinner.stop();
      console.error(
        chalk.yellow('!') + ` Swap load failed for ${toId}; attempting rollback to ${fromLoadedId}`
      );
      try {
        const rollbackId = await ensureModelLoaded(client, fromLoadedId, {
          timeoutMs: STABLE_MODEL_LOAD_TIMEOUT_MS,
          loadRequestTimeoutMs: STABLE_MODEL_LOAD_REQUEST_TIMEOUT_MS,
          onProgress: createLoadProgressUpdater(spinner, 'Swap model', fromLoadedId, 88),
        });
        console.log(chalk.green('✓') + ` Rollback restored ${rollbackId}`);
      } catch (rollbackErr) {
        console.error(chalk.red('✗') + ` Rollback failed: ${errorMessage(rollbackErr)}`);
      }
      throw loadErr;
    }
  } catch (err) {
    spinner.stop();
    throwModelCommandError(err);
  }
}
