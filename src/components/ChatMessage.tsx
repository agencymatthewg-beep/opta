/**
 * ChatMessage component for displaying individual chat messages.
 *
 * Displays message bubbles with role-based styling (user vs assistant).
 * Supports streaming indicator for assistant messages being generated.
 * Shows backend badge (Local/Claude) for assistant messages.
 */

import { cn } from '@/lib/utils';

export interface ChatMessageProps {
  /** Message role - determines styling and alignment */
  role: 'user' | 'assistant';
  /** Message content to display */
  content: string;
  /** Whether the message is currently being streamed (shows typing indicator) */
  isStreaming?: boolean;
  /** Which backend generated this message (only shown for assistant) */
  backend?: 'local' | 'cloud';
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
 * Backend badge showing which AI generated the response.
 */
function BackendBadge({ backend }: { backend: 'local' | 'cloud' }) {
  const isCloud = backend === 'cloud';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium',
        isCloud
          ? 'bg-primary/15 text-primary border border-primary/30'
          : 'bg-muted text-muted-foreground border border-border/50'
      )}
    >
      {isCloud ? (
        <>
          <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
          </svg>
          Claude
        </>
      ) : (
        <>
          <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8" />
            <path d="M12 17v4" />
          </svg>
          Local
        </>
      )}
    </span>
  );
}

/**
 * ChatMessage component displaying a single message bubble.
 *
 * @example
 * ```tsx
 * <ChatMessage role="user" content="How can I optimize my PC?" />
 * <ChatMessage role="assistant" content="Here are some tips..." backend="local" />
 * <ChatMessage role="assistant" content="" isStreaming={true} />
 * ```
 */
function ChatMessage({ role, content, isStreaming = false, backend }: ChatMessageProps) {
  const isUser = role === 'user';

  return (
    <div
      className={cn(
        'flex w-full mb-3',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div className={cn('max-w-[85%]', !isUser && 'flex flex-col gap-1')}>
        {/* Backend badge for assistant messages */}
        {!isUser && backend && !isStreaming && (
          <div className="flex justify-start ml-1">
            <BackendBadge backend={backend} />
          </div>
        )}
        <div
          className={cn(
            'px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
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
    </div>
  );
}

export default ChatMessage;
