/**
 * Chat session persistence using idb-keyval (IndexedDB).
 *
 * Provides save/load/list/delete operations for web chat sessions.
 * Uses IndexedDB instead of localStorage because chat histories with
 * code blocks can easily exceed localStorage's 5-10MB limit.
 *
 * These are LOCAL web sessions. CLI session resume is handled in Phase 5.
 */

import { get, set, del, keys } from 'idb-keyval';
import type { ChatMessage, Session } from '@/types/lmx';

const SESSION_PREFIX = 'opta-session:';

// ---------------------------------------------------------------------------
// Core CRUD
// ---------------------------------------------------------------------------

/** Save a chat session to IndexedDB. */
export async function saveChatSession(session: Session): Promise<void> {
  await set(`${SESSION_PREFIX}${session.id}`, session);
}

/** Retrieve a chat session by ID. Returns undefined if not found. */
export async function getChatSession(
  id: string,
): Promise<Session | undefined> {
  return get<Session>(`${SESSION_PREFIX}${id}`);
}

/** Delete a chat session by ID. */
export async function deleteChatSession(id: string): Promise<void> {
  await del(`${SESSION_PREFIX}${id}`);
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

/** Summary of a session for list views (excludes full message history). */
export interface ChatSessionSummary {
  id: string;
  title: string;
  model: string;
  messageCount: number;
  created_at: string;
  updated_at: string;
}

/**
 * List all chat sessions sorted by updated_at descending (most recent first).
 * Returns summaries without full messages to avoid loading all message data.
 */
export async function listChatSessions(): Promise<ChatSessionSummary[]> {
  const allKeys = await keys();
  const sessionKeys = allKeys.filter(
    (k) => typeof k === 'string' && k.startsWith(SESSION_PREFIX),
  );

  const summaries: ChatSessionSummary[] = [];
  for (const key of sessionKeys) {
    const session = await get<Session>(key as string);
    if (session) {
      summaries.push({
        id: session.id,
        title: session.title,
        model: session.model,
        messageCount: session.messages.length,
        created_at: session.created_at,
        updated_at: session.updated_at,
      });
    }
  }

  // Sort by updated_at descending (most recent first)
  return summaries.sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a session title from the first user message.
 * Truncates to 60 characters with ellipsis if longer.
 */
export function generateSessionTitle(messages: ChatMessage[]): string {
  const firstUserMsg = messages.find((m) => m.role === 'user');
  if (!firstUserMsg) return 'New Chat';
  const content = firstUserMsg.content.trim();
  if (content.length <= 60) return content;
  return content.slice(0, 60) + '...';
}
