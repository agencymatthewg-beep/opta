import { cn } from '@/lib/utils';
import { OptaRing } from '@/components/OptaRing';

interface OptaLogoProps {
  /** Size of the logomark (ignored for ASCII). Controls spacing. */
  size?: 48 | 64 | 80 | 120 | number;
  /** Custom class name for the wrapper */
  className?: string;
  /** Direction of the lockup */
  layout?: 'horizontal' | 'vertical';
  /** Show the OPTA text */
  showText?: boolean;
  /** Add a subtitle/suffix (e.g. "LOCAL", "ACCOUNTS") */
  suffix?: string;
  /** Pause the ring animations (no-op for ASCII) */
  paused?: boolean;
}

/**
 * Opta Logo Lockup
 * Uses the official Opta ASCII Logo
 */
export function OptaLogo({
  size = 80,
  className,
  layout = 'horizontal',
  showText = true,
  suffix,
  paused = false
}: OptaLogoProps) {
  // Map size to a scale factor for text to roughly match the ring
  const scale = size / 64;

  return (
    <div className={cn(
      "flex",
      layout === 'horizontal' ? 'flex-row items-center gap-4' : 'flex-col items-center justify-center gap-4',
      className
    )}>
      <OptaRing size={size as any} paused={paused} className="shrink-0 pointer-events-none" />

      {showText && (
        <div
          className="flex flex-col items-start justify-center"
          style={{ transform: `scale(${scale})`, transformOrigin: layout === 'horizontal' ? 'left center' : 'center top' }}
        >
          <div className="font-bold tracking-tighter uppercase flex items-center text-opta-primary" style={{ fontSize: '24px', lineHeight: '1', textShadow: '0 0 12px rgba(168, 85, 247, 0.4)' }}>
            OPTA
          </div>

          {suffix && (
            <span className={cn(
              "font-sans font-bold uppercase tracking-[0.2em] leading-none mt-1",
              "text-opta-text-muted",
              "text-[10px]"
            )}>
              {suffix}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
