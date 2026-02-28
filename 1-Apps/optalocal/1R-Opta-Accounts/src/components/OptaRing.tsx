'use client';

import { cn } from '@/lib/utils';

interface OptaRingProps {
  size?: 48 | 64 | 80 | 120;
  className?: string;
}

/**
 * Animated Opta Ring — the brand torus element.
 * CSS-only animation using conic-gradient plasma effect.
 */
export function OptaRing({ size = 80, className }: OptaRingProps) {
  return (
    <div className={cn('opta-ring-wrap', className)}>
      <div
        className={cn('opta-ring', {
          'opta-ring-48': size === 48,
          'opta-ring-64': size === 64,
          'opta-ring-80': size === 80,
          'opta-ring-120': size === 120,
        })}
      />
    </div>
  );
}
