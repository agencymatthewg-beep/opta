import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  DEFAULT_BROWSER_BENCHMARK_THRESHOLDS,
  validateBrowserBenchmarkThresholdFeed,
  validateBrowserSessionArtifactCompleteness,
  type BrowserBenchmarkThresholdFeedResult,
  type BrowserBenchmarkThresholds,
} from './quality-gates.js';

const HOUR_MS = 60 * 60 * 1_000;

export type BrowserCanaryRollbackStatus = 'pending' | 'pass' | 'fail';

export interface BrowserCanarySessionAssessment {
  sessionId: string;
  updatedAt: string;
  completenessOk: boolean;
  benchmarkOk: boolean;
  completenessIssues: string[];
  benchmarkFailures: string[];
}

export interface BrowserCanaryRollbackEvidence {
  status: BrowserCanaryRollbackStatus;
  executedAt?: string;
  notes?: string;
}

export interface BrowserCanaryEvidence {
  schemaVersion: 1;
  generatedAt: string;
  windowHours: number;
  thresholdProfile: BrowserBenchmarkThresholds;
  assessedSessionCount: number;
  passCount: number;
  failCount: number;
  sessions: BrowserCanarySessionAssessment[];
  overallStatus: 'pass' | 'fail';
  rollbackDrill: BrowserCanaryRollbackEvidence;
}

function sanitizeSessionId(sessionId: string): string {
  const trimmed = sessionId.trim();
  if (trimmed.length === 0) return 'session';
  return trimmed.replace(/[\\/]/g, '_');
}

function timestampSlug(isoTimestamp: string): string {
  return isoTimestamp.replace(/[:.]/g, '-');
}

function defaultNow(): Date {
  return new Date();
}

export function browserCanaryEvidenceDir(cwd: string): string {
  return join(cwd, '.opta', 'browser', 'canary-evidence');
}

export function browserCanaryLatestPath(cwd: string): string {
  return join(browserCanaryEvidenceDir(cwd), 'latest.json');
}

export function browserCanarySnapshotPath(cwd: string, generatedAt: string): string {
  return join(browserCanaryEvidenceDir(cwd), `${timestampSlug(generatedAt)}.json`);
}

async function listSessionIdsInWindow(
  cwd: string,
  now: Date,
  windowHours: number,
): Promise<Array<{ sessionId: string; updatedAt: string }>> {
  const root = join(cwd, '.opta', 'browser');
  let entries: Array<{ name: string; isDirectory: boolean }> = [];
  try {
    const dirEntries = await readdir(root, { withFileTypes: true });
    entries = dirEntries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
    }));
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') return [];
    throw error;
  }

  const minUpdatedMs = now.getTime() - (windowHours * HOUR_MS);
  const sessions: Array<{ sessionId: string; updatedAt: string }> = [];

  for (const entry of entries) {
    if (!entry.isDirectory) continue;
    if (entry.name === 'profiles' || entry.name === 'canary-evidence') continue;
    const sessionId = sanitizeSessionId(entry.name);
    if (sessionId !== entry.name) continue;

    const metadataPath = join(root, entry.name, 'metadata.json');
    try {
      const raw = await readFile(metadataPath, 'utf-8');
      const parsed = JSON.parse(raw) as { updatedAt?: string };
      if (typeof parsed.updatedAt !== 'string') continue;
      const updatedMs = Date.parse(parsed.updatedAt);
      if (!Number.isFinite(updatedMs)) continue;
      if (updatedMs < minUpdatedMs) continue;
      sessions.push({
        sessionId: entry.name,
        updatedAt: parsed.updatedAt,
      });
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') continue;
      // Skip malformed session metadata from canary set while keeping
      // assessment deterministic for readable sessions.
      continue;
    }
  }

  return sessions.sort((left, right) => left.sessionId.localeCompare(right.sessionId));
}

async function assessSession(
  cwd: string,
  sessionId: string,
  updatedAt: string,
  thresholds: BrowserBenchmarkThresholds,
): Promise<BrowserCanarySessionAssessment> {
  const completeness = await validateBrowserSessionArtifactCompleteness(cwd, sessionId);
  const benchmark: BrowserBenchmarkThresholdFeedResult = await validateBrowserBenchmarkThresholdFeed(
    cwd,
    sessionId,
    thresholds,
  );

  return {
    sessionId,
    updatedAt,
    completenessOk: completeness.ok,
    benchmarkOk: benchmark.ok,
    completenessIssues: [...completeness.issues],
    benchmarkFailures: [...benchmark.failures],
  };
}

export async function buildBrowserCanaryEvidence(
  cwd: string,
  options: {
    windowHours?: number;
    thresholds?: BrowserBenchmarkThresholds;
    now?: () => Date;
  } = {},
): Promise<BrowserCanaryEvidence> {
  const now = options.now ?? defaultNow;
  const windowHours = Math.max(1, Math.floor(options.windowHours ?? 24));
  const thresholdProfile = options.thresholds ?? DEFAULT_BROWSER_BENCHMARK_THRESHOLDS;
  const generatedAt = now().toISOString();

  const sessionCandidates = await listSessionIdsInWindow(cwd, now(), windowHours);
  const sessions: BrowserCanarySessionAssessment[] = [];
  for (const candidate of sessionCandidates) {
    sessions.push(await assessSession(cwd, candidate.sessionId, candidate.updatedAt, thresholdProfile));
  }

  let passCount = 0;
  let failCount = 0;
  for (const session of sessions) {
    if (session.completenessOk && session.benchmarkOk) {
      passCount += 1;
    } else {
      failCount += 1;
    }
  }

  return {
    schemaVersion: 1,
    generatedAt,
    windowHours,
    thresholdProfile,
    assessedSessionCount: sessions.length,
    passCount,
    failCount,
    sessions,
    overallStatus: failCount === 0 ? 'pass' : 'fail',
    rollbackDrill: {
      status: 'pending',
    },
  };
}

export async function writeBrowserCanaryEvidence(
  cwd: string,
  evidence: BrowserCanaryEvidence,
): Promise<{ latestPath: string; snapshotPath: string }> {
  const dir = browserCanaryEvidenceDir(cwd);
  await mkdir(dir, { recursive: true });

  const latestPath = browserCanaryLatestPath(cwd);
  const snapshotPath = browserCanarySnapshotPath(cwd, evidence.generatedAt);
  const payload = JSON.stringify(evidence, null, 2) + '\n';

  await writeFile(snapshotPath, payload, 'utf-8');
  await writeFile(latestPath, payload, 'utf-8');

  return {
    latestPath,
    snapshotPath,
  };
}

export async function readLatestBrowserCanaryEvidence(cwd: string): Promise<BrowserCanaryEvidence | null> {
  const path = browserCanaryLatestPath(cwd);
  try {
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw) as BrowserCanaryEvidence;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') return null;
    throw error;
  }
}

export async function updateBrowserCanaryRollbackDrill(
  cwd: string,
  input: {
    status: Exclude<BrowserCanaryRollbackStatus, 'pending'>;
    notes?: string;
    now?: () => Date;
  },
): Promise<BrowserCanaryEvidence | null> {
  const current = await readLatestBrowserCanaryEvidence(cwd);
  if (!current) return null;

  const updated: BrowserCanaryEvidence = {
    ...current,
    rollbackDrill: {
      status: input.status,
      executedAt: (input.now ?? defaultNow)().toISOString(),
      notes: input.notes?.trim() || undefined,
    },
  };

  await writeBrowserCanaryEvidence(cwd, updated);
  return updated;
}

export async function browserCanaryEvidenceFileSize(path: string): Promise<number | null> {
  try {
    const info = await stat(path);
    return info.size;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') return null;
    throw error;
  }
}
