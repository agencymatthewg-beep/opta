'use client';

/**
 * ConnectionIndicator — SSE connection state badge.
 *
 * Shows the current connection state as a compact pill with icon:
 *   connecting → amber pulse + Loader2 spin
 *   open       → emerald + Wifi
 *   closed     → muted + WifiOff
 *   error      → red + WifiOff
 */

import { motion } from 'framer-motion';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { cn } from '@opta/ui';
import type { ConnectionState } from '@/hooks/useSSE';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ConnectionIndicatorProps {
  /** Current SSE connection state */
  state: ConnectionState;
  /** Optional extra class names */
  className?: string;
}

// ---------------------------------------------------------------------------
// State config
// ---------------------------------------------------------------------------

interface StateConfig {
  label: string;
  icon: React.ReactNode;
  classes: string;
  pulse: boolean;
}

function getStateConfig(state: ConnectionState): StateConfig {
  switch (state) {
    case 'connecting':
      return {
        label: 'Connecting',
        icon: <Loader2 className="h-3 w-3 animate-spin" />,
        classes:
          'bg-neon-amber/20 border-neon-amber/40 text-neon-amber',
        pulse: true,
      };
    case 'open':
      return {
        label: 'Connected',
        icon: <Wifi className="h-3 w-3" />,
        classes:
          'bg-neon-green/20 border-neon-green/40 text-neon-green',
        pulse: false,
      };
    case 'closed':
      return {
        label: 'Disconnected',
        icon: <WifiOff className="h-3 w-3" />,
        classes:
          'bg-white/5 border-white/10 text-text-muted',
        pulse: false,
      };
    case 'error':
      return {
        label: 'Error',
        icon: <WifiOff className="h-3 w-3" />,
        classes:
          'bg-neon-red/20 border-neon-red/40 text-neon-red',
        pulse: false,
      };
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConnectionIndicator({
  state,
  className,
}: ConnectionIndicatorProps) {
  const config = getStateConfig(state);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{
        opacity: 1,
        scale: config.pulse ? [1, 1.04, 1] : 1,
      }}
      transition={
        config.pulse
          ? { scale: { repeat: Infinity, duration: 1.5, ease: 'easeInOut' } }
          : { duration: 0.2 }
      }
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        config.classes,
        className,
      )}
      role="status"
      aria-label={`Connection status: ${config.label}`}
    >
      {config.icon}
      {config.label}
    </motion.div>
  );
}
