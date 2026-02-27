'use client';

import { useState, useCallback, useRef, useTransition } from 'react';
import type { LMXClient } from '@/lib/lmx-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ArenaChannel {
  modelId: string;
  content: string;
  isStreaming: boolean;
  error: string | null;
  startedAt: number;
  finishedAt: number | null;
  tokenCount: number;
}

export interface UseArenaStreamReturn {
  channels: ArenaChannel[];
  sendPrompt: (prompt: string) => void;
  stopAll: () => void;
  isAnyStreaming: boolean;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages parallel streaming to multiple models simultaneously.
 *
 * Each model gets an independent channel with its own state, error handling,
 * and abort control. Uses Promise.allSettled so one model failing does not
 * kill the others. Token appends are wrapped in startTransition to avoid
 * blocking user input during rapid streaming.
 */
export function useArenaStream(
  client: LMXClient | null,
  models: string[],
): UseArenaStreamReturn {
  const [channels, setChannels] = useState<ArenaChannel[]>([]);
  const [, startTransition] = useTransition();
  const abortControllers = useRef<Map<string, AbortController>>(new Map());
  const activeStreamCount = useRef(0);

  const isAnyStreaming = channels.some((ch) => ch.isStreaming);

  /**
   * Initialize channels for all selected models and begin parallel streaming.
   */
  const sendPrompt = useCallback(
    (prompt: string) => {
      if (!client || models.length === 0) return;

      // Abort any previous streams
      for (const controller of abortControllers.current.values()) {
        controller.abort();
      }
      abortControllers.current.clear();

      const now = performance.now();

      // Initialize all channels
      const initialChannels: ArenaChannel[] = models.map((modelId) => ({
        modelId,
        content: '',
        isStreaming: true,
        error: null,
        startedAt: now,
        finishedAt: null,
        tokenCount: 0,
      }));

      setChannels(initialChannels);
      activeStreamCount.current = models.length;

      // Launch parallel streams — one per model
      const streamPromises = models.map(async (modelId) => {
        const controller = new AbortController();
        abortControllers.current.set(modelId, controller);

        try {
          const messages = [
            {
              id: crypto.randomUUID(),
              role: 'user' as const,
              content: prompt,
              created_at: new Date().toISOString(),
            },
          ];

          for await (const token of client.streamChat(modelId, messages)) {
            // Check abort
            if (controller.signal.aborted) break;

            startTransition(() => {
              setChannels((prev) =>
                prev.map((ch) =>
                  ch.modelId === modelId
                    ? {
                        ...ch,
                        content: ch.content + token,
                        tokenCount: ch.tokenCount + 1,
                      }
                    : ch,
                ),
              );
            });
          }

          // Stream completed successfully
          if (!controller.signal.aborted) {
            setChannels((prev) =>
              prev.map((ch) =>
                ch.modelId === modelId
                  ? {
                      ...ch,
                      isStreaming: false,
                      finishedAt: performance.now(),
                    }
                  : ch,
              ),
            );
          }
        } catch (error: unknown) {
          // Don't report abort errors
          if (
            error instanceof DOMException &&
            error.name === 'AbortError'
          ) {
            return;
          }

          const message =
            error instanceof Error ? error.message : String(error);

          setChannels((prev) =>
            prev.map((ch) =>
              ch.modelId === modelId
                ? {
                    ...ch,
                    isStreaming: false,
                    error: message,
                    finishedAt: performance.now(),
                  }
                : ch,
            ),
          );
        } finally {
          abortControllers.current.delete(modelId);
          activeStreamCount.current -= 1;
        }
      });

      // Fire and forget — Promise.allSettled ensures individual failures
      // don't cascade to other channels
      void Promise.allSettled(streamPromises);
    },
    [client, models, startTransition],
  );

  /**
   * Abort all active streams.
   */
  const stopAll = useCallback(() => {
    for (const controller of abortControllers.current.values()) {
      controller.abort();
    }
    abortControllers.current.clear();
    activeStreamCount.current = 0;

    setChannels((prev) =>
      prev.map((ch) =>
        ch.isStreaming
          ? { ...ch, isStreaming: false, finishedAt: performance.now() }
          : ch,
      ),
    );
  }, []);

  /**
   * Reset all channels and abort any active streams.
   */
  const reset = useCallback(() => {
    stopAll();
    setChannels([]);
  }, [stopAll]);

  return {
    channels,
    sendPrompt,
    stopAll,
    isAnyStreaming,
    reset,
  };
}
