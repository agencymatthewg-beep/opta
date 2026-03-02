import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { getConfigDir } from '../platform/paths.js';

export interface EndpointScore {
  host: string;
  success: number;
  failure: number;
  lastSeenAt: string;
}

interface EndpointProfileFile {
  version: 1;
  endpoints: EndpointScore[];
}

function resolveProfilePath(path?: string): string {
  if (path && path.trim().length > 0) return path;
  const fromEnv = process.env['OPTA_LMX_ENDPOINT_PROFILE_PATH'];
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv;
  return profilePath();
}

function profilePath(): string {
  return join(getConfigDir(), 'lmx-endpoints.json');
}

function normalizeHost(host: string): string {
  return host.trim().toLowerCase();
}

function profileScore(entry: EndpointScore, nowMs: number): number {
  const lastSeenMs = Date.parse(entry.lastSeenAt);
  const recencyPenalty =
    Number.isFinite(lastSeenMs) && lastSeenMs > 0
      ? Math.min(48, (nowMs - lastSeenMs) / (1000 * 60 * 60))
      : 48;
  return entry.success * 5 - entry.failure * 3 - recencyPenalty;
}

export function rankHostsByProfile(
  hosts: readonly string[],
  entries: readonly EndpointScore[],
  nowMs = Date.now()
): string[] {
  if (hosts.length <= 1 || entries.length === 0) {
    return [...hosts];
  }

  const lookup = new Map(entries.map((entry) => [normalizeHost(entry.host), entry] as const));
  return [...hosts]
    .map((host, index) => {
      const entry = lookup.get(normalizeHost(host));
      const score = entry ? profileScore(entry, nowMs) : Number.NEGATIVE_INFINITY;
      return { host, index, score };
    })
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return a.index - b.index;
    })
    .map((item) => item.host);
}

export async function loadEndpointProfile(path = profilePath()): Promise<EndpointScore[]> {
  const resolvedPath = resolveProfilePath(path);
  try {
    const raw = await readFile(resolvedPath, 'utf-8');
    const parsed = JSON.parse(raw) as EndpointProfileFile;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.endpoints)) {
      return [];
    }
    return parsed.endpoints.filter(
      (entry): entry is EndpointScore =>
        typeof entry?.host === 'string' &&
        typeof entry?.success === 'number' &&
        typeof entry?.failure === 'number' &&
        typeof entry?.lastSeenAt === 'string'
    );
  } catch {
    return [];
  }
}

async function saveEndpointProfile(entries: readonly EndpointScore[], path = profilePath()): Promise<void> {
  const resolvedPath = resolveProfilePath(path);
  await mkdir(dirname(resolvedPath), { recursive: true });
  const payload: EndpointProfileFile = {
    version: 1,
    endpoints: [...entries],
  };
  await writeFile(resolvedPath, JSON.stringify(payload, null, 2), 'utf-8');
}

export async function prioritizeHostsByProfile(
  hosts: readonly string[],
  path = profilePath()
): Promise<string[]> {
  const entries = await loadEndpointProfile(resolveProfilePath(path));
  return rankHostsByProfile(hosts, entries);
}

export async function recordEndpointProbeOutcome(
  host: string,
  success: boolean,
  path = profilePath(),
  now = new Date()
): Promise<void> {
  if (!host.trim()) return;
  const normalized = normalizeHost(host);
  const resolvedPath = resolveProfilePath(path);
  const existing = await loadEndpointProfile(resolvedPath);
  const byHost = new Map(existing.map((entry) => [normalizeHost(entry.host), entry] as const));
  const current = byHost.get(normalized) ?? {
    host,
    success: 0,
    failure: 0,
    lastSeenAt: now.toISOString(),
  };

  const updated: EndpointScore = {
    host: current.host,
    success: success ? current.success + 1 : current.success,
    failure: success ? current.failure : current.failure + 1,
    lastSeenAt: now.toISOString(),
  };
  byHost.set(normalized, updated);

  await saveEndpointProfile([...byHost.values()], resolvedPath);
}

// Backward-compatible alias used by some callers/tests.
export async function recordEndpointProbe(
  host: string,
  success: boolean,
  path = profilePath(),
  now = new Date()
): Promise<void> {
  await recordEndpointProbeOutcome(host, success, path, now);
}
