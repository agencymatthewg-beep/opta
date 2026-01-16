/**
 * OptimizationResultModal - Shows optimization result with explanations.
 *
 * Follows DESIGN_SYSTEM.md:
 * - Glass effects (glass-strong for modal)
 * - Framer Motion animations
 * - Lucide icons
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { CheckCircle, XCircle, X, Sparkles, RotateCcw, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import OptimizationExplanation from './OptimizationExplanation';
import type { OptimizationResult } from '../types/optimizer';

export interface OptimizationResultModalProps {
  open: boolean;
  onClose: () => void;
  result: OptimizationResult | null;
  gameName: string;
  onRevert?: () => void;
}

function OptimizationResultModal({
  open,
  onClose,
  result,
  gameName,
  onRevert,
}: OptimizationResultModalProps) {
  const [showDetails, setShowDetails] = useState(false);

  if (!result) return null;

  const isSuccess = result.success && result.actions_failed === 0;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className={cn(
                'w-full max-w-lg glass-strong rounded-2xl border overflow-hidden',
                isSuccess ? 'border-success/30' : 'border-danger/30'
              )}
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className={cn(
                'px-6 py-4 border-b',
                isSuccess ? 'bg-success/5 border-success/10' : 'bg-danger/5 border-danger/10'
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <motion.div
                      className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center',
                        isSuccess ? 'bg-success/15' : 'bg-danger/15'
                      )}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', duration: 0.5, delay: 0.1 }}
                    >
                      {isSuccess ? (
                        <CheckCircle className="w-5 h-5 text-success" strokeWidth={2} />
                      ) : (
                        <XCircle className="w-5 h-5 text-danger" strokeWidth={2} />
                      )}
                    </motion.div>
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">
                        {isSuccess ? 'Optimization Applied' : 'Optimization Failed'}
                      </h2>
                      <p className="text-sm text-muted-foreground/70">{gameName}</p>
                    </div>
                  </div>
                  <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onClose}
                      className="rounded-xl"
                    >
                      <X className="w-5 h-5" strokeWidth={1.75} />
                    </Button>
                  </motion.div>
                </div>
              </div>

              {/* Content */}
              <ScrollArea className="max-h-[60vh]">
                <div className="p-6 space-y-4">
                  {/* Summary */}
                  <div className="flex items-center justify-between p-4 glass-subtle rounded-xl border border-border/20">
                    <div>
                      <span className="text-2xl font-bold text-foreground">
                        {result.actions_applied}
                      </span>
                      <span className="text-sm text-muted-foreground/70 ml-2">
                        optimizations applied
                      </span>
                    </div>
                    {result.actions_failed > 0 && (
                      <div className="text-right">
                        <span className="text-lg font-bold text-danger">
                          {result.actions_failed}
                        </span>
                        <span className="text-sm text-danger/70 ml-1">
                          failed
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Message */}
                  <p className="text-sm text-muted-foreground/70 text-center">
                    {result.message}
                  </p>

                  {/* Details Toggle */}
                  {result.details.length > 0 && (
                    <button
                      onClick={() => setShowDetails(!showDetails)}
                      className="w-full flex items-center justify-between p-3 glass-subtle rounded-xl border border-border/20 text-sm text-muted-foreground/70 hover:text-foreground transition-colors"
                    >
                      <span>View {result.details.length} applied settings</span>
                      <ChevronDown
                        className={cn(
                          'w-4 h-4 transition-transform',
                          showDetails && 'rotate-180'
                        )}
                      />
                    </button>
                  )}

                  {/* Details List */}
                  <AnimatePresence>
                    {showDetails && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="space-y-3 overflow-hidden"
                      >
                        {result.details.map((detail, index) => (
                          <OptimizationExplanation
                            key={index}
                            settingKey={detail.key || detail.action}
                            currentValue="Previous"
                            recommendedValue={detail.value || 'Applied'}
                            impact={detail.action === 'graphics_setting' ? 'medium' : 'low'}
                          />
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Next Steps */}
                  <div className="p-4 glass-subtle rounded-xl border border-border/20 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Sparkles className="w-4 h-4 text-primary" strokeWidth={1.75} />
                      Next Steps
                    </div>
                    <ul className="text-xs text-muted-foreground/70 space-y-1 pl-6">
                      <li>Launch your game to test the optimizations</li>
                      <li>Run a benchmark to measure improvements</li>
                      <li>Revert if you experience any issues</li>
                    </ul>
                  </div>
                </div>
              </ScrollArea>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-border/20 flex items-center justify-end gap-3">
                {onRevert && (
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      variant="outline"
                      onClick={onRevert}
                      className="gap-1.5 glass-subtle rounded-xl border-border/30"
                    >
                      <RotateCcw className="w-4 h-4" strokeWidth={2} />
                      Revert
                    </Button>
                  </motion.div>
                )}
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    onClick={onClose}
                    className={cn(
                      'gap-1.5 rounded-xl',
                      'bg-gradient-to-r from-primary to-accent',
                      'shadow-[0_0_16px_-4px_hsl(var(--glow-primary)/0.5)]'
                    )}
                  >
                    Done
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default OptimizationResultModal;
