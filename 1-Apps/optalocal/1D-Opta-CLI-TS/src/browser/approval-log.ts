import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { BrowserRiskEvidence, BrowserRiskLevel } from './policy-engine.js';

export const BROWSER_APPROVAL_LOG_RELATIVE_PATH = join(
  '.opta',
  'browser',
  'approval-log.jsonl',
);

export type BrowserApprovalDecision = 'approved' | 'denied';

export interface BrowserApprovalEvent {
  timestamp: string;
  tool: string;
  sessionId?: string;
  decision: BrowserApprovalDecision;
  risk?: BrowserRiskLevel;
  actionKey?: string;
  targetHost?: string;
  target_origin?: string;
  policyReason?: string;
  riskEvidence?: BrowserRiskEvidence;
}

export interface BrowserApprovalEventInput {
  cwd?: string;
  timestamp?: string;
  tool: string;
  sessionId?: string;
  decision: BrowserApprovalDecision;
  risk?: BrowserRiskLevel;
  actionKey?: string;
  targetHost?: string;
  targetOrigin?: string;
  policyReason?: string;
  riskEvidence?: BrowserRiskEvidence;
}

export function browserApprovalLogPath(cwd = process.cwd()): string {
  return join(cwd, BROWSER_APPROVAL_LOG_RELATIVE_PATH);
}

export function extractBrowserSessionId(args: Record<string, unknown>): string | undefined {
  const raw = typeof args['session_id'] === 'string'
    ? args['session_id']
    : typeof args['sessionId'] === 'string'
      ? args['sessionId']
      : undefined;

  if (!raw) return undefined;
  const sessionId = raw.trim();
  return sessionId.length > 0 ? sessionId : undefined;
}

function parseBrowserApprovalEvent(value: unknown): BrowserApprovalEvent | null {
  if (
    value === null
    || value === undefined
    || typeof value !== 'object'
    || Array.isArray(value)
  ) {
    return null;
  }

  const candidate = value as Partial<BrowserApprovalEvent>;
  if (typeof candidate.timestamp !== 'string') return null;
  if (typeof candidate.tool !== 'string') return null;
  if (candidate.decision !== 'approved' && candidate.decision !== 'denied') return null;

  const event: BrowserApprovalEvent = {
    timestamp: candidate.timestamp,
    tool: candidate.tool,
    decision: candidate.decision,
  };

  if (typeof candidate.sessionId === 'string' && candidate.sessionId.trim()) {
    event.sessionId = candidate.sessionId.trim();
  }

  if (candidate.risk === 'low' || candidate.risk === 'medium' || candidate.risk === 'high') {
    event.risk = candidate.risk;
  }
  if (typeof candidate.actionKey === 'string' && candidate.actionKey.trim()) {
    event.actionKey = candidate.actionKey.trim();
  }
  if (typeof candidate.targetHost === 'string' && candidate.targetHost.trim()) {
    event.targetHost = candidate.targetHost.trim();
  }
  if (typeof candidate.target_origin === 'string' && candidate.target_origin.trim()) {
    event.target_origin = candidate.target_origin.trim();
  }
  if (typeof candidate.policyReason === 'string' && candidate.policyReason.trim()) {
    event.policyReason = candidate.policyReason.trim();
  }
  if (
    candidate.riskEvidence
    && typeof candidate.riskEvidence === 'object'
    && !Array.isArray(candidate.riskEvidence)
  ) {
    const evidence = candidate.riskEvidence as Partial<BrowserRiskEvidence>;
    const matchedSignals = Array.isArray(evidence.matchedSignals)
      ? evidence.matchedSignals.filter((signal): signal is string => typeof signal === 'string')
      : [];
    if (evidence.classifier === 'static' || evidence.classifier === 'adaptive-escalation') {
      event.riskEvidence = {
        classifier: evidence.classifier,
        matchedSignals,
        adaptationReason: typeof evidence.adaptationReason === 'string'
          ? evidence.adaptationReason
          : undefined,
      };
    }
  }

  return event;
}

export async function appendBrowserApprovalEvent(
  input: BrowserApprovalEventInput,
): Promise<void> {
  const path = browserApprovalLogPath(input.cwd);
  await mkdir(dirname(path), { recursive: true });

  const event: BrowserApprovalEvent = {
    timestamp: input.timestamp ?? new Date().toISOString(),
    tool: input.tool,
    decision: input.decision,
    risk: input.risk,
    actionKey: input.actionKey,
    targetHost: input.targetHost,
    target_origin: input.targetOrigin,
    policyReason: input.policyReason,
    riskEvidence: input.riskEvidence,
  };

  const sessionId = input.sessionId?.trim();
  if (sessionId) {
    event.sessionId = sessionId;
  }

  await appendFile(path, `${JSON.stringify(event)}\n`, 'utf-8');
}

export async function readBrowserApprovalEvents(cwd = process.cwd()): Promise<BrowserApprovalEvent[]> {
  const path = browserApprovalLogPath(cwd);
  try {
    const raw = await readFile(path, 'utf-8');
    const lines = raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const events: BrowserApprovalEvent[] = [];
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as unknown;
        const event = parseBrowserApprovalEvent(parsed);
        if (event) events.push(event);
      } catch {
        // Ignore malformed lines and continue scanning.
      }
    }

    return events;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') return [];
    throw error;
  }
}

export async function readRecentBrowserApprovalEvents(
  cwd = process.cwd(),
  limit = 10,
): Promise<BrowserApprovalEvent[]> {
  const normalizedLimit = Number.isInteger(limit) && limit > 0 ? limit : 10;
  const events = await readBrowserApprovalEvents(cwd);
  if (events.length === 0) return [];
  return events.slice(-normalizedLimit).reverse();
}

export interface BrowserApprovalPruneOptions {
  /** Remove entries older than this many days. Default: 30 */
  maxAgeDays?: number;
  /** Keep only the newest N entries after age filtering. Default: 1000 */
  maxEntries?: number;
}

export interface BrowserApprovalPruneResult {
  kept: number;
  pruned: number;
}

export async function pruneOldBrowserApprovalEvents(
  cwd: string,
  options: BrowserApprovalPruneOptions,
): Promise<BrowserApprovalPruneResult> {
  const maxAgeDays = options.maxAgeDays ?? 30;
  const maxEntries = options.maxEntries ?? 1000;
  const logPath = browserApprovalLogPath(cwd);

  let raw: string;
  try {
    raw = await readFile(logPath, 'utf-8') as unknown as string;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { kept: 0, pruned: 0 };
    }
    throw err;
  }

  const cutoffMs = Date.now() - maxAgeDays * 86_400_000;
  const lines = raw.split(/\r?\n/).filter(Boolean);

  const validLines: { ts: number; line: string }[] = [];
  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as { timestamp?: string };
      const ts = entry.timestamp ? new Date(entry.timestamp).getTime() : Date.now();
      if (Number.isFinite(ts) && ts >= cutoffMs) {
        validLines.push({ ts, line });
      }
    } catch {
      // skip malformed lines
    }
  }

  validLines.sort((a, b) => b.ts - a.ts);
  const kept = validLines.slice(0, maxEntries);
  kept.sort((a, b) => a.ts - b.ts);

  await writeFile(logPath, kept.map((e) => e.line).join('\n') + (kept.length > 0 ? '\n' : ''), 'utf-8');

  return { kept: kept.length, pruned: lines.length - kept.length };
}
