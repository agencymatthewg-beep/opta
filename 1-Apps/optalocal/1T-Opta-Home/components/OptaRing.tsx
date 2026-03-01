"use client";

import { cn } from "@/lib/utils";

interface OptaRingProps {
  size?: 20 | 24 | 32 | 48 | 64 | 80;
  className?: string;
}

export function OptaRing({ size = 24, className }: OptaRingProps) {
  const px = size;

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("inline-block flex-shrink-0", className)}
    >
      <defs>
        <linearGradient id="olg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
        <linearGradient id="olg2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      {/* Outer ring */}
      <circle cx="16" cy="16" r="10.5" stroke="url(#olg)" strokeWidth="2" />
      {/* Tilted orbit ellipse */}
      <ellipse
        cx="16" cy="16"
        rx="10.5" ry="3.5"
        stroke="url(#olg2)"
        strokeWidth="1.5"
        transform="rotate(-25 16 16)"
      />
      {/* Center dot */}
      <circle cx="16" cy="16" r="2.5" fill="url(#olg)" />
    </svg>
  );
}
