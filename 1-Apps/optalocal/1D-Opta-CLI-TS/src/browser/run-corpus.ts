import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  BrowserRuntimeState,
  BrowserSessionStatus,
  BrowserVisualDiffRegressionSignal,
} from './types.js';
import { summarizeBrowserReplay } from './replay.js';
import { isMcpHighRiskTool } from './adaptation.js';
import { readBrowserApprovalEvents } from './approval-log.js';

const HOUR_MS = 60 * 60 * 1_000;

export interface BrowserRunCorpusEntry {
  sessionId: string;
  runId?: string;
  status: BrowserSessionStatus;
  runtime: BrowserRuntimeState;
  updatedAt: string;
  actionCount: number;
  artifactCount: number;
  failureCount: number;
  regressionScore: number;
  regressionSignal: BrowserVisualDiffRegressionSignal;
  regressionPairCount: number;
  /** True if any step in this session used a high-risk MCP tool (browser_evaluate, browser_file_upload). */
  highRiskMcpToolsPresent?: boolean;
}

export interface BrowserRunCorpusSummary {
  schemaVersion: 1;
  generatedAt: string;
  windowHours: number;
  assessedSessionCount: number;
  regressionSessionCount: number;
  investigateSessionCount: number;
  meanRegressionScore: number;
  maxRegressionScore: number;
  entries: BrowserRunCorpusEntry[];
}

export interface BrowserRunCorpusRefreshResult {
  summary: BrowserRunCorpusSummary;
  latestPath: string;
  snapshotPath: string;
}

function timestampSlug(isoTimestamp: string): string {
  return isoTimestamp.replace(/[:.]/g, '-');
}

function defaultNow(): Date {
  return new Date();
}

function sanitizeSessionId(sessionId: string): string {
  const trimmed = sessionId.trim();
  if (trimmed.length === 0) return 'session';
  return trimmed.replace(/[\\/]/g, '_');
}

export function browserRunCorpusDir(cwd: string): string {
  return join(cwd, '.opta', 'browser', 'run-corpus');
}

export function browserRunCorpusLatestPath(cwd: string): string {
  return join(browserRunCorpusDir(cwd), 'latest.json');
}

export function browserRunCorpusSnapshotPath(cwd: string, generatedAt: string): string {
  return join(browserRunCorpusDir(cwd), `${timestampSlug(generatedAt)}.json`);
}

async function listSessionMetadataInWindow(
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
    if (entry.name === 'profiles' || entry.name === 'canary-evidence' || entry.name === 'run-corpus') continue;
    const sessionId = sanitizeSessionId(entry.name);
    if (sessionId !== entry.name) continue;

    const metadataPath = join(root, entry.name, 'metadata.json');
    try {
      const raw = await readFile(metadataPath, 'utf-8');
      const parsed = JSON.parse(raw) as { updatedAt?: string };
      if (typeof parsed.updatedAt !== 'string') continue;
      const updatedMs = Date.parse(parsed.updatedAt);
      if (!Number.isFinite(updatedMs) || updatedMs < minUpdatedMs) continue;
      sessions.push({
        sessionId: entry.name,
        updatedAt: parsed.updatedAt,
      });
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') continue;
      continue;
    }
  }

  return sessions.sort((left, right) => {
    const leftMs = Date.parse(left.updatedAt);
    const rightMs = Date.parse(right.updatedAt);
    if (Number.isFinite(leftMs) && Number.isFinite(rightMs) && leftMs !== rightMs) {
      return rightMs - leftMs;
    }
    return left.sessionId.localeCompare(right.sessionId);
  });
}

export async function buildBrowserRunCorpusSummary(
  cwd: string,
  options: {
    windowHours?: number;
    now?: () => Date;
  } = {},
): Promise<BrowserRunCorpusSummary> {
  const now = options.now ?? defaultNow;
  const windowHours = Math.max(1, Math.floor(options.windowHours ?? 168));
  const runAt = now();
  const generatedAt = runAt.toISOString();

  const candidates = await listSessionMetadataInWindow(cwd, runAt, windowHours);

  // Build a set of sessionIds that used high-risk MCP tools, sourced from the approval log.
  const highRiskSessionIds = new Set<string>();
  try {
    const approvalEvents = await readBrowserApprovalEvents(cwd);
    for (const event of approvalEvents) {
      if (event.sessionId && isMcpHighRiskTool(event.tool)) {
        highRiskSessionIds.add(event.sessionId);
      }
    }
  } catch {
    // Approval log is optional — proceed without high-risk metadata if unavailable.
  }

  const entries: BrowserRunCorpusEntry[] = [];
  for (const candidate of candidates) {
    const replay = await summarizeBrowserReplay(cwd, candidate.sessionId);
    if (!replay) continue;
    const highRiskMcpToolsPresent = highRiskSessionIds.has(replay.sessionId) || undefined;
    entries.push({
      sessionId: replay.sessionId,
      runId: replay.runId,
      status: replay.status,
      runtime: replay.runtime,
      updatedAt: replay.lastUpdatedAt,
      actionCount: replay.actionCount,
      artifactCount: replay.artifactCount,
      failureCount: replay.failureCount,
      regressionScore: replay.regressionScore,
      regressionSignal: replay.regressionSignal,
      regressionPairCount: replay.regressionPairCount,
      highRiskMcpToolsPresent,
    });
  }

  const regressionSessionCount = entries.filter((entry) => entry.regressionSignal === 'regression').length;
  const investigateSessionCount = entries.filter((entry) => entry.regressionSignal === 'investigate').length;
  const maxRegressionScore = entries.reduce((max, entry) => Math.max(max, entry.regressionScore), 0);
  const meanRegressionScore = entries.length > 0
    ? entries.reduce((sum, entry) => sum + entry.regressionScore, 0) / entries.length
    : 0;

  return {
    schemaVersion: 1,
    generatedAt,
    windowHours,
    assessedSessionCount: entries.length,
    regressionSessionCount,
    investigateSessionCount,
    meanRegressionScore,
    maxRegressionScore,
    entries,
  };
}

export async function writeBrowserRunCorpusSummary(
  cwd: string,
  summary: BrowserRunCorpusSummary,
): Promise<{ latestPath: string; snapshotPath: string }> {
  const dir = browserRunCorpusDir(cwd);
  await mkdir(dir, { recursive: true });

  const latestPath = browserRunCorpusLatestPath(cwd);
  const snapshotPath = browserRunCorpusSnapshotPath(cwd, summary.generatedAt);
  const payload = JSON.stringify(summary, null, 2) + '\n';

  await writeFile(snapshotPath, payload, 'utf-8');
  await writeFile(latestPath, payload, 'utf-8');

  return {
    latestPath,
    snapshotPath,
  };
}

export async function readLatestBrowserRunCorpusSummary(
  cwd: string,
): Promise<BrowserRunCorpusSummary | null> {
  const path = browserRunCorpusLatestPath(cwd);
  try {
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw) as BrowserRunCorpusSummary;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') return null;
    throw error;
  }
}

const runCorpusRefreshInFlight = new Map<string, Promise<BrowserRunCorpusRefreshResult | null>>();

export async function refreshBrowserRunCorpusSummary(
  cwd: string,
  options: {
    enabled?: boolean;
    windowHours?: number;
    now?: () => Date;
  } = {},
): Promise<BrowserRunCorpusRefreshResult | null> {
  if (options.enabled === false) return null;

  const windowHours = Math.max(1, Math.floor(options.windowHours ?? 168));
  const key = `${cwd}::${windowHours}`;
  const existing = runCorpusRefreshInFlight.get(key);
  if (existing) {
    return existing;
  }

  const refreshPromise = (async () => {
    const summary = await buildBrowserRunCorpusSummary(cwd, {
      windowHours,
      now: options.now,
    });
    const paths = await writeBrowserRunCorpusSummary(cwd, summary);
    return {
      summary,
      latestPath: paths.latestPath,
      snapshotPath: paths.snapshotPath,
    };
  })();

  runCorpusRefreshInFlight.set(key, refreshPromise);
  try {
    return await refreshPromise;
  } finally {
    runCorpusRefreshInFlight.delete(key);
  }
}
