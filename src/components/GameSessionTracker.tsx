/**
 * GameSessionTracker - Floating panel showing active game session.
 *
 * Follows DESIGN_SYSTEM.md Obsidian Standard:
 * - Obsidian glass surfaces with volumetric glow
 * - Framer Motion animations
 * - Lucide icons
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Gamepad2,
  Timer,
  Cpu,
  MemoryStick,
  Minimize2,
  Maximize2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { GameSession, SessionTelemetry } from '../types/launcher';

export interface GameSessionTrackerProps {
  /** Current game session */
  session: GameSession;
  /** Current telemetry data */
  telemetry: SessionTelemetry | null;
  /** Callback to end the session */
  onEndSession: () => void;
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
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Metric display component.
 */
function Metric({
  icon: Icon,
  label,
  value,
  unit,
}: {
  icon: LucideIcon;
  label: string;
  value: number | null;
  unit: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="p-1.5 rounded-lg bg-primary/10">
        <Icon className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} />
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">
          {label}
        </span>
        <span className="text-sm font-medium tabular-nums text-foreground">
          {value !== null ? `${Math.round(value)}${unit}` : '--'}
        </span>
      </div>
    </div>
  );
}

/**
 * GameSessionTracker - Floating panel for active game session.
 */
function GameSessionTracker({
  session,
  telemetry,
  onEndSession,
}: GameSessionTrackerProps) {
  const [minimized, setMinimized] = useState(false);
  const [elapsed, setElapsed] = useState(Date.now() - session.startedAt);

  // Update elapsed time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - session.startedAt);
    }, 1000);
    return () => clearInterval(interval);
  }, [session.startedAt]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 100, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 100, scale: 0.9 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className={cn(
          'fixed bottom-6 right-6 z-50',
          'bg-[#05030a]/90 backdrop-blur-2xl rounded-2xl border border-primary/30',
          'shadow-[0_0_32px_-8px_rgba(168,85,247,0.4)]',
          'overflow-hidden'
        )}
      >
        {/* Header */}
        <div className="px-4 py-3 bg-primary/5 border-b border-primary/10">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <motion.div
                className="w-8 h-8 rounded-full bg-success/15 flex items-center justify-center"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Gamepad2 className="w-4 h-4 text-success" strokeWidth={2} />
              </motion.div>
              <div>
                <h3 className="text-sm font-semibold text-foreground line-clamp-1">
                  {session.gameName}
                </h3>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                  <Timer className="w-3 h-3" strokeWidth={2} />
                  <span className="tabular-nums">{formatDuration(elapsed)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMinimized(!minimized)}
                  className="h-7 w-7 rounded-lg"
                >
                  {minimized ? (
                    <Maximize2 className="w-3.5 h-3.5" strokeWidth={2} />
                  ) : (
                    <Minimize2 className="w-3.5 h-3.5" strokeWidth={2} />
                  )}
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onEndSession}
                  className="h-7 w-7 rounded-lg text-muted-foreground hover:text-danger"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={2} />
                </Button>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Metrics - collapsible */}
        <AnimatePresence>
          {!minimized && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="p-4 grid grid-cols-2 gap-4">
                <Metric
                  icon={Cpu}
                  label="CPU"
                  value={telemetry?.cpuPercent ?? null}
                  unit="%"
                />
                <Metric
                  icon={MemoryStick}
                  label="RAM"
                  value={telemetry?.memoryMb ?? null}
                  unit=" MB"
                />
              </div>

              {/* Session Status */}
              <div className="px-4 pb-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground/60">
                    Status
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-medium',
                      session.status === 'running'
                        ? 'bg-success/15 text-success'
                        : session.status === 'launching'
                        ? 'bg-warning/15 text-warning'
                        : 'bg-muted/30 text-muted-foreground'
                    )}
                  >
                    <motion.div
                      className="w-1.5 h-1.5 rounded-full bg-current"
                      animate={
                        session.status === 'running'
                          ? { opacity: [1, 0.5, 1] }
                          : {}
                      }
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    {session.status === 'running'
                      ? 'Playing'
                      : session.status === 'launching'
                      ? 'Starting...'
                      : session.status}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}

export default GameSessionTracker;
