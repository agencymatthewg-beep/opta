'use client';

/**
 * ModelList — Loaded models with AnimatePresence transitions.
 *
 * Renders each loaded model with a status badge, model name, VRAM usage,
 * and quantization info. Unload button for each model (ghost variant).
 * AnimatePresence with mode="popLayout" for smooth list transitions.
 */

import { motion, AnimatePresence } from 'framer-motion';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Button,
} from '@opta/ui';
import { Layers, X } from 'lucide-react';
import type { LoadedModel } from '@/types/lmx';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ModelListProps {
  /** List of currently loaded models */
  models: LoadedModel[];
  /** Called when the user requests to unload a model */
  onUnload?: (modelId: string) => void;
  /** Model ID currently being unloaded (disables its button) */
  isUnloading?: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ModelList({
  models,
  onUnload,
  isUnloading = null,
}: ModelListProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-neon-purple" />
            Loaded Models
          </span>
          <Badge variant="default" size="sm">
            {models.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <AnimatePresence mode="popLayout">
          {models.map((model) => (
            <motion.div
              key={model.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="flex items-center justify-between border-b border-white/5 py-3 last:border-0"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Badge variant="success" size="sm">
                  ready
                </Badge>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {model.name}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {model.vram_gb.toFixed(1)} GB
                    {model.quantization ? ` \u00B7 ${model.quantization}` : ''}
                  </p>
                </div>
              </div>
              {onUnload && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isUnloading === model.id}
                  onClick={() => onUnload(model.id)}
                  aria-label={`Unload ${model.name}`}
                >
                  {isUnloading === model.id ? (
                    <span className="text-xs">Unloading...</span>
                  ) : (
                    <X className="h-3.5 w-3.5" />
                  )}
                </Button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {models.length === 0 && (
          <p className="py-8 text-center text-sm text-text-muted">
            No models loaded
          </p>
        )}
      </CardContent>
    </Card>
  );
}
