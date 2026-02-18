'use client';

/**
 * ConnectionBadge — Global connection status indicator.
 *
 * Compact pill showing connection type (LAN/WAN/Offline) with
 * Lucide icon, animated status dot, and optional latency display.
 * Uses Framer Motion for the pulse animation while probing.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, Globe, WifiOff, Loader2 } from 'lucide-react';
import { cn } from '@opta/ui';
import type { ConnectionMode } from '@/hooks/useConnection';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ConnectionBadgeProps {
  /** Current connection mode */
  type: ConnectionMode;
  /** Last measured latency in milliseconds */
  latencyMs?: number | null;
  /** Optional extra class names */
  className?: string;
}

// ---------------------------------------------------------------------------
// State config
// ---------------------------------------------------------------------------

interface BadgeConfig {
  label: string;
  icon: React.ReactNode;
  dotColor: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  pulse: boolean;
}

function getBadgeConfig(type: ConnectionMode): BadgeConfig {
  switch (type) {
    case 'lan':
      return {
        label: 'LAN',
        icon: <Wifi className="h-3 w-3" />,
        dotColor: 'bg-neon-green',
        textColor: 'text-neon-green',
        bgColor: 'bg-neon-green/10',
        borderColor: 'border-neon-green/30',
        pulse: false,
      };
    case 'wan':
      return {
        label: 'WAN',
        icon: <Globe className="h-3 w-3" />,
        dotColor: 'bg-neon-amber',
        textColor: 'text-neon-amber',
        bgColor: 'bg-neon-amber/10',
        borderColor: 'border-neon-amber/30',
        pulse: false,
      };
    case 'offline':
      return {
        label: 'Offline',
        icon: <WifiOff className="h-3 w-3" />,
        dotColor: 'bg-neon-red',
        textColor: 'text-neon-red',
        bgColor: 'bg-neon-red/10',
        borderColor: 'border-neon-red/30',
        pulse: false,
      };
    case 'probing':
      return {
        label: 'Connecting',
        icon: <Loader2 className="h-3 w-3 animate-spin" />,
        dotColor: 'bg-neon-amber',
        textColor: 'text-neon-amber',
        bgColor: 'bg-neon-amber/10',
        borderColor: 'border-neon-amber/30',
        pulse: true,
      };
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConnectionBadge({
  type,
  latencyMs,
  className,
}: ConnectionBadgeProps) {
  const config = getBadgeConfig(type);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={type}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2 }}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1',
          'glass-subtle text-xs font-medium select-none',
          config.bgColor,
          config.borderColor,
          config.textColor,
          className,
        )}
        role="status"
        aria-label={`Connection: ${config.label}${latencyMs != null ? `, ${latencyMs}ms latency` : ''}`}
      >
        {/* Animated status dot */}
        <span className="relative flex h-2 w-2">
          {config.pulse && (
            <motion.span
              className={cn(
                'absolute inline-flex h-full w-full rounded-full opacity-75',
                config.dotColor,
              )}
              animate={{ scale: [1, 1.8, 1], opacity: [0.75, 0, 0.75] }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          )}
          <span
            className={cn(
              'relative inline-flex h-2 w-2 rounded-full',
              config.dotColor,
            )}
          />
        </span>

        {/* Icon */}
        {config.icon}

        {/* Label */}
        <span>{config.label}</span>

        {/* Latency (only show when connected) */}
        {latencyMs != null && (type === 'lan' || type === 'wan') && (
          <span className="text-text-muted font-mono text-[10px] ml-0.5">
            {latencyMs}ms
          </span>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
