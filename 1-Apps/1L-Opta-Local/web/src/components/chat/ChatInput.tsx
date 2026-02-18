'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { cn } from '@opta/ui';
import { SendHorizontal, Square } from 'lucide-react';
import { useClipboardDetector } from '@/hooks/useClipboardDetector';
import { ClipboardSuggestion } from './ClipboardSuggestion';

interface ChatInputProps {
  onSend: (content: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

/**
 * Multiline chat input with send/stop button.
 *
 * - Submit on Enter (Shift+Enter for newline)
 * - Auto-resizes textarea height up to a max
 * - Shows stop button (Square) when streaming, send button (SendHorizontal) otherwise
 * - Auto-focuses on mount
 */
export function ChatInput({ onSend, onStop, isStreaming, disabled }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Clipboard content detection for smart suggestions
  const { detectedType, pastedContent, suggestions, icon, label, dismiss } =
    useClipboardDetector(textareaRef);

  // Handle suggestion selection — fill input with formatted prompt + content
  const handleSuggestionSelect = useCallback(
    (prompt: string, content: string) => {
      const formatted = `${prompt}:\n\n${content}`;
      setValue(formatted);
      dismiss();
      // Refocus textarea so user can review/send
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    },
    [dismiss],
  );

  // Auto-focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Auto-resize textarea based on content
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    // Cap at ~6 lines (roughly 144px)
    textarea.style.height = `${Math.min(textarea.scrollHeight, 144)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming || disabled) return;
    onSend(trimmed);
    setValue('');
    // Reset height after clearing
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    });
  }, [value, isStreaming, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const canSend = value.trim().length > 0 && !isStreaming && !disabled;

  return (
    <div className="border-t border-opta-border px-4 py-3">
      {/* Clipboard suggestion panel — floats above input */}
      <AnimatePresence>
        {detectedType && pastedContent && icon && label && (
          <ClipboardSuggestion
            type={detectedType}
            icon={icon}
            label={label}
            suggestions={suggestions}
            pastedContent={pastedContent}
            onSelect={handleSuggestionSelect}
            onDismiss={dismiss}
          />
        )}
      </AnimatePresence>

      <div className="glass-subtle rounded-xl flex items-end gap-2 px-4 py-2 max-w-4xl mx-auto">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message your AI..."
          disabled={isStreaming || disabled}
          rows={1}
          className={cn(
            'flex-1 bg-transparent outline-none text-text-primary placeholder:text-text-muted',
            'text-sm leading-relaxed resize-none py-1',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            className={cn(
              'flex-shrink-0 p-2 rounded-lg transition-colors',
              'text-neon-red hover:text-neon-red/80 hover:bg-neon-red/10',
            )}
            aria-label="Stop generating"
          >
            <Square className="w-5 h-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSend}
            className={cn(
              'flex-shrink-0 p-2 rounded-lg transition-colors',
              canSend
                ? 'text-primary hover:text-primary-glow hover:bg-primary/10'
                : 'text-text-muted cursor-not-allowed',
            )}
            aria-label="Send message"
          >
            <SendHorizontal className="w-5 h-5" />
          </button>
        )}
      </div>
      <p className="text-center text-xs text-text-muted mt-2 max-w-4xl mx-auto">
        AI runs locally on your Mac Studio. Responses may vary by model.
      </p>
    </div>
  );
}
