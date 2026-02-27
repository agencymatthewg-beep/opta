import type { SupabaseBrowserClient } from '@/lib/supabase/client';

const LOCAL_SESSIONS_KEY = 'opta-local:sessions';

interface LocalSession {
  id: string;
  title?: string;
  model?: string;
  messages?: unknown[];
  created_at?: string;
  updated_at?: string;
}

function readLocalSessions(): LocalSession[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(LOCAL_SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as LocalSession[]) : [];
  } catch {
    return [];
  }
}

function writeLocalSessions(sessions: LocalSession[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(sessions));
}

export async function pullRemoteSessions(
  supabase: SupabaseBrowserClient,
): Promise<number> {
  const { data, error } = await supabase
    .from('sessions')
    .select('id,title,model,messages,created_at,updated_at')
    .order('updated_at', { ascending: false })
    .limit(200);

  if (error || !data) {
    if (error) throw new Error(error.message);
    return 0;
  }

  const local = readLocalSessions();
  const byId = new Set(local.map((session) => session.id));

  let imported = 0;
  const nextLocal = [...local];

  for (const row of data as LocalSession[]) {
    if (!row.id || byId.has(row.id)) continue;
    byId.add(row.id);
    nextLocal.push(row);
    imported += 1;
  }

  if (imported > 0) writeLocalSessions(nextLocal);
  return imported;
}

export async function pushAllLocalSessions(
  supabase: SupabaseBrowserClient,
  userId: string,
  deviceId: string | null,
): Promise<number> {
  const local = readLocalSessions();
  if (local.length === 0) return 0;

  const payload = local
    .filter((session) => Boolean(session.id))
    .map((session) => ({
      id: session.id,
      user_id: userId,
      device_id: deviceId,
      title: session.title ?? 'Session',
      model: session.model ?? 'unknown',
      messages: session.messages ?? [],
      created_at: session.created_at ?? new Date().toISOString(),
      updated_at: session.updated_at ?? new Date().toISOString(),
    }));

  if (payload.length === 0) return 0;

  const { error } = await supabase
    .from('sessions')
    .upsert(payload, { onConflict: 'id' });

  if (error) throw new Error(error.message);
  return payload.length;
}
