'use client';

import { useEffect, useRef, useCallback } from 'react';
import {
  saveChatSession,
  getChatSession,
  generateSessionTitle,
} from '@/lib/chat-store';
import type { ChatMessage, Session } from '@/types/lmx';

interface UseSessionPersistReturn {
  /** Restore messages for a given session ID. Returns null if not found. */
  restore: () => Promise<Session | null>;
}

/**
 * Auto-save chat sessions to IndexedDB after streaming completes.
 *
 * - Saves after each completed assistant response (not during streaming)
 * - Saves on page unload as a best-effort safety net
 * - Generates session title from first user message
 * - Supports restoring existing session by ID
 */
export function useSessionPersist(
  sessionId: string,
  messages: ChatMessage[],
  model: string,
  isStreaming: boolean,
): UseSessionPersistReturn {
  const lastSavedRef = useRef<string>('');

  // Auto-save when streaming completes (not during — too many writes)
  useEffect(() => {
    if (isStreaming || messages.length === 0) return;

    const serialized = JSON.stringify(messages);
    if (serialized === lastSavedRef.current) return; // No changes

    const session: Session = {
      id: sessionId,
      title: generateSessionTitle(messages),
      messages,
      model,
      created_at: messages[0]?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    void saveChatSession(session);
    lastSavedRef.current = serialized;
  }, [sessionId, messages, model, isStreaming]);

  // Save on page unload (catch mid-stream exits) — best effort
  useEffect(() => {
    const handleUnload = () => {
      if (messages.length > 0) {
        const session: Session = {
          id: sessionId,
          title: generateSessionTitle(messages),
          messages,
          model,
          created_at: messages[0]?.created_at ?? new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        // Fire-and-forget — async write may not complete before unload
        void saveChatSession(session);
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [sessionId, messages, model]);

  // Restore session on mount
  const restore = useCallback(async (): Promise<Session | null> => {
    const session = await getChatSession(sessionId);
    if (session) {
      lastSavedRef.current = JSON.stringify(session.messages);
      return session;
    }
    return null;
  }, [sessionId]);

  return { restore };
}
