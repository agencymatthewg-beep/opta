'use client';

/**
 * HeartbeatIndicator — Compact connection health dot.
 *
 * Shows a pulsing dot that reflects heartbeat state:
 * - Green: healthy (0 consecutive failures)
 * - Amber: degraded (1-2 consecutive failures)
 * - Red: unhealthy (3+ consecutive failures)
 *
 * Hover tooltip shows last ping latency.
 * Small enough to fit inline in the dashboard header.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@opta/ui';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HeartbeatIndicatorProps {
  /** Whether the server is responding to heartbeat pings */
  isHealthy: boolean;
  /** Number of consecutive heartbeat failures */
  consecutiveFailures: number;
  /** Last successful ping latency in ms, or null */
  lastPingMs: number | null;
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

function getDotColor(consecutiveFailures: number): {
  bg: string;
  glow: string;
  label: string;
} {
  if (consecutiveFailures === 0) {
    return {
      bg: 'bg-neon-green',
      glow: 'shadow-[0_0_6px_var(--color-neon-green)]',
      label: 'Healthy',
    };
  }
  if (consecutiveFailures < 3) {
    return {
      bg: 'bg-neon-amber',
      glow: 'shadow-[0_0_6px_var(--color-neon-amber)]',
      label: 'Degraded',
    };
  }
  return {
    bg: 'bg-neon-red',
    glow: 'shadow-[0_0_6px_var(--color-neon-red)]',
    label: 'Unhealthy',
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HeartbeatIndicator({
  isHealthy,
  consecutiveFailures,
  lastPingMs,
}: HeartbeatIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const { bg, glow, label } = getDotColor(consecutiveFailures);

  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Pulsing dot */}
      <div className="relative">
        {/* Pulse ring */}
        <motion.div
          className={cn('absolute inset-0 rounded-full', bg)}
          animate={{
            scale: isHealthy ? [1, 1.8, 1] : [1, 1.4, 1],
            opacity: [0.6, 0, 0.6],
          }}
          transition={{
            duration: isHealthy ? 2 : 1,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{ width: 8, height: 8 }}
        />
        {/* Solid dot */}
        <div
          className={cn('relative h-2 w-2 rounded-full', bg, glow)}
        />
      </div>

      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50',
              'glass-subtle rounded-lg px-3 py-1.5 whitespace-nowrap',
              'text-xs text-text-secondary',
            )}
          >
            <span className="font-medium text-text-primary">{label}</span>
            {lastPingMs !== null && (
              <span className="ml-2 tabular-nums text-text-muted">
                {lastPingMs}ms
              </span>
            )}
            {consecutiveFailures > 0 && (
              <span className="ml-2 text-text-muted">
                {consecutiveFailures} fail{consecutiveFailures !== 1 ? 's' : ''}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
