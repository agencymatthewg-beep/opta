'use client';

/**
 * ModelLoadDialog — Glass-styled panel for loading a new model.
 *
 * Text input for HuggingFace model path, optional quantization select,
 * and load button with loading/error states. Uses Framer Motion for
 * enter/exit transitions. Calls parent onLoad handler (which should
 * invoke LMXClient.loadModel()).
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent, Button } from '@opta/ui';
import { Download, Loader2, AlertCircle, X } from 'lucide-react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ModelLoadDialogProps {
  /** Called when user submits the load form. Parent handles API call. */
  onLoad: (modelPath: string, quantization?: string) => Promise<void>;
  /** Whether a model load is currently in progress */
  isLoading: boolean;
  /** Whether this panel is visible */
  isOpen: boolean;
  /** Called when user dismisses the panel */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Quantization options
// ---------------------------------------------------------------------------

const QUANTIZATION_OPTIONS = [
  { value: '', label: 'Default' },
  { value: '4bit', label: '4-bit' },
  { value: '8bit', label: '8-bit' },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ModelLoadDialog({
  onLoad,
  isLoading,
  isOpen,
  onClose,
}: ModelLoadDialogProps) {
  const [modelPath, setModelPath] = useState('');
  const [quantization, setQuantization] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = modelPath.trim();
      if (!trimmed) return;

      setError(null);
      try {
        await onLoad(trimmed, quantization || undefined);
        // On success, clear the form
        setModelPath('');
        setQuantization('');
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load model',
        );
      }
    },
    [modelPath, quantization, onLoad],
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -8, height: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
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
                >
                  <X className="h-4 w-4" />
                </button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
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
                    disabled={isLoading}
                    className="w-full rounded-lg border border-opta-border bg-opta-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
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
                    disabled={isLoading}
                    className="w-full rounded-lg border border-opta-border bg-opta-surface px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                  >
                    {QUANTIZATION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Error message */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-start gap-2 rounded-lg bg-neon-red/10 border border-neon-red/20 px-3 py-2"
                    >
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neon-red" />
                      <p className="text-xs text-neon-red">{error}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit button */}
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={isLoading || !modelPath.trim()}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading Model...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Load Model
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
