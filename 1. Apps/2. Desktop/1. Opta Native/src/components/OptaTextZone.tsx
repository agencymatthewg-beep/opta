/**
 * OptaTextZone - Central glassmorphic text area for contextual guidance.
 *
 * Displays dynamic messages that translate app state into simple,
 * user-friendly guidance. This is the "single source of truth" for
 * understanding what Opta is doing.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

export type TextZoneType = 'neutral' | 'positive' | 'warning' | 'error';

export interface TextZoneIndicator {
  direction: 'up' | 'down';
  value: string;
  label: string;
}

export interface OptaTextZoneProps {
  message: string;
  type?: TextZoneType;
  indicator?: TextZoneIndicator;
  hint?: string;
}

/**
 * Animated counter component for satisfying number transitions.
 * Counts up from 0 to the target value with easing.
 */
function CountUp({ end, className, duration = 500 }: { end: number; className?: string; duration?: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    // Reset to 0 when end value changes
    setCount(0);

    const steps = 20;
    const increment = end / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.round(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [end, duration]);

  return (
    <motion.span
      key={end}
      className={className}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 25 }}
    >
      {count}
    </motion.span>
  );
}

/**
 * OptaTextZone component - displays contextual messages with optional indicators.
 */
export function OptaTextZone({
  message,
  type = 'neutral',
  indicator,
  hint,
}: OptaTextZoneProps) {
  const colorClass = {
    neutral: 'text-foreground',
    positive: 'text-success',
    warning: 'text-warning',
    error: 'text-danger',
  }[type];

  const glowClass = {
    neutral: '',
    positive: 'shadow-[0_0_24px_-8px_hsl(var(--glow-success)/0.3)]',
    warning: 'shadow-[0_0_24px_-8px_hsl(var(--glow-warning)/0.3)]',
    error: 'shadow-[0_0_24px_-8px_hsl(var(--glow-danger)/0.3)]',
  }[type];

  return (
    <motion.div
      className={cn(
        'glass rounded-xl p-4 text-center max-w-md mx-auto',
        'border border-border/30',
        glowClass
      )}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 25 }}
    >
      <AnimatePresence mode="wait">
        <motion.p
          key={message}
          className={cn('text-lg font-medium', colorClass)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {message}
        </motion.p>
      </AnimatePresence>

      {indicator && (
        <motion.div
          className="flex items-center justify-center gap-2 mt-2"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {indicator.direction === 'up' ? (
            <TrendingUp className="w-5 h-5 text-success" strokeWidth={1.75} />
          ) : (
            <TrendingDown className="w-5 h-5 text-danger" strokeWidth={1.75} />
          )}
          <CountUp
            end={parseFloat(indicator.value)}
            className="text-xl font-bold text-foreground"
          />
          <span className="text-sm text-muted-foreground">{indicator.label}</span>
        </motion.div>
      )}

      {hint && (
        <motion.p
          className="text-xs text-muted-foreground/70 mt-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {hint}
        </motion.p>
      )}
    </motion.div>
  );
}

export default OptaTextZone;
