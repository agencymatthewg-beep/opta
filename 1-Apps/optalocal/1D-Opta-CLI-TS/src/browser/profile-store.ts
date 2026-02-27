import type { Dirent } from 'node:fs';
import { lstat, readdir, rm } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';

export const BROWSER_PROFILES_RELATIVE_DIR = join('.opta', 'browser', 'profiles');

const DAY_MS = 24 * 60 * 60 * 1000;

export interface BrowserProfileDirEntry {
  sessionId: string;
  absolutePath: string;
  relativePath: string;
  modifiedAt: string;
  modifiedMs: number;
}

export interface BrowserProfileRetentionPolicy {
  retentionDays: number;
  maxPersistedProfiles: number;
}

export const DEFAULT_BROWSER_PROFILE_RETENTION_POLICY: Readonly<BrowserProfileRetentionPolicy> = Object.freeze({
  retentionDays: 30,
  maxPersistedProfiles: 200,
});

export interface BrowserProfilePruneOptions {
  cwd?: string;
  now?: () => Date;
  sessionId?: string;
  excludeSessionIds?: string[];
  policy?: Partial<BrowserProfileRetentionPolicy>;
}

export interface BrowserProfilePruneResult {
  rootDir: string;
  policy: BrowserProfileRetentionPolicy;
  listed: BrowserProfileDirEntry[];
  kept: BrowserProfileDirEntry[];
  pruned: BrowserProfileDirEntry[];
}

function compareBySessionId(
  left: Pick<BrowserProfileDirEntry, 'sessionId'>,
  right: Pick<BrowserProfileDirEntry, 'sessionId'>,
): number {
  return left.sessionId.localeCompare(right.sessionId);
}

function compareByFreshness(
  left: Pick<BrowserProfileDirEntry, 'sessionId' | 'modifiedMs'>,
  right: Pick<BrowserProfileDirEntry, 'sessionId' | 'modifiedMs'>,
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

function assertWithinProfilesRoot(rootDir: string, targetDir: string): void {
  const rootResolved = resolve(rootDir);
  const targetResolved = resolve(targetDir);
  const rel = relative(rootResolved, targetResolved);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`Refusing to prune path outside browser profiles root: ${targetDir}`);
  }
}

export function browserProfilesRootPath(cwd: string): string {
  return join(cwd, BROWSER_PROFILES_RELATIVE_DIR);
}

function coercePositiveInt(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1, Math.floor(value));
}

export function resolveBrowserProfileRetentionPolicy(
  policy?: Partial<BrowserProfileRetentionPolicy>,
): BrowserProfileRetentionPolicy {
  return {
    retentionDays: coercePositiveInt(
      policy?.retentionDays,
      DEFAULT_BROWSER_PROFILE_RETENTION_POLICY.retentionDays,
    ),
    maxPersistedProfiles: coercePositiveInt(
      policy?.maxPersistedProfiles,
      DEFAULT_BROWSER_PROFILE_RETENTION_POLICY.maxPersistedProfiles,
    ),
  };
}

export async function listBrowserProfileDirs(cwd: string): Promise<BrowserProfileDirEntry[]> {
  const rootDir = browserProfilesRootPath(cwd);
  let dirents: Dirent[];

  try {
    dirents = await readdir(rootDir, { withFileTypes: true, encoding: 'utf8' });
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') return [];
    throw error;
  }

  const listed: BrowserProfileDirEntry[] = [];
  for (const dirent of dirents) {
    if (!dirent.isDirectory()) continue;
    const absolutePath = join(rootDir, dirent.name);
    const stats = await lstat(absolutePath).catch(() => null);
    if (!stats || !stats.isDirectory() || stats.isSymbolicLink()) {
      continue;
    }

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

export async function pruneBrowserProfileDirs(
  options: BrowserProfilePruneOptions,
): Promise<BrowserProfilePruneResult> {
  const cwd = options.cwd ?? process.cwd();
  const now = options.now ?? (() => new Date());
  const policy = resolveBrowserProfileRetentionPolicy(options.policy);
  const rootDir = browserProfilesRootPath(cwd);
  const listed = await listBrowserProfileDirs(cwd);
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
      throw new Error(`Invalid browser profile session id: ${requestedSessionId}`);
    }
    pruneIds = new Set(
      pruneCandidates
        .filter((entry) => entry.sessionId === requestedSessionId)
        .map((entry) => entry.sessionId),
    );
  } else {
    const retentionDays = policy.retentionDays;
    const maxPersistedProfiles = policy.maxPersistedProfiles;
    const cutoffMs = now().getTime() - retentionDays * DAY_MS;
    const keepByCount = new Set(
      [...pruneCandidates]
        .sort(compareByFreshness)
        .slice(0, maxPersistedProfiles)
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
    assertWithinProfilesRoot(rootDir, entry.absolutePath);
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
