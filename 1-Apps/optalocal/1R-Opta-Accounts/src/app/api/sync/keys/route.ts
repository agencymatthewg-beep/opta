import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { matchesIfNoneMatch } from '@/lib/sync/http-cache';
import { createSyncRateLimiter } from '@/lib/sync/rate-limit';

/**
 * GET /api/sync/keys
 *
 * Secure machine-to-machine endpoint used by Opta CLI and Opta Code Desktop
 * to fetch active API keys for all providers. Returns decrypted key_value
 * so callers can write them into the local OS keychain.
 *
 * Auth: Supabase session cookie OR Bearer token (Supabase access_token)
 * in Authorization header.
 * Optional query param: ?provider=anthropic or ?category=ai-models
 */
export const dynamic = 'force-dynamic';

const rateLimiter = createSyncRateLimiter({
    namespace: 'sync_keys',
    defaultLimit: 30,
    defaultWindowMs: 60_000,
});
const NO_STORE_HEADERS = {
  'cache-control': 'no-store, max-age=0',
  pragma: 'no-cache',
} as const;
const SCHEMA_MISSING_CODES = new Set(['PGRST205', '42P01']);

const CATEGORY_MAP: Record<string, readonly string[]> = {
    'ai-models': ['anthropic', 'openai', 'gemini', 'groq', 'lmx', 'opencode', 'codex', 'github-copilot', 'gemini-cli', 'openai-codex', 'huggingface', 'openrouter'],
    'research-tools': ['tavily', 'brave', 'exa', 'perplexity'],
    'developer-platforms': ['github', 'vercel', 'cloudflare', 'google', 'twitter'],
};

function withNoStoreHeaders(extra?: HeadersInit): Headers {
    const headers = new Headers(NO_STORE_HEADERS);
    if (!extra) return headers;
    new Headers(extra).forEach((value, key) => headers.set(key, value));
    return headers;
}

function buildSyncKeysEtag(
    rows: Array<{ id: string; provider: string; key_value: string; updated_at: string }>,
): string {
    const payload = rows
        .map((row) => `${row.id}:${row.provider}:${row.updated_at}:${row.key_value}`)
        .join('|');
    const digest = createHash('sha256').update(payload).digest('base64url');
    return `"sync-keys-${digest}"`;
}

function firstForwardedIp(raw: string | null): string {
    if (!raw) return '127.0.0.1';
    const first = raw.split(',')[0]?.trim();
    return first && first.length > 0 ? first : '127.0.0.1';
}

function isSchemaMissingError(error: { code?: string }) {
    const code = error.code?.toUpperCase();
    return Boolean(code && SCHEMA_MISSING_CODES.has(code));
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
    const providerFilter = url.searchParams.get('provider')?.trim().toLowerCase();
    const categoryFilter = url.searchParams.get('category')?.trim().toLowerCase();
    const hasCategoryFilter = Boolean(categoryFilter);
    const categoryProviders = categoryFilter ? CATEGORY_MAP[categoryFilter] ?? [] : [];
    if (hasCategoryFilter && categoryProviders.length === 0) {
        const etag = buildSyncKeysEtag([]);
        if (matchesIfNoneMatch(request.headers.get('if-none-match'), etag)) {
            return new Response(null, { status: 304, headers: withNoStoreHeaders({ etag }) });
        }
        return NextResponse.json({
            keys: [],
            count: 0,
            syncedAt: new Date().toISOString(),
        }, { headers: withNoStoreHeaders({ etag }) });
    }

    let query = supabase
        .from('api_keys')
        .select('id,provider,label,key_value,is_active,updated_at')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('updated_at', { ascending: false });

    if (providerFilter) {
        query = query.eq('provider', providerFilter);
    }
    if (categoryProviders.length > 0) {
        query = query.in('provider', [...categoryProviders]);
    }

    const { data, error } = await query;

    if (error) {
        if (isSchemaMissingError(error)) {
            return NextResponse.json({ error: 'schema_not_migrated' }, { status: 503, headers: NO_STORE_HEADERS });
        }
        return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE_HEADERS });
    }

    const rows = (data ?? []) as Array<{ id: string; provider: string; label: string | null; key_value: string; is_active: boolean; updated_at: string }>;

    const etag = buildSyncKeysEtag(rows);
    if (matchesIfNoneMatch(request.headers.get('if-none-match'), etag)) {
        return new Response(null, { status: 304, headers: withNoStoreHeaders({ etag }) });
    }

    return NextResponse.json({
        keys: rows,
        count: rows.length,
        syncedAt: new Date().toISOString(),
    }, { headers: withNoStoreHeaders({ etag }) });
}
