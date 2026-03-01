import type { Dirent } from 'node:fs';
import { appendFile, lstat, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import type {
  BrowserArtifactKind,
  BrowserArtifactMetadata,
  BrowserSessionMetadata,
  BrowserSessionRecordingIndex,
  BrowserSessionStepRecord,
  BrowserVisualDiffManifestEntry,
  BrowserVisualDiffResultEntry,
} from './types.js';

export const BROWSER_ARTIFACTS_ROOT = join('.opta', 'browser');
export const BROWSER_SESSION_METADATA_FILE = 'metadata.json';
export const BROWSER_SESSION_STEPS_FILE = 'steps.jsonl';
export const BROWSER_SESSION_RECORDINGS_FILE = 'recordings.json';
export const BROWSER_VISUAL_DIFF_MANIFEST_FILE = 'visual-diff-manifest.jsonl';
export const BROWSER_VISUAL_DIFF_RESULTS_FILE = 'visual-diff-results.jsonl';
const DAY_MS = 24 * 60 * 60 * 1_000;
const BROWSER_ARTIFACTS_RESERVED_DIRS = new Set(['profiles', 'canary-evidence', 'run-corpus']);

export interface BrowserArtifactSessionDirEntry {
  sessionId: string;
  absolutePath: string;
  relativePath: string;
  modifiedAt: string;
  modifiedMs: number;
}

export interface BrowserArtifactRetentionPolicy {
  retentionDays: number;
  maxPersistedSessions: number;
}

export const DEFAULT_BROWSER_ARTIFACT_RETENTION_POLICY: Readonly<BrowserArtifactRetentionPolicy> = Object.freeze({
  retentionDays: 30,
  maxPersistedSessions: 200,
});

export interface BrowserArtifactPruneOptions {
  cwd?: string;
  now?: () => Date;
  sessionId?: string;
  excludeSessionIds?: string[];
  policy?: Partial<BrowserArtifactRetentionPolicy>;
}

export interface BrowserArtifactPruneResult {
  rootDir: string;
  policy: BrowserArtifactRetentionPolicy;
  listed: BrowserArtifactSessionDirEntry[];
  kept: BrowserArtifactSessionDirEntry[];
  pruned: BrowserArtifactSessionDirEntry[];
}

function sanitizePathSegment(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 'session';
  const sanitized = trimmed.replace(/[\\/]/g, '_');
  if (sanitized === '.' || sanitized === '..') return 'session';
  return sanitized;
}

function normalizeExtension(ext: string): string {
  const normalized = ext.replace(/^\./, '').trim().toLowerCase();
  return normalized.length > 0 ? normalized : 'dat';
}

function compareBySessionId(
  left: Pick<BrowserArtifactSessionDirEntry, 'sessionId'>,
  right: Pick<BrowserArtifactSessionDirEntry, 'sessionId'>,
): number {
  return left.sessionId.localeCompare(right.sessionId);
}

function compareByFreshness(
  left: Pick<BrowserArtifactSessionDirEntry, 'sessionId' | 'modifiedMs'>,
  right: Pick<BrowserArtifactSessionDirEntry, 'sessionId' | 'modifiedMs'>,
): number {
  if (left.modifiedMs !== right.modifiedMs) {
    return right.modifiedMs - left.modifiedMs;
  }
  return compareBySessionId(left, right);
}

function isSafeSessionIdSegment(value: string): boolean {
  if (!value) return false;
  if (value === '.' || value === '..') return false;
  return !value.includes('/') && !value.includes('\\');
}

function assertWithinArtifactsRoot(rootDir: string, targetDir: string): void {
  const rootResolved = resolve(rootDir);
  const targetResolved = resolve(targetDir);
  const rel = relative(rootResolved, targetResolved);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`Refusing to prune path outside browser artifacts root: ${targetDir}`);
  }
}

function coercePositiveInt(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1, Math.floor(value));
}

export function resolveBrowserArtifactRetentionPolicy(
  policy?: Partial<BrowserArtifactRetentionPolicy>,
): BrowserArtifactRetentionPolicy {
  return {
    retentionDays: coercePositiveInt(
      policy?.retentionDays,
      DEFAULT_BROWSER_ARTIFACT_RETENTION_POLICY.retentionDays,
    ),
    maxPersistedSessions: coercePositiveInt(
      policy?.maxPersistedSessions,
      DEFAULT_BROWSER_ARTIFACT_RETENTION_POLICY.maxPersistedSessions,
    ),
  };
}

export function browserArtifactsRootPath(cwd: string): string {
  return join(cwd, BROWSER_ARTIFACTS_ROOT);
}

export function browserSessionArtifactsDir(cwd: string, sessionId: string): string {
  return join(cwd, BROWSER_ARTIFACTS_ROOT, sanitizePathSegment(sessionId));
}

export function browserSessionMetadataPath(cwd: string, sessionId: string): string {
  return join(browserSessionArtifactsDir(cwd, sessionId), BROWSER_SESSION_METADATA_FILE);
}

export function browserSessionStepsPath(cwd: string, sessionId: string): string {
  return join(browserSessionArtifactsDir(cwd, sessionId), BROWSER_SESSION_STEPS_FILE);
}

export function browserSessionRecordingsPath(cwd: string, sessionId: string): string {
  return join(browserSessionArtifactsDir(cwd, sessionId), BROWSER_SESSION_RECORDINGS_FILE);
}

export function browserSessionVisualDiffManifestPath(cwd: string, sessionId: string): string {
  return join(browserSessionArtifactsDir(cwd, sessionId), BROWSER_VISUAL_DIFF_MANIFEST_FILE);
}

export function browserSessionVisualDiffResultsPath(cwd: string, sessionId: string): string {
  return join(browserSessionArtifactsDir(cwd, sessionId), BROWSER_VISUAL_DIFF_RESULTS_FILE);
}

export async function ensureBrowserSessionArtifactsDir(cwd: string, sessionId: string): Promise<string> {
  const dir = browserSessionArtifactsDir(cwd, sessionId);
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function listBrowserArtifactSessionDirs(cwd: string): Promise<BrowserArtifactSessionDirEntry[]> {
  const rootDir = browserArtifactsRootPath(cwd);
  let dirents: Dirent[];

  try {
    dirents = await readdir(rootDir, { withFileTypes: true, encoding: 'utf8' });
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') return [];
    throw error;
  }

  const listed: BrowserArtifactSessionDirEntry[] = [];
  for (const dirent of dirents) {
    if (!dirent.isDirectory()) continue;
    if (BROWSER_ARTIFACTS_RESERVED_DIRS.has(dirent.name)) continue;
    if (!isSafeSessionIdSegment(dirent.name)) continue;

    const absolutePath = join(rootDir, dirent.name);
    const stats = await lstat(absolutePath).catch(() => null);
    if (!stats || !stats.isDirectory() || stats.isSymbolicLink()) continue;

    listed.push({
      sessionId: dirent.name,
      absolutePath,
      relativePath: relative(cwd, absolutePath) || dirent.name,
      modifiedAt: new Date(stats.mtimeMs).toISOString(),
      modifiedMs: stats.mtimeMs,
    });
  }

  listed.sort(compareBySessionId);
  return listed;
}

export async function pruneBrowserArtifactSessionDirs(
  options: BrowserArtifactPruneOptions,
): Promise<BrowserArtifactPruneResult> {
  const cwd = options.cwd ?? process.cwd();
  const now = options.now ?? (() => new Date());
  const policy = resolveBrowserArtifactRetentionPolicy(options.policy);
  const rootDir = browserArtifactsRootPath(cwd);
  const listed = await listBrowserArtifactSessionDirs(cwd);
  const requestedSessionId = options.sessionId?.trim();
  const excludedSessionIds = new Set(
    (options.excludeSessionIds ?? [])
      .map((value) => value.trim())
      .filter((value) => value.length > 0 && isSafeSessionIdSegment(value)),
  );

  const pruneCandidates = listed.filter((entry) => !excludedSessionIds.has(entry.sessionId));
  let pruneIds = new Set<string>();

  if (requestedSessionId) {
    if (!isSafeSessionIdSegment(requestedSessionId)) {
      throw new Error(`Invalid browser artifact session id: ${requestedSessionId}`);
    }
    pruneIds = new Set(
      pruneCandidates
        .filter((entry) => entry.sessionId === requestedSessionId)
        .map((entry) => entry.sessionId),
    );
  } else {
    const cutoffMs = now().getTime() - policy.retentionDays * DAY_MS;
    const keepByCount = new Set(
      [...pruneCandidates]
        .sort(compareByFreshness)
        .slice(0, policy.maxPersistedSessions)
        .map((entry) => entry.sessionId),
    );
    pruneIds = new Set(
      pruneCandidates
        .filter((entry) => entry.modifiedMs < cutoffMs || !keepByCount.has(entry.sessionId))
        .map((entry) => entry.sessionId),
    );
  }

  const pruned = listed
    .filter((entry) => pruneIds.has(entry.sessionId))
    .sort(compareBySessionId);
  const kept = listed
    .filter((entry) => !pruneIds.has(entry.sessionId))
    .sort(compareBySessionId);

  for (const entry of pruned) {
    assertWithinArtifactsRoot(rootDir, entry.absolutePath);
    await rm(entry.absolutePath, { recursive: true, force: true });
  }

  return {
    rootDir,
    policy,
    listed,
    kept,
    pruned,
  };
}

export async function writeBrowserSessionMetadata(
  cwd: string,
  metadata: BrowserSessionMetadata,
): Promise<string> {
  const filePath = browserSessionMetadataPath(cwd, metadata.sessionId);
  await ensureBrowserSessionArtifactsDir(cwd, metadata.sessionId);
  await writeFile(filePath, JSON.stringify(metadata, null, 2) + '\n', 'utf-8');
  return filePath;
}

export async function appendBrowserSessionStep(
  cwd: string,
  step: BrowserSessionStepRecord,
): Promise<string> {
  const filePath = browserSessionStepsPath(cwd, step.sessionId);
  await ensureBrowserSessionArtifactsDir(cwd, step.sessionId);
  await appendFile(filePath, JSON.stringify(step) + '\n', 'utf-8');
  return filePath;
}

export async function writeBrowserSessionRecordings(
  cwd: string,
  recordings: BrowserSessionRecordingIndex,
): Promise<string> {
  const filePath = browserSessionRecordingsPath(cwd, recordings.sessionId);
  await ensureBrowserSessionArtifactsDir(cwd, recordings.sessionId);
  await writeFile(filePath, JSON.stringify(recordings, null, 2) + '\n', 'utf-8');
  return filePath;
}

export async function appendBrowserVisualDiffManifestEntry(
  cwd: string,
  entry: BrowserVisualDiffManifestEntry,
): Promise<string> {
  const filePath = browserSessionVisualDiffManifestPath(cwd, entry.sessionId);
  await ensureBrowserSessionArtifactsDir(cwd, entry.sessionId);
  await appendFile(filePath, JSON.stringify(entry) + '\n', 'utf-8');
  return filePath;
}

export async function appendBrowserVisualDiffResultEntry(
  cwd: string,
  entry: BrowserVisualDiffResultEntry,
): Promise<string> {
  const filePath = browserSessionVisualDiffResultsPath(cwd, entry.sessionId);
  await ensureBrowserSessionArtifactsDir(cwd, entry.sessionId);
  await appendFile(filePath, JSON.stringify(entry) + '\n', 'utf-8');
  return filePath;
}

export async function readBrowserVisualDiffResults(
  cwd: string,
  sessionId: string,
): Promise<BrowserVisualDiffResultEntry[]> {
  const filePath = browserSessionVisualDiffResultsPath(cwd, sessionId);
  try {
    const raw = await readFile(filePath, 'utf-8');
    const lines = raw.split(/\r?\n/);
    const entries: BrowserVisualDiffResultEntry[] = [];

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]?.trim();
      if (!line) continue;

      try {
        entries.push(JSON.parse(line) as BrowserVisualDiffResultEntry);
      } catch (error) {
        const isTrailingLine = index === lines.length - 1;
        if (isTrailingLine) {
          continue;
        }
        throw error;
      }
    }

    return entries;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') return [];
    throw error;
  }
}

interface WriteBrowserArtifactInput {
  cwd: string;
  sessionId: string;
  actionId: string;
  sequence: number;
  kind: Exclude<BrowserArtifactKind, 'metadata'>;
  extension: string;
  mimeType: string;
  content: string | Uint8Array;
  createdAt: string;
}

export async function writeBrowserArtifact(input: WriteBrowserArtifactInput): Promise<BrowserArtifactMetadata> {
  const dir = await ensureBrowserSessionArtifactsDir(input.cwd, input.sessionId);
  const extension = normalizeExtension(input.extension);
  const filename = `${String(input.sequence).padStart(4, '0')}-${input.kind}.${extension}`;
  const absolutePath = join(dir, filename);

  await writeFile(absolutePath, input.content);
  const fileStat = await stat(absolutePath);
  const relativePath = relative(input.cwd, absolutePath) || filename;

  return {
    id: `${input.sessionId}:${input.actionId}:${input.kind}`,
    sessionId: input.sessionId,
    actionId: input.actionId,
    kind: input.kind,
    createdAt: input.createdAt,
    relativePath,
    absolutePath,
    mimeType: input.mimeType,
    sizeBytes: fileStat.size,
  };
}
