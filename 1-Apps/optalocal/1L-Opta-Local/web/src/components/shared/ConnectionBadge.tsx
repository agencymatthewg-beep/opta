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

export type ConnectionBadgeQuality =
  | 'unknown'
  | 'excellent'
  | 'good'
  | 'degraded'
  | 'poor';

interface ConnectionBadgeProps {
  /** Current connection mode */
  type: ConnectionMode;
  /** Last measured latency in milliseconds */
  latencyMs?: number | null;
  /** Optional inferred link quality for richer visual cues */
  quality?: ConnectionBadgeQuality;
  /** Optional busy state to show active probing/recovery intent */
  busy?: boolean;
  /** Optional compact mode for dense header layouts */
  compact?: boolean;
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

function inferQuality(
  type: ConnectionMode,
  latencyMs?: number | null,
): ConnectionBadgeQuality {
  if (type === 'offline') return 'poor';
  if (type === 'probing') return 'unknown';
  if (latencyMs == null) return 'unknown';
  if (latencyMs <= 60) return 'excellent';
  if (latencyMs <= 140) return 'good';
  if (latencyMs <= 280) return 'degraded';
  return 'poor';
}

function getQualityPulseConfig(quality: ConnectionBadgeQuality) {
  switch (quality) {
    case 'excellent':
      return { scale: 1.35, duration: 2.4, opacity: 0.45 };
    case 'good':
      return { scale: 1.45, duration: 2.1, opacity: 0.52 };
    case 'degraded':
      return { scale: 1.65, duration: 1.7, opacity: 0.62 };
    case 'poor':
      return { scale: 1.8, duration: 1.4, opacity: 0.7 };
    case 'unknown':
      return { scale: 1.55, duration: 1.8, opacity: 0.56 };
  }
}

function formatAriaLabel(
  label: string,
  quality: ConnectionBadgeQuality,
  busy: boolean,
  latencyMs?: number | null,
  type?: ConnectionMode,
) {
  const parts: string[] = [`Connection: ${label}`];
  if (quality !== 'unknown') {
    parts.push(`${quality} quality`);
  }
  if (latencyMs != null && (type === 'lan' || type === 'wan')) {
    parts.push(`${latencyMs}ms latency`);
  }
  if (busy) {
    parts.push('busy');
  }
  return parts.join(', ');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConnectionBadge({
  type,
  latencyMs,
  quality,
  busy = false,
  compact = false,
  className,
}: ConnectionBadgeProps) {
  const config = getBadgeConfig(type);
  const resolvedQuality = quality ?? inferQuality(type, latencyMs);
  const showLatency = latencyMs != null && (type === 'lan' || type === 'wan') && !compact;
  const shouldPulse = type === 'probing' || busy || resolvedQuality === 'degraded' || resolvedQuality === 'poor';
  const pulseConfig = getQualityPulseConfig(
    type === 'probing' || busy ? 'unknown' : resolvedQuality,
  );
  const ariaLabel = formatAriaLabel(
    config.label,
    resolvedQuality,
    busy,
    latencyMs,
    type,
  );

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${type}-${compact ? 'compact' : 'full'}`}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{
          opacity: 1,
          scale: 1,
          y: busy ? [0, -0.8, 0] : 0,
        }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{
          duration: 0.2,
          y: {
            duration: 1.2,
            repeat: busy ? Infinity : 0,
            ease: 'easeInOut',
          },
        }}
        className={cn(
          'inline-flex items-center rounded-full border',
          'glass-subtle text-xs font-medium select-none',
          compact
            ? 'gap-1 px-2 py-0.5 text-[11px]'
            : 'gap-1.5 px-2.5 py-1',
          busy && 'shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_0_18px_rgba(139,92,246,0.18)]',
          config.bgColor,
          config.borderColor,
          config.textColor,
          className,
        )}
        role="status"
        aria-label={ariaLabel}
      >
        {/* Animated status dot */}
        <span className="relative flex h-2 w-2">
          {(config.pulse || shouldPulse) && (
            <motion.span
              className={cn(
                'absolute inline-flex h-full w-full rounded-full opacity-75',
                config.dotColor,
              )}
              animate={{
                scale: [1, pulseConfig.scale, 1],
                opacity: [pulseConfig.opacity, 0, pulseConfig.opacity],
              }}
              transition={{
                duration: pulseConfig.duration,
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
        <motion.span
          animate={
            busy && type !== 'probing'
              ? { rotate: [0, 8, -6, 0], scale: [1, 1.03, 1] }
              : { rotate: 0, scale: 1 }
          }
          transition={{
            duration: busy && type !== 'probing' ? 0.8 : 0.2,
            repeat: busy && type !== 'probing' ? Infinity : 0,
            ease: 'easeInOut',
          }}
          className="inline-flex"
        >
          {config.icon}
        </motion.span>

        {/* Label */}
        <span className={cn(compact && 'tracking-[0.03em]')}>{config.label}</span>

        {/* Latency (only show when connected) */}
        {showLatency && (
          <span className="text-text-muted font-mono text-[10px] ml-0.5">
            {latencyMs}ms
          </span>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
