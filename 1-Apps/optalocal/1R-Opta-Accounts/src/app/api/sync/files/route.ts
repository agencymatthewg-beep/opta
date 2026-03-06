import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseSyncFilesQueryMode } from '@/lib/sync/files-delta';
import {
  buildMissingSyncFileEtag,
  buildSyncFileEtag,
  buildSyncFilesDeltaEtag,
  matchesIfMatch,
  matchesIfNoneMatch,
} from '@/lib/sync/http-cache';
import { createSyncRateLimiter } from '@/lib/sync/rate-limit';

/**
 * GET /api/sync/files?name=non-negotiables.md
 *
 * Secure M2M endpoint used by Opta CLI and Opta Code Desktop to fetch synced
 * configuration files, primarily the user's `non-negotiables.md`. If no file
 * is configured, returns { configured: false, content: null }.
 *
 * PATCH /api/sync/files
 * Body: { filename: string; content: string }
 * Allows CLI to push local rule updates back to the vault.
 *
 * Auth: Supabase session cookie OR Bearer token (Supabase access_token)
 * in Authorization header.
 */
export const dynamic = 'force-dynamic';

const rateLimiter = createSyncRateLimiter({
  namespace: 'sync_files',
  defaultLimit: 30,
  defaultWindowMs: 60_000,
});
const DEFAULT_FILENAME = 'non-negotiables.md';
const SAFE_FILENAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;
const MAX_SYNC_FILE_BYTES =
  Number.parseInt(process.env.OPTA_ACCOUNTS_SYNC_FILE_MAX_BYTES ?? '262144', 10) || 262144;
const DEFAULT_SYNC_DELTA_LIMIT =
  Number.parseInt(process.env.OPTA_ACCOUNTS_SYNC_DELTA_DEFAULT_LIMIT ?? '100', 10) || 100;
const MAX_SYNC_DELTA_LIMIT =
  Number.parseInt(process.env.OPTA_ACCOUNTS_SYNC_DELTA_MAX_LIMIT ?? '500', 10) || 500;
const NO_STORE_HEADERS = {
  'cache-control': 'no-store, max-age=0',
  pragma: 'no-cache',
} as const;
const SCHEMA_MISSING_CODES = new Set(['PGRST205', '42P01']);
const UTF8_ENCODER = new TextEncoder();

type SyncFileRow = {
  id: string;
  filename: string;
  content: string;
  is_active: boolean;
  updated_at: string;
};

type SyncFileDeltaRow = {
  id: string;
  filename: string;
  updated_at: string;
};

function firstForwardedIp(raw: string | null): string {
  if (!raw) return '127.0.0.1';
  const first = raw.split(',')[0]?.trim();
  return first && first.length > 0 ? first : '127.0.0.1';
}

function isValidFilename(filename: string) {
  return SAFE_FILENAME_PATTERN.test(filename);
}

function resolveRequestedFilename(url: URL): string {
  const fromName = url.searchParams.get('name');
  const fromFilename = url.searchParams.get('filename');
  return (fromName ?? fromFilename)?.trim() || DEFAULT_FILENAME;
}

function isSchemaMissingError(error: { code?: string }) {
  const code = error.code?.toUpperCase();
  return Boolean(code && SCHEMA_MISSING_CODES.has(code));
}

function utf8ByteLength(value: string) {
  return UTF8_ENCODER.encode(value).byteLength;
}

function withNoStoreHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(NO_STORE_HEADERS);
  if (!extra) return headers;
  new Headers(extra).forEach((value, key) => headers.set(key, value));
  return headers;
}

export async function GET(request: Request) {
  const ip = firstForwardedIp(request.headers.get('x-forwarded-for'));
  if (!(await rateLimiter.check(`get:${ip}`))) {
    return NextResponse.json({ error: 'rate_limit_exceeded' }, { status: 429, headers: NO_STORE_HEADERS });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: 'supabase_unconfigured' }, { status: 500, headers: NO_STORE_HEADERS });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE_HEADERS });
  }

  const url = new URL(request.url);
  const queryMode = parseSyncFilesQueryMode(url, {
    defaultLimit: DEFAULT_SYNC_DELTA_LIMIT,
    maxLimit: MAX_SYNC_DELTA_LIMIT,
  });
  if (queryMode.mode === 'error') {
    return NextResponse.json({ error: queryMode.error }, { status: 400, headers: NO_STORE_HEADERS });
  }

  if (queryMode.mode === 'delta') {
    const { data, error } = await supabase
      .from('sync_files')
      .select('id,filename,updated_at')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .gt('updated_at', queryMode.updatedSince)
      .order('updated_at', { ascending: true })
      .limit(queryMode.limit);

    if (error) {
      if (isSchemaMissingError(error)) {
        return NextResponse.json({ error: 'schema_not_migrated' }, { status: 503, headers: NO_STORE_HEADERS });
      }
      return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE_HEADERS });
    }

    const rows = (data ?? []) as SyncFileDeltaRow[];
    const etag = buildSyncFilesDeltaEtag(queryMode.updatedSince, queryMode.limit, rows);
    if (matchesIfNoneMatch(request.headers.get('if-none-match'), etag)) {
      return new Response(null, { status: 304, headers: withNoStoreHeaders({ etag }) });
    }

    return NextResponse.json({
      mode: 'delta',
      files: rows,
      count: rows.length,
      limit: queryMode.limit,
      updatedSince: queryMode.updatedSince,
      syncedAt: rows[rows.length - 1]?.updated_at ?? new Date().toISOString(),
    }, { headers: withNoStoreHeaders({ etag }) });
  }

  const filename = resolveRequestedFilename(url);
  if (!isValidFilename(filename)) {
    return NextResponse.json({ error: 'invalid_filename' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const { data, error } = await supabase
    .from('sync_files')
    .select('id,filename,content,is_active,updated_at')
    .eq('user_id', user.id)
    .eq('filename', filename)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    if (isSchemaMissingError(error)) {
      return NextResponse.json({ error: 'schema_not_migrated' }, { status: 503, headers: NO_STORE_HEADERS });
    }
    return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE_HEADERS });
  }

  if (!data) {
    const etag = buildMissingSyncFileEtag(filename);
    if (matchesIfNoneMatch(request.headers.get('if-none-match'), etag)) {
      return new Response(null, { status: 304, headers: withNoStoreHeaders({ etag }) });
    }
    return NextResponse.json({ file: null, content: null, configured: false }, {
      headers: withNoStoreHeaders({ etag }),
    });
  }

  const row = data as SyncFileRow;
  const etag = buildSyncFileEtag(row);
  if (matchesIfNoneMatch(request.headers.get('if-none-match'), etag)) {
    return new Response(null, { status: 304, headers: withNoStoreHeaders({ etag }) });
  }
  return NextResponse.json({
    file: row,
    content: row.content,
    configured: true,
    syncedAt: row.updated_at ?? new Date().toISOString(),
  }, { headers: withNoStoreHeaders({ etag }) });
}

export async function PATCH(request: Request) {
  const ip = firstForwardedIp(request.headers.get('x-forwarded-for'));
  if (!(await rateLimiter.check(`patch:${ip}`))) {
    return NextResponse.json({ error: 'rate_limit_exceeded' }, { status: 429, headers: NO_STORE_HEADERS });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: 'supabase_unconfigured' }, { status: 500, headers: NO_STORE_HEADERS });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE_HEADERS });
  }

  let body: { filename?: unknown; content?: unknown };
  try {
    body = (await request.json()) as { filename?: unknown; content?: unknown };
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const filename = typeof body.filename === 'string'
    ? body.filename.trim() || DEFAULT_FILENAME
    : DEFAULT_FILENAME;
  if (!isValidFilename(filename)) {
    return NextResponse.json({ error: 'invalid_filename' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  if (body.content === undefined) {
    return NextResponse.json({ error: 'content is required' }, { status: 400, headers: NO_STORE_HEADERS });
  }
  if (typeof body.content !== 'string') {
    return NextResponse.json({ error: 'content_must_be_string' }, { status: 400, headers: NO_STORE_HEADERS });
  }
  if (utf8ByteLength(body.content) > MAX_SYNC_FILE_BYTES) {
    return NextResponse.json({ error: 'content_too_large' }, { status: 413, headers: NO_STORE_HEADERS });
  }

  const { data: currentRowData, error: currentRowError } = await supabase
    .from('sync_files')
    .select('id,filename,content,is_active,updated_at')
    .eq('user_id', user.id)
    .eq('filename', filename)
    .maybeSingle();

  if (currentRowError) {
    if (isSchemaMissingError(currentRowError)) {
      return NextResponse.json({ error: 'schema_not_migrated' }, { status: 503, headers: NO_STORE_HEADERS });
    }
    return NextResponse.json({ error: currentRowError.message }, { status: 500, headers: NO_STORE_HEADERS });
  }

  const currentRow = currentRowData as SyncFileRow | null;
  const currentEtag = currentRow ? buildSyncFileEtag(currentRow) : null;
  if (!matchesIfMatch(request.headers.get('if-match'), currentEtag)) {
    return NextResponse.json({ error: 'precondition_failed' }, {
      status: 412,
      headers: withNoStoreHeaders(currentEtag ? { etag: currentEtag } : undefined),
    });
  }

  const { data, error } = await supabase
    .from('sync_files')
    .upsert(
      { user_id: user.id, filename, content: body.content, is_active: true },
      { onConflict: 'user_id,filename' },
    )
    .select('id,filename,content,is_active,updated_at')
    .single();

  if (error) {
    if (isSchemaMissingError(error)) {
      return NextResponse.json({ error: 'schema_not_migrated' }, { status: 503, headers: NO_STORE_HEADERS });
    }
    return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE_HEADERS });
  }

  const row = data as SyncFileRow;
  const etag = buildSyncFileEtag(row);
  return NextResponse.json({ ok: true, filename, syncedAt: row.updated_at ?? new Date().toISOString() }, {
    headers: withNoStoreHeaders({ etag }),
  });
}
