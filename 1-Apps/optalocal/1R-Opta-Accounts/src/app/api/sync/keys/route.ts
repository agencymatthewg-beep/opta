import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { RateLimiter } from '@/lib/rate-limit';

/**
 * GET /api/sync/keys
 *
 * Secure machine-to-machine endpoint used by Opta CLI and Opta Code Desktop
 * to fetch active API keys for all providers. Returns decrypted key_value
 * so callers can write them into the local OS keychain.
 *
 * Auth: Bearer token (Supabase access_token) in Authorization header.
 * Optional query param: ?provider=anthropic or ?category=ai-models
 */
const rateLimiter = new RateLimiter(30, 60_000);

const CATEGORY_MAP: Record<string, string[]> = {
    'ai-models': ['anthropic', 'openai', 'gemini', 'groq', 'lmx', 'opencode', 'codex'],
    'research-tools': ['tavily', 'brave', 'exa', 'perplexity'],
    'developer-platforms': ['github', 'vercel', 'cloudflare', 'google', 'twitter'],
};

export async function GET(request: Request) {
    const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1';
    if (!rateLimiter.check(ip)) {
        return NextResponse.json({ error: 'rate_limit_exceeded' }, { status: 429 });
    }

    const supabase = await createClient();
    if (!supabase) {
        return NextResponse.json({ error: 'supabase_unconfigured' }, { status: 500 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }

    const url = new URL(request.url);
    const providerFilter = url.searchParams.get('provider')?.trim().toLowerCase();
    const categoryFilter = url.searchParams.get('category')?.trim().toLowerCase();

    let query = supabase
        .from('api_keys')
        .select('id,provider,label,key_value,is_active,updated_at')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('updated_at', { ascending: false });

    if (providerFilter) {
        query = query.eq('provider', providerFilter);
    }

    const { data, error } = await query;

    if (error) {
        const code = (error as { code?: string }).code;
        if (code === 'PGRST205') {
            return NextResponse.json({ error: 'schema_not_migrated' }, { status: 503 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data ?? []) as Array<{ id: string; provider: string; label: string | null; key_value: string; is_active: boolean; updated_at: string }>;

    let filtered = rows;
    if (categoryFilter) {
        const providerSet = new Set(CATEGORY_MAP[categoryFilter] ?? []);
        filtered = rows.filter(k => providerSet.has(k.provider));
    }

    return NextResponse.json({
        keys: filtered,
        count: filtered.length,
        syncedAt: new Date().toISOString(),
    });
}
