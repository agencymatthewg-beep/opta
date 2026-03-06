import { createHash } from 'node:crypto';

export type SyncFileCacheRow = {
  id: string;
  filename: string;
  content: string;
  updated_at: string;
};

export type SyncFileDeltaCacheRow = {
  id: string;
  filename: string;
  updated_at: string;
};

function createStrongEtag(namespace: string, payload: string): string {
  const digest = createHash('sha256').update(payload).digest('base64url');
  return `"${namespace}-${digest}"`;
}

function normalizeEtagToken(raw: string): string {
  let token = raw.trim();
  if (token.startsWith('W/')) {
    token = token.slice(2).trim();
  }
  if (token.startsWith('"') && token.endsWith('"') && token.length >= 2) {
    token = token.slice(1, -1);
  }
  return token;
}

function parseEtagHeader(headerValue: string | null): string[] {
  if (!headerValue) return [];
  return headerValue
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export function buildSyncFileEtag(row: SyncFileCacheRow): string {
  return createStrongEtag('sync-file', `${row.id}\n${row.filename}\n${row.updated_at}\n${row.content}`);
}

export function buildMissingSyncFileEtag(filename: string): string {
  return createStrongEtag('sync-file-missing', filename);
}

export function buildSyncFilesDeltaEtag(
  updatedSince: string,
  limit: number,
  rows: readonly SyncFileDeltaCacheRow[],
): string {
  const serialisedRows = rows
    .map((row) => `${row.id}:${row.filename}:${row.updated_at}`)
    .join('|');
  return createStrongEtag('sync-files-delta', `${updatedSince}\n${limit}\n${serialisedRows}`);
}

export function matchesIfNoneMatch(ifNoneMatchHeader: string | null, currentEtag: string): boolean {
  const candidates = parseEtagHeader(ifNoneMatchHeader);
  if (candidates.length === 0) return false;
  if (candidates.includes('*')) return true;
  const normalizedCurrent = normalizeEtagToken(currentEtag);
  return candidates.some((candidate) => normalizeEtagToken(candidate) === normalizedCurrent);
}

export function matchesIfMatch(ifMatchHeader: string | null, currentEtag: string | null): boolean {
  if (!ifMatchHeader) return true;

  const candidates = parseEtagHeader(ifMatchHeader);
  if (candidates.length === 0) return false;
  if (currentEtag === null) return false;
  if (candidates.includes('*')) return true;

  const normalizedCurrent = normalizeEtagToken(currentEtag);
  return candidates.some((candidate) => normalizeEtagToken(candidate) === normalizedCurrent);
}
