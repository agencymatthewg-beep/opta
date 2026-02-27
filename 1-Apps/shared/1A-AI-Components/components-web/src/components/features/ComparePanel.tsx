'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, GitCompare, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CompanyLogo } from './CompanyLogo';
import { useCompare } from '@/lib/context/CompareContext';

/**
 * Sticky floating bar for model comparison selection
 */
export function ComparePanel() {
  const {
    selectedModels,
    maxModels,
    isPanelOpen,
    removeModel,
    clearAll,
    openCompareView,
  } = useCompare();

  return (
    <AnimatePresence>
      {isPanelOpen && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={cn(
            'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
            'w-[calc(100%-2rem)] max-w-2xl mx-auto',
            'bg-opta-bg/95 backdrop-blur-xl rounded-2xl',
            'border border-neon-cyan/30 shadow-2xl shadow-neon-cyan/20'
          )}
        >
          {/* Top glow accent */}
          <div className="absolute -top-px left-4 right-4 h-px bg-gradient-to-r from-transparent via-neon-cyan/50 to-transparent" />

          <div className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <GitCompare className="w-4 h-4 text-neon-cyan" />
                <span className="text-sm font-medium text-white">
                  Compare Models
                </span>
                <span className="text-xs text-text-muted">
                  ({selectedModels.length}/{maxModels})
                </span>
              </div>
              <button
                onClick={clearAll}
                className="flex items-center gap-1 text-xs text-text-muted hover:text-neon-coral transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
            </div>

            {/* Selected Models */}
            <div className="flex items-center gap-2 flex-wrap mb-4">
              {selectedModels.map((model) => (
                <motion.div
                  key={model.id}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  layout
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg',
                    'bg-white/5 border border-glass-border',
                    'group'
                  )}
                >
                  <CompanyLogo company={model.company} size={18} />
                  <span className="text-sm text-white truncate max-w-[120px]">
                    {model.name}
                  </span>
                  <button
                    onClick={() => removeModel(model.id)}
                    className="text-text-muted hover:text-neon-coral transition-colors"
                    aria-label={`Remove ${model.name} from comparison`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              ))}

              {/* Empty slots */}
              {Array.from({ length: maxModels - selectedModels.length }).map(
                (_, i) => (
                  <div
                    key={`empty-${i}`}
                    className={cn(
                      'flex items-center justify-center w-10 h-8 rounded-lg',
                      'border border-dashed border-glass-border',
                      'text-text-muted text-xs'
                    )}
                  >
                    +
                  </div>
                )
              )}
            </div>

            {/* Compare Button */}
            <button
              onClick={openCompareView}
              disabled={selectedModels.length < 2}
              className={cn(
                'w-full py-3 rounded-xl font-medium text-sm',
                'transition-all duration-200',
                selectedModels.length >= 2
                  ? 'bg-gradient-to-r from-neon-cyan to-purple-glow text-white hover:shadow-lg hover:shadow-neon-cyan/30 active:scale-[0.98]'
                  : 'bg-white/5 text-text-muted cursor-not-allowed'
              )}
            >
              {selectedModels.length < 2
                ? `Select ${2 - selectedModels.length} more model${2 - selectedModels.length > 1 ? 's' : ''}`
                : `Compare ${selectedModels.length} Models`}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Checkbox to add/remove model from comparison
 */
export function CompareCheckbox({
  modelId,
  modelName,
  model,
  className,
}: {
  modelId: string;
  modelName: string;
  model: {
    id: string;
    slug: string;
    name: string;
    company: string;
    rank: number;
    compositeScore: number;
    status: string;
    lastUpdated: string;
    capabilities: unknown;
    tags: unknown[];
    benchmarks: unknown[];
    sources: unknown[];
    pricing?: unknown;
  };
  className?: string;
}) {
  const { isSelected, toggleModel, canAddMore } = useCompare();
  const selected = isSelected(modelId);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        toggleModel(model as Parameters<typeof toggleModel>[0]);
      }}
      disabled={!selected && !canAddMore}
      className={cn(
        'flex items-center justify-center w-5 h-5 rounded',
        'border transition-all duration-200',
        selected
          ? 'bg-neon-cyan/20 border-neon-cyan text-neon-cyan'
          : canAddMore
            ? 'border-glass-border text-text-muted hover:border-neon-cyan/50 hover:text-neon-cyan'
            : 'border-glass-border/50 text-text-muted/50 cursor-not-allowed',
        className
      )}
      aria-label={
        selected ? `Remove ${modelName} from comparison` : `Add ${modelName} to comparison`
      }
      aria-pressed={selected}
    >
      {selected && (
        <motion.svg
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-3 h-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </motion.svg>
      )}
    </button>
  );
}
