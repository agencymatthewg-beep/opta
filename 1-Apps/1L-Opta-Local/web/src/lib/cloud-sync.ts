/**
 * Cloud sync layer — write-through to Supabase when authenticated.
 *
 * Wraps the local IndexedDB chat-store operations with Supabase
 * push/pull for cross-device session continuity. Local-first:
 * IndexedDB always works, Supabase sync is best-effort when auth'd.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Session, ChatMessage } from '@/types/lmx';
import type { CloudMessage } from '@/types/cloud';
import {
  saveChatSession,
  getChatSession,
  deleteChatSession,
  listChatSessions,
  type ChatSessionSummary,
} from '@/lib/chat-store';

// ---------------------------------------------------------------------------
// Sync-aware CRUD (wraps chat-store with Supabase push)
// ---------------------------------------------------------------------------

/**
 * Save a session to IndexedDB AND push to Supabase if authenticated.
 * Local write always succeeds; cloud write is best-effort.
 */
export async function syncSaveSession(
  session: Session,
  supabase: SupabaseClient | null,
  userId: string | null,
  deviceId: string | null,
): Promise<void> {
  // Always save locally first
  await saveChatSession(session);

  // Push to cloud if authenticated
  if (!supabase || !userId) return;

  try {
    // Upsert session metadata
    await supabase.from('cloud_sessions').upsert({
      id: session.id,
      user_id: userId,
      device_id: deviceId,
      title: session.title,
      model: session.model,
      message_count: session.messages.length,
      token_count: session.messages.reduce(
        (sum, m) => sum + (m.tokens_used ?? 0),
        0,
      ),
      created_at: session.created_at,
      updated_at: session.updated_at,
    });

    // Upsert all messages
    const cloudMessages: Omit<CloudMessage, 'created_at'>[] =
      session.messages.map((m, i) => ({
        id: `${session.id}-msg-${i}`,
        session_id: session.id,
        user_id: userId,
        role: m.role,
        content: m.content,
        model: m.model ?? null,
        tool_calls: m.tool_calls ?? null,
        token_usage: m.tokens_used
          ? { prompt: 0, completion: m.tokens_used }
          : null,
        index: i,
      }));

    if (cloudMessages.length > 0) {
      await supabase.from('cloud_messages').upsert(cloudMessages);
    }
  } catch {
    // Cloud sync failed — local data is still safe
    console.warn('[cloud-sync] Failed to push session to Supabase');
  }
}

/**
 * Delete a session from IndexedDB AND Supabase.
 * Cascade delete on cloud_messages handles message cleanup.
 */
export async function syncDeleteSession(
  id: string,
  supabase: SupabaseClient | null,
): Promise<void> {
  await deleteChatSession(id);

  if (!supabase) return;

  try {
    await supabase.from('cloud_sessions').delete().eq('id', id);
  } catch {
    console.warn('[cloud-sync] Failed to delete session from Supabase');
  }
}

// ---------------------------------------------------------------------------
// Pull: Merge remote sessions into local IndexedDB
// ---------------------------------------------------------------------------

/**
 * Pull sessions from Supabase that aren't in local IndexedDB.
 * Returns the number of sessions imported.
 */
export async function pullRemoteSessions(
  supabase: SupabaseClient,
): Promise<number> {
  // Get local session IDs
  const localSummaries = await listChatSessions();
  const localIds = new Set(localSummaries.map((s) => s.id));

  // Fetch all remote sessions
  const { data: remoteSessions, error: sessError } = await supabase
    .from('cloud_sessions')
    .select('*')
    .order('updated_at', { ascending: false });

  if (sessError || !remoteSessions) return 0;

  let imported = 0;

  for (const remote of remoteSessions) {
    if (localIds.has(remote.id)) continue; // Already local

    // Fetch messages for this session
    const { data: remoteMessages } = await supabase
      .from('cloud_messages')
      .select('*')
      .eq('session_id', remote.id)
      .order('index', { ascending: true });

    if (!remoteMessages) continue;

    // Convert to local Session format
    const localSession: Session = {
      id: remote.id,
      title: remote.title,
      model: remote.model,
      created_at: remote.created_at,
      updated_at: remote.updated_at,
      messages: remoteMessages.map(
        (m: CloudMessage): ChatMessage => ({
          id: m.id,
          role: m.role,
          content: m.content,
          model: m.model ?? undefined,
          tokens_used: m.token_usage?.completion ?? undefined,
          created_at: m.created_at,
          tool_calls: (m.tool_calls as ChatMessage['tool_calls']) ?? undefined,
        }),
      ),
    };

    await saveChatSession(localSession);
    imported++;
  }

  return imported;
}

// ---------------------------------------------------------------------------
// Push: Upload all local sessions to Supabase (one-time migration)
// ---------------------------------------------------------------------------

/**
 * Upload all local sessions to Supabase. Used on first sign-in
 * to migrate existing local-only sessions to the cloud.
 */
export async function pushAllLocalSessions(
  supabase: SupabaseClient,
  userId: string,
  deviceId: string | null,
): Promise<number> {
  const summaries = await listChatSessions();
  let pushed = 0;

  for (const summary of summaries) {
    const session = await getChatSession(summary.id);
    if (!session) continue;

    await syncSaveSession(session, supabase, userId, deviceId);
    pushed++;
  }

  return pushed;
}

// ---------------------------------------------------------------------------
// List: Merged local + remote session summaries
// ---------------------------------------------------------------------------

/**
 * List sessions from both IndexedDB and Supabase, deduplicated by ID.
 * Local sessions take precedence (they may have newer unsynced messages).
 */
export async function listMergedSessions(
  supabase: SupabaseClient | null,
): Promise<ChatSessionSummary[]> {
  const localSummaries = await listChatSessions();

  if (!supabase) return localSummaries;

  try {
    const { data: remoteSessions } = await supabase
      .from('cloud_sessions')
      .select('id, title, model, message_count, created_at, updated_at')
      .order('updated_at', { ascending: false });

    if (!remoteSessions) return localSummaries;

    // Merge: local takes precedence
    const localIds = new Set(localSummaries.map((s) => s.id));
    const remoteSummaries: ChatSessionSummary[] = remoteSessions
      .filter((r) => !localIds.has(r.id))
      .map((r) => ({
        id: r.id,
        title: r.title,
        model: r.model,
        messageCount: r.message_count,
        created_at: r.created_at,
        updated_at: r.updated_at,
      }));

    return [...localSummaries, ...remoteSummaries].sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
  } catch {
    return localSummaries;
  }
}
