/**
 * ChatInput component for sending messages to the AI assistant.
 *
 * Features auto-resizing textarea, Enter to send (Shift+Enter for newline),
 * and disabled state while waiting for response.
 */

import { useState, useRef, useCallback, KeyboardEvent, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ChatInputProps {
  /** Callback when user sends a message */
  onSend: (message: string) => void;
  /** Whether the input is disabled (e.g., waiting for response) */
  disabled?: boolean;
  /** Placeholder text for the input */
  placeholder?: string;
}

/**
 * Send icon component.
 */
function SendIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
      />
    </svg>
  );
}

/**
 * ChatInput component with auto-resize and keyboard shortcuts.
 *
 * @example
 * ```tsx
 * <ChatInput
 *   onSend={(msg) => console.log('Sent:', msg)}
 *   disabled={isLoading}
 *   placeholder="Ask a question..."
 * />
 * ```
 */
function ChatInput({
  onSend,
  disabled = false,
  placeholder = 'Ask about PC optimization...',
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Auto-resize textarea based on content.
   */
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const maxHeight = 150; // Max 150px height
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    }
  }, []);

  /**
   * Handle input change.
   */
  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    adjustHeight();
  };

  /**
   * Send the message if valid.
   */
  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setValue('');
      // Reset height after sending
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  }, [value, disabled, onSend]);

  /**
   * Handle keyboard shortcuts.
   * Enter = send, Shift+Enter = newline
   */
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <div className="flex items-end gap-2 p-3 bg-background/80 border-t border-border/50">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className={cn(
          'flex-1 resize-none bg-card/50 border border-border/50 rounded-xl px-4 py-2.5',
          'text-sm text-foreground placeholder:text-muted-foreground/60',
          'focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20',
          'transition-all duration-200',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'min-h-[42px] max-h-[150px]'
        )}
      />
      <Button
        onClick={handleSend}
        disabled={!canSend}
        size="icon"
        className={cn(
          'h-[42px] w-[42px] rounded-xl shrink-0',
          'transition-all duration-200',
          canSend && 'glow-sm'
        )}
      >
        <SendIcon className="w-5 h-5" />
        <span className="sr-only">Send message</span>
      </Button>
    </div>
  );
}

export default ChatInput;
