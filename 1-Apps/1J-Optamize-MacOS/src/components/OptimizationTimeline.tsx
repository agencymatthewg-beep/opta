/**
 * OptimizationTimeline - Shows history of applied optimizations.
 *
 * Follows DESIGN_SYSTEM.md:
 * - Glass effects
 * - Framer Motion animations
 * - Lucide icons
 */

import { motion } from 'framer-motion';
import { Clock, CheckCircle, RotateCcw, Settings, Terminal, Cpu, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { OptimizationHistoryEntry } from '../types/optimizer';

export interface OptimizationTimelineProps {
  history: OptimizationHistoryEntry[];
  onRevert?: () => void;
  canRevert?: boolean;
}

const ACTION_ICONS: Record<string, LucideIcon> = {
  graphics: Settings,
  launch_options: Terminal,
  priority: Cpu,
};

function formatTimestamp(timestamp: number | null): string {
  if (!timestamp) return 'Unknown';
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
}

function OptimizationTimeline({ history, onRevert, canRevert = true }: OptimizationTimelineProps) {
  if (history.length === 0) {
    return (
      <motion.div
        className="rounded-xl bg-white/[0.02] p-6 border border-white/[0.04] text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <Clock className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" strokeWidth={1.5} />
        <p className="text-sm text-muted-foreground/70">
          No optimizations applied yet.
        </p>
      </motion.div>
    );
  }

  // Group by timestamp (within same minute = same batch)
  const grouped = history.reduce((acc, entry) => {
    const key = entry.applied_at ? Math.floor(entry.applied_at / 60) : 0;
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {} as Record<number, OptimizationHistoryEntry[]>);

  const batches = Object.entries(grouped).sort(([a], [b]) => Number(b) - Number(a));

  return (
    <motion.div
      className="rounded-xl bg-white/[0.02] border border-white/[0.04] overflow-hidden"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="px-4 py-3 border-b border-border/20 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Optimization History
        </h3>
        {canRevert && onRevert && (
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              variant="outline"
              size="sm"
              onClick={onRevert}
              className="gap-1.5 rounded-xl bg-white/[0.02] border-border/30"
            >
              <RotateCcw className="w-3.5 h-3.5" strokeWidth={2} />
              Revert All
            </Button>
          </motion.div>
        )}
      </div>

      <div className="p-4 space-y-4">
        {batches.map(([key, entries], batchIndex) => {
          const timestamp = entries[0]?.applied_at;
          const gameName = entries[0]?.game_name || 'Unknown Game';

          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: batchIndex * 0.1 }}
              className="relative pl-6"
            >
              {/* Timeline line */}
              {batchIndex < batches.length - 1 && (
                <div className="absolute left-[7px] top-6 bottom-0 w-px bg-border/30" />
              )}

              {/* Timeline dot */}
              <div className="absolute left-0 top-1 w-3.5 h-3.5 rounded-full bg-success/20 border-2 border-success flex items-center justify-center">
                <CheckCircle className="w-2 h-2 text-success" strokeWidth={3} />
              </div>

              {/* Content */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{gameName}</span>
                  <span className="text-xs text-muted-foreground/50">
                    {formatTimestamp(timestamp)}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {entries.map((entry, index) => {
                    const Icon = ACTION_ICONS[entry.action_type] || Settings;

                    return (
                      <div
                        key={`${entry.action_id}-${index}`}
                        className="flex items-center gap-2 text-xs"
                      >
                        <Icon className="w-3 h-3 text-muted-foreground/50" strokeWidth={1.75} />
                        <span className="text-muted-foreground/70 capitalize">
                          {entry.setting_key.replace(/_/g, ' ')}:
                        </span>
                        <code className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs">
                          {String(entry.new_value)}
                        </code>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

export default OptimizationTimeline;
