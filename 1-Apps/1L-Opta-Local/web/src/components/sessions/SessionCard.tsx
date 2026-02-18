'use client';

/**
 * SessionCard — Glass card displaying a CLI session summary.
 *
 * Shows title, model badge, relative date (via date-fns), message count,
 * and tags. Click to resume navigates to /chat/[id]. Delete button with
 * confirmation removes the session via LMX API.
 */

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Clock, Tag, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn, Badge } from '@opta/ui';
import type { SessionSummary } from '@/types/lmx';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SessionCardProps {
  /** Session summary data */
  session: SessionSummary;
  /** Called when user clicks to resume the session */
  onResume: (id: string) => void;
  /** Called when user confirms deletion */
  onDelete?: (id: string) => void;
  /** Additional class names */
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Truncate a string to maxLen characters, appending ellipsis if truncated. */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '\u2026';
}

/** Extract a short model name from a full HuggingFace-style path. */
function shortModelName(model: string): string {
  // "mlx-community/Qwen2.5-Coder-32B-Instruct-4bit" -> "Qwen2.5-Coder-32B-Instruct-4bit"
  const parts = model.split('/');
  const name = parts.length > 1 ? parts[parts.length - 1]! : model;
  return truncate(name, 30);
}

/** Format an ISO date as a human-readable relative string. */
function relativeDate(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SessionCard({
  session,
  onResume,
  onDelete,
  className,
}: SessionCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (confirmDelete) {
        onDelete?.(session.id);
        setConfirmDelete(false);
      } else {
        setConfirmDelete(true);
        // Auto-reset confirmation after 3 seconds
        setTimeout(() => setConfirmDelete(false), 3000);
      }
    },
    [confirmDelete, onDelete, session.id],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onResume(session.id);
      }
    },
    [onResume, session.id],
  );

  const title = session.title || 'Untitled session';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      onClick={() => onResume(session.id)}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Resume session: ${title}`}
      className={cn(
        'glass-subtle rounded-xl px-5 py-4 cursor-pointer',
        'transition-colors hover:border-primary/40',
        'group relative',
        className,
      )}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-sm font-semibold text-text-primary leading-snug">
          {truncate(title, 60)}
        </h3>

        {onDelete && (
          <button
            onClick={handleDelete}
            className={cn(
              'flex-shrink-0 p-1.5 rounded-lg transition-colors',
              'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
              confirmDelete
                ? 'bg-neon-red/20 text-neon-red'
                : 'text-text-muted hover:text-neon-red hover:bg-neon-red/10',
            )}
            aria-label={confirmDelete ? 'Confirm delete' : 'Delete session'}
            title={confirmDelete ? 'Click again to confirm' : 'Delete session'}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Metadata row */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary">
        {/* Model badge */}
        {session.model && (
          <Badge variant="purple" size="sm">
            {shortModelName(session.model)}
          </Badge>
        )}

        {/* Message count */}
        <span className="inline-flex items-center gap-1">
          <MessageSquare className="w-3 h-3 text-text-muted" />
          {session.message_count}
        </span>

        {/* Relative date */}
        <span className="inline-flex items-center gap-1">
          <Clock className="w-3 h-3 text-text-muted" />
          {relativeDate(session.updated)}
        </span>
      </div>

      {/* Tags */}
      {session.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <Tag className="w-3 h-3 text-text-muted flex-shrink-0" />
          {session.tags.map((tag) => (
            <Badge key={tag} variant="default" size="sm">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </motion.div>
  );
}
