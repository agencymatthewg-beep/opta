export const ADMIN_KEYS_BY_HOST_ENV_VAR = 'OPTA_ADMIN_KEYS_BY_HOST';

export type AdminKeysByHost = Record<string, string>;

function stripScheme(value: string): string {
  return value.replace(/^https?:\/\//i, '');
}

function stripPath(value: string): string {
  const slashIndex = value.indexOf('/');
  return slashIndex >= 0 ? value.slice(0, slashIndex) : value;
}

function stripTrailingDot(value: string): string {
  return value.endsWith('.') ? value.slice(0, -1) : value;
}

function stripPort(host: string): string {
  // Keep bracketed IPv6 addresses intact.
  if (host.startsWith('[') && host.includes(']')) {
    const closeBracket = host.indexOf(']');
    if (closeBracket >= 0) {
      return host.slice(0, closeBracket + 1);
    }
  }

  const lastColon = host.lastIndexOf(':');
  if (lastColon < 0) return host;
  const portPart = host.slice(lastColon + 1);
  if (!/^\d+$/.test(portPart)) return host;
  return host.slice(0, lastColon);
}

export function normalizeAdminKeyHost(host: string): string {
  const trimmed = stripTrailingDot(stripPath(stripScheme(host.trim().toLowerCase())));
  return trimmed;
}

function normalizeMapEntries(entries: Array<[string, string]>): AdminKeysByHost {
  const normalized: AdminKeysByHost = {};
  for (const [rawHost, rawKey] of entries) {
    const host = normalizeAdminKeyHost(rawHost);
    const key = rawKey.trim();
    if (!host || !key) continue;
    normalized[host] = key;
  }
  return normalized;
}

function parseAdminKeysFromObject(raw: Record<string, unknown>): AdminKeysByHost {
  const entries: Array<[string, string]> = [];
  for (const [host, value] of Object.entries(raw)) {
    if (typeof value !== 'string') continue;
    entries.push([host, value]);
  }
  return normalizeMapEntries(entries);
}

function parseAdminKeysFromCsv(value: string): AdminKeysByHost | null {
  const entries: Array<[string, string]> = [];
  for (const token of value.split(',')) {
    const trimmed = token.trim();
    if (!trimmed) continue;
    const sep = trimmed.indexOf('=');
    if (sep <= 0 || sep === trimmed.length - 1) {
      return null;
    }
    const host = trimmed.slice(0, sep).trim();
    const key = trimmed.slice(sep + 1).trim();
    if (!host || !key) {
      return null;
    }
    entries.push([host, key]);
  }
  return normalizeMapEntries(entries);
}

export function parseAdminKeysByHost(raw: unknown): AdminKeysByHost | null {
  if (raw === null || raw === undefined) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return parseAdminKeysFromObject(raw as Record<string, unknown>);
  }
  if (typeof raw !== 'string') return null;

  const trimmed = raw.trim();
  if (!trimmed) return {};

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parseAdminKeysFromObject(parsed as Record<string, unknown>);
      }
    } catch {
      return null;
    }
    return null;
  }

  return parseAdminKeysFromCsv(trimmed);
}

export function getAdminKeysByHostFromEnv(): AdminKeysByHost {
  const raw = process.env[ADMIN_KEYS_BY_HOST_ENV_VAR];
  if (!raw) return {};
  const parsed = parseAdminKeysByHost(raw);
  return parsed ?? {};
}

export function resolveAdminKeyForHost(
  host: string,
  port: number,
  options?: {
    defaultAdminKey?: string;
    adminKeysByHost?: AdminKeysByHost;
  }
): string | undefined {
  const map = options?.adminKeysByHost ?? getAdminKeysByHostFromEnv();
  const normalizedHost = normalizeAdminKeyHost(host);
  const hostWithoutPort = stripPort(normalizedHost);

  const candidates: string[] = [];
  if (normalizedHost) {
    candidates.push(normalizedHost);
  }
  if (hostWithoutPort && hostWithoutPort !== normalizedHost) {
    candidates.push(hostWithoutPort);
  }
  if (hostWithoutPort && !candidates.includes(`${hostWithoutPort}:${port}`)) {
    candidates.push(`${hostWithoutPort}:${port}`);
  }

  for (const candidate of candidates) {
    const key = map[candidate];
    if (typeof key === 'string' && key.trim().length > 0) {
      return key.trim();
    }
  }

  const fallback = options?.defaultAdminKey?.trim();
  return fallback && fallback.length > 0 ? fallback : undefined;
}
