/**
 * SessionSummaryModal - Post-game statistics display.
 *
 * Follows DESIGN_SYSTEM.md:
 * - Glass effects (glass-strong for modal)
 * - Framer Motion animations
 * - Lucide icons
 */

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Trophy,
  Timer,
  Cpu,
  MemoryStick,
  Zap,
  Shield,
  X,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SessionSummary } from '../types/launcher';

export interface SessionSummaryModalProps {
  open: boolean;
  onClose: () => void;
  summary: SessionSummary;
}

/**
 * Format duration from milliseconds to readable string.
 */
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Stat card component.
 */
function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  color = 'primary',
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subValue?: string;
  color?: 'primary' | 'success' | 'warning';
}) {
  const colorClasses = {
    primary: 'text-primary bg-primary/10',
    success: 'text-success bg-success/10',
    warning: 'text-warning bg-warning/10',
  };

  return (
    <div className="glass-subtle rounded-xl border border-border/20 p-4">
      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-lg', colorClasses[color])}>
          <Icon className="w-4 h-4" strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground/60 uppercase tracking-wide">
            {label}
          </p>
          <p className="text-lg font-semibold text-foreground tabular-nums">
            {value}
          </p>
          {subValue && (
            <p className="text-[10px] text-muted-foreground/50">{subValue}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * SessionSummaryModal - Modal displaying post-game statistics.
 */
function SessionSummaryModal({
  open,
  onClose,
  summary,
}: SessionSummaryModalProps) {
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
              className="w-full max-w-md glass-strong rounded-2xl border border-primary/30 overflow-hidden"
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-4 bg-primary/5 border-b border-primary/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <motion.div
                      className="w-10 h-10 rounded-full bg-success/15 flex items-center justify-center"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', duration: 0.5, delay: 0.1 }}
                    >
                      <Trophy className="w-5 h-5 text-success" strokeWidth={2} />
                    </motion.div>
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">
                        Session Complete
                      </h2>
                      <p className="text-sm text-muted-foreground/70">
                        {summary.gameName}
                      </p>
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
              <div className="p-6 space-y-4">
                {/* Duration - Featured */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="glass rounded-xl border border-success/30 p-4 text-center"
                >
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Timer className="w-5 h-5 text-success" strokeWidth={1.75} />
                    <span className="text-sm font-medium text-success">
                      Play Time
                    </span>
                  </div>
                  <p className="text-3xl font-bold text-foreground tabular-nums">
                    {formatDuration(summary.durationMs)}
                  </p>
                </motion.div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                  >
                    <StatCard
                      icon={Cpu}
                      label="Avg CPU"
                      value={`${summary.averageCpuPercent}%`}
                      subValue={`Peak: ${summary.peakCpuPercent}%`}
                    />
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <StatCard
                      icon={MemoryStick}
                      label="Avg RAM"
                      value={`${summary.averageMemoryMb} MB`}
                      subValue={`Peak: ${summary.peakMemoryMb} MB`}
                    />
                  </motion.div>
                </div>

                {/* Opta Benefits */}
                {(summary.stealthModeSavingsMb > 0 || summary.optimizationsApplied > 0) && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="space-y-2"
                  >
                    <h4 className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">
                      Opta Benefits
                    </h4>
                    <div className="space-y-2">
                      {summary.stealthModeSavingsMb > 0 && (
                        <div className="flex items-center justify-between glass-subtle rounded-xl border border-border/20 p-3">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-success/10">
                              <Shield className="w-3.5 h-3.5 text-success" strokeWidth={2} />
                            </div>
                            <span className="text-sm text-foreground">Stealth Mode</span>
                          </div>
                          <span className="text-sm font-medium text-success tabular-nums">
                            +{summary.stealthModeSavingsMb} MB freed
                          </span>
                        </div>
                      )}

                      {summary.optimizationsApplied > 0 && (
                        <div className="flex items-center justify-between glass-subtle rounded-xl border border-border/20 p-3">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-primary/10">
                              <Zap className="w-3.5 h-3.5 text-primary" strokeWidth={2} />
                            </div>
                            <span className="text-sm text-foreground">Optimizations</span>
                          </div>
                          <span className="text-sm font-medium text-primary tabular-nums">
                            {summary.optimizationsApplied} applied
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-border/20 flex justify-end">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    onClick={onClose}
                    className={cn(
                      'gap-1.5 rounded-xl',
                      'bg-gradient-to-r from-primary to-accent',
                      'shadow-[0_0_16px_-4px_hsl(var(--glow-primary)/0.5)]'
                    )}
                  >
                    <TrendingUp className="w-4 h-4" strokeWidth={2} />
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

export default SessionSummaryModal;
