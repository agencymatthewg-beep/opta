import fs from 'node:fs';
import path from 'node:path';
import type {
  AdminAuditAction,
  AdminAuditEntry,
  AdminAuditOutcome,
  AdminFeatureRegistrySnapshot,
  AdminOpsSnapshot,
  AdminStatusProbe,
  StatusIntegrationState,
} from './types';

const MAX_AUDIT_RECORDS = 120;
const DEFAULT_ACTION_LIMIT = 20;
const FEATURE_AUDIT_PATH = path.resolve(process.cwd(), '../1S-Opta-Status/docs/feature-audit.md');

type AuditStore = {
  entries: AdminAuditEntry[];
};

type GlobalWithAuditStore = typeof globalThis & {
  __optaAdminAuditStore__?: AuditStore;
};

interface RecordAdminActionInput {
  action: AdminAuditAction;
  outcome: AdminAuditOutcome;
  slug?: string;
  message: string;
  requestId?: string;
}

function getAuditStore(): AuditStore {
  const globalRef = globalThis as GlobalWithAuditStore;
  if (!globalRef.__optaAdminAuditStore__) {
    globalRef.__optaAdminAuditStore__ = { entries: [] };
  }
  return globalRef.__optaAdminAuditStore__;
}

function sanitizeMessage(message: string): string {
  return message
    .replace(/vcp_[A-Za-z0-9]+/g, 'vcp_[redacted]')
    .replace(/(?:sk|rk|pk)_[A-Za-z0-9]+/g, '[redacted_token]');
}

function normalizeStatus(value: unknown): StatusIntegrationState {
  if (
    value === 'online' ||
    value === 'degraded' ||
    value === 'offline' ||
    value === 'checking' ||
    value === 'unconfigured'
  ) {
    return value;
  }

  return 'unknown';
}

function parseFeatureAuditSnapshot(): AdminFeatureRegistrySnapshot {
  if (!fs.existsSync(FEATURE_AUDIT_PATH)) {
    return {
      source: 'feature-audit:unavailable',
      topGaps: [],
      error: 'Feature audit file is not available in this deployment.',
    };
  }

  try {
    const raw = fs.readFileSync(FEATURE_AUDIT_PATH, 'utf-8');
    const generatedMatch = raw.match(/^Generated:\s*(.+)$/m);
    const adminLine = raw
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.startsWith('| admin |'));

    if (!adminLine) {
      return {
        source: 'feature-audit:missing-admin-row',
        generatedAt: generatedMatch?.[1]?.trim(),
        topGaps: [],
        error: 'Admin row was not found in feature-audit.md.',
      };
    }

    const cells = adminLine.split('|').map((cell) => cell.trim());
    const complete = Number.parseInt(cells[2] ?? '', 10);
    const pending = Number.parseInt(cells[3] ?? '', 10);
    const total = Number.parseInt(cells[4] ?? '', 10);
    const completion = cells[5] ?? undefined;
    const risk = cells[6] ?? undefined;
    const topGapsRaw = cells[7] ?? '';

    return {
      source: 'feature-audit:local-file',
      generatedAt: generatedMatch?.[1]?.trim(),
      complete: Number.isFinite(complete) ? complete : undefined,
      pending: Number.isFinite(pending) ? pending : undefined,
      total: Number.isFinite(total) ? total : undefined,
      completion,
      risk,
      topGaps: topGapsRaw
        .split(';')
        .map((item) => item.trim())
        .filter(Boolean),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      source: 'feature-audit:error',
      topGaps: [],
      error: sanitizeMessage(message),
    };
  }
}

async function fetchStatusProbe(): Promise<AdminStatusProbe> {
  const statusBaseUrl =
    process.env.OPTA_STATUS_URL?.trim().replace(/\/$/, '') ?? 'https://status.optalocal.com';
  const url = `${statusBaseUrl}/api/health/admin`;

  try {
    const startedAt = Date.now();
    const response = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(6_000),
      headers: { Accept: 'application/json' },
    });
    const latencyMs = Date.now() - startedAt;

    let payload: Record<string, unknown> = {};
    try {
      payload = (await response.json()) as Record<string, unknown>;
    } catch {
      payload = {};
    }

    return {
      source: 'status-api',
      url,
      status: normalizeStatus(payload.status),
      latencyMs,
      checkedAt: new Date().toISOString(),
      error: response.ok
        ? undefined
        : sanitizeMessage(typeof payload.error === 'string' ? payload.error : `HTTP ${response.status}`),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      source: 'status-api',
      url,
      status: 'offline',
      checkedAt: new Date().toISOString(),
      error: sanitizeMessage(message),
    };
  }
}

export function createAdminRequestId(prefix = 'req'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function recordAdminAction({
  action,
  outcome,
  slug,
  message,
  requestId,
}: RecordAdminActionInput): AdminAuditEntry {
  const entry: AdminAuditEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    action,
    outcome,
    slug: slug?.trim() || undefined,
    message: sanitizeMessage(message.trim() || 'No details provided.'),
    requestId: requestId ?? createAdminRequestId(action.replace('.', '-')),
    createdAt: new Date().toISOString(),
  };

  const store = getAuditStore();
  store.entries.unshift(entry);
  if (store.entries.length > MAX_AUDIT_RECORDS) {
    store.entries.length = MAX_AUDIT_RECORDS;
  }

  return entry;
}

export function getRecentAdminActions(limit = DEFAULT_ACTION_LIMIT): AdminAuditEntry[] {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : DEFAULT_ACTION_LIMIT;
  return getAuditStore().entries.slice(0, safeLimit);
}

export async function buildAdminOpsSnapshot(limit = DEFAULT_ACTION_LIMIT): Promise<AdminOpsSnapshot> {
  const [statusProbe, featureRegistry] = await Promise.all([
    fetchStatusProbe(),
    Promise.resolve(parseFeatureAuditSnapshot()),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    actions: getRecentAdminActions(limit),
    statusProbe,
    featureRegistry,
  };
}
