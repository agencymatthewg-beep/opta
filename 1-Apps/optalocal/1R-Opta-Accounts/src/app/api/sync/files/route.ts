import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { RateLimiter } from '@/lib/rate-limit';

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
 * Auth: Bearer token (Supabase access_token) in Authorization header.
 */
const rateLimiter = new RateLimiter(30, 60_000);

type SyncFileRow = {
    id: string;
    filename: string;
    content: string;
    is_active: boolean;
    updated_at: string;
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
    const filename = url.searchParams.get('name')?.trim() || 'non-negotiables.md';

    const { data, error } = await supabase
        .from('sync_files')
        .select('id,filename,content,is_active,updated_at')
        .eq('user_id', user.id)
        .eq('filename', filename)
        .eq('is_active', true)
        .maybeSingle();

    if (error) {
        const code = (error as { code?: string }).code;
        if (code === 'PGRST205') {
            return NextResponse.json({ error: 'schema_not_migrated' }, { status: 503 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
        return NextResponse.json({ file: null, content: null, configured: false });
    }

    const row = data as SyncFileRow;
    return NextResponse.json({
        file: row,
        content: row.content,
        configured: true,
        syncedAt: new Date().toISOString(),
    });
}

export async function PATCH(request: Request) {
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

    let body: { filename?: string; content?: string };
    try {
        body = (await request.json()) as { filename?: string; content?: string };
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }

    const filename = body.filename?.trim() || 'non-negotiables.md';
    const content = body.content;

    if (content === undefined) {
        return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    // Only allow safe, well-known filenames
    if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
        return NextResponse.json({ error: 'invalid_filename' }, { status: 400 });
    }

    const { error } = await supabase
        .from('sync_files')
        .upsert(
            { user_id: user.id, filename, content, is_active: true },
            { onConflict: 'user_id,filename' },
        );

    if (error) {
        const code = (error as { code?: string }).code;
        if (code === 'PGRST205') {
            return NextResponse.json({ error: 'schema_not_migrated' }, { status: 503 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, filename, syncedAt: new Date().toISOString() });
}
