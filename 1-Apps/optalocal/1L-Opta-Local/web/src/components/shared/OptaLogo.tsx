"use client";

import { cn } from "@opta/ui";

interface OptaLogoProps {
  /** Icon size in px. Default 20. Controls the orbit ring icon. */
  size?: number;
  /** Show "OPTA LOCAL" wordmark next to the icon. Default true. */
  showText?: boolean;
  /** Custom class name for the wrapper */
  className?: string;
  /** Legacy scale prop — mapped to size (size = scale * 50) */
  scale?: number;
}

/**
 * Opta Local — brand logo lockup.
 * Orbit ring SVG icon + "OPTA LOCAL" wordmark.
 */
export function OptaLogo({
  size,
  showText = true,
  className,
  scale,
}: OptaLogoProps) {
  const resolvedSize = size ?? (scale != null ? Math.round(scale * 50) : 20);
  const px = Math.max(14, resolvedSize);

  return (
    <div className={cn("flex items-center gap-2 select-none", className)}>
      <svg
        width={px}
        height={px}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="flex-shrink-0"
      >
        <defs>
          <linearGradient id="olg-a" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
          <linearGradient id="olg-b" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#a855f7" stopOpacity="0.5" />
          </linearGradient>
        </defs>
        <circle cx="16" cy="16" r="10.5" stroke="url(#olg-a)" strokeWidth="2" />
        <ellipse
          cx="16" cy="16"
          rx="10.5" ry="3.5"
          stroke="url(#olg-b)"
          strokeWidth="1.5"
          transform="rotate(-25 16 16)"
        />
        <circle cx="16" cy="16" r="2.5" fill="url(#olg-a)" />
      </svg>

      {showText && (
        <span
          className="font-sans font-semibold tracking-[0.08em] leading-none"
          style={{ fontSize: Math.max(11, Math.round(px * 0.7)) }}
        >
          <span className="text-white">OPTA</span>
          <span style={{ color: "#a855f7" }}> LOCAL</span>
        </span>
      )}
    </div>
  );
}
