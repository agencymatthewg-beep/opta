'use client';

import { useState, useTransition, useCallback, useRef } from 'react';
import type { LMXClient } from '@/lib/lmx-client';
import type { ChatMessage } from '@/types/lmx';

interface UseChatStreamOptions {
  onError?: (error: Error) => void;
}

interface UseChatStreamReturn {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  isStreaming: boolean;
  isPending: boolean;
  sendMessage: (client: LMXClient, model: string, content: string) => Promise<void>;
  stop: () => void;
}

/**
 * Streaming chat hook wrapping LMXClient.streamChat() with React 19 startTransition.
 *
 * Token-append state updates are wrapped in startTransition() so rapid streaming
 * (20-100 tok/s) doesn't block user input. The hook manages messages state,
 * streaming status, and abort control.
 */
export function useChatStream(options?: UseChatStreamOptions): UseChatStreamReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (client: LMXClient, model: string, content: string) => {
      // Create new AbortController for this request
      abortRef.current = new AbortController();

      // 1. Add user message immediately (optimistic)
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        created_at: new Date().toISOString(),
      };

      // 2. Add placeholder assistant message
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        model,
        created_at: new Date().toISOString(),
      };

      // Capture current messages before updating for the API call
      let allMessages: ChatMessage[] = [];
      setMessages((prev) => {
        allMessages = [...prev, userMsg];
        return [...prev, userMsg, assistantMsg];
      });

      setIsStreaming(true);

      try {
        // 3. Stream tokens, updating assistant message content
        for await (const token of client.streamChat(model, allMessages)) {
          // Check if aborted
          if (abortRef.current?.signal.aborted) break;

          // Wrap in startTransition so token appends don't block input
          startTransition(() => {
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last && last.role === 'assistant') {
                updated[updated.length - 1] = {
                  ...last,
                  content: last.content + token,
                };
              }
              return updated;
            });
          });
        }
      } catch (error) {
        // Don't report abort errors
        if (error instanceof DOMException && error.name === 'AbortError') return;
        options?.onError?.(error instanceof Error ? error : new Error(String(error)));
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [startTransition, options],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return { messages, setMessages, isStreaming, isPending, sendMessage, stop };
}
