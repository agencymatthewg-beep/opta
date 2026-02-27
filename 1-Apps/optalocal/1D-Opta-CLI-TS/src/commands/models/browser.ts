/**
 * Model browser UI — browse local models, full library, catalog action loop.
 */

import chalk from 'chalk';
import { spawn } from 'node:child_process';
import { dirname } from 'node:path';
import { ExitError, EXIT } from '../../core/errors.js';
import { LmxClient, lookupContextLimit } from '../../lmx/client.js';
import {
  ensureModelLoaded,
  findMatchingModelId,
  modelIdsEqual,
} from '../../lmx/model-lifecycle.js';
import { getDisplayProfile } from '../../core/model-display.js';
import { fmtGB, fmtCtx } from '../../providers/model-scan.js';
import { runMenuPrompt } from '../../ui/prompt-nav.js';
import {
  FAST_DISCOVERY_REQUEST_OPTS,
  STABLE_MODEL_LOAD_TIMEOUT_MS,
  HF_CATALOG_LIMIT,
  HF_QUERY_LIMIT,
  formatCompactCount,
  formatRelativeTime,
  formatCatalogEntryLabel,
  warnModelInventoryFallback,
  fmtTag,
  type ModelsOptions,
  type ModelBrowserAction,
  type ModelManagerAction,
  type LibraryModelEntry,
  type HfModelApiItem,
  type LocalModelSnapshot,
} from './types.js';
import { recordModelHistory } from './history.js';
import {
  fetchHuggingFaceModels,
  loadLocalModelSnapshot,
  mergeCatalogEntries,
  sortCatalogEntries,
  rankCatalogEntries,
  promptCatalogSelection,
  formatModelComparison,
} from './inventory.js';
import { downloadModel, deleteModel } from './lifecycle.js';

// ── File manager helpers ────────────────────────────────────────────

function trySpawnDetached(command: string, args: string[]): boolean {
  try {
    const child = spawn(command, args, { stdio: 'ignore', detached: true });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

function revealPathInFileManager(path: string): boolean {
  if (!path) return false;
  if (process.platform === 'darwin') return trySpawnDetached('open', ['-R', path]);
  if (process.platform === 'win32') return trySpawnDetached('explorer.exe', ['/select,', path]);
  return trySpawnDetached('xdg-open', [dirname(path)]);
}

function openDirectoryInFileManager(path: string): boolean {
  if (!path) return false;
  if (process.platform === 'darwin') return trySpawnDetached('open', [path]);
  if (process.platform === 'win32') return trySpawnDetached('explorer.exe', [path]);
  return trySpawnDetached('xdg-open', [path]);
}

// ── Catalog info display ────────────────────────────────────────────

function printCatalogModelInfo(entry: LibraryModelEntry, catalog: LibraryModelEntry[]): void {
  const profile = getDisplayProfile(entry.id);
  const tag = fmtTag(profile.format);
  console.log('\n' + chalk.bold(profile.displayName) + ` ${tag} ${chalk.dim(profile.orgAbbrev)}`);
  console.log(chalk.dim(`  ${entry.id}\n`));
  console.log(`  Status:    ${entry.loaded ? chalk.green('loaded') : entry.downloaded ? chalk.cyan('on disk') : chalk.dim('not downloaded')}`);
  console.log(`  Context:   ${fmtCtx(entry.contextLength)}`);
  if (entry.sizeBytes) console.log(`  Size:      ${fmtGB(entry.sizeBytes)}`);
  if (typeof entry.downloads === 'number') console.log(`  Downloads: ${formatCompactCount(entry.downloads)}`);
  if (typeof entry.likes === 'number') console.log(`  Likes:     ${formatCompactCount(entry.likes)}`);
  if (entry.pipelineTag) console.log(`  Type:      ${entry.pipelineTag}`);
  if (entry.lastModified) {
    const updated = new Date(entry.lastModified);
    if (!Number.isNaN(updated.getTime())) {
      console.log(`  Updated:   ${chalk.dim(`${updated.toLocaleDateString()} (${formatRelativeTime(updated.getTime())})`)}`);
    }
  }
  if (entry.downloadedAt) {
    console.log(`  Downloaded:${chalk.dim(` ${new Date(entry.downloadedAt).toLocaleString()}`)}`);
  }
  if (entry.historyLastSeenAt) {
    console.log(`  History:   ${chalk.dim(`seen ${formatRelativeTime(entry.historyLastSeenAt)}`)}`);
  }
  if (entry.localPath) {
    console.log(`  Path:      ${chalk.dim(entry.localPath)}`);
  }
  const tags = (entry.tags ?? []).filter((tagName) => !tagName.startsWith('license:')).slice(0, 5);
  if (tags.length > 0) {
    console.log(`  Tags:      ${chalk.dim(tags.join(', '))}`);
  }
  console.log(`  ${chalk.dim(formatModelComparison(entry, catalog))}\n`);
}

// ── Browser action prompts ──────────────────────────────────────────

async function promptBrowserAction(
  entry: LibraryModelEntry,
  downloadRoot?: string,
): Promise<ModelBrowserAction | null> {
  const { select } = await import('@inquirer/prompts');
  const choices: Array<{ value: ModelBrowserAction; name: string }> = [
    {
      value: 'info',
      name: `${chalk.blue('Info')} ${chalk.dim('specs, metadata, and comparison')}`,
    },
    {
      value: 'use-chat',
      name: `${chalk.green('Use with Opta Chat')} ${chalk.dim('load/switch model then launch chat')}`,
    },
  ];

  if (!entry.downloaded) {
    choices.push({
      value: 'download',
      name: `${chalk.cyan('Download')} ${chalk.dim('pull model from Hugging Face via LMX')}`,
    });
  }
  if (entry.downloaded) {
    choices.push({
      value: 'delete',
      name: `${chalk.red('Delete')} ${chalk.dim('remove model from local disk')}`,
    });
  }
  if (entry.downloaded && entry.localPath) {
    choices.push({
      value: 'open-file',
      name: `${chalk.magenta('Open File Location')} ${chalk.dim(entry.localPath)}`,
    });
  }
  if (downloadRoot) {
    choices.push({
      value: 'open-download',
      name: `${chalk.magenta('Open Download Location')} ${chalk.dim(downloadRoot)}`,
    });
  }
  if (entry.downloaded) {
    choices.push({
      value: 'benchmark-chat',
      name: `${chalk.yellow('Run Benchmark')} ${chalk.dim('launch chat with benchmark prompt')}`,
    });
  }

  choices.push({ value: 'back', name: chalk.dim('Back') });

  try {
    return await runMenuPrompt((context) =>
      select<ModelBrowserAction>({
        message: chalk.dim(`Model actions · ${entry.id}`),
        choices,
      }, context), 'select');
  } catch {
    return null;
  }
}

async function promptLoadedModelConflict(
  modelId: string,
): Promise<'replace' | 'parallel' | 'cancel'> {
  const { select } = await import('@inquirer/prompts');
  try {
    return await runMenuPrompt((context) =>
      select<'replace' | 'parallel' | 'cancel'>({
        message: chalk.dim(`Another model is running. How should ${modelId} launch?`),
        choices: [
          {
            value: 'replace',
            name: `${chalk.red('Kill other model(s)')} ${chalk.dim('unload current + load selected')}`,
          },
          {
            value: 'parallel',
            name: `${chalk.green('Run both simultaneously')} ${chalk.dim('keep current + load selected')}`,
          },
          {
            value: 'cancel',
            name: chalk.dim('Stop launching'),
          },
        ],
      }, context), 'select') ?? 'cancel';
  } catch {
    return 'cancel';
  }
}

async function ensureModelIsDownloaded(entry: LibraryModelEntry, client: LmxClient): Promise<boolean> {
  if (entry.downloaded || entry.loaded) return true;
  const { confirm } = await import('@inquirer/prompts');
  const ok = await confirm({
    message: chalk.dim(`${entry.id} is not downloaded. Download it now?`),
    default: true,
  }).catch(() => false);
  if (!ok) return false;
  await downloadModel(entry.id, client);
  await recordModelHistory([entry.id], 'downloaded');
  return true;
}

async function launchChatWithModel(modelId: string, initialPrompt?: string): Promise<void> {
  const { startChat } = await import('../chat.js');
  if (initialPrompt) {
    console.log(chalk.dim('\nBenchmark prompt queued:\n'));
    console.log(chalk.cyan(initialPrompt));
    console.log('');
  }
  await startChat({
    model: modelId,
    initialPrompt,
  });
}

async function useModelWithChat(
  entry: LibraryModelEntry,
  client: LmxClient,
  initialPrompt?: string,
): Promise<void> {
  const ready = await ensureModelIsDownloaded(entry, client);
  if (!ready) return;

  const loadedRes = await client.models(FAST_DISCOVERY_REQUEST_OPTS).catch((err: unknown) => {
    warnModelInventoryFallback('loaded models', err);
    return { models: [] };
  });
  const loadedIds = loadedRes.models.map((m) => m.model_id);
  const alreadyLoadedId = findMatchingModelId(entry.id, loadedIds);
  const otherLoaded = loadedIds.filter((id) => !modelIdsEqual(id, entry.id));
  let activeModelId = alreadyLoadedId ?? entry.id;

  if (!alreadyLoadedId) {
    let strategy: 'replace' | 'parallel' | 'cancel' = 'parallel';
    if (otherLoaded.length > 0) {
      strategy = await promptLoadedModelConflict(entry.id);
    }
    if (strategy === 'cancel') return;
    if (strategy === 'replace') {
      for (const modelId of otherLoaded) {
        await client.unloadModel(modelId).catch(() => null);
      }
    }
    activeModelId = await ensureModelLoaded(client, entry.id, { timeoutMs: STABLE_MODEL_LOAD_TIMEOUT_MS });
    await recordModelHistory([activeModelId], 'loaded');
  }

  await recordModelHistory([activeModelId], 'chat');
  await launchChatWithModel(activeModelId, initialPrompt);
}

// ── Catalog action loop ─────────────────────────────────────────────

async function runCatalogActionLoop(
  entry: LibraryModelEntry,
  client: LmxClient,
  catalog: LibraryModelEntry[],
  downloadRoot?: string,
): Promise<void> {
  const BENCHMARK_PROMPT = [
    'Run a concise benchmark-style response.',
    '1) Solve a 3-step reasoning task with explicit steps.',
    '2) Generate ~120 tokens total.',
    '3) End with: BENCHMARK_DONE.',
  ].join(' ');

  while (true) {
    const action = await promptBrowserAction(entry, downloadRoot);
    if (!action || action === 'back') return;

    if (action === 'info') {
      printCatalogModelInfo(entry, catalog);
      continue;
    }
    if (action === 'download') {
      await downloadModel(entry.id, client);
      await recordModelHistory([entry.id], 'downloaded');
      return;
    }
    if (action === 'delete') {
      await deleteModel(entry.id, client);
      await recordModelHistory([entry.id], 'deleted');
      return;
    }
    if (action === 'open-file') {
      if (!entry.localPath) {
        console.log(chalk.dim('  No local file path is available for this model.'));
      } else if (!revealPathInFileManager(entry.localPath)) {
        console.log(chalk.yellow('!') + ' Could not open file manager for that path');
      } else {
        console.log(chalk.green('✓') + ' Opened file location');
      }
      continue;
    }
    if (action === 'open-download') {
      if (!downloadRoot) {
        console.log(chalk.dim('  Download location is unknown (no local models found yet).'));
      } else if (!openDirectoryInFileManager(downloadRoot)) {
        console.log(chalk.yellow('!') + ' Could not open download directory');
      } else {
        console.log(chalk.green('✓') + ' Opened download location');
      }
      continue;
    }
    if (action === 'use-chat') {
      await useModelWithChat(entry, client);
      return;
    }
    if (action === 'benchmark-chat') {
      await useModelWithChat(entry, client, BENCHMARK_PROMPT);
      return;
    }
  }
}

// ── Browse top-level flows ──────────────────────────────────────────

export async function browseLocalModels(client: LmxClient, defaultModel: string): Promise<void> {
  console.log(chalk.bold('\nBrowse Local Models'));
  console.log(chalk.dim('  Includes currently downloaded models and your model history.\n'));
  while (true) {
    const snapshot = await loadLocalModelSnapshot(client);
    const all = sortCatalogEntries(mergeCatalogEntries(snapshot, []));
    const entries = all.filter((entry) => entry.source === 'local' || entry.source === 'history');
    if (entries.length === 0) {
      console.log(chalk.dim('  No local models or model history found yet.'));
      return;
    }

    const selected = await promptCatalogSelection('Browse Local Models', entries, defaultModel);
    if (!selected) return;
    await runCatalogActionLoop(selected, client, entries, snapshot.downloadRoot);
  }
}

async function promptFullLibrarySelection(
  snapshot: LocalModelSnapshot,
  defaultModel: string,
): Promise<{ entry: LibraryModelEntry; catalog: LibraryModelEntry[] } | null> {
  const seed = await fetchHuggingFaceModels(undefined, HF_CATALOG_LIMIT).catch(() => [] as HfModelApiItem[]);
  const fallback = sortCatalogEntries(mergeCatalogEntries(snapshot, seed));
  const cache = new Map<string, LibraryModelEntry[]>();
  cache.set('', fallback);
  const byId = new Map<string, LibraryModelEntry>(fallback.map((entry) => [entry.id, entry] as const));
  let lastCatalog = fallback;
  const { search } = await import('@inquirer/prompts');

  try {
    const selected = await runMenuPrompt((context) =>
      search<string>({
        message: chalk.dim('Browse Full LLM Library (type to search Hugging Face globally)'),
        source: async (input?: string) => {
          const query = (input ?? '').trim();
          const cacheKey = query.toLowerCase();
          let entries = cache.get(cacheKey);
          if (!entries) {
            let remote: HfModelApiItem[] = seed;
            if (query.length >= 2) {
              remote = await fetchHuggingFaceModels(query, HF_QUERY_LIMIT).catch(() => [] as HfModelApiItem[]);
            }
            entries = rankCatalogEntries(mergeCatalogEntries(snapshot, remote), query).slice(0, 160);
            cache.set(cacheKey, entries);
          }
          lastCatalog = entries;
          for (const entry of entries) {
            byId.set(entry.id, entry);
          }
          return entries.map((entry) => ({
            value: entry.id,
            name: formatCatalogEntryLabel(entry, defaultModel),
          }));
        },
      }, context), 'search');
    if (!selected) return null;
    const entry = byId.get(selected);
    return entry ? { entry, catalog: lastCatalog } : null;
  } catch {
    return null;
  }
}

export async function browseFullLibrary(client: LmxClient, defaultModel: string): Promise<void> {
  console.log(chalk.bold('\nBrowse Full LLM Library'));
  console.log(chalk.dim('  Type to search globally. Blank query shows a top downloadable catalog plus your local models.\n'));
  while (true) {
    const snapshot = await loadLocalModelSnapshot(client);
    const selected = await promptFullLibrarySelection(snapshot, defaultModel);
    if (!selected) return;
    await runCatalogActionLoop(selected.entry, client, selected.catalog, snapshot.downloadRoot);
  }
}

export async function promptManagerAction(
  loadedCount: number,
  onDiskCount: number,
  defaultModel: string,
): Promise<ModelManagerAction | null> {
  const { select } = await import('@inquirer/prompts');
  try {
    return await runMenuPrompt((context) =>
      select<ModelManagerAction>({
        message: chalk.dim(`Model manager · default ${defaultModel}`),
        choices: [
          {
            value: 'use',
            name: `${chalk.cyan('Set default')} ${chalk.dim('pick by typing or arrows')}`,
          },
          {
            value: 'load',
            name: `${chalk.green('Load model')} ${chalk.dim(`(${onDiskCount} on disk)`)}`,
          },
          {
            value: 'unload',
            name: `${chalk.yellow('Unload model')} ${chalk.dim(`(${loadedCount} loaded)`)}`,
          },
          {
            value: 'swap',
            name: `${chalk.magenta('Swap model')} ${chalk.dim('unload one, load another')}`,
          },
          {
            value: 'stop',
            name: `${chalk.red('Stop all models')} ${chalk.dim('unload everything')}`,
          },
          {
            value: 'scan',
            name: `${chalk.blue('Run scan')} ${chalk.dim('show full model inventory')}`,
          },
          {
            value: 'dashboard',
            name: `${chalk.blue('Dashboard')} ${chalk.dim('at-a-glance model health and aliases')}`,
          },
          {
            value: 'browse-local',
            name: `${chalk.cyan('Browse Local Models')} ${chalk.dim('downloaded now + model history')}`,
          },
          {
            value: 'browse-library',
            name: `${chalk.magenta('Browse Full LLM Library')} ${chalk.dim('search all downloadable models')}`,
          },
          {
            value: 'refresh',
            name: `${chalk.dim('Refresh list')}`,
          },
          {
            value: 'exit',
            name: `${chalk.dim('Exit')}`,
          },
        ],
      }, context), 'select');
  } catch {
    return null;
  }
}
