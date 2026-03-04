'use server';

import { createClient } from '@/lib/supabase/server';

export interface SyncFile {
    id: string;
    filename: string;
    content: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

interface DbSyncFile {
    id: string;
    filename: string;
    content: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

function toSyncFile(row: DbSyncFile): SyncFile {
    return {
        id: row.id,
        filename: row.filename,
        content: row.content,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export async function getSyncFile(filename: string): Promise<SyncFile | null> {
    const supabase = await createClient();
    if (!supabase) return null;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('sync_files')
        .select('*')
        .eq('user_id', user.id)
        .eq('filename', filename)
        .single();

    if (error || !data) return null;
    return toSyncFile(data as DbSyncFile);
}

export async function upsertSyncFile(
    filename: string,
    content: string,
): Promise<{ ok: boolean; error?: string }> {
    const supabase = await createClient();
    if (!supabase) return { ok: false, error: 'Supabase is not configured.' };

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'Not authenticated.' };

    const { error } = await supabase
        .from('sync_files')
        .upsert(
            {
                user_id: user.id,
                filename,
                content,
                is_active: true,
            },
            { onConflict: 'user_id,filename' },
        );

    if (error) return { ok: false, error: error.message };
    return { ok: true };
}
