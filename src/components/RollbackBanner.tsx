/**
 * RollbackBanner - The Obsidian Rollback Toast
 *
 * Shows a timed banner allowing quick undo of recent optimizations.
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Easing curve for smooth energy transitions
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];
import { Undo2, X, CheckCircle, Loader2 } from 'lucide-react';
import type { AppliedOptimization } from '../hooks/useRollback';

export interface RollbackBannerProps {
  /** Rollback point ID */
  rollbackId: string;
  /** List of applied optimizations */
  optimizations: AppliedOptimization[];
  /** Game name (optional) */
  gameName?: string;
  /** Callback when user clicks undo */
  onRollback: (rollbackId: string) => Promise<boolean>;
  /** Callback when banner is dismissed */
  onDismiss?: () => void;
  /** Time in seconds before banner auto-hides (default: 60) */
  timeoutSeconds?: number;
  /** Whether rollback is in progress */
  isRollingBack?: boolean;
}

function RollbackBanner({
  rollbackId,
  optimizations,
  gameName,
  onRollback,
  onDismiss,
  timeoutSeconds = 60,
  isRollingBack = false,
}: RollbackBannerProps) {
  const [timeLeft, setTimeLeft] = useState(timeoutSeconds);
  const [rollbackSuccess, setRollbackSuccess] = useState(false);
  const [visible, setVisible] = useState(true);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0 || rollbackSuccess || isRollingBack) return;

    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timer);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, rollbackSuccess, isRollingBack]);

  // Auto-hide when timer expires
  useEffect(() => {
    if (timeLeft === 0 && !rollbackSuccess) {
      setVisible(false);
      onDismiss?.();
    }
  }, [timeLeft, rollbackSuccess, onDismiss]);

  const handleRollback = useCallback(async () => {
    const success = await onRollback(rollbackId);
    if (success) {
      setRollbackSuccess(true);
      // Auto-dismiss after showing success
      setTimeout(() => {
        setVisible(false);
        onDismiss?.();
      }, 2000);
    }
  }, [onRollback, rollbackId, onDismiss]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    onDismiss?.();
  }, [onDismiss]);

  if (!visible) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ ease: smoothOut }}
          className={cn(
            'fixed top-4 right-4 z-50',
            'relative rounded-xl p-4 max-w-sm overflow-hidden',
            // Obsidian glass material
            'bg-[#05030a]/90 backdrop-blur-2xl',
            'border',
            rollbackSuccess
              ? 'border-success/30 shadow-[inset_0_0_20px_rgba(34,197,94,0.05),0_0_20px_-8px_rgba(34,197,94,0.3)]'
              : 'border-primary/30 shadow-[inset_0_0_20px_rgba(168,85,247,0.05),0_0_20px_-8px_rgba(168,85,247,0.3)]',
            // Inner specular highlight
            'before:absolute before:inset-x-0 before:top-0 before:h-px before:z-10',
            'before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent'
          )}
        >
          <div className="flex items-start gap-3">
            {/* Icon */}
            <motion.div
              className={cn(
                'shrink-0 w-9 h-9 rounded-lg flex items-center justify-center',
                rollbackSuccess
                  ? 'bg-success/15'
                  : 'bg-primary/15'
              )}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.1 }}
            >
              {rollbackSuccess ? (
                <CheckCircle className="w-5 h-5 text-success" strokeWidth={2} />
              ) : (
                <Undo2 className="w-5 h-5 text-primary" strokeWidth={1.75} />
              )}
            </motion.div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground">
                {rollbackSuccess ? 'Changes Reverted' : 'Optimizations Applied'}
              </p>
              <p className="text-sm text-muted-foreground/70 mt-0.5">
                {rollbackSuccess ? (
                  'Settings restored to previous state.'
                ) : (
                  <>
                    {optimizations.length} change{optimizations.length !== 1 ? 's' : ''} made
                    {gameName && <> for <span className="text-foreground/80">{gameName}</span></>}.
                    {' '}Not working as expected?
                  </>
                )}
              </p>

              {/* Actions */}
              {!rollbackSuccess && (
                <div className="flex items-center gap-3 mt-3">
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRollback}
                      disabled={isRollingBack}
                      className="gap-1.5 rounded-lg text-xs bg-white/[0.02] border-white/[0.06]"
                    >
                      {isRollingBack ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Reverting...
                        </>
                      ) : (
                        <>
                          <Undo2 className="w-3.5 h-3.5" strokeWidth={2} />
                          Undo All ({timeLeft}s)
                        </>
                      )}
                    </Button>
                  </motion.div>
                  <button
                    onClick={handleDismiss}
                    className="text-xs text-muted-foreground/60 hover:text-foreground/80 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>

            {/* Close button */}
            <motion.button
              onClick={handleDismiss}
              className="shrink-0 p-1 rounded-lg text-muted-foreground/40 hover:text-foreground/60 hover:bg-card/60 transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <X className="w-4 h-4" strokeWidth={2} />
              <span className="sr-only">Dismiss</span>
            </motion.button>
          </div>

          {/* Progress bar */}
          {!rollbackSuccess && !isRollingBack && (
            <motion.div
              className="absolute bottom-0 left-0 right-0 h-1 bg-primary/10 rounded-b-xl overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <motion.div
                className="h-full bg-primary/50"
                initial={{ width: '100%' }}
                animate={{ width: `${(timeLeft / timeoutSeconds) * 100}%` }}
                transition={{ duration: 1, ease: 'linear' }}
              />
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default RollbackBanner;
