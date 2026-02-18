'use client';

/**
 * Session Resume Hook
 *
 * Fetches a full CLI session from the LMX server and maps its messages
 * to the web ChatMessage format for rendering and continued chatting.
 * Uses SWR for caching and error handling.
 */

import useSWR from 'swr';
import type { LMXClient } from '@/lib/lmx-client';
import type { SessionFull, ChatMessage } from '@/types/lmx';
import { LMXError } from '@/types/lmx';
import { mapSessionToChat } from '@/lib/session-mapper';

interface UseSessionResumeReturn {
  /** The full session data from LMX, or undefined while loading. */
  session: SessionFull | undefined;
  /** CLI session messages mapped to web ChatMessage format. */
  messages: ChatMessage[];
  /** True while the initial fetch is in progress. */
  isLoading: boolean;
  /** Error object if the fetch failed. */
  error: Error | undefined;
  /** True if the session was not found (404). */
  isNotFound: boolean;
  /** The model used in the session. */
  model: string;
}

/**
 * Fetch a CLI session by ID and prepare it for display/resumption in the web UI.
 *
 * - Uses SWR to fetch SessionFull from LMXClient.getSession(id)
 * - Maps session messages to ChatMessage[] via session-mapper
 * - Detects 404 (session not found) and surfaces it via isNotFound
 * - Returns the session's model for the ModelPicker default
 */
export function useSessionResume(
  client: LMXClient | null,
  sessionId: string,
): UseSessionResumeReturn {
  const { data, error, isLoading } = useSWR<SessionFull>(
    client && sessionId ? `lmx:session:${sessionId}` : null,
    () => client!.getSession(sessionId),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      errorRetryCount: 1,
      // Don't auto-refresh — session history is static
      refreshInterval: 0,
    },
  );

  const isNotFound =
    error instanceof LMXError && error.status === 404;

  const messages = data ? mapSessionToChat(data) : [];
  const model = data?.model ?? '';

  return {
    session: data,
    messages,
    isLoading,
    error: error as Error | undefined,
    isNotFound,
    model,
  };
}
