/**
 * ChatMessage component for displaying individual chat messages.
 *
 * Displays message bubbles with role-based styling (user vs assistant).
 * Supports streaming indicator for assistant messages being generated.
 */

import { cn } from '@/lib/utils';

export interface ChatMessageProps {
  /** Message role - determines styling and alignment */
  role: 'user' | 'assistant';
  /** Message content to display */
  content: string;
  /** Whether the message is currently being streamed (shows typing indicator) */
  isStreaming?: boolean;
}

/**
 * Typing indicator with animated dots.
 */
function TypingIndicator() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
      <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
      <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" />
    </span>
  );
}

/**
 * ChatMessage component displaying a single message bubble.
 *
 * @example
 * ```tsx
 * <ChatMessage role="user" content="How can I optimize my PC?" />
 * <ChatMessage role="assistant" content="Here are some tips..." />
 * <ChatMessage role="assistant" content="" isStreaming={true} />
 * ```
 */
function ChatMessage({ role, content, isStreaming = false }: ChatMessageProps) {
  const isUser = role === 'user';

  return (
    <div
      className={cn(
        'flex w-full mb-3',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
          'shadow-sm transition-all duration-200',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-md'
            : 'bg-card border border-border/50 text-foreground rounded-bl-md'
        )}
      >
        {isStreaming && !content ? (
          <TypingIndicator />
        ) : (
          <div className="whitespace-pre-wrap break-words">{content}</div>
        )}
      </div>
    </div>
  );
}

export default ChatMessage;
