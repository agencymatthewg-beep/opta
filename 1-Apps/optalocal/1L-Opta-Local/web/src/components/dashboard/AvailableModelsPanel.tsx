"use client";

/**
 * AvailableModelsPanel — Browse and manage on-disk models.
 *
 * Fetches client.getAvailableModels() on mount (and on refresh).
 * Shows on-disk models that aren't yet loaded. Each row has:
 *   - Load button → opens ModelLoadDialog with path pre-filled
 *   - Delete button → inline confirmation (no browser confirm())
 *
 * States: loading skeleton, empty state, error state with retry.
 */

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent, Button } from "@opta/ui";
import { cn } from "@opta/ui";
import {
  HardDrive,
  Plus,
  Trash2,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Check,
  Loader2,
} from "lucide-react";
import type { LMXClient } from "@/lib/lmx-client";
import type { AvailableModel } from "@/types/lmx";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AvailableModelsPanelProps {
  /** LMX client — must be non-null to fetch models */
  client: LMXClient | null;
  /**
   * Called when the user wants to load a model.
   * Parent should open ModelLoadDialog with the path pre-filled.
   */
  onLoadModel: (modelPath: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1e9) return `${(bytes / 1e6).toFixed(0)} MB`;
  return `${(bytes / 1e9).toFixed(1)} GB`;
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Skeleton row
// ---------------------------------------------------------------------------

function SkeletonRow() {
  return (
    <div className="flex items-center justify-between border-b border-white/5 px-2 py-3 last:border-0">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className="h-4 w-4 shrink-0 rounded"
          style={{ background: "var(--opta-elevated)", opacity: 0.6 }}
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div
            className="h-3 w-48 max-w-full rounded"
            style={{ background: "var(--opta-elevated)", opacity: 0.6 }}
          />
          <div
            className="h-2.5 w-24 rounded"
            style={{ background: "var(--opta-elevated)", opacity: 0.4 }}
          />
        </div>
      </div>
      <div className="flex gap-1.5 ml-3 shrink-0">
        <div
          className="h-7 w-14 rounded-md"
          style={{ background: "var(--opta-elevated)", opacity: 0.5 }}
        />
        <div
          className="h-7 w-7 rounded-md"
          style={{ background: "var(--opta-elevated)", opacity: 0.4 }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Model row
// ---------------------------------------------------------------------------

interface ModelRowProps {
  model: AvailableModel;
  onLoad: (repoId: string) => void;
  onDelete: (repoId: string) => void;
  isDeleting: boolean;
}

function ModelRow({ model, onLoad, onDelete, isDeleting }: ModelRowProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      className="flex items-center justify-between border-b border-white/5 px-2 py-3 rounded-lg last:border-0"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <HardDrive
          className="h-4 w-4 shrink-0"
          style={{ color: "var(--opta-neon-cyan)" }}
        />
        <div className="min-w-0">
          <p
            className="truncate text-sm font-medium text-text-primary"
            title={model.repo_id}
          >
            {model.repo_id}
          </p>
          <p className="text-xs text-text-muted">
            {formatBytes(model.size_bytes)}
            {model.downloaded_at && (
              <>
                {" · "}
                {formatDate(model.downloaded_at)}
              </>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 ml-3 shrink-0">
        <AnimatePresence mode="wait">
          {confirmDelete ? (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="flex items-center gap-1.5"
            >
              <span className="text-xs text-neon-red font-medium">Delete?</span>
              <Button
                variant="ghost"
                size="sm"
                disabled={isDeleting}
                onClick={() => {
                  onDelete(model.repo_id);
                  setConfirmDelete(false);
                }}
                className={cn(
                  "h-6 w-6 p-0",
                  "border border-neon-red/30 hover:border-neon-red/60",
                  "text-neon-red hover:text-neon-red",
                )}
                aria-label={`Confirm delete ${model.repo_id}`}
              >
                {isDeleting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={isDeleting}
                onClick={() => setConfirmDelete(false)}
                className="h-6 w-6 p-0 text-text-muted hover:text-text-primary"
                aria-label="Cancel delete"
              >
                <AlertTriangle className="h-3 w-3 rotate-180" />
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="actions"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="flex items-center gap-1.5"
            >
              <Button
                variant="glass"
                size="sm"
                onClick={() => onLoad(model.repo_id)}
                aria-label={`Load ${model.repo_id}`}
              >
                <Plus className="mr-1 h-3 w-3" />
                Load
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                className="h-7 w-7 p-0 text-text-muted hover:text-neon-red"
                aria-label={`Delete ${model.repo_id}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AvailableModelsPanel({
  client,
  onLoadModel,
}: AvailableModelsPanelProps) {
  const [models, setModels] = useState<AvailableModel[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch available models
  // ---------------------------------------------------------------------------

  const fetchModels = useCallback(
    async (quiet = false) => {
      if (!client) return;
      setFetchError(null);
      setDeleteError(null);
      if (quiet) {
        setIsRefreshing(true);
      } else {
        setIsFetching(true);
      }
      try {
        const result = await client.getAvailableModels();
        setModels(result);
      } catch (err) {
        setFetchError(
          err instanceof Error
            ? err.message
            : "Failed to load available models",
        );
      } finally {
        setIsFetching(false);
        setIsRefreshing(false);
      }
    },
    [client],
  );

  useEffect(() => {
    fetchModels(false);
  }, [fetchModels]);

  // ---------------------------------------------------------------------------
  // Delete model
  // ---------------------------------------------------------------------------

  const handleDelete = useCallback(
    async (repoId: string) => {
      if (!client) return;
      setDeleteError(null);
      setDeletingId(repoId);
      try {
        await client.deleteModel(repoId);
        setModels((prev) => prev.filter((m) => m.repo_id !== repoId));
      } catch (err) {
        setDeleteError(
          err instanceof Error ? err.message : "Failed to delete model",
        );
      } finally {
        setDeletingId(null);
      }
    },
    [client],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <HardDrive
              className="h-4 w-4"
              style={{ color: "var(--opta-neon-cyan)" }}
            />
            Available Models
          </span>

          {/* Refresh button */}
          <button
            onClick={() => fetchModels(true)}
            disabled={isFetching || isRefreshing}
            className="rounded-md p-1.5 text-text-muted transition-colors hover:text-text-primary disabled:opacity-40"
            aria-label="Refresh available models"
          >
            <motion.span
              animate={isRefreshing ? { rotate: 360 } : { rotate: 0 }}
              transition={
                isRefreshing
                  ? { duration: 1, repeat: Infinity, ease: "linear" }
                  : { duration: 0 }
              }
              className="block"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </motion.span>
          </button>
        </CardTitle>
      </CardHeader>

      <CardContent>
        {/* Delete error banner */}
        <AnimatePresence>
          {deleteError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3 flex items-start gap-2 rounded-lg border border-neon-red/20 bg-neon-red/10 px-3 py-2"
            >
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neon-red" />
              <p className="text-xs text-neon-red">{deleteError}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading skeleton */}
        {isFetching && (
          <div className="space-y-0">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.06 }}
              >
                <SkeletonRow />
              </motion.div>
            ))}
          </div>
        )}

        {/* Fetch error */}
        {!isFetching && fetchError && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-3 py-8 text-center"
          >
            <AlertCircle
              className="h-8 w-8"
              style={{ color: "var(--opta-neon-red)", opacity: 0.7 }}
            />
            <div className="space-y-1">
              <p className="text-sm font-medium text-text-secondary">
                Failed to load models
              </p>
              <p className="text-xs text-text-muted">{fetchError}</p>
            </div>
            <Button
              variant="glass"
              size="sm"
              onClick={() => fetchModels(false)}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Retry
            </Button>
          </motion.div>
        )}

        {/* Empty state */}
        {!isFetching && !fetchError && models.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-3 py-10 text-center"
          >
            <HardDrive
              className="h-8 w-8"
              style={{ color: "var(--opta-text-muted)" }}
            />
            <div className="space-y-1">
              <p className="text-sm font-medium text-text-secondary">
                No models downloaded yet
              </p>
              <p className="text-xs text-text-muted">
                Load a model by path above to download it.
              </p>
            </div>
          </motion.div>
        )}

        {/* Model list */}
        {!isFetching && !fetchError && models.length > 0 && (
          <AnimatePresence mode="popLayout">
            {models.map((model) => (
              <ModelRow
                key={model.repo_id}
                model={model}
                onLoad={onLoadModel}
                onDelete={handleDelete}
                isDeleting={deletingId === model.repo_id}
              />
            ))}
          </AnimatePresence>
        )}
      </CardContent>
    </Card>
  );
}
