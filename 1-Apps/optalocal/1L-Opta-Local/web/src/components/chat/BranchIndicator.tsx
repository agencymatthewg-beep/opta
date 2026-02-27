'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { GitBranch, ArrowUpRight, Check, Pencil } from 'lucide-react';
import { cn } from '@opta/ui';
import type { BranchableSession } from '@/lib/branch-store';

interface BranchIndicatorProps {
  /** Parent session ID. */
  parentId: string;
  /** Title of the parent session. */
  parentTitle: string;
  /** Message index where this branch was created. */
  branchPoint: number;
  /** Other branches from the same parent (siblings). */
  siblings: BranchableSession[];
  /** Current branch label (user-editable). */
  currentBranchLabel?: string;
  /** Callback when the user edits the branch label. */
  onLabelChange: (label: string) => void;
  /** Navigate to a different session. */
  onNavigate: (sessionId: string) => void;
}

/**
 * Compact horizontal indicator shown at the top of chat when viewing
 * a branched session. Displays parent link, branch label (editable),
 * and sibling branches.
 */
export function BranchIndicator({
  parentId,
  parentTitle,
  branchPoint,
  siblings,
  currentBranchLabel,
  onLabelChange,
  onNavigate,
}: BranchIndicatorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [labelValue, setLabelValue] = useState(currentBranchLabel ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleLabelSubmit = useCallback(() => {
    const trimmed = labelValue.trim();
    if (trimmed && trimmed !== currentBranchLabel) {
      onLabelChange(trimmed);
    }
    setIsEditing(false);
  }, [labelValue, currentBranchLabel, onLabelChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleLabelSubmit();
      } else if (e.key === 'Escape') {
        setLabelValue(currentBranchLabel ?? '');
        setIsEditing(false);
      }
    },
    [handleLabelSubmit, currentBranchLabel],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="glass-subtle rounded-xl px-4 py-2.5 mx-4 mt-4 mb-2"
    >
      <div className="flex items-center gap-3 flex-wrap text-sm">
        {/* Branch icon */}
        <GitBranch className="w-4 h-4 text-primary flex-shrink-0" />

        {/* Parent link */}
        <span className="text-text-secondary">
          Branched from{' '}
          <button
            type="button"
            onClick={() => onNavigate(parentId)}
            className="text-primary hover:text-primary-glow underline underline-offset-2 transition-colors"
          >
            {parentTitle}
          </button>
          {' '}at message {branchPoint + 1}
        </span>

        {/* Editable branch label */}
        <span className="text-text-muted">|</span>
        {isEditing ? (
          <span className="flex items-center gap-1.5">
            <input
              ref={inputRef}
              type="text"
              value={labelValue}
              onChange={(e) => setLabelValue(e.target.value)}
              onBlur={handleLabelSubmit}
              onKeyDown={handleKeyDown}
              placeholder="Branch label..."
              className={cn(
                'bg-transparent border border-primary/30 rounded px-2 py-0.5',
                'text-sm text-text-primary placeholder:text-text-muted',
                'outline-none focus:border-primary',
                'w-40',
              )}
            />
            <button
              type="button"
              onClick={handleLabelSubmit}
              className="p-0.5 text-neon-green hover:text-neon-green/80 transition-colors"
              aria-label="Save label"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => {
              setLabelValue(currentBranchLabel ?? '');
              setIsEditing(true);
            }}
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded',
              'text-text-secondary hover:text-text-primary hover:bg-primary/10',
              'transition-colors text-xs',
            )}
          >
            {currentBranchLabel ? (
              <span className="italic">{currentBranchLabel}</span>
            ) : (
              <span className="text-text-muted">Add label</span>
            )}
            <Pencil className="w-3 h-3" />
          </button>
        )}

        {/* Sibling branches */}
        {siblings.length > 0 && (
          <>
            <span className="text-text-muted">|</span>
            <span className="text-text-muted text-xs">
              {siblings.length} sibling{siblings.length === 1 ? '' : 's'}:
            </span>
            {siblings.map((sibling) => (
              <button
                key={sibling.id}
                type="button"
                onClick={() => onNavigate(sibling.id)}
                className={cn(
                  'flex items-center gap-1 px-2 py-0.5 rounded',
                  'text-xs text-text-secondary hover:text-text-primary',
                  'hover:bg-primary/10 transition-colors',
                )}
                title={sibling.branchLabel ?? sibling.title}
              >
                <ArrowUpRight className="w-3 h-3" />
                <span className="max-w-[100px] truncate">
                  {sibling.branchLabel ?? sibling.title}
                </span>
              </button>
            ))}
          </>
        )}
      </div>
    </motion.div>
  );
}
