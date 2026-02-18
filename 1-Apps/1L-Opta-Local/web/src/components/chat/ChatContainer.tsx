'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, MessageSquare, Sparkles } from 'lucide-react';
import { cn } from '@opta/ui';
import { useChatStream } from '@/hooks/useChatStream';
import { useScrollAnchor } from '@/hooks/useScrollAnchor';
import { createClient, getConnectionSettings } from '@/lib/connection';
import type { LMXClient } from '@/lib/lmx-client';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';

interface ChatContainerProps {
  model: string;
}

const PROMPT_SUGGESTIONS = [
  'Explain quantum computing in simple terms',
  'Write a Python function to sort a list',
  'What are the benefits of local AI?',
  'Help me debug a TypeScript error',
];

/**
 * Main chat container integrating streaming, scroll behavior, and message UI.
 *
 * Creates an LMXClient from saved ConnectionSettings, manages the streaming
 * chat flow via useChatStream, and handles auto-scroll via useScrollAnchor.
 */
export function ChatContainer({ model }: ChatContainerProps) {
  const [client, setClient] = useState<LMXClient | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { messages, isStreaming, sendMessage, stop } = useChatStream({
    onError: (err) => setError(err.message),
  });

  const {
    containerRef,
    anchorRef,
    showScrollButton,
    scrollToBottom,
    autoScroll,
  } = useScrollAnchor();

  // Initialize client from saved connection settings
  useEffect(() => {
    let cancelled = false;

    async function initClient() {
      try {
        const settings = await getConnectionSettings();
        if (!cancelled) {
          setClient(createClient(settings));
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load connection settings');
        }
      }
    }

    void initClient();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-scroll when messages change during streaming
  useEffect(() => {
    autoScroll();
  }, [messages, autoScroll]);

  const handleSend = useCallback(
    (content: string) => {
      if (!client) {
        setError('Not connected. Check your connection settings.');
        return;
      }
      setError(null);
      void sendMessage(client, model, content);
    },
    [client, model, sendMessage],
  );

  const handlePromptSuggestion = useCallback(
    (prompt: string) => {
      handleSend(prompt);
    },
    [handleSend],
  );

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Message area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto"
      >
        {hasMessages ? (
          <div className="px-4 py-6 space-y-6 max-w-4xl mx-auto">
            {messages.map((msg, index) => (
              <ChatMessage
                key={msg.id}
                content={msg.content}
                role={msg.role as 'user' | 'assistant'}
                isStreaming={
                  isStreaming &&
                  index === messages.length - 1 &&
                  msg.role === 'assistant'
                }
              />
            ))}
          </div>
        ) : (
          /* Empty state — welcome + prompt suggestions */
          <div className="flex flex-col items-center justify-center h-full px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center max-w-lg"
            >
              <div className="w-16 h-16 rounded-2xl glass flex items-center justify-center mx-auto mb-6">
                <MessageSquare className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold text-text-primary mb-2">
                Chat with your AI
              </h2>
              <p className="text-text-secondary mb-8">
                Running locally on your Mac Studio. Fast, private, and unlimited.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PROMPT_SUGGESTIONS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handlePromptSuggestion(prompt)}
                    disabled={!client}
                    className={cn(
                      'glass-subtle rounded-xl px-4 py-3 text-left text-sm',
                      'text-text-secondary hover:text-text-primary',
                      'transition-colors hover:border-primary/30',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      'flex items-start gap-2',
                    )}
                  >
                    <Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span>{prompt}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}

        {/* Scroll anchor — must be inside the scrollable container */}
        <div ref={anchorRef} className="h-px" />
      </div>

      {/* Scroll to bottom button */}
      <AnimatePresence>
        {showScrollButton && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            onClick={() => scrollToBottom()}
            className={cn(
              'absolute bottom-28 right-8 z-10',
              'glass rounded-full p-2 shadow-lg',
              'hover:bg-primary/10 transition-colors',
            )}
            aria-label="Scroll to bottom"
          >
            <ChevronDown className="w-5 h-5 text-text-primary" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 py-2 text-center text-sm text-neon-red bg-neon-red/10 border-t border-neon-red/20"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        onStop={stop}
        isStreaming={isStreaming}
        disabled={!client}
      />
    </div>
  );
}
