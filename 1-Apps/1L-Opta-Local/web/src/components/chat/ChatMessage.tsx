'use client';

import { memo } from 'react';
import { Streamdown } from 'streamdown';
import { createCodePlugin } from '@streamdown/code';
import { cn } from '@opta/ui';
import { Bot, User } from 'lucide-react';
import { ForkButton } from './ForkButton';

// Custom code plugin with github-dark-default for both light/dark (OLED-only design)
const optaCode = createCodePlugin({
  themes: ['github-dark-default', 'github-dark-default'],
});

interface ChatMessageProps {
  content: string;
  role: 'user' | 'assistant';
  isStreaming?: boolean;
  /** Message index — used by ForkButton to identify the fork point. */
  messageIndex?: number;
  /** Callback when the user clicks fork. Omit to hide fork button. */
  onFork?: (atIndex: number) => void;
}

/**
 * Renders a single chat message.
 *
 * User messages: glass-subtle panel, right-aligned with user icon.
 * Assistant messages: left-aligned, rendered with Streamdown for
 * markdown + syntax highlighting via Shiki.
 */
export const ChatMessage = memo(function ChatMessage({
  content,
  role,
  isStreaming,
  messageIndex,
  onFork,
}: ChatMessageProps) {
  const showFork = onFork != null && messageIndex != null;

  if (role === 'user') {
    return (
      <div className="group relative flex justify-end gap-3">
        {showFork && (
          <ForkButton messageIndex={messageIndex} onFork={onFork} />
        )}
        <div className={cn('glass-subtle rounded-xl px-4 py-3 ml-12 max-w-[80%]')}>
          <p className="text-text-primary whitespace-pre-wrap text-sm leading-relaxed">
            {content}
          </p>
        </div>
        <div className="flex-shrink-0 w-8 h-8 rounded-full glass-subtle flex items-center justify-center mt-1">
          <User className="w-4 h-4 text-text-secondary" />
        </div>
      </div>
    );
  }

  return (
    <div className="group relative flex gap-3">
      {showFork && (
        <ForkButton messageIndex={messageIndex} onFork={onFork} />
      )}
      <div className="flex-shrink-0 w-8 h-8 rounded-full glass flex items-center justify-center mt-1">
        <Bot className="w-4 h-4 text-primary" />
      </div>
      <div className={cn('mr-12 max-w-[80%] min-w-0 prose-invert')}>
        {content ? (
          <Streamdown
            plugins={{ code: optaCode }}
            caret={isStreaming ? 'block' : undefined}
            isAnimating={isStreaming}
            className="text-sm leading-relaxed text-text-primary [&_pre]:glass-subtle [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:my-3 [&_code:not(pre_code)]:glass-subtle [&_code:not(pre_code)]:rounded [&_code:not(pre_code)]:px-1.5 [&_code:not(pre_code)]:py-0.5 [&_code:not(pre_code)]:text-primary-glow [&_code:not(pre_code)]:text-xs [&_a]:text-primary [&_a]:underline [&_a:hover]:text-primary-glow [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_p]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-text-secondary [&_table]:w-full [&_th]:text-left [&_th]:p-2 [&_th]:border-b [&_th]:border-opta-border [&_td]:p-2 [&_td]:border-b [&_td]:border-opta-border/50 [&_hr]:border-opta-border [&_hr]:my-4"
          >
            {content}
          </Streamdown>
        ) : isStreaming ? (
          <div className="flex items-center gap-1.5 py-2">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
});
