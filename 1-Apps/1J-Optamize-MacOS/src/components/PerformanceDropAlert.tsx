/**
 * PerformanceDropAlert - The Obsidian Performance Warning
 *
 * Shows when optimization causes performance to degrade significantly.
 * Offers option to rollback changes with obsidian glass styling.
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Easing curve for smooth energy transitions
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];
import { AlertTriangle, Undo2, X, TrendingDown } from 'lucide-react';
import type { PerformanceMetrics } from '../hooks/usePerformanceMonitor';

export interface PerformanceDropAlertProps {
  /** Baseline performance before optimization */
  baseline: PerformanceMetrics;
  /** Current performance after optimization */
  current: PerformanceMetrics;
  /** Callback when user clicks undo */
  onRollback: () => void;
  /** Callback when user dismisses the alert */
  onDismiss: () => void;
  /** Whether rollback is in progress */
  isRollingBack?: boolean;
}

function PerformanceDropAlert({
  baseline,
  current,
  onRollback,
  onDismiss,
  isRollingBack = false,
}: PerformanceDropAlertProps) {
  const dropPercent = Math.round(
    ((baseline.fps - current.fps) / baseline.fps) * 100
  );

  const tempIncrease =
    baseline.gpuTempC !== null && current.gpuTempC !== null
      ? current.gpuTempC - baseline.gpuTempC
      : null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onDismiss}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20, filter: 'brightness(0.5)' }}
          animate={{ opacity: 1, scale: 1, y: 0, filter: 'brightness(1)' }}
          exit={{ opacity: 0, scale: 0.95, y: 20, filter: 'brightness(0.5)' }}
          transition={{ ease: smoothOut }}
          className={cn(
            "relative rounded-2xl p-6 max-w-md w-full overflow-hidden",
            // Obsidian glass with warning energy
            "glass-strong",
            "border border-warning/30",
            // Inner specular highlight
            "before:absolute before:inset-x-0 before:top-0 before:h-px before:z-10",
            "before:bg-gradient-to-r before:from-transparent before:via-warning/20 before:to-transparent",
            // Warning energy glow
            "shadow-[inset_0_0_20px_rgba(245,158,11,0.05),0_0_40px_-10px_rgba(245,158,11,0.3)]"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <motion.div
                className="w-12 h-12 rounded-full bg-warning/15 flex items-center justify-center"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.1 }}
              >
                <AlertTriangle className="w-6 h-6 text-warning" strokeWidth={2} />
              </motion.div>
              <div>
                <h3 className="font-semibold text-lg text-foreground">
                  Performance Drop Detected
                </h3>
                <p className="text-sm text-muted-foreground/70">
                  FPS decreased by {dropPercent}% after optimization
                </p>
              </div>
            </div>
            <motion.button
              onClick={onDismiss}
              className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-foreground/60 hover:bg-card/60 transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <X className="w-5 h-5" strokeWidth={2} />
            </motion.button>
          </div>

          {/* Comparison cards */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Before */}
            <motion.div
              className="rounded-xl p-4 text-center bg-white/[0.02] border border-white/[0.04]"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <p className="text-xs text-muted-foreground/60 mb-1">Before</p>
              <p className="text-2xl font-bold text-success tabular-nums">
                {baseline.fps}
              </p>
              <p className="text-xs text-muted-foreground/50">FPS</p>
              {baseline.gpuTempC !== null && (
                <p className="text-xs text-muted-foreground/50 mt-1">
                  {baseline.gpuTempC}°C
                </p>
              )}
            </motion.div>

            {/* After */}
            <motion.div
              className="rounded-xl p-4 text-center bg-white/[0.02] border border-danger/20"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
            >
              <p className="text-xs text-muted-foreground/60 mb-1">After</p>
              <div className="flex items-center justify-center gap-1">
                <p className="text-2xl font-bold text-danger tabular-nums">
                  {current.fps}
                </p>
                <TrendingDown className="w-4 h-4 text-danger" strokeWidth={2} />
              </div>
              <p className="text-xs text-muted-foreground/50">FPS</p>
              {current.gpuTempC !== null && (
                <p className={cn(
                  'text-xs mt-1',
                  tempIncrease && tempIncrease > 5 ? 'text-warning' : 'text-muted-foreground/50'
                )}>
                  {current.gpuTempC}°C
                  {tempIncrease && tempIncrease > 0 && (
                    <span className="text-warning"> (+{tempIncrease}°)</span>
                  )}
                </p>
              )}
            </motion.div>
          </div>

          {/* Impact summary */}
          <motion.div
            className="rounded-xl p-4 mb-6 bg-white/[0.02] border border-white/[0.04]"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-2 text-sm mb-2">
              <AlertTriangle className="w-4 h-4 text-warning" strokeWidth={1.75} />
              <span className="font-medium text-foreground">Impact Summary</span>
            </div>
            <ul className="text-xs text-muted-foreground/70 space-y-1.5 pl-6">
              <li>
                FPS dropped from <span className="text-success">{baseline.fps}</span> to{' '}
                <span className="text-danger">{current.fps}</span> ({dropPercent}% decrease)
              </li>
              {tempIncrease !== null && tempIncrease > 0 && (
                <li>
                  GPU temperature increased by <span className="text-warning">{tempIncrease}°C</span>
                </li>
              )}
              <li>
                Recent optimizations may not be compatible with your hardware
              </li>
            </ul>
          </motion.div>

          {/* Actions */}
          <div className="flex gap-3">
            <motion.div className="flex-1" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                variant="outline"
                className="w-full gap-1.5 rounded-xl bg-white/[0.02] border-white/[0.06]"
                onClick={onDismiss}
                disabled={isRollingBack}
              >
                Keep Changes
              </Button>
            </motion.div>
            <motion.div className="flex-1" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                className={cn(
                  'w-full gap-1.5 rounded-xl',
                  'bg-gradient-to-r from-warning/80 to-warning',
                  'shadow-[0_0_16px_-4px_hsl(var(--glow-warning)/0.5)]'
                )}
                onClick={onRollback}
                disabled={isRollingBack}
              >
                {isRollingBack ? (
                  'Reverting...'
                ) : (
                  <>
                    <Undo2 className="w-4 h-4" strokeWidth={2} />
                    Undo Changes
                  </>
                )}
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default PerformanceDropAlert;
