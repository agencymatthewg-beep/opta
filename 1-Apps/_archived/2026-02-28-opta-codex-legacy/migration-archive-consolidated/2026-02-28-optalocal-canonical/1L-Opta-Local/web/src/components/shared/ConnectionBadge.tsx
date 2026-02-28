'use client';

import { cn } from '@opta/ui';

type ConnectionType = 'lan' | 'tunnel' | 'probing';

interface ConnectionBadgeProps {
  type: ConnectionType;
  latencyMs?: number | null;
}

const typeStyles: Record<ConnectionType, string> = {
  lan: 'border-neon-green/30 bg-neon-green/10 text-neon-green',
  tunnel: 'border-neon-cyan/30 bg-neon-cyan/10 text-neon-cyan',
  probing: 'border-neon-amber/30 bg-neon-amber/10 text-neon-amber',
};

const typeLabels: Record<ConnectionType, string> = {
  lan: 'LAN',
  tunnel: 'Tunnel',
  probing: 'Probing',
};

export function ConnectionBadge({ type, latencyMs }: ConnectionBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        typeStyles[type],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden />
      <span>{typeLabels[type]}</span>
      {latencyMs != null ? (
        <span className="font-mono text-[10px] opacity-80">{latencyMs}ms</span>
      ) : null}
    </span>
  );
}
