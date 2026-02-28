"use client";

/**
 * ModelLoadDialog — Enhanced glass panel for loading / downloading models.
 *
 * Supports full download flow:
 *   1. Submit model path → calls client.loadModelFull()
 *   2. If 202 / download_required → show inline download confirmation
 *   3. On confirm → calls client.confirmModelDownload(token) → polls progress
 *   4. Progress bar (Framer Motion) while downloading
 *   5. On completion → automatically proceeds to load
 *
 * Advanced options (collapsible): backend selector, keep-alive, max context,
 * auto-download toggle.
 *
 * Falls back to onLoad() callback path if no client is provided.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent, Button } from "@opta/ui";
import {
  Download,
  Loader2,
  AlertCircle,
  X,
  ChevronDown,
  ChevronRight,
  HardDrive,
  Check,
} from "lucide-react";
import { cn } from "@opta/ui";
import type { LMXClient } from "@/lib/lmx-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdvancedLoadOptions {
  backend?: string;
  keep_alive_sec?: number;
  max_context_length?: number;
  auto_download?: boolean;
}

interface ModelLoadDialogProps {
  /** Whether this panel is visible */
  isOpen: boolean;
  /** Whether a model load is currently in progress (external state) */
  isLoading: boolean;
  /**
   * Fallback load callback — used when no client is provided.
   * When client is provided the dialog manages the full load/download flow internally.
   */
  onLoad: (
    modelPath: string,
    quantization?: string,
    options?: AdvancedLoadOptions,
  ) => Promise<void>;
  /** Called when user dismisses the panel */
  onClose: () => void;
  /** LMX client — enables full download flow. Falls back to onLoad if absent. */
  client?: LMXClient | null;
  /** Pre-fill the model path input (e.g. when triggered from AvailableModelsPanel) */
  prefillPath?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUANTIZATION_OPTIONS = [
  { value: "", label: "Default" },
  { value: "4bit", label: "4-bit" },
  { value: "8bit", label: "8-bit" },
] as const;

const BACKEND_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "mlx", label: "MLX (Apple Silicon)" },
  { value: "gguf", label: "GGUF (llama.cpp)" },
] as const;

type DialogPhase =
  | "idle"
  | "loading"
  | "download_confirm"
  | "downloading"
  | "download_complete"
  | "error";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1e9) return `${(bytes / 1e6).toFixed(0)} MB`;
  return `${(bytes / 1e9).toFixed(1)} GB`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ModelLoadDialog({
  onLoad,
  isLoading,
  isOpen,
  onClose,
  client,
  prefillPath,
}: ModelLoadDialogProps) {
  // Form state
  const [modelPath, setModelPath] = useState("");
  const [quantization, setQuantization] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Sync prefillPath into the input whenever it changes
  useEffect(() => {
    if (prefillPath) setModelPath(prefillPath);
  }, [prefillPath]);

  // Advanced options (collapsed by default)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [backend, setBackend] = useState("auto");
  const [keepAliveSec, setKeepAliveSec] = useState(3600);
  const [maxContextLength, setMaxContextLength] = useState("");
  const [autoDownload, setAutoDownload] = useState(true);

  // Download flow state
  const [phase, setPhase] = useState<DialogPhase>("idle");
  const [confirmToken, setConfirmToken] = useState<string | null>(null);
  // downloadId / downloadCompleted are non-display tracking values — use refs to avoid re-renders
  const downloadIdRef = useRef<string | null>(null);
  const downloadCompletedRef = useRef(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadTotal, setDownloadTotal] = useState<number | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clear poll on unmount / close
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Reset when dialog closes
  useEffect(() => {
    if (!isOpen) {
      if (pollRef.current) clearInterval(pollRef.current);
      setPhase("idle");
      setError(null);
      setConfirmToken(null);
      downloadIdRef.current = null;
      setDownloadProgress(0);
      setDownloadTotal(null);
      downloadCompletedRef.current = false;
    }
  }, [isOpen]);

  // ---------------------------------------------------------------------------
  // Poll download progress
  // ---------------------------------------------------------------------------

  const startPolling = useCallback(
    (dlId: string) => {
      if (!client) return;

      const poll = async () => {
        try {
          const progress = await client.getDownloadProgress(dlId);
          setDownloadProgress(progress.percent);
          if (progress.total_bytes) setDownloadTotal(progress.total_bytes);

          if (progress.status === "completed") {
            if (pollRef.current) clearInterval(pollRef.current);
            downloadCompletedRef.current = true;
            setPhase("download_complete");
            // Auto-proceed to load after a brief success flash
            setTimeout(async () => {
              try {
                await client.loadModelFull({
                  model_path: modelPath.trim(),
                  quantization: quantization || undefined,
                  backend: backend !== "auto" ? backend : undefined,
                  keep_alive_sec: keepAliveSec,
                  max_context_length: maxContextLength
                    ? Number(maxContextLength)
                    : undefined,
                  auto_download: false, // already downloaded
                });
                setModelPath("");
                setQuantization("");
                setPhase("idle");
                onClose();
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : "Failed to load model after download",
                );
                setPhase("error");
              }
            }, 1200);
          } else if (progress.status === "failed") {
            if (pollRef.current) clearInterval(pollRef.current);
            setError(progress.error ?? "Download failed");
            setPhase("error");
          }
        } catch (err) {
          if (pollRef.current) clearInterval(pollRef.current);
          setError(
            err instanceof Error
              ? err.message
              : "Failed to fetch download progress",
          );
          setPhase("error");
        }
      };

      poll(); // immediate first check
      pollRef.current = setInterval(poll, 1000);
    },
    [
      client,
      modelPath,
      quantization,
      backend,
      keepAliveSec,
      maxContextLength,
      onClose,
    ],
  );

  // ---------------------------------------------------------------------------
  // Confirm download
  // ---------------------------------------------------------------------------

  const handleConfirmDownload = useCallback(async () => {
    if (!client || !confirmToken) return;
    setPhase("downloading");
    setDownloadProgress(0);
    try {
      const result = await client.confirmModelDownload(confirmToken);
      // result should contain download_id
      const dlId =
        (result as { download_id?: string }).download_id ?? confirmToken;
      downloadIdRef.current = dlId;
      startPolling(dlId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start download");
      setPhase("error");
    }
  }, [client, confirmToken, startPolling]);

  // ---------------------------------------------------------------------------
  // Submit load form
  // ---------------------------------------------------------------------------

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = modelPath.trim();
      if (!trimmed) return;

      setError(null);

      // No client — fall back to parent callback
      if (!client) {
        setPhase("loading");
        try {
          const opts: AdvancedLoadOptions = {
            backend: backend !== "auto" ? backend : undefined,
            keep_alive_sec: keepAliveSec,
            max_context_length: maxContextLength
              ? Number(maxContextLength)
              : undefined,
            auto_download: autoDownload,
          };
          await onLoad(trimmed, quantization || undefined, opts);
          setModelPath("");
          setQuantization("");
          setPhase("idle");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to load model");
          setPhase("error");
        }
        return;
      }

      // Full client path
      setPhase("loading");
      try {
        const result = await client.loadModelFull({
          model_path: trimmed,
          quantization: quantization || undefined,
          backend: backend !== "auto" ? backend : undefined,
          keep_alive_sec: keepAliveSec,
          max_context_length: maxContextLength
            ? Number(maxContextLength)
            : undefined,
          auto_download: autoDownload,
        });

        if (
          result.status === "download_required" &&
          result.confirmation_token
        ) {
          // Prompt user to confirm download
          setConfirmToken(result.confirmation_token);
          const approxBytes = result.model?.context_length
            ? result.model.context_length * 2 * 1024 * 1024 // rough estimate
            : null;
          if (approxBytes) setDownloadTotal(approxBytes);
          setPhase("download_confirm");
        } else {
          // Successfully loaded
          setModelPath("");
          setQuantization("");
          setPhase("idle");
          onClose();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load model");
        setPhase("error");
      }
    },
    [
      modelPath,
      quantization,
      client,
      onLoad,
      onClose,
      backend,
      keepAliveSec,
      maxContextLength,
      autoDownload,
    ],
  );

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const isSubmitting = phase === "loading";
  const isEffectivelyLoading = isLoading || isSubmitting;
  const canSubmit =
    modelPath.trim().length > 0 &&
    !isEffectivelyLoading &&
    phase !== "downloading";

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -8, height: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="overflow-hidden"
        >
          <Card variant="glass">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <Download className="h-4 w-4 text-neon-cyan" />
                  Load Model
                </span>
                <button
                  onClick={onClose}
                  className="rounded-md p-1 text-text-muted transition-colors hover:text-text-primary"
                  aria-label="Close load model panel"
                  disabled={phase === "downloading"}
                >
                  <X className="h-4 w-4" />
                </button>
              </CardTitle>
            </CardHeader>

            <CardContent>
              {/* ── Download confirmation phase ── */}
              <AnimatePresence mode="wait">
                {phase === "download_confirm" && (
                  <motion.div
                    key="download-confirm"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ type: "spring", stiffness: 280, damping: 28 }}
                    className="space-y-4"
                  >
                    <div className="rounded-lg border border-neon-amber/20 bg-neon-amber/10 px-4 py-3 space-y-1">
                      <p className="text-sm font-medium text-neon-amber flex items-center gap-2">
                        <HardDrive className="h-4 w-4 shrink-0" />
                        Model not on disk
                      </p>
                      <p className="text-xs text-text-secondary">
                        {downloadTotal
                          ? `Download ~${formatBytes(downloadTotal)} to continue?`
                          : "Download this model to continue?"}
                      </p>
                      <p className="text-xs text-text-muted font-mono truncate">
                        {modelPath}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        className="flex-1"
                        onClick={handleConfirmDownload}
                      >
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                        Download
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setPhase("idle");
                          setConfirmToken(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* ── Download progress phase ── */}
                {(phase === "downloading" || phase === "download_complete") && (
                  <motion.div
                    key="download-progress"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ type: "spring", stiffness: 280, damping: 28 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-text-primary flex items-center gap-2">
                        {phase === "download_complete" ? (
                          <>
                            <Check className="h-4 w-4 text-neon-green" />
                            Download complete — loading…
                          </>
                        ) : (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin text-neon-cyan" />
                            Downloading…
                          </>
                        )}
                      </p>
                      <span className="text-xs font-mono text-text-secondary">
                        {Math.round(downloadProgress)}%
                      </span>
                    </div>

                    {/* Progress bar track */}
                    <div
                      className="h-1.5 w-full rounded-full overflow-hidden"
                      style={{ background: "var(--opta-chart-track)" }}
                    >
                      <motion.div
                        className="h-full rounded-full"
                        style={{
                          background:
                            phase === "download_complete"
                              ? "var(--opta-neon-green)"
                              : "var(--opta-neon-cyan)",
                          boxShadow:
                            phase === "download_complete"
                              ? "var(--glow-green-sm)"
                              : "var(--glow-cyan-sm)",
                        }}
                        initial={{ width: "0%" }}
                        animate={{ width: `${downloadProgress}%` }}
                        transition={{
                          type: "spring",
                          stiffness: 180,
                          damping: 30,
                        }}
                      />
                    </div>

                    <p className="text-xs text-text-muted font-mono truncate">
                      {modelPath}
                    </p>
                  </motion.div>
                )}

                {/* ── Standard form phase ── */}
                {(phase === "idle" ||
                  phase === "loading" ||
                  phase === "error") && (
                  <motion.form
                    key="load-form"
                    onSubmit={handleSubmit}
                    className="space-y-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    {/* Model path input */}
                    <div>
                      <label
                        htmlFor="model-path"
                        className="mb-1.5 block text-xs font-medium text-text-secondary"
                      >
                        Model Path
                      </label>
                      <input
                        id="model-path"
                        type="text"
                        value={modelPath}
                        onChange={(e) => setModelPath(e.target.value)}
                        placeholder="mlx-community/Qwen2.5-Coder-32B-Instruct-4bit"
                        disabled={isEffectivelyLoading}
                        className={cn(
                          "w-full rounded-lg border bg-opta-surface px-3 py-2 text-sm text-text-primary",
                          "placeholder:text-text-muted",
                          "focus:outline-none focus:ring-1 focus:ring-primary",
                          "disabled:opacity-50",
                          "border-opta-border focus:border-primary",
                        )}
                      />
                    </div>

                    {/* Quantization select */}
                    <div>
                      <label
                        htmlFor="quantization"
                        className="mb-1.5 block text-xs font-medium text-text-secondary"
                      >
                        Quantization
                      </label>
                      <select
                        id="quantization"
                        value={quantization}
                        onChange={(e) => setQuantization(e.target.value)}
                        disabled={isEffectivelyLoading}
                        className={cn(
                          "w-full rounded-lg border border-opta-border bg-opta-surface px-3 py-2",
                          "text-sm text-text-primary",
                          "focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary",
                          "disabled:opacity-50",
                        )}
                      >
                        {QUANTIZATION_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Advanced options toggle */}
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowAdvanced((v) => !v)}
                        className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors"
                      >
                        {showAdvanced ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                        Advanced options
                      </button>

                      <AnimatePresence>
                        {showAdvanced && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{
                              type: "spring",
                              stiffness: 300,
                              damping: 30,
                            }}
                            className="overflow-hidden"
                          >
                            <div className="mt-3 space-y-3 rounded-lg border border-opta-border/50 bg-opta-surface/60 p-3">
                              {/* Backend selector */}
                              <div>
                                <label
                                  htmlFor="backend"
                                  className="mb-1 block text-xs font-medium text-text-secondary"
                                >
                                  Backend
                                </label>
                                <select
                                  id="backend"
                                  value={backend}
                                  onChange={(e) => setBackend(e.target.value)}
                                  disabled={isEffectivelyLoading}
                                  className={cn(
                                    "w-full rounded-md border border-opta-border bg-opta-surface px-2.5 py-1.5",
                                    "text-xs text-text-primary",
                                    "focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary",
                                    "disabled:opacity-50",
                                  )}
                                >
                                  {BACKEND_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Keep-alive */}
                              <div>
                                <label
                                  htmlFor="keep-alive"
                                  className="mb-1 block text-xs font-medium text-text-secondary"
                                >
                                  Keep-alive (seconds)
                                </label>
                                <input
                                  id="keep-alive"
                                  type="number"
                                  min={0}
                                  value={keepAliveSec}
                                  onChange={(e) =>
                                    setKeepAliveSec(Number(e.target.value))
                                  }
                                  disabled={isEffectivelyLoading}
                                  className={cn(
                                    "w-full rounded-md border border-opta-border bg-opta-surface px-2.5 py-1.5",
                                    "text-xs text-text-primary",
                                    "focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary",
                                    "disabled:opacity-50",
                                  )}
                                />
                              </div>

                              {/* Max context length */}
                              <div>
                                <label
                                  htmlFor="max-context"
                                  className="mb-1 block text-xs font-medium text-text-secondary"
                                >
                                  Max context length{" "}
                                  <span className="text-text-muted">
                                    (optional)
                                  </span>
                                </label>
                                <input
                                  id="max-context"
                                  type="number"
                                  min={256}
                                  placeholder="e.g. 8192"
                                  value={maxContextLength}
                                  onChange={(e) =>
                                    setMaxContextLength(e.target.value)
                                  }
                                  disabled={isEffectivelyLoading}
                                  className={cn(
                                    "w-full rounded-md border border-opta-border bg-opta-surface px-2.5 py-1.5",
                                    "text-xs text-text-primary placeholder:text-text-muted",
                                    "focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary",
                                    "disabled:opacity-50",
                                  )}
                                />
                              </div>

                              {/* Auto-download toggle */}
                              <label className="flex items-center gap-2.5 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={autoDownload}
                                  onChange={(e) =>
                                    setAutoDownload(e.target.checked)
                                  }
                                  disabled={isEffectivelyLoading}
                                  className="h-3.5 w-3.5 rounded accent-primary disabled:opacity-50"
                                />
                                <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors">
                                  Auto-download if not on disk
                                </span>
                              </label>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Error message */}
                    <AnimatePresence>
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex items-start gap-2 rounded-lg border border-neon-red/20 bg-neon-red/10 px-3 py-2"
                        >
                          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neon-red" />
                          <p className="text-xs text-neon-red">{error}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Submit */}
                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      disabled={!canSubmit}
                      className="w-full"
                    >
                      {isEffectivelyLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Loading Model…
                        </>
                      ) : (
                        <>
                          <Download className="mr-2 h-4 w-4" />
                          Load Model
                        </>
                      )}
                    </Button>
                  </motion.form>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
