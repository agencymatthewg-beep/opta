'use client';

/**
 * CollectionList — Sidebar listing all RAG collections.
 *
 * Displays collection name, document count, and embedding dimensions
 * as a badge. Supports selection (active highlight), deletion with
 * confirmation, refresh, and a "New Collection" CTA that triggers
 * the IngestPanel.
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database,
  Trash2,
  RefreshCw,
  Plus,
  FileText,
  Loader2,
} from 'lucide-react';
import { cn, Button, Badge } from '@opta/ui';
import type { RagCollectionInfo } from '@/types/rag';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CollectionListProps {
  /** All available collections */
  collections: RagCollectionInfo[];
  /** Currently selected collection name (null = none) */
  selectedCollection: string | null;
  /** Called when user selects a collection */
  onSelect: (name: string) => void;
  /** Called when user deletes a collection */
  onDelete: (name: string) => void;
  /** Called when user clicks "New Collection" */
  onNewCollection: () => void;
  /** Called when user clicks refresh */
  onRefresh: () => void;
  /** Whether collections are loading */
  isLoading: boolean;
  /** Additional class names */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CollectionList({
  collections,
  selectedCollection,
  onSelect,
  onDelete,
  onNewCollection,
  onRefresh,
  isLoading,
  className,
}: CollectionListProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDelete = useCallback(
    (e: React.MouseEvent, name: string) => {
      e.stopPropagation();
      if (confirmDeleteId === name) {
        onDelete(name);
        setConfirmDeleteId(null);
      } else {
        setConfirmDeleteId(name);
        // Auto-reset confirmation after 3 seconds
        setTimeout(() => setConfirmDeleteId(null), 3000);
      }
    },
    [confirmDeleteId, onDelete],
  );

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-opta-border">
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest">
          Collections
        </h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            aria-label="Refresh collections"
            className="h-7 w-7 p-0"
          >
            <RefreshCw
              className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')}
            />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onNewCollection}
            aria-label="New collection"
            className="h-7 w-7 p-0"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Collection list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1 no-scrollbar">
        {isLoading && collections.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
          </div>
        )}

        {!isLoading && collections.length === 0 && (
          <div className="text-center py-8 px-3">
            <Database className="mx-auto h-8 w-8 text-text-muted mb-3" />
            <p className="text-sm text-text-secondary mb-1">No collections</p>
            <p className="text-xs text-text-muted mb-4">
              Index your first documents to get started
            </p>
            <Button
              variant="glass"
              size="sm"
              onClick={onNewCollection}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Ingest Documents
            </Button>
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {collections.map((collection) => {
            const isSelected = selectedCollection === collection.name;
            const isConfirming = confirmDeleteId === collection.name;

            return (
              <motion.button
                key={collection.name}
                layout
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                onClick={() => onSelect(collection.name)}
                className={cn(
                  'w-full text-left rounded-lg px-3 py-2.5 group',
                  'transition-colors',
                  isSelected
                    ? 'bg-primary/15 border border-primary/30'
                    : 'hover:bg-primary/5 border border-transparent',
                )}
                aria-label={`Select collection: ${collection.name}`}
                aria-pressed={isSelected}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'text-sm font-medium truncate',
                        isSelected ? 'text-text-primary' : 'text-text-secondary',
                      )}
                    >
                      {collection.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center gap-1 text-xs text-text-muted">
                        <FileText className="w-3 h-3" />
                        {collection.document_count}
                      </span>
                      <Badge variant="default" size="sm">
                        {collection.embedding_dimensions}d
                      </Badge>
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleDelete(e, collection.name)}
                    className={cn(
                      'flex-shrink-0 p-1 rounded transition-colors',
                      'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
                      isConfirming
                        ? 'bg-neon-red/20 text-neon-red opacity-100'
                        : 'text-text-muted hover:text-neon-red hover:bg-neon-red/10',
                    )}
                    aria-label={
                      isConfirming ? 'Confirm delete' : 'Delete collection'
                    }
                    title={
                      isConfirming ? 'Click again to confirm' : 'Delete collection'
                    }
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
