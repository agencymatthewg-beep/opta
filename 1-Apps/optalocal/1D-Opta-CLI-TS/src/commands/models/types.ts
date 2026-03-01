/**
 * Shared types, constants, and pure utility functions for the models subsystem.
 *
 * Every other submodule in `src/commands/models/` imports from this file.
 * This file MUST NOT import from any sibling submodule.
 */

import chalk from 'chalk';
import { readFile } from 'node:fs/promises';
import { renderPercentBar } from '../../ui/progress.js';
import { errorMessage } from '../../utils/errors.js';
import { LmxApiError } from '../../lmx/client.js';
import type { LmxAvailableModel, LmxRequestOptions } from '../../lmx/client.js';
import { modelIdsEqual, type ModelLoadProgress } from '../../lmx/model-lifecycle.js';
import { formatError, OptaError, ExitError, EXIT } from '../../core/errors.js';
import { formatTagLabel } from '../../core/model-display.js';
import type { ModelFormat } from '../../core/model-display.js';
import { fmtGB, fmtCtx } from '../../providers/model-scan.js';
import type { Spinner } from '../../ui/spinner.js';

// ── Interfaces ──────────────────────────────────────────────────────

export interface ModelsOptions {
  json?: boolean;
  full?: boolean;
}

export interface ModelPickerOption {
  id: string;
  source: 'loaded' | 'disk';
  contextLength?: number;
  memoryBytes?: number;
  sizeBytes?: number;
  requestCount?: number;
}

export interface RankedModelMatch {
  id: string;
  score: number;
}

export type ModelHistoryAction = 'detected' | 'downloaded' | 'loaded' | 'deleted' | 'chat';

export interface ModelHistoryEntry {
  id: string;
  firstSeenAt: number;
  lastSeenAt: number;
  lastAction: ModelHistoryAction;
}

export interface HfModelApiItem {
  id: string;
  downloads?: number;
  likes?: number;
  lastModified?: string;
  pipeline_tag?: string;
  tags?: string[];
}

export interface LibraryModelEntry {
  id: string;
  source: 'local' | 'history' | 'library';
  loaded: boolean;
  downloaded: boolean;
  contextLength: number;
  localPath?: string;
  sizeBytes?: number;
  downloadedAt?: number;
  historyLastSeenAt?: number;
  downloads?: number;
  likes?: number;
  lastModified?: string;
  pipelineTag?: string;
  tags?: string[];
}

export type ModelBrowserAction =
  | 'info'
  | 'use-chat'
  | 'download'
  | 'delete'
  | 'open-file'
  | 'open-download'
  | 'benchmark-chat'
  | 'back';

export type ModelManagerAction =
  | 'use'
  | 'load'
  | 'unload'
  | 'swap'
  | 'stop'
  | 'dashboard'
  | 'browse-local'
  | 'browse-library'
  | 'scan'
  | 'refresh'
  | 'exit';

export type ModelAliasMap = Record<string, string>;

export interface ParsedSseEvent {
  event: string;
  data: string;
}

export interface LocalModelSnapshot {
  loadedIds: Set<string>;
  availableById: Map<string, LmxAvailableModel>;
  historyById: Map<string, ModelHistoryEntry>;
  downloadRoot?: string;
}

// ── Constants ───────────────────────────────────────────────────────

export const MODEL_HISTORY_KEY = 'models.history';
export const MODEL_ALIASES_KEY = 'models.aliases';
export const MODEL_HISTORY_LIMIT = 800;
export const HF_CATALOG_LIMIT = 250;
export const HF_QUERY_LIMIT = 120;
export const MODEL_ALIAS_LIMIT = 300;
export const STABLE_MODEL_LOAD_TIMEOUT_MS = 300_000;
export const STABLE_MODEL_LOAD_REQUEST_TIMEOUT_MS = 15_000;
export const FAST_DISCOVERY_TIMEOUT_MS = 5_000;
export const FAST_DISCOVERY_REQUEST_OPTS: LmxRequestOptions = {
  timeoutMs: FAST_DISCOVERY_TIMEOUT_MS,
  maxRetries: 0,
};
export const MODEL_INVENTORY_WARNINGS = new Set<string>();

export const LIFECYCLE_PROGRESS_MIN_HORIZON_MS = 15_000;
export const LIFECYCLE_PROGRESS_MAX_HORIZON_MS = 90_000;
export const LIFECYCLE_PROGRESS_HEARTBEAT_MS = 3_000;

// ── Pure utility functions ──────────────────────────────────────────

export function isInteractiveTerminal(): boolean {
  return Boolean(process.stdout.isTTY) && Boolean(process.stdin.isTTY) && !process.env['CI'];
}

/**
 * Normalize user-entered model text for forgiving matching.
 */
export function normalizeModelKey(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function modelAliases(modelId: string): string[] {
  const lower = modelId.toLowerCase();
  const tail = lower.split('/').pop() ?? lower;
  const dotTail = lower.split('.').pop() ?? lower;
  const aliases = [
    lower,
    tail,
    dotTail,
    normalizeModelKey(lower),
    normalizeModelKey(tail),
    normalizeModelKey(dotTail),
  ];
  return [...new Set(aliases.filter(Boolean))];
}

export function splitQueryTokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z]+|\d+/g) ?? [])
    .map((token) => normalizeModelKey(token))
    .filter(Boolean);
}

export function parseShellLikeArgs(raw: string): string[] {
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

export async function readStdinText(): Promise<string> {
  if (process.stdin.isTTY) return '';
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function resolveDataSource(raw: string, flagName: string): Promise<string> {
  if (raw === '-') {
    const piped = await readStdinText();
    if (!piped.trim()) {
      throw new Error(`${flagName} requested stdin ("-"), but no stdin data was provided`);
    }
    return piped;
  }
  if (raw.startsWith('@')) {
    const filePath = raw.slice(1).trim();
    if (!filePath) {
      throw new Error(`${flagName} @file path is empty`);
    }
    return readFile(filePath, 'utf8');
  }
  return raw;
}

export async function parseJsonValueOption(raw: string, flagName: string): Promise<unknown> {
  const source = await resolveDataSource(raw, flagName);
  try {
    return JSON.parse(source);
  } catch (err) {
    throw new Error(`${flagName} must be valid JSON: ${errorMessage(err)}`);
  }
}

export async function parseJsonObjectOption(
  raw: string,
  flagName: string
): Promise<Record<string, unknown>> {
  const parsed = await parseJsonValueOption(raw, flagName);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${flagName} must resolve to a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

export function parseCsvList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Build a user-facing warning when model inventory/admin calls fail but the command can continue.
 */
export function formatModelInventoryWarning(scope: string, err: unknown): string {
  if (err instanceof LmxApiError) {
    if (err.code === 'unauthorized' || err.status === 403) {
      return `LMX denied access to ${scope} (403 unauthorized). Check connection.adminKey.`;
    }
    if (err.code === 'connection_error') {
      return `LMX unreachable while fetching ${scope}: ${err.message}`;
    }
    return `Failed to fetch ${scope} from LMX: ${err.message}`;
  }
  if (err instanceof Error) {
    return `Failed to fetch ${scope}: ${err.message}`;
  }
  return `Failed to fetch ${scope} from LMX.`;
}

export function warnModelInventoryFallback(scope: string, err: unknown): void {
  const message = formatModelInventoryWarning(scope, err);
  if (MODEL_INVENTORY_WARNINGS.has(message)) return;
  MODEL_INVENTORY_WARNINGS.add(message);
  console.error(chalk.yellow('!') + ` ${message}`);
}

/** Colored format tag for a model's format type. */
export function fmtTag(format: ModelFormat): string {
  switch (format) {
    case 'MLX':
      return chalk.hex('#a855f7')(formatTagLabel(format));
    case 'GGUF':
      return chalk.yellow(formatTagLabel(format));
    case 'CLOUD':
      return chalk.blue(formatTagLabel(format));
    default:
      return chalk.dim(formatTagLabel(format));
  }
}

export function matchesTokenSequence(target: string, tokens: string[]): boolean {
  if (tokens.length === 0) return false;
  let position = 0;
  for (const token of tokens) {
    const next = target.indexOf(token, position);
    if (next === -1) return false;
    position = next + token.length;
  }
  return true;
}

export function scoreModelMatch(
  modelId: string,
  rawQuery: string,
  normalizedQuery: string,
  queryTokens: string[],
  extraAliases: string[] = []
): number | null {
  const aliases = [...modelAliases(modelId), ...extraAliases.map((alias) => alias.toLowerCase())];
  const normalizedAliases = [...new Set(aliases.map(normalizeModelKey).filter(Boolean))];

  if (aliases.some((a) => a === rawQuery || a === normalizedQuery)) return 0;
  if (aliases.some((a) => a.startsWith(rawQuery) || a.startsWith(normalizedQuery))) return 1;
  if (aliases.some((a) => a.includes(rawQuery) || a.includes(normalizedQuery))) return 2;
  if (
    queryTokens.length > 1 &&
    normalizedAliases.some((alias) => matchesTokenSequence(alias, queryTokens))
  )
    return 3;
  return null;
}

/**
 * Rank model IDs by fuzzy relevance for non-exact name input.
 */
export function rankModelIds(
  ids: string[],
  query: string,
  aliasMap: ModelAliasMap = {}
): RankedModelMatch[] {
  const raw = query.trim().toLowerCase();
  const normalized = normalizeModelKey(raw);
  const queryTokens = splitQueryTokens(raw);
  if (!raw) return [];

  const aliasEntries = Object.entries(aliasMap);

  return ids
    .map((id) => {
      const relatedAliases = aliasEntries
        .filter(([, target]) => modelIdsEqual(target, id))
        .map(([alias]) => alias);
      const score = scoreModelMatch(id, raw, normalized, queryTokens, relatedAliases);
      return score === null ? null : { id, score };
    })
    .filter((v): v is RankedModelMatch => v !== null)
    .sort((a, b) => a.score - b.score || a.id.length - b.id.length || a.id.localeCompare(b.id));
}

export function normalizeTimestamp(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : null;
  return numeric && numeric > 0 ? numeric : fallback;
}

export function formatCompactCount(value: number): string {
  if (!Number.isFinite(value)) return '0';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
}

export function formatRelativeTime(timestampMs: number): string {
  const diffMs = Date.now() - timestampMs;
  const mins = Math.max(1, Math.round(diffMs / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function progressText(action: string, percent: number, detail: string): string {
  return `${renderPercentBar(percent, 16)} ${action}${detail ? ` ${chalk.dim(detail)}` : ''}`;
}

export function computeLifecycleStagePercent(
  startPercent: number,
  progress: ModelLoadProgress,
  previousPercent?: number
): number {
  const clampedStart = Math.max(0, Math.min(99, Math.round(startPercent)));
  if (progress.status === 'ready') return 100;

  const span = Math.max(1, 99 - clampedStart);
  const effectiveTimeoutMs =
    progress.timeoutMs > 0
      ? Math.max(
          LIFECYCLE_PROGRESS_MIN_HORIZON_MS,
          Math.min(progress.timeoutMs, LIFECYCLE_PROGRESS_MAX_HORIZON_MS)
        )
      : LIFECYCLE_PROGRESS_MAX_HORIZON_MS;
  const ratio = Math.max(0, Math.min(1, progress.elapsedMs / effectiveTimeoutMs));
  const easedByTime = clampedStart + Math.floor(Math.sqrt(ratio) * span);
  const heartbeat =
    clampedStart +
    Math.min(span - 1, Math.floor(progress.elapsedMs / LIFECYCLE_PROGRESS_HEARTBEAT_MS));
  const attemptBump =
    clampedStart + Math.min(span - 1, Math.floor(Math.log2(Math.max(2, progress.attempt + 1))));
  const target = Math.max(clampedStart + 1, easedByTime, heartbeat, attemptBump);
  const floorPercent =
    previousPercent == null ? clampedStart : Math.max(clampedStart, previousPercent);
  return Math.min(99, Math.max(floorPercent, target));
}

export function createLifecycleProgressUpdater(
  spinner: Spinner,
  action: string,
  verb: string,
  modelId: string,
  startPercent: number
): (progress: ModelLoadProgress) => void {
  const clampedStart = Math.max(0, Math.min(99, Math.round(startPercent)));
  let lastSecond = -1;
  let lastRenderedPercent = clampedStart;

  return (progress: ModelLoadProgress): void => {
    if (progress.status === 'ready') return;
    const elapsedSeconds = Math.floor(progress.elapsedMs / 1000);
    const nextPercent = computeLifecycleStagePercent(clampedStart, progress, lastRenderedPercent);
    if (
      elapsedSeconds === lastSecond &&
      nextPercent === lastRenderedPercent &&
      progress.elapsedMs > 0
    ) {
      return;
    }
    lastSecond = elapsedSeconds;
    lastRenderedPercent = nextPercent;

    spinner.start(progressText(action, nextPercent, `${verb} ${modelId} · ${elapsedSeconds}s`));
  };
}

export function createLoadProgressUpdater(
  spinner: Spinner,
  action: string,
  modelId: string,
  startPercent: number
): (progress: ModelLoadProgress) => void {
  return createLifecycleProgressUpdater(spinner, action, 'loading', modelId, startPercent);
}

export function createUnloadProgressUpdater(
  spinner: Spinner,
  action: string,
  modelId: string,
  startPercent: number
): (progress: ModelLoadProgress) => void {
  return createLifecycleProgressUpdater(spinner, action, 'unloading', modelId, startPercent);
}

export function throwModelCommandError(err: unknown): never {
  if (err instanceof ExitError) throw err;
  if (err instanceof OptaError) {
    console.error(formatError(err));
    throw new ExitError(err.code);
  }
  if (err instanceof LmxApiError) {
    console.error(chalk.red('✗') + ` ${err.message}`);
    throw new ExitError(err.code === 'not_found' ? EXIT.NOT_FOUND : EXIT.ERROR);
  }
  if (err instanceof Error) {
    console.error(chalk.red('✗') + ` ${err.message}`);
    throw new ExitError(EXIT.ERROR);
  }
  console.error(chalk.red('✗') + ` ${errorMessage(err)}`);
  throw new ExitError(EXIT.ERROR);
}

export function printModelMatches(ranked: RankedModelMatch[], limit = 8): void {
  for (const match of ranked.slice(0, limit)) {
    console.log(`  ${match.id}`);
  }
}

export function formatModelOptionLabel(option: ModelPickerOption, defaultModel: string): string {
  const isDefault = option.id === defaultModel;
  const bullet = option.source === 'loaded' ? chalk.green('●') : chalk.dim('○');
  const role = option.source === 'loaded' ? chalk.dim('loaded') : chalk.dim('on disk');
  const ctx = option.contextLength ? fmtCtx(option.contextLength) : '';
  const mem = option.memoryBytes ? fmtGB(option.memoryBytes) : '';
  const size = option.sizeBytes ? `${fmtGB(option.sizeBytes)} disk` : '';
  const reqs = option.requestCount ? `${option.requestCount} reqs` : '';
  const meta = [role, ctx, mem, size, reqs].filter(Boolean).join(' · ');
  const star = isDefault ? chalk.green(' ★') : '';
  return `${bullet} ${option.id}${meta ? `  ${chalk.dim(meta)}` : ''}${star}`;
}

export function formatCatalogEntryLabel(entry: LibraryModelEntry, defaultModel: string): string {
  const dot = entry.loaded
    ? chalk.green('●')
    : entry.downloaded
      ? chalk.cyan('○')
      : entry.source === 'history'
        ? chalk.yellow('◌')
        : chalk.dim('·');
  const defaultStar = entry.id === defaultModel ? chalk.green(' ★') : '';
  const sourceTag = entry.loaded
    ? 'loaded'
    : entry.downloaded
      ? 'on disk'
      : entry.source === 'history'
        ? 'history'
        : 'library';
  const metadata: string[] = [sourceTag, fmtCtx(entry.contextLength)];
  if (entry.sizeBytes && entry.sizeBytes > 0) metadata.push(`${fmtGB(entry.sizeBytes)} disk`);
  if (typeof entry.downloads === 'number')
    metadata.push(`${formatCompactCount(entry.downloads)} dl`);
  if (typeof entry.likes === 'number') metadata.push(`${formatCompactCount(entry.likes)} likes`);
  if (entry.pipelineTag) metadata.push(entry.pipelineTag);
  return `${dot} ${entry.id}  ${chalk.dim(metadata.join(' · '))}${defaultStar}`;
}

export async function streamSseEvents(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number
): Promise<{ events: ParsedSseEvent[]; timedOut: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const events: ParsedSseEvent[] = [];
  let timedOut = false;

  const pushEvent = (eventName: string, dataLines: string[]): void => {
    if (dataLines.length === 0) return;
    events.push({
      event: eventName || 'message',
      data: dataLines.join('\n'),
    });
  };

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `HTTP ${response.status} ${response.statusText}${body ? `: ${body.trim()}` : ''}`
      );
    }

    if (!response.body) {
      const text = await response.text();
      if (text.trim()) {
        events.push({ event: 'message', data: text });
      }
      return { events, timedOut: false };
    }

    const decoder = new TextDecoder();
    const reader = response.body.getReader();
    let buffer = '';
    let currentEvent = 'message';
    let dataLines: string[] = [];

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newlineIdx = buffer.search(/\r?\n/);
      while (newlineIdx !== -1) {
        const line = buffer.slice(0, newlineIdx).replace(/\r$/, '');
        buffer = buffer.slice(
          newlineIdx + (buffer[newlineIdx] === '\r' && buffer[newlineIdx + 1] === '\n' ? 2 : 1)
        );
        if (!line) {
          pushEvent(currentEvent, dataLines);
          currentEvent = 'message';
          dataLines = [];
          newlineIdx = buffer.search(/\r?\n/);
          continue;
        }
        if (line.startsWith(':')) {
          newlineIdx = buffer.search(/\r?\n/);
          continue;
        }
        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim() || 'message';
          newlineIdx = buffer.search(/\r?\n/);
          continue;
        }
        if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trimStart());
        }
        newlineIdx = buffer.search(/\r?\n/);
      }
    }

    if (buffer.trim()) {
      const line = buffer.replace(/\r$/, '');
      if (line.startsWith('event:')) currentEvent = line.slice(6).trim() || currentEvent;
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
    }
    pushEvent(currentEvent, dataLines);
    return { events, timedOut: false };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      timedOut = true;
      return { events, timedOut };
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
