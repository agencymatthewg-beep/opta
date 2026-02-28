"use client";

import { cn } from "@/lib/utils";

interface OptaRingProps {
  size?: 48 | 64 | 80 | 120;
  className?: string;
  paused?: boolean;
}

/**
 * Animated Opta Ring — Calm Singularity HD
 * Premium obsidian body with gravity-pulled quantum dust.
 */
export function OptaRing({
  size = 80,
  className,
  paused = false,
}: OptaRingProps) {
  return (
    <div
      className={cn(
        "opta-ring-wrap",
        {
          "opta-ring-48": size === 48,
          "opta-ring-64": size === 64,
          "opta-ring-80": size === 80,
          "opta-ring-120": size === 120,
        },
        className,
      )}
      data-paused={paused}
    >
      <div className="opta-ring-ambient" />
      <div className="opta-ring-scaler">
        <div className="opta-ring-core">
          <div className="opta-singularity" />
          <div className="opta-dust opta-dust-1" />
          <div className="opta-dust opta-dust-2" />
          <div className="opta-dust opta-dust-3" />
        </div>
      </div>
      <div className="opta-ring-body" />
      <div className="opta-ring-rims" />
    </div>
  );
}
