/**
 * Model discovery, listing, dashboard, scan, and picker resolution.
 */

import chalk from 'chalk';
import { dirname } from 'node:path';
import { loadConfig, saveConfig } from '../../core/config.js';
import { ExitError, EXIT } from '../../core/errors.js';
import { createSpinner } from '../../ui/spinner.js';
import { renderPercentBar } from '../../ui/progress.js';
import { NO_MODELS_LOADED } from '../../utils/errors.js';
import { LmxClient, lookupContextLimit } from '../../lmx/client.js';
import type { LmxAvailableModel, LmxModelDetail, LmxMemoryResponse } from '../../lmx/client.js';
import {
  normalizeConfiguredModelId,
  modelIdsEqual,
  normalizeModelIdKey,
} from '../../lmx/model-lifecycle.js';
import {
  scanModels as gatherScanData,
  buildRoleMap,
  shortId,
  fmtGB,
  fmtCtx,
  summarizeScan,
} from '../../providers/model-scan.js';
import { getDisplayProfile } from '../../core/model-display.js';
import { runMenuPrompt } from '../../ui/prompt-nav.js';
import {
  FAST_DISCOVERY_REQUEST_OPTS,
  HF_CATALOG_LIMIT,
  normalizeModelKey,
  scoreModelMatch,
  splitQueryTokens,
  rankModelIds,
  formatCompactCount,
  formatModelOptionLabel,
  formatCatalogEntryLabel,
  warnModelInventoryFallback,
  isInteractiveTerminal,
  printModelMatches,
  progressText,
  throwModelCommandError,
  fmtTag,
  type ModelsOptions,
  type ModelPickerOption,
  type ModelAliasMap,
  type HfModelApiItem,
  type LibraryModelEntry,
  type LocalModelSnapshot,
  type ModelHistoryEntry,
} from './types.js';
import { readModelHistory, recordModelHistory } from './history.js';
import { readModelAliasMap } from './aliases.js';

// ── Hugging Face catalog ────────────────────────────────────────────

export async function fetchHuggingFaceModels(
  searchTerm?: string,
  limit = HF_CATALOG_LIMIT
): Promise<HfModelApiItem[]> {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('sort', 'downloads');
  params.set('direction', '-1');
  params.set('full', 'true');
  if (searchTerm && searchTerm.trim()) {
    params.set('search', searchTerm.trim());
  }

  const res = await fetch(`https://huggingface.co/api/models?${params.toString()}`, {
    signal: AbortSignal.timeout(10_000),
    headers: { 'User-Agent': 'opta-cli/0.5 model-browser' },
  });

  if (!res.ok) {
    throw new Error(`Hugging Face catalog request failed (${res.status})`);
  }

  const raw = await res.json();
  if (!Array.isArray(raw)) return [];

  const parsed: HfModelApiItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const id = (item as { id?: unknown }).id;
    if (typeof id !== 'string' || !id.trim()) continue;
    const downloads = (item as { downloads?: unknown }).downloads;
    const likes = (item as { likes?: unknown }).likes;
    const lastModified = (item as { lastModified?: unknown }).lastModified;
    const pipelineTag = (item as { pipeline_tag?: unknown }).pipeline_tag;
    const tags = (item as { tags?: unknown }).tags;
    parsed.push({
      id: id.trim(),
      downloads:
        typeof downloads === 'number' && Number.isFinite(downloads) ? downloads : undefined,
      likes: typeof likes === 'number' && Number.isFinite(likes) ? likes : undefined,
      lastModified: typeof lastModified === 'string' ? lastModified : undefined,
      pipeline_tag: typeof pipelineTag === 'string' ? pipelineTag : undefined,
      tags: Array.isArray(tags)
        ? tags.filter((t): t is string => typeof t === 'string')
        : undefined,
    });
  }

  return parsed;
}

// ── Local snapshot ──────────────────────────────────────────────────

export async function loadLocalModelSnapshot(client: LmxClient): Promise<LocalModelSnapshot> {
  const [loadedRes, availableRes, history] = await Promise.all([
    client.models(FAST_DISCOVERY_REQUEST_OPTS).catch((err: unknown) => {
      warnModelInventoryFallback('loaded models', err);
      return { models: [] };
    }),
    client.available(FAST_DISCOVERY_REQUEST_OPTS).catch((err: unknown) => {
      warnModelInventoryFallback('downloaded models', err);
      return [] as LmxAvailableModel[];
    }),
    readModelHistory(),
  ]);

  const loadedIds = new Set(loadedRes.models.map((m) => m.model_id));
  const availableById = new Map<string, LmxAvailableModel>();
  for (const model of availableRes) {
    availableById.set(model.repo_id, model);
  }
  if (availableRes.length > 0) {
    await recordModelHistory(
      availableRes.map((m) => m.repo_id),
      'detected'
    );
  }

  const historyById = new Map<string, ModelHistoryEntry>();
  for (const entry of history) {
    historyById.set(entry.id, entry);
  }

  const firstPath = availableRes.find(
    (m) => typeof m.local_path === 'string' && m.local_path.trim().length > 0
  )?.local_path;
  const downloadRoot = firstPath ? dirname(firstPath) : undefined;

  return { loadedIds, availableById, historyById, downloadRoot };
}

// ── Catalog merging / sorting / ranking ─────────────────────────────

export function mergeCatalogEntries(
  snapshot: LocalModelSnapshot,
  hfEntries: HfModelApiItem[]
): LibraryModelEntry[] {
  const byId = new Map<string, LibraryModelEntry>();

  for (const item of hfEntries) {
    byId.set(item.id, {
      id: item.id,
      source: 'library',
      loaded: snapshot.loadedIds.has(item.id),
      downloaded: snapshot.availableById.has(item.id),
      contextLength: lookupContextLimit(item.id),
      downloads: item.downloads,
      likes: item.likes,
      lastModified: item.lastModified,
      pipelineTag: item.pipeline_tag,
      tags: item.tags,
    });
  }

  for (const [id, local] of snapshot.availableById.entries()) {
    const existing = byId.get(id);
    const base: LibraryModelEntry = existing ?? {
      id,
      source: 'local',
      loaded: false,
      downloaded: true,
      contextLength: lookupContextLimit(id),
    };
    byId.set(id, {
      ...base,
      source: 'local',
      loaded: snapshot.loadedIds.has(id),
      downloaded: true,
      localPath: local.local_path,
      sizeBytes: local.size_bytes > 0 ? local.size_bytes : undefined,
      downloadedAt:
        typeof local.downloaded_at === 'number' ? local.downloaded_at * 1000 : undefined,
      contextLength: lookupContextLimit(id),
    });
  }

  for (const [id, history] of snapshot.historyById.entries()) {
    const existing = byId.get(id);
    if (existing) {
      byId.set(id, {
        ...existing,
        historyLastSeenAt: history.lastSeenAt,
      });
      continue;
    }
    byId.set(id, {
      id,
      source: 'history',
      loaded: snapshot.loadedIds.has(id),
      downloaded: false,
      contextLength: lookupContextLimit(id),
      historyLastSeenAt: history.lastSeenAt,
    });
  }

  return Array.from(byId.values());
}

export function sortCatalogEntries(entries: LibraryModelEntry[]): LibraryModelEntry[] {
  const sourceWeight = (source: LibraryModelEntry['source']): number => {
    if (source === 'local') return 0;
    if (source === 'history') return 1;
    return 2;
  };

  return entries.slice().sort((a, b) => {
    if (a.loaded !== b.loaded) return a.loaded ? -1 : 1;
    if (a.downloaded !== b.downloaded) return a.downloaded ? -1 : 1;
    const sw = sourceWeight(a.source) - sourceWeight(b.source);
    if (sw !== 0) return sw;
    const dls = (b.downloads ?? -1) - (a.downloads ?? -1);
    if (dls !== 0) return dls;
    return a.id.localeCompare(b.id);
  });
}

export function rankCatalogEntries(
  entries: LibraryModelEntry[],
  query: string
): LibraryModelEntry[] {
  const q = query.trim();
  if (!q) return sortCatalogEntries(entries);

  const raw = q.toLowerCase();
  const normalized = normalizeModelKey(raw);
  const tokens = splitQueryTokens(raw);
  const ranked = entries
    .map((entry) => {
      const idScore = scoreModelMatch(entry.id, raw, normalized, tokens);
      const metaBlob = `${entry.pipelineTag ?? ''} ${(entry.tags ?? []).join(' ')}`.toLowerCase();
      const metaMatch = normalized.length > 0 && normalizeModelKey(metaBlob).includes(normalized);
      if (idScore === null && !metaMatch) return null;
      return {
        entry,
        score: idScore ?? 5,
        metaPenalty: metaMatch && idScore === null ? 1 : 0,
      };
    })
    .filter(
      (item): item is { entry: LibraryModelEntry; score: number; metaPenalty: number } =>
        item !== null
    )
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      if (a.metaPenalty !== b.metaPenalty) return a.metaPenalty - b.metaPenalty;
      if ((b.entry.downloads ?? -1) !== (a.entry.downloads ?? -1)) {
        return (b.entry.downloads ?? -1) - (a.entry.downloads ?? -1);
      }
      return a.entry.id.localeCompare(b.entry.id);
    });

  return ranked.map((r) => r.entry);
}

// ── Model search/resolve prompts ────────────────────────────────────

export async function promptModelSearch(
  message: string,
  options: ModelPickerOption[],
  defaultModel: string,
  aliasMap: ModelAliasMap = {}
): Promise<string | null> {
  if (options.length === 0) return null;

  const { search } = await import('@inquirer/prompts');
  const ids = options.map((o) => o.id);
  const byId = new Map(options.map((o) => [o.id, o] as const));

  try {
    return await runMenuPrompt(
      (context) =>
        search<string>(
          {
            message: chalk.dim(message),
            source: (input?: string) => {
              const q = (input ?? '').trim();
              const ordered = q
                ? rankModelIds(ids, q, aliasMap).map((m) => m.id)
                : options
                    .slice()
                    .sort((a, b) => {
                      if (a.source !== b.source) return a.source === 'loaded' ? -1 : 1;
                      return a.id.localeCompare(b.id);
                    })
                    .map((o) => o.id);

              return ordered.map((id) => {
                const item = byId.get(id)!;
                return {
                  value: id,
                  name: formatModelOptionLabel(item, defaultModel),
                };
              });
            },
          },
          context
        ),
      'search'
    );
  } catch {
    return null;
  }
}

export async function resolveModelIdFromOptions(
  query: string | undefined,
  options: ModelPickerOption[],
  defaultModel: string,
  promptMessage: string,
  aliasMap: ModelAliasMap = {}
): Promise<string> {
  if (options.length === 0) {
    throw new ExitError(EXIT.NOT_FOUND);
  }

  if (!query || query.trim() === '') {
    if (!isInteractiveTerminal()) {
      console.error(chalk.red('✗') + ' Missing model name in non-interactive terminal');
      printModelMatches(options.map((o) => ({ id: o.id, score: 0 })));
      throw new ExitError(EXIT.MISUSE);
    }
    const selected = await promptModelSearch(promptMessage, options, defaultModel, aliasMap);
    if (!selected) throw new ExitError(EXIT.SIGINT);
    return selected;
  }

  const ids = options.map((o) => o.id);
  const ranked = rankModelIds(ids, query, aliasMap);

  if (ranked.length === 0) {
    console.error(chalk.red('✗') + ` Model "${query}" not found`);
    if (!isInteractiveTerminal()) {
      printModelMatches(options.map((o) => ({ id: o.id, score: 0 })));
      throw new ExitError(EXIT.NOT_FOUND);
    }
    const selected = await promptModelSearch(promptMessage, options, defaultModel, aliasMap);
    if (!selected) throw new ExitError(EXIT.NOT_FOUND);
    return selected;
  }

  if (ranked.length === 1 || ranked[0]!.score < ranked[1]!.score) {
    return ranked[0]!.id;
  }

  if (!isInteractiveTerminal()) {
    console.error(chalk.red('✗') + ` Ambiguous model "${query}"`);
    printModelMatches(ranked);
    throw new ExitError(EXIT.MISUSE);
  }

  const ambiguousOptions = options.filter((o) => ranked.slice(0, 12).some((m) => m.id === o.id));
  const selected = await promptModelSearch(
    `Multiple matches for "${query}" — choose model`,
    ambiguousOptions,
    defaultModel,
    aliasMap
  );
  if (!selected) throw new ExitError(EXIT.SIGINT);
  return selected;
}

export async function getModelOptions(
  client: LmxClient
): Promise<{ loaded: ModelPickerOption[]; onDisk: ModelPickerOption[] }> {
  const [loadedRes, availableRes] = await Promise.all([
    client.models(FAST_DISCOVERY_REQUEST_OPTS),
    client.available(FAST_DISCOVERY_REQUEST_OPTS).catch((err: unknown) => {
      warnModelInventoryFallback('downloaded models', err);
      return [] as LmxAvailableModel[];
    }),
  ]);

  const loaded = loadedRes.models.map((m) => ({
    id: m.model_id,
    source: 'loaded' as const,
    contextLength: m.context_length ?? lookupContextLimit(m.model_id),
    memoryBytes: m.memory_bytes,
    requestCount: m.request_count,
  }));

  const loadedIds = new Set(loaded.map((m) => normalizeModelIdKey(m.id)));
  const onDisk = availableRes
    .filter((m) => !loadedIds.has(normalizeModelIdKey(m.repo_id)))
    .map((m) => ({
      id: m.repo_id,
      source: 'disk' as const,
      contextLength: lookupContextLimit(m.repo_id),
      sizeBytes: m.size_bytes,
    }));

  return { loaded, onDisk };
}

export async function resolveEffectiveDefaultModel(
  client: LmxClient,
  configuredDefault: string,
  opts?: ModelsOptions
): Promise<string> {
  const normalized = normalizeConfiguredModelId(configuredDefault);
  if (normalized) {
    if (normalized !== configuredDefault) {
      await saveConfig({
        'model.default': normalized,
        'model.contextLimit': lookupContextLimit(normalized),
      }).catch(() => {});
    }
    return normalized;
  }

  const loaded = await client
    .models(FAST_DISCOVERY_REQUEST_OPTS)
    .catch(() => ({ models: [] as LmxModelDetail[] }));
  const fallbackLoaded = loaded.models[0]?.model_id;
  if (fallbackLoaded) {
    await saveConfig({
      'model.default': fallbackLoaded,
      'model.contextLimit': lookupContextLimit(fallbackLoaded),
    }).catch(() => {});
    if (!opts?.json) {
      console.log(
        chalk.yellow('!') + ` Default model was unset; using loaded model ${fallbackLoaded}`
      );
    }
    return fallbackLoaded;
  }

  const available = await client
    .available(FAST_DISCOVERY_REQUEST_OPTS)
    .catch(() => [] as LmxAvailableModel[]);
  const fallbackOnDisk = available[0]?.repo_id;
  if (fallbackOnDisk) {
    await saveConfig({
      'model.default': fallbackOnDisk,
      'model.contextLimit': lookupContextLimit(fallbackOnDisk),
    }).catch(() => {});
    if (!opts?.json) {
      console.log(
        chalk.yellow('!') + ` Default model was unset; using on-disk model ${fallbackOnDisk}`
      );
    }
    return fallbackOnDisk;
  }

  return '';
}

// ── List / Dashboard / Scan ─────────────────────────────────────────

export async function listModels(
  client: LmxClient,
  defaultModel: string,
  opts?: ModelsOptions
): Promise<void> {
  const spinner = opts?.json ? null : await createSpinner();
  spinner?.start('Fetching models...');

  try {
    const result = await client.models(FAST_DISCOVERY_REQUEST_OPTS);
    spinner?.stop();

    if (opts?.json) {
      const output = result.models.map((m) => ({
        id: m.model_id,
        status: m.status,
        contextLength: m.context_length ?? lookupContextLimit(m.model_id),
        memoryBytes: m.memory_bytes,
        isDefault: m.model_id === defaultModel || m.is_default,
      }));
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    console.log(chalk.bold('Models\n'));

    for (const model of result.models) {
      const ctx = model.context_length ?? lookupContextLimit(model.model_id);
      const ctxStr = chalk.dim(` ${(ctx / 1000).toFixed(0)}K context`);
      const def = model.model_id === defaultModel || model.is_default ? chalk.green(' ★') : '';
      const mem = model.memory_bytes
        ? chalk.dim(` ${(model.memory_bytes / 1e9).toFixed(1)}GB`)
        : '';
      console.log(`  ${model.model_id}${ctxStr}${mem}${def}`);
    }

    if (result.models.length === 0) {
      console.log(chalk.dim('  ' + NO_MODELS_LOADED));
    }

    console.log('\n' + chalk.dim(`Use ${chalk.reset('opta models use <name>')} to switch default`));
    console.log(chalk.dim(`Use ${chalk.reset('opta models load <name>')} to load a model`));
  } catch (err) {
    spinner?.stop();
    throwModelCommandError(err);
  }
}

export async function showModelDashboard(
  client: LmxClient,
  defaultModel: string,
  opts?: ModelsOptions
): Promise<void> {
  const [snapshot, loadedRes, memory, aliases] = await Promise.all([
    loadLocalModelSnapshot(client),
    client.models(FAST_DISCOVERY_REQUEST_OPTS).catch((err: unknown) => {
      warnModelInventoryFallback('loaded models', err);
      return { models: [] as LmxModelDetail[] };
    }),
    client.memory(FAST_DISCOVERY_REQUEST_OPTS).catch((err: unknown) => {
      warnModelInventoryFallback('memory telemetry', err);
      return null as LmxMemoryResponse | null;
    }),
    readModelAliasMap(),
  ]);

  const catalog = sortCatalogEntries(mergeCatalogEntries(snapshot, []));
  const loaded = loadedRes.models;
  const loadedIds = new Set(loaded.map((model) => normalizeModelIdKey(model.model_id)));
  const onDiskCount = catalog.filter((entry) => entry.downloaded).length;
  const historyOnlyCount = catalog.filter(
    (entry) => entry.source === 'history' && !entry.downloaded
  ).length;
  const defaultLoaded = loaded.some((model) => modelIdsEqual(model.model_id, defaultModel));
  const aliasEntries = Object.entries(aliases).sort((a, b) => a[0].localeCompare(b[0]));

  if (opts?.json) {
    console.log(
      JSON.stringify(
        {
          defaultModel,
          defaultLoaded,
          counts: {
            loaded: loaded.length,
            onDisk: onDiskCount,
            historyOnly: historyOnlyCount,
            aliases: aliasEntries.length,
          },
          memory: memory
            ? {
                usedGb: memory.used_gb,
                totalGb: memory.total_unified_memory_gb,
                percent:
                  memory.total_unified_memory_gb > 0
                    ? Math.round((memory.used_gb / memory.total_unified_memory_gb) * 100)
                    : null,
              }
            : null,
          loaded: loaded.map((model) => ({
            id: model.model_id,
            contextLength: model.context_length ?? lookupContextLimit(model.model_id),
            memoryBytes: model.memory_bytes,
            requestCount: model.request_count,
            isDefault: modelIdsEqual(model.model_id, defaultModel),
          })),
          aliases: Object.fromEntries(aliasEntries),
        },
        null,
        2
      )
    );
    return;
  }

  console.log(chalk.bold('\nModel Dashboard'));
  console.log(
    chalk.dim(
      `  default ${defaultModel}${defaultLoaded ? chalk.green(' (loaded)') : chalk.dim(' (not loaded)')}`
    )
  );

  if (memory) {
    const totalGb = memory.total_unified_memory_gb;
    const usedPct = totalGb > 0 ? Math.round((memory.used_gb / totalGb) * 100) : 0;
    const bar = renderPercentBar(usedPct, 14);
    console.log(
      chalk.dim(
        `  Memory ${bar} ${usedPct}% · ${memory.used_gb.toFixed(1)}/${totalGb.toFixed(1)} GB`
      )
    );
  }

  console.log(
    chalk.dim(
      `  Loaded ${loaded.length} · On disk ${onDiskCount} · History only ${historyOnlyCount} · Aliases ${aliasEntries.length}\n`
    )
  );

  if (loaded.length === 0) {
    console.log(chalk.dim('  ' + NO_MODELS_LOADED));
  } else {
    console.log(chalk.bold('Loaded'));
    for (const model of loaded.slice(0, 8)) {
      const isDefault = modelIdsEqual(model.model_id, defaultModel);
      const bullet = isDefault ? chalk.green('●') : chalk.cyan('○');
      const ctx = fmtCtx(model.context_length ?? lookupContextLimit(model.model_id));
      const mem = model.memory_bytes ? fmtGB(model.memory_bytes) : '';
      const reqs = model.request_count ? `${model.request_count} reqs` : '';
      const meta = [ctx, mem, reqs].filter(Boolean).join(' · ');
      console.log(
        `  ${bullet} ${model.model_id}${meta ? `  ${chalk.dim(meta)}` : ''}${isDefault ? chalk.green(' ★') : ''}`
      );
    }
    if (loaded.length > 8) {
      console.log(chalk.dim(`  … ${loaded.length - 8} more loaded`));
    }
  }

  const onDiskTop = catalog
    .filter((entry) => entry.downloaded && !loadedIds.has(normalizeModelIdKey(entry.id)))
    .slice(0, 6);
  if (onDiskTop.length > 0) {
    console.log(chalk.bold('\nOn Disk (Top)'));
    for (const entry of onDiskTop) {
      const size = entry.sizeBytes ? `${fmtGB(entry.sizeBytes)} disk` : '';
      const dls =
        typeof entry.downloads === 'number' ? `${formatCompactCount(entry.downloads)} dl` : '';
      const meta = [fmtCtx(entry.contextLength), size, dls].filter(Boolean).join(' · ');
      console.log(`  ${chalk.dim('○')} ${entry.id}${meta ? `  ${chalk.dim(meta)}` : ''}`);
    }
  }

  if (aliasEntries.length > 0) {
    console.log(chalk.bold('\nAliases'));
    for (const [alias, target] of aliasEntries.slice(0, 8)) {
      const exists =
        catalog.some((entry) => modelIdsEqual(entry.id, target)) ||
        loaded.some((model) => modelIdsEqual(model.model_id, target));
      console.log(
        `  ${chalk.cyan(alias)} ${chalk.dim('→')} ${target}${exists ? '' : chalk.yellow(' (target not detected locally)')}`
      );
    }
    if (aliasEntries.length > 8) {
      console.log(chalk.dim(`  … ${aliasEntries.length - 8} more aliases`));
    }
  } else {
    console.log(
      chalk.dim(
        '\n  No custom aliases yet. Add one with: opta models alias mini inferencelabs/GLM-5-MLX-4.8bit'
      )
    );
  }
}

export async function scanModelsCommand(
  _client: LmxClient,
  config: Awaited<ReturnType<typeof loadConfig>>,
  opts?: ModelsOptions
): Promise<void> {
  const spinner = opts?.json ? null : await createSpinner();
  const { host, port } = config.connection;
  const isFull = opts?.full === true;
  spinner?.start(progressText('Scan models', 15, `scanning LMX (${host}:${port}) + providers${isFull ? ' (full)' : ''}`));

  try {
    const scan = await gatherScanData(config, isFull);
    spinner?.succeed(progressText('Scan models', 100, 'scan complete'));

    // --- JSON output ---
    if (opts?.json) {
      console.log(JSON.stringify(scan, null, 2));
      return;
    }

    // --- Build role lookup (model_id -> role names) ---
    const roleMap = buildRoleMap(scan.roles);

    // --- Build loaded set for dedup with available ---
    const loadedIds = new Set(scan.loaded.map((m) => m.model_id));
    const defaultModel = config.model.default;

    // --- Print: Loaded ---
    if (!scan.lmxReachable) {
      console.log(chalk.yellow('\n  LMX unreachable') + chalk.dim(` (${host}:${port})\n`));
    } else {
      console.log(
        chalk.bold('\n  Loaded') +
          chalk.dim(
            ` \u2500\u2500 LMX ${host}:${port} \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`
          )
      );
      if (scan.loaded.length === 0) {
        console.log(chalk.dim('  ' + NO_MODELS_LOADED));
      }
      for (const m of scan.loaded) {
        const ctx = m.context_length ?? lookupContextLimit(m.model_id);
        const parts: string[] = [fmtCtx(ctx)];
        if (m.memory_bytes) parts.push(fmtGB(m.memory_bytes));
        if (m.request_count != null && m.request_count > 0) parts.push(`${m.request_count} reqs`);
        const roles = roleMap.get(m.model_id);
        if (roles) parts.push(roles.map((r) => `role:${r}`).join(' '));
        const isDefault = m.model_id === defaultModel || m.is_default;
        const star = isDefault ? chalk.green(' \u2605') : '';
        const dp = getDisplayProfile(m.model_id);
        const tag = fmtTag(dp.format);
        console.log(
          `  ${chalk.green('\u25cf')} ${chalk.bold(dp.displayName)} ${tag} ${chalk.dim(dp.orgAbbrev)}  ${chalk.dim(parts.join(' \u00b7 '))}${star}`
        );
      }

      // --- Print: Available on disk ---
      const unloaded = scan.available.filter((a) => !loadedIds.has(a.repo_id));
      if (unloaded.length > 0) {
        console.log(
          chalk.bold('\n  On Disk') +
            chalk.dim(
              ' \u2500\u2500 downloaded, not loaded \u2500\u2500\u2500\u2500\u2500\u2500\u2500'
            )
        );
        for (const a of unloaded) {
          const ctx = lookupContextLimit(a.repo_id);
          const parts: string[] = [fmtCtx(ctx)];
          if (a.size_bytes > 0) parts.push(`${fmtGB(a.size_bytes)} on disk`);
          const dp = getDisplayProfile(a.repo_id);
          const tag = fmtTag(dp.format);
          console.log(
            `  ${chalk.dim('\u25cb')} ${dp.displayName} ${tag} ${chalk.dim(dp.orgAbbrev)}  ${chalk.dim(parts.join(' \u00b7 '))}`
          );
        }
      }
    }

    // --- Print: Presets ---
    if (scan.presets.length > 0) {
      console.log(
        chalk.bold('\n  Presets') +
          chalk.dim(
            ' \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500'
          )
      );
      for (const p of scan.presets) {
        const modelStr = shortId(p.model);
        const isLoaded = loadedIds.has(p.model);
        const dot = isLoaded ? chalk.green('\u25cf') : chalk.dim('\u25cb');
        const aliasStr = p.routing_alias ? chalk.cyan(`alias:"${p.routing_alias}"`) : '';
        const autoStr = p.auto_load ? chalk.dim('auto-load') : '';
        const parts = [`\u2192 ${modelStr}`, aliasStr, autoStr].filter(Boolean);
        console.log(`  ${dot} ${chalk.bold(p.name.padEnd(20))} ${chalk.dim(parts.join('  '))}`);
      }
    }

    // --- Print: Cloud providers ---
    if (scan.cloud.length > 0) {
      const statusStr = scan.cloudHealthy
        ? chalk.green('api key \u2713')
        : chalk.yellow('not configured');
      console.log(
        chalk.bold('\n  Cloud') +
          chalk.dim(
            ` \u2500\u2500 Anthropic \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 `
          ) +
          statusStr
      );
      for (const m of scan.cloud) {
        const ctx = m.contextLength ? fmtCtx(m.contextLength) : '';
        const name = m.name ?? m.id;
        console.log(
          `  ${chalk.blue('\u2601')} ${m.id}  ${chalk.dim(name !== m.id ? `${name}  ` : '')}${chalk.dim(ctx)}`
        );
      }
    }

    // --- Print: Memory summary ---
    if (scan.memory) {
      const pct = Math.round((scan.memory.used_gb / scan.memory.total_unified_memory_gb) * 100);
      const pctColor = pct > 80 ? chalk.red : pct > 60 ? chalk.yellow : chalk.green;
      console.log(
        chalk.bold('\n  Memory') +
          chalk.dim(
            ' \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500'
          )
      );
      console.log(
        `  ${scan.memory.used_gb.toFixed(1)} / ${scan.memory.total_unified_memory_gb.toFixed(1)} GB used ` +
          pctColor(`(${pct}%)`) +
          chalk.dim(` \u00b7 threshold ${scan.memory.threshold_percent}%`)
      );
    }

    // --- Print: Summary footer ---
    const summary = summarizeScan(scan);
    const counts: string[] = [];
    if (summary.loadedCount > 0) counts.push(`${summary.loadedCount} loaded`);
    if (summary.onDiskCount > 0) counts.push(`${summary.onDiskCount} on disk`);
    if (summary.presetCount > 0) counts.push(`${summary.presetCount} presets`);
    if (summary.cloudCount > 0) counts.push(`${summary.cloudCount} cloud`);

    console.log(`\n  ${chalk.dim(counts.join(' \u00b7 '))}`);
    console.log(chalk.dim(`  'opta models load <name>'         load from disk`));
    console.log(chalk.dim(`  'opta models stop'                unload all models`));
    console.log(chalk.dim(`  'opta models swap <old> <new>'    swap running model`));
    console.log(chalk.dim(`  'opta models use <name>'          switch default\n`));
  } catch (err) {
    spinner?.stop();
    throwModelCommandError(err);
  }
}

export function formatModelComparison(
  entry: LibraryModelEntry,
  catalog: LibraryModelEntry[]
): string {
  const withDownloads = catalog
    .map((item) => item.downloads)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (typeof entry.downloads !== 'number' || withDownloads.length < 3) {
    return 'Comparison: not enough catalog stats yet';
  }

  const rank = withDownloads.filter((value) => value > entry.downloads!).length + 1;
  const percentile = Math.max(1, Math.round((rank / withDownloads.length) * 100));
  return `Downloads rank: #${rank}/${withDownloads.length} (top ${percentile}%)`;
}

export async function promptCatalogSelection(
  message: string,
  entries: LibraryModelEntry[],
  defaultModel: string
): Promise<LibraryModelEntry | null> {
  if (entries.length === 0) return null;
  const { search } = await import('@inquirer/prompts');
  const byId = new Map(entries.map((entry) => [entry.id, entry] as const));

  try {
    const selected = await runMenuPrompt(
      (context) =>
        search<string>(
          {
            message: chalk.dim(message),
            source: (input?: string) => {
              const query = (input ?? '').trim();
              const ranked = rankCatalogEntries(entries, query).slice(0, 140);
              for (const entry of ranked) {
                byId.set(entry.id, entry);
              }
              return ranked.map((entry) => ({
                value: entry.id,
                name: formatCatalogEntryLabel(entry, defaultModel),
              }));
            },
          },
          context
        ),
      'search'
    );
    return selected ? (byId.get(selected) ?? null) : null;
  } catch {
    return null;
  }
}
