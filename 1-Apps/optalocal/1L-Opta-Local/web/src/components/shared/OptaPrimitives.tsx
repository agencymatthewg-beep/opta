import type { HTMLAttributes, ReactNode } from 'react';

type ClassValue = string | null | undefined | false;

function cx(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}

type SurfaceHierarchy = 'base' | 'raised' | 'overlay';
type SurfacePadding = 'none' | 'sm' | 'md' | 'lg';

const SURFACE_HIERARCHY_CLASS: Record<SurfaceHierarchy, string> = {
  base: 'opta-panel--base',
  raised: 'opta-panel--raised',
  overlay: 'opta-panel--overlay',
};

const SURFACE_PADDING_CLASS: Record<SurfacePadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export interface OptaSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  hierarchy?: SurfaceHierarchy;
  framed?: boolean;
  padding?: SurfacePadding;
}

export function OptaSurface({
  className,
  hierarchy = 'base',
  framed = false,
  padding = 'md',
  ...props
}: OptaSurfaceProps) {
  return (
    <div
      className={cx(
        'opta-panel',
        SURFACE_HIERARCHY_CLASS[hierarchy],
        framed && 'opta-section-frame',
        SURFACE_PADDING_CLASS[padding],
        className,
      )}
      {...props}
    />
  );
}

export type OptaStatus = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export interface OptaStatusPillProps extends HTMLAttributes<HTMLSpanElement> {
  label: string;
  status?: OptaStatus;
  icon?: ReactNode;
}

export function OptaStatusPill({
  className,
  label,
  status = 'neutral',
  icon,
  ...props
}: OptaStatusPillProps) {
  return (
    <span
      data-status={status}
      className={cx('opta-status-pill', className)}
      {...props}
    >
      {icon ? (
        <span aria-hidden className="inline-flex h-3.5 w-3.5 items-center justify-center">
          {icon}
        </span>
      ) : null}
      <span>{label}</span>
    </span>
  );
}
