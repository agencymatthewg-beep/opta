'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import { Streamdown } from 'streamdown';
import { createCodePlugin } from '@streamdown/code';
import { cn } from '@opta/ui';
import { Bot, AlertCircle, Clock, Hash } from 'lucide-react';

// ---------------------------------------------------------------------------
// Streamdown code plugin (same config as ChatMessage)
// ---------------------------------------------------------------------------

const optaCode = createCodePlugin({
  themes: ['github-dark-default', 'github-dark-default'],
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ArenaPanelProps {
  modelId: string;
  content: string;
  isStreaming: boolean;
  error: string | null;
  tokenCount: number;
  elapsedMs: number | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Single response panel for the arena view.
 *
 * Displays a model's streaming response inside a glass card with:
 * - Model name header with bot icon
 * - Markdown-rendered content via Streamdown
 * - Loading shimmer while waiting for the first token
 * - Error state with red border
 * - Footer with token count and elapsed time (tabular-nums)
 */
export const ArenaPanel = memo(function ArenaPanel({
  modelId,
  content,
  isStreaming,
  error,
  tokenCount,
  elapsedMs,
}: ArenaPanelProps) {
  const hasContent = content.length > 0;
  const isWaiting = isStreaming && !hasContent;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'glass rounded-2xl flex flex-col min-h-[200px] overflow-hidden',
        error && 'border border-neon-red/40',
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-opta-border">
        <div className="w-7 h-7 rounded-full glass-subtle flex items-center justify-center flex-shrink-0">
          <Bot className="w-3.5 h-3.5 text-primary" />
        </div>
        <span className="text-sm font-semibold text-text-primary truncate">
          {extractModelName(modelId)}
        </span>
        {isStreaming && (
          <span className="ml-auto flex-shrink-0">
            <span className="inline-flex items-center gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1 h-1 rounded-full bg-primary animate-pulse"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </span>
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-3 overflow-y-auto">
        {error ? (
          <div className="flex items-start gap-2 text-neon-red">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
          </div>
        ) : isWaiting ? (
          <WaitingShimmer />
        ) : hasContent ? (
          <Streamdown
            plugins={{ code: optaCode }}
            caret={isStreaming ? 'block' : undefined}
            isAnimating={isStreaming}
            className="text-sm leading-relaxed text-text-primary [&_pre]:glass-subtle [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:my-3 [&_code:not(pre_code)]:glass-subtle [&_code:not(pre_code)]:rounded [&_code:not(pre_code)]:px-1.5 [&_code:not(pre_code)]:py-0.5 [&_code:not(pre_code)]:text-primary-glow [&_code:not(pre_code)]:text-xs [&_a]:text-primary [&_a]:underline [&_a:hover]:text-primary-glow [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_p]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-text-secondary [&_table]:w-full [&_th]:text-left [&_th]:p-2 [&_th]:border-b [&_th]:border-opta-border [&_td]:p-2 [&_td]:border-b [&_td]:border-opta-border/50 [&_hr]:border-opta-border [&_hr]:my-4"
          >
            {content}
          </Streamdown>
        ) : null}
      </div>

      {/* Footer — token count and elapsed time */}
      {(tokenCount > 0 || elapsedMs !== null) && (
        <div className="flex items-center gap-4 px-4 py-2 border-t border-opta-border text-xs text-text-muted">
          {tokenCount > 0 && (
            <span className="flex items-center gap-1 tabular-nums">
              <Hash className="w-3 h-3" />
              {tokenCount} tokens
            </span>
          )}
          {elapsedMs !== null && (
            <span className="flex items-center gap-1 tabular-nums">
              <Clock className="w-3 h-3" />
              {formatElapsed(elapsedMs)}
            </span>
          )}
          {elapsedMs !== null && tokenCount > 0 && (
            <span className="tabular-nums ml-auto">
              {(tokenCount / (elapsedMs / 1000)).toFixed(1)} tok/s
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
});

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function WaitingShimmer() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-3 bg-text-muted/10 rounded-full w-3/4" />
      <div className="h-3 bg-text-muted/10 rounded-full w-5/6" />
      <div className="h-3 bg-text-muted/10 rounded-full w-2/3" />
      <div className="h-3 bg-text-muted/10 rounded-full w-4/5" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract a short display name from a model ID.
 * e.g. "mlx-community/Llama-3-8B-4bit" -> "Llama-3-8B-4bit"
 */
function extractModelName(modelId: string): string {
  const parts = modelId.split('/');
  return parts[parts.length - 1] ?? modelId;
}

/** Format elapsed milliseconds as human-readable. */
function formatElapsed(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
}
