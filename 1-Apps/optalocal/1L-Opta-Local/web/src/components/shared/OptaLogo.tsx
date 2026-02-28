"use client";

import { cn } from "@opta/ui";
import { OptaRing } from '@/components/shared/OptaRing';

interface OptaLogoProps {
  /** Size of the ring element. Controls the overall scale. */
  size?: 48 | 64 | 80 | 120;
  /** Custom class name for the wrapper */
  className?: string;
  /** Direction of the lockup */
  layout?: 'horizontal' | 'vertical';
  /** Show the OPTA text */
  showText?: boolean;
  /** Add a subtitle/suffix (e.g. "LOCAL", "ACCOUNTS") */
  suffix?: string;
  /** Pause the ring animations */
  paused?: boolean;
}

/**
 * Opta Logo Lockup
 * Combines the Calm Singularity Opta Ring with the official Opta Typography.
 */
export function OptaLogo({ 
  size = 80, 
  className, 
  layout = 'horizontal',
  showText = true, 
  suffix,
  paused = false 
}: OptaLogoProps) {
  // Map ring size to text size so the lockup remains proportional
  const textSizeClass = {
    48: 'text-2xl',
    64: 'text-3xl',
    80: 'text-4xl',
    120: 'text-6xl',
  }[size];

  const gapClass = {
    48: 'gap-3',
    64: 'gap-4',
    80: 'gap-5',
    120: 'gap-8',
  }[size];

  return (
    <div className={cn(
      "flex", 
      layout === 'horizontal' ? 'flex-row items-center' : 'flex-col items-center justify-center',
      gapClass,
      className
    )}>
      <OptaRing size={size} paused={paused} />
      
      {showText && (
        <div className={cn("flex", layout === 'horizontal' ? 'flex-row gap-2' : 'flex-col items-center gap-1')}>
          <h1 className={cn(
            "m-0 p-0 font-sans font-bold uppercase tracking-[0.12em] leading-none",
            "bg-gradient-to-b from-[#fafafa] via-[#a855f7] to-[#6366f1] bg-clip-text text-transparent",
            "drop-shadow-[0_0_24px_rgba(139,92,246,0.35)]",
            textSizeClass
          )}>
            OPTA
          </h1>
          {suffix && (
            <span className={cn(
              "font-sans font-bold uppercase tracking-[0.12em] leading-none",
              "text-text-primary",
              textSizeClass
            )}>
              {suffix}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
