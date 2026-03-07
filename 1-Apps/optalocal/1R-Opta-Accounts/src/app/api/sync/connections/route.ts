import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { matchesIfNoneMatch } from '@/lib/sync/http-cache';
import { createSyncRateLimiter } from '@/lib/sync/rate-limit';

/**
 * GET /api/sync/connections
 *
 * Secure machine-to-machine endpoint used by Opta CLI and Opta Code Desktop
 * to fetch active OAuth provider connections. Returns token_encrypted as-is
 * (still encrypted) — the CLI uses the shared OAUTH_TOKEN_ENCRYPTION_KEY
 * to decrypt tokens locally.
 *
 * Auth: Supabase session cookie OR Bearer token (Supabase access_token)
 * in Authorization header.
 * Optional query param: ?provider=github-copilot
 */
export const dynamic = 'force-dynamic';

const rateLimiter = createSyncRateLimiter({
    namespace: 'sync_connections',
    defaultLimit: 30,
    defaultWindowMs: 60_000,
});

const NO_STORE_HEADERS = {
    'cache-control': 'no-store, max-age=0',
    pragma: 'no-cache',
} as const;

const SCHEMA_MISSING_CODES = new Set(['PGRST205', '42P01']);

type ConnectionRow = {
    provider: string;
    token_encrypted: string | null;
    token_refresh_encrypted: string | null;
    token_scope: string | null;
    token_expires_at: string | null;
    connected_via: string | null;
    updated_at: string;
};

function withNoStoreHeaders(extra?: HeadersInit): Headers {
    const headers = new Headers(NO_STORE_HEADERS);
    if (!extra) return headers;
    new Headers(extra).forEach((value, key) => headers.set(key, value));
    return headers;
}

function buildConnectionsEtag(rows: ConnectionRow[]): string {
    const payload = rows
        .map((row) => `${row.provider}:${row.updated_at}:${row.token_encrypted ?? ''}`)
        .join('|');
    const digest = createHash('sha256').update(payload).digest('base64url');
    return `"sync-connections-${digest}"`;
}

function firstForwardedIp(raw: string | null): string {
    if (!raw) return '127.0.0.1';
    const first = raw.split(',')[0]?.trim();
    return first && first.length > 0 ? first : '127.0.0.1';
}

function isSchemaMissingError(error: { code?: string }): boolean {
    const code = error.code?.toUpperCase();
    return Boolean(code && SCHEMA_MISSING_CODES.has(code));
}

export async function GET(request: Request) {
    const ip = firstForwardedIp(request.headers.get('x-forwarded-for'));
    if (!(await rateLimiter.check(`get:${ip}`))) {
        return NextResponse.json(
            { error: 'rate_limit_exceeded' },
            { status: 429, headers: NO_STORE_HEADERS },
        );
    }

    const supabase = await createClient();
    if (!supabase) {
        return NextResponse.json(
            { error: 'supabase_unconfigured' },
            { status: 500, headers: NO_STORE_HEADERS },
        );
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json(
            { error: 'unauthenticated' },
            { status: 401, headers: NO_STORE_HEADERS },
        );
    }

    const url = new URL(request.url);
    const providerFilter = url.searchParams.get('provider')?.trim().toLowerCase();

    let query = supabase
        .from('accounts_provider_connections')
        .select(
            'provider,token_encrypted,token_refresh_encrypted,token_scope,token_expires_at,connected_via,updated_at',
        )
        .eq('user_id', user.id)
        .eq('status', 'connected')
        .order('updated_at', { ascending: false });

    if (providerFilter) {
        query = query.eq('provider', providerFilter);
    }

    const { data, error } = await query;

    if (error) {
        if (isSchemaMissingError(error)) {
            return NextResponse.json(
                { error: 'schema_not_migrated' },
                { status: 503, headers: NO_STORE_HEADERS },
            );
        }
        return NextResponse.json(
            { error: error.message },
            { status: 500, headers: NO_STORE_HEADERS },
        );
    }

    const rows = (data ?? []) as ConnectionRow[];

    const etag = buildConnectionsEtag(rows);
    if (matchesIfNoneMatch(request.headers.get('if-none-match'), etag)) {
        return new Response(null, { status: 304, headers: withNoStoreHeaders({ etag }) });
    }

    return NextResponse.json(
        {
            connections: rows,
            count: rows.length,
            syncedAt: new Date().toISOString(),
        },
        { headers: withNoStoreHeaders({ etag }) },
    );
}
