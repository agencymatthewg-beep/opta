"use client";

import { cn } from "@/lib/utils";

interface OptaRingProps {
  size?: 24 | 48 | 64 | 80;
  className?: string;
}

export function OptaRing({ size = 24, className }: OptaRingProps) {
  const sizeClass = {
    24: "w-6 h-6",
    48: "w-12 h-12",
    64: "w-16 h-16",
    80: "w-20 h-20",
  }[size];

  return (
    <div className={cn("relative inline-flex items-center justify-center", sizeClass, className)}>
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 via-primary/5 to-transparent animate-opta-breathe blur-xl" />
      <div className="relative rounded-full bg-gradient-to-br from-void via-surface to-elevated border border-white/10 w-full h-full flex items-center justify-center">
        <div className="w-1 h-1 rounded-full bg-primary shadow-[0_0_8px_2px_rgba(168,85,247,0.6)]" />
      </div>
    </div>
  );
}
