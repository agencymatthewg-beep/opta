'use client';

import type { ReactNode } from 'react';
import { cn } from '@opta/ui';

type SurfaceHierarchy = 'base' | 'raised' | 'overlay';
type SurfacePadding = 'none' | 'md' | 'lg';

interface OptaSurfaceProps {
  children: ReactNode;
  className?: string;
  hierarchy?: SurfaceHierarchy;
  padding?: SurfacePadding;
}

const hierarchyStyles: Record<SurfaceHierarchy, string> = {
  base: 'border border-opta-border bg-opta-surface/35',
  raised: 'border border-opta-border bg-opta-surface/50 shadow-[0_10px_30px_rgba(0,0,0,0.24)]',
  overlay: 'border border-opta-border/80 bg-opta-surface/70 backdrop-blur-sm',
};

const paddingStyles: Record<SurfacePadding, string> = {
  none: '',
  md: 'p-4',
  lg: 'p-6',
};

export function OptaSurface({
  children,
  className,
  hierarchy = 'base',
  padding = 'md',
}: OptaSurfaceProps) {
  return (
    <section
      className={cn(
        'rounded-xl text-text-primary',
        hierarchyStyles[hierarchy],
        paddingStyles[padding],
        className,
      )}
    >
      {children}
    </section>
  );
}

type OptaStatus = 'success' | 'danger' | 'neutral';

interface OptaStatusPillProps {
  status: OptaStatus;
  label: string;
  icon?: ReactNode;
}

const statusStyles: Record<OptaStatus, string> = {
  success: 'border-neon-green/25 bg-neon-green/10 text-neon-green',
  danger: 'border-neon-red/25 bg-neon-red/10 text-neon-red',
  neutral: 'border-opta-border bg-opta-surface/45 text-text-secondary',
};

export function OptaStatusPill({ status, label, icon }: OptaStatusPillProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs',
        statusStyles[status],
      )}
      role="status"
    >
      {icon}
      <span>{label}</span>
    </div>
  );
}
