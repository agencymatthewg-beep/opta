export const DEFAULT_SYNC_DELTA_LIMIT = 100;
export const MAX_SYNC_DELTA_LIMIT = 500;

type SyncDeltaParseOptions = {
  defaultLimit?: number;
  maxLimit?: number;
};

export type SyncFilesQueryMode =
  | { mode: 'single' }
  | { mode: 'delta'; updatedSince: string; limit: number }
  | { mode: 'error'; error: 'invalid_updated_since' | 'invalid_limit' };

function parsePositiveInteger(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return parsed;
}

export function parseSyncFilesQueryMode(url: URL, options?: SyncDeltaParseOptions): SyncFilesQueryMode {
  const updatedSinceRaw = url.searchParams.get('updated_since')?.trim();
  if (!updatedSinceRaw) {
    return { mode: 'single' };
  }

  const parsedDate = new Date(updatedSinceRaw);
  if (Number.isNaN(parsedDate.getTime())) {
    return { mode: 'error', error: 'invalid_updated_since' };
  }

  const defaultLimit = options?.defaultLimit ?? DEFAULT_SYNC_DELTA_LIMIT;
  const maxLimit = options?.maxLimit ?? MAX_SYNC_DELTA_LIMIT;

  const limitRaw = url.searchParams.get('limit')?.trim();
  let limit = defaultLimit;
  if (limitRaw && limitRaw.length > 0) {
    const parsedLimit = parsePositiveInteger(limitRaw);
    if (parsedLimit === null) {
      return { mode: 'error', error: 'invalid_limit' };
    }
    limit = Math.min(parsedLimit, maxLimit);
  }

  return {
    mode: 'delta',
    updatedSince: parsedDate.toISOString(),
    limit,
  };
}
