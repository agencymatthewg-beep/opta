'use client';

import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { GitBranch, MessageSquare } from 'lucide-react';
import { cn } from '@opta/ui';
import type { BranchNode } from '@/lib/branch-store';

interface BranchTreeProps {
  /** Recursive tree of branch nodes. */
  tree: BranchNode[];
  /** Currently active session ID (highlighted). */
  currentSessionId: string;
  /** Navigate to a different session. */
  onNavigate: (sessionId: string) => void;
}

interface BranchNodeItemProps {
  node: BranchNode;
  currentSessionId: string;
  onNavigate: (sessionId: string) => void;
  depth: number;
}

/**
 * Single node in the branch tree. Renders itself and recurses into children.
 */
function BranchNodeItem({
  node,
  currentSessionId,
  onNavigate,
  depth,
}: BranchNodeItemProps) {
  const isCurrent = node.id === currentSessionId;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ duration: 0.2, delay: depth * 0.05 }}
    >
      <button
        type="button"
        onClick={() => onNavigate(node.id)}
        className={cn(
          'flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg',
          'transition-colors text-sm',
          isCurrent
            ? 'glass text-primary border border-primary/30'
            : 'hover:bg-primary/5 text-text-secondary hover:text-text-primary',
        )}
        style={{ marginLeft: `${depth * 20}px` }}
      >
        {/* Connecting line indicator */}
        {depth > 0 && (
          <span
            className="border-l-2 border-b-2 border-opta-border rounded-bl w-3 h-3 flex-shrink-0"
            aria-hidden="true"
          />
        )}

        <GitBranch
          className={cn(
            'w-3.5 h-3.5 flex-shrink-0',
            isCurrent ? 'text-primary' : 'text-text-muted',
          )}
        />

        <span className="truncate flex-1 min-w-0">{node.title}</span>

        <span
          className={cn(
            'flex items-center gap-1 text-xs flex-shrink-0',
            isCurrent ? 'text-primary/70' : 'text-text-muted',
          )}
        >
          <MessageSquare className="w-3 h-3" />
          {node.messageCount}
        </span>
      </button>

      {/* Recursive children */}
      {node.children.length > 0 && (
        <div className="relative">
          {/* Vertical connecting line */}
          <div
            className="absolute left-0 top-0 bottom-0 border-l border-opta-border/50"
            style={{ marginLeft: `${(depth + 1) * 20 + 12}px` }}
            aria-hidden="true"
          />
          <AnimatePresence>
            {node.children.map((child) => (
              <BranchNodeItem
                key={child.id}
                node={child}
                currentSessionId={currentSessionId}
                onNavigate={onNavigate}
                depth={depth + 1}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}

/**
 * Visual branch tree showing the fork structure of a session.
 *
 * Renders an indented list with connecting lines. The current session
 * is highlighted with the primary color. Clicking any node navigates
 * to that branch.
 */
export function BranchTree({
  tree,
  currentSessionId,
  onNavigate,
}: BranchTreeProps) {
  if (tree.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25 }}
      className="glass-subtle rounded-xl p-3 mx-4 mb-2 overflow-hidden"
    >
      <div className="flex items-center gap-2 mb-2 px-3">
        <GitBranch className="w-4 h-4 text-primary" />
        <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
          Branches
        </span>
      </div>

      <LayoutGroup>
        <AnimatePresence>
          {tree.map((node) => (
            <BranchNodeItem
              key={node.id}
              node={node}
              currentSessionId={currentSessionId}
              onNavigate={onNavigate}
              depth={0}
            />
          ))}
        </AnimatePresence>
      </LayoutGroup>
    </motion.div>
  );
}
